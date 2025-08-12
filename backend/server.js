/* Marketing App Express Server */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const { OpenAI } = require('openai');
const http = require('http');

// Load prompts configuration
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));

const app = express();

// Configure longer timeouts for video processing
app.use((req, res, next) => {
  // Increase server timeout for video processing endpoints
  if (req.path.includes('analyzeAd')) {
    req.setTimeout(900000); // 15 minutes
    res.setTimeout(900000); // 15 minutes
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const HAS_KEY = !!process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL_CHAT || 'gpt-5';
const CHAT_MODEL = process.env.OPENAI_MODEL_CHAT_ACTIONS || 'gpt-5-mini'; // Use GPT-5 Mini for chat
const PY_BACKEND = process.env.BACKEND_URL || 'http://localhost:8000';

let openai = null;
if (HAS_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function truncate(str, n = 200) {
  if (typeof str !== 'string') return str;
  return str.length > n ? str.slice(0, n) + `…(+${str.length - n})` : str;
}

function summarizeInputs(inputs = {}, adAnalyses = {}) {
  const specLen = (inputs.product_specs || '').length;
  const extraLen = (inputs.extra_instructions || '').length;
  const refs = inputs.ad_refs || [];
  const analysesCount = Object.keys(adAnalyses || {}).length;
  return {
    product_specs_len: specLen,
    extra_instructions_len: extraLen,
    ad_refs: refs,
    ad_analyses_keys: Object.keys(adAnalyses || {}).slice(0, 4),
    ad_analyses_count: analysesCount,
  };
}

function deterministicChunks(inputs) {
  const base = [
    { id: 'c1', type: 'HOOK', script_text: 'Stop scrolling — meet the bottle that keeps up.', camera_instruction: 'Tight face, eye-level, fast cut.' },
    { id: 'c2', type: 'PRODUCT', script_text: '24h cold, 12h hot, leak-proof, fits cup holders.', camera_instruction: 'Product macro on stainless texture.' },
    { id: 'c3', type: 'CTA', script_text: 'Hydrate smarter. Shop now.', camera_instruction: 'Logo + hand placing bottle into gym bag.' }
  ];
  return { id: `s_${Date.now()}`, title: inputs?.title || 'Generated Script', chunks: base };
}

function applyActionsServer(script, actions) {
  let chunks = [...(script.chunks || [])];
  for (const act of actions || []) {
    if (act.type === 'rewrite') {
      chunks = chunks.map(c => c.id === act.targetId ? { ...c, script_text: act.script_text ?? c.script_text, camera_instruction: act.camera_instruction ?? c.camera_instruction } : c);
    } else if (act.type === 'add') {
      const idx = chunks.findIndex(c => c.id === act.targetId);
      const toAdd = act.chunk || { id: `c_${Math.random().toString(36).slice(2, 6)}`, type: 'PRODUCT', script_text: '', camera_instruction: '' };
      if (idx >= 0) {
        if (act.position === 'before') { chunks.splice(idx, 0, toAdd); } else { chunks.splice(idx + 1, 0, toAdd); }
      } else { chunks.push(toAdd); }
    } else if (act.type === 'remove') {
      chunks = chunks.filter(c => c.id !== act.targetId);
    } else if (act.type === 'move') {
      const from = chunks.findIndex(c => c.id === act.targetId);
      const to = chunks.findIndex(c => c.id === act.refId);
      if (from >= 0 && to >= 0) {
        const [m] = chunks.splice(from, 1);
        const insertAt = act.position === 'before' ? to : to + 1;
        chunks.splice(insertAt, 0, m);
      }
    } else if (act.type === 'polish_camera') {
      chunks = chunks.map(c => ({ ...c, camera_instruction: c.camera_instruction || 'Clear, steady framing showing product benefit.' }));
    } else if (act.type === 'rewrite_batch') {
      const edits = Array.isArray(act.edits) ? act.edits : [];
      for (const e of edits) {
        chunks = chunks.map(c => c.id === e.targetId ? { ...c, script_text: e.script_text ?? c.script_text, camera_instruction: e.camera_instruction ?? c.camera_instruction } : c);
      }
    }
  }
  return { ...script, chunks };
}


// Generate script via OpenAI or mock
app.post('/api/generateScript', async (req, res) => {
  try {
    const body = req.body || {};
    const inputs = body.inputs || {};
    const adAnalyses = body.adAnalyses || {};

    console.log('\n🚀 [SCRIPT GENERATION] Starting...');
    console.log('📊 Request Summary:', {
      hasKey: HAS_KEY,
      model: MODEL,
      ...summarizeInputs(inputs, adAnalyses)
    });
    console.log('📝 Full Input Data:', {
      product_specs_length: (inputs.product_specs || '').length,
      extra_instructions_length: (inputs.extra_instructions || '').length,
      ad_refs_count: (inputs.ad_refs || []).length,
      ad_analyses_available: Object.keys(adAnalyses || {}).length
    });
    
    // Detailed logging of what the LLM will receive
    console.log('\n🔍 [DETAILED LLM INPUT] =====================================');
    console.log('📄 Product Specs Content:');
    console.log(inputs.product_specs || '[No product specs provided]');
    console.log('\n📋 Extra Instructions:');
    console.log(inputs.extra_instructions || '[No extra instructions]');
    console.log('\n🎥 Ad References:');
    console.log(inputs.ad_refs || []);
    console.log('\n🎬 Ad Analyses (Full):');
    Object.entries(adAnalyses || {}).forEach(([url, analysis]) => {
      console.log(`\n  URL: ${url}`);
      console.log('  Analysis:', JSON.stringify(analysis, null, 2));
    });
    console.log('============================================================\n');

    if (!HAS_KEY) {
      console.log('[generateScript] mock mode returning deterministic chunks');
      return res.json({ mock: true, script: deterministicChunks(inputs) });
    }

    // Tool definitions for context retrieval
    const tools = Object.values(prompts.tools).map(tool => ({
      type: 'function',
      function: tool
    }));

    const system = prompts.scriptGeneration.system.join('\n');

    const inlineContext = {
      product_specs: truncate(inputs.product_specs || '', 8000),
      extra_instructions: truncate(inputs.extra_instructions || '', 2000),
      ad_refs: inputs.ad_refs || [],
      ad_analyses_inline_samples: Object.fromEntries(
        Object.entries(adAnalyses).slice(0, 2).map(([u, a]) => [u, a])
      )
    };

    const messagesBase = [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({
        note: prompts.scriptGeneration.userNote,
        context_inline: inlineContext
      }) }
    ];
    
    console.log('\n📨 [LLM MESSAGE CONTENT] =====================================');
    console.log('System Prompt:', system);
    console.log('\nUser Message:', JSON.stringify({
      note: prompts.scriptGeneration.userNote,
      context_inline: inlineContext
    }, null, 2));
    console.log('============================================================\n');

    async function callToolsLoop(msgs, modelName) {
      console.log(`🤖 [API CALL] Making request to ${modelName}...`);
      console.log(`📨 Message count: ${msgs.length}`);
      
      const r = await openai.chat.completions.create({
        model: modelName,
        messages: msgs,
        tools,
        tool_choice: 'auto',
        response_format: { type: 'json_object' },
        reasoning_effort: 'medium'  // Enable reasoning for script generation (GPT-5)
      });

      console.log('✅ [API RESPONSE] Received response');
      console.log('📊 Token usage:', r.usage);

      const choice = r.choices?.[0];
      const toolCalls = choice?.message?.tool_calls || [];
      if (toolCalls.length === 0) {
        const txt = choice?.message?.content || '{}';
        console.log(`✅ [SCRIPT GENERATION] Complete - no tool calls needed (response: ${(txt || '').length} chars)\n`);
        return JSON.parse(txt);
      }

      console.log(`\n🔧 [TOOL CALLS] Processing ${toolCalls.length} tool calls:`);
      console.log(`   Tools requested: ${toolCalls.map(tc => tc.function?.name).join(', ')}`);
      
      const followups = [];
      for (const tc of toolCalls) {
        try {
          const fn = tc.function?.name;
          const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
          console.log(`  🛠️ Tool: ${fn}`);
          console.log(`     Args:`, args);
          
          if (fn === 'get_product_specs') {
            const contentLength = (inputs.product_specs || '').length;
            console.log(`     ↳ Returning ${contentLength} characters of product specs`);
            if (contentLength > 0) {
              const preview = (inputs.product_specs || '').substring(0, 100) + '...';
              console.log(`     Preview: "${preview}"`);
            }
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ text: inputs.product_specs || '' }) });
          } else if (fn === 'get_extra_instructions') {
            const contentLength = (inputs.extra_instructions || '').length;
            console.log(`     ↳ Returning ${contentLength} characters of extra instructions`);
            if (contentLength > 0) {
              const preview = (inputs.extra_instructions || '').substring(0, 100) + '...';
              console.log(`     Preview: "${preview}"`);
            }
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ text: inputs.extra_instructions || '' }) });
          } else if (fn === 'get_ad_jsons') {
            const urls = Array.isArray(args.urls) ? args.urls : [];
            console.log(`     ↳ Requested URLs: [${urls.join(', ')}]`);
            const payload = urls.map(u => ({ url: u, analysis: adAnalyses[u] || null }));
            const availableAnalyses = payload.filter(p => p.analysis).length;
            console.log(`     ↳ Returning ${availableAnalyses}/${urls.length} ad analyses`);
            payload.forEach(p => {
              if (p.analysis) {
                console.log(`       ✅ ${p.url}: ${p.analysis.chunks?.length || 0} chunks, ${p.analysis.duration || 0}s`);
              } else {
                console.log(`       ❌ ${p.url}: No analysis available`);
              }
            });
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ items: payload }) });
          } else {
            console.warn(`     ❌ Unknown tool requested: ${fn}`);
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ error: 'UNKNOWN_TOOL' }) });
          }
        } catch (e) {
          console.warn(`     ❌ Error preparing tool response:`, e);
          followups.push({ role: 'tool', tool_call_id: tc.id, name: 'error', content: JSON.stringify({ error: String(e) }) });
        }
      }

      console.log(`🔄 Making follow-up API call with ${followups.length} tool results...\n`);
      return await callToolsLoop([...msgs, choice.message, ...followups], modelName);
    }

    async function runWithFallback() {
      try {
        return await callToolsLoop(messagesBase, MODEL);
      } catch (err) {
        const alt = process.env.OPENAI_MODEL_FALLBACK || 'gpt-4o-mini';
        console.warn('[generateScript] primary model failed (%s). Trying fallback: %s. Error: %s', MODEL, alt, String(err));
        if (MODEL !== alt) {
          try { return await callToolsLoop(messagesBase, alt); } catch (e2) {
            console.error('[generateScript] fallback model also failed:', e2);
          }
        }
        throw err;
      }
    }

    const parsed = await runWithFallback();
    const chunkCount = Array.isArray(parsed?.chunks) ? parsed.chunks.length : 0;
    
    console.log('\n📜 [SCRIPT RESULT]');
    console.log(`📊 Generated script: "${parsed?.title || 'Untitled'}"`)
    console.log(`🎯 Chunks created: ${chunkCount}`);
    if (chunkCount > 0) {
      const chunkTypes = (parsed.chunks || []).reduce((acc, chunk) => {
        acc[chunk.type] = (acc[chunk.type] || 0) + 1;
        return acc;
      }, {});
      console.log('📋 Chunk breakdown:', chunkTypes);
      console.log('📝 Sample chunks:');
      (parsed.chunks || []).slice(0, 3).forEach((chunk, i) => {
        const preview = (chunk.script_text || '').substring(0, 60) + '...';
        console.log(`   ${i + 1}. [${chunk.type}] "${preview}"`);
      });
    }
    console.log('✅ [SCRIPT GENERATION] Complete\n');
    
    return res.json({ mock: false, script: parsed });
  } catch (e) {
    console.error('[generateScript] error:', e);
    res.status(500).json({ error: 'GEN_FAIL' });
  }
});

// Chat actions
app.post('/api/chatActions', async (req, res) => {
  try {
    const { prompt, script, context, chat_history, inputs: requestInputs, adAnalyses } = req.body || {};
    
    console.log('\n💬 [CHAT ACTIONS] Starting...');
    console.log('📊 Request Summary:', {
      prompt_length: (prompt || '').length,
      script_chunks: (script?.chunks || []).length,
      context_keys: context ? Object.keys(context) : [],
      chat_history_msgs: Array.isArray(chat_history) ? chat_history.length : 0,
      model: CHAT_MODEL
    });
    console.log('💭 User Prompt:', `"${(prompt || '').substring(0, 200)}${(prompt || '').length > 200 ? '...' : ''}"`);
    
    if (context?.selectedNodes?.length > 0) {
      console.log('🎯 Selected Context:', {
        nodes: context.selectedNodes.length,
        productSpecs: context.productSpecs ? `${context.productSpecs.length} chars` : 'none',
        extraInstructions: context.extraInstructions ? `${context.extraInstructions.length} chars` : 'none',
        selectedAds: context.selectedAds ? context.selectedAds.length : 0
      });
    }
    
    // Use provided inputs or extract from context
    const inputs = requestInputs || {
      product_specs: context?.productSpecs || '',
      extra_instructions: context?.extraInstructions || '',
      ad_refs: context?.selectedAds || []
    };
    
    if (!prompt || !script) {
      return res.status(400).json({ error: 'BAD_INPUT' });
    }
    
    if (!HAS_KEY) {
      const actions = [];
      if (/rewrite/i.test(prompt) && /c2/i.test(prompt)) {
        actions.push({ type: 'rewrite', targetId: 'c2', script_text: 'Cold or hot, leak-proof — built for your day.' });
      }
      if (/remove c\d+/i.test(prompt)) {
        const id = (prompt.match(/remove (c\d+)/i) || [])[1];
        if (id) actions.push({ type: 'remove', targetId: id });
      }
      console.log('[chatActions] mock actions=%o', actions);
      return res.json({ mock: true, actions });
    }
    
    const sys = prompts.chatActions.system;
    
    const baseMessages = [
      { role: 'system', content: sys },
      ...(Array.isArray(chat_history) ? chat_history.slice(-8) : []),
      { role: 'user', content: JSON.stringify({ prompt, context, script }) }
    ];

    // Add same tools as script generation
    const tools = Object.values(prompts.tools).map(tool => ({
      type: 'function',
      function: tool
    }));

    async function callChatToolsLoop(msgs, maxIterations = 5, currentIteration = 0) {
      console.log(`🤖 [CHAT API CALL] Making request to ${CHAT_MODEL}... (iteration ${currentIteration + 1})`);
      console.log(`📨 Message count: ${msgs.length}`);
      
      const r = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: msgs,
        tools,
        tool_choice: 'auto',
        reasoning_effort: 'medium'  // Enable reasoning for chat actions (GPT-5 Mini)
      });

      console.log('✅ [CHAT API RESPONSE] Received response');
      console.log('📊 Token usage:', r.usage);

      const choice = r.choices?.[0];
      if (!choice) throw new Error('No response choice');

      const message = choice.message;
      console.log('💭 Response content length:', (message.content || '').length);
      
      // Handle tool calls if present
      if (message.tool_calls?.length > 0) {
        console.log(`\n🔧 [CHAT TOOL CALLS] Processing ${message.tool_calls.length} tool calls:`);
        const followups = [{ role: 'assistant', content: message.content, tool_calls: message.tool_calls }];
        let hasScriptEditingTools = false;
        let collectedActions = [];
        
        for (const tc of message.tool_calls) {
          const fn = tc.function?.name;
          const args = JSON.parse(tc.function?.arguments || '{}');
          console.log(`  🛠️ Chat Tool: ${fn}`);
          console.log(`     Args:`, args);
          
          if (fn === 'get_product_specs') {
            const contentLength = (inputs.product_specs || '').length;
            console.log(`     ↳ Returning ${contentLength} characters of product specs`);
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ text: inputs.product_specs || '' }) });
          } else if (fn === 'get_extra_instructions') {
            const contentLength = (inputs.extra_instructions || '').length;
            console.log(`     ↳ Returning ${contentLength} characters of extra instructions`);
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ text: inputs.extra_instructions || '' }) });
          } else if (fn === 'get_ad_jsons') {
            const urls = Array.isArray(args.urls) ? args.urls : [];
            console.log(`     ↳ Requested URLs: [${urls.join(', ')}]`);
            const payload = urls.map(u => ({ url: u, analysis: adAnalyses[u] || null }));
            const availableAnalyses = payload.filter(p => p.analysis).length;
            console.log(`     ↳ Returning ${availableAnalyses}/${urls.length} ad analyses`);
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ items: payload }) });
          } else if (['rewrite_chunk', 'add_chunk', 'remove_chunk', 'move_chunk', 'rewrite_chunks_batch', 'add_chunks_batch', 'remove_chunks_batch', 'move_chunks_batch'].includes(fn)) {
            // Handle script editing tools - these will be collected for final response
            console.log(`     ↳ Converting ${fn} tool call to action`);
            hasScriptEditingTools = true;
            let action;
            
            if (fn === 'rewrite_chunk') {
              action = { type: 'rewrite', targetId: args.targetId };
              if (args.script_text !== undefined) action.script_text = args.script_text;
              if (args.camera_instruction !== undefined) action.camera_instruction = args.camera_instruction;
            } else if (fn === 'add_chunk') {
              action = { type: 'add', position: args.position, targetId: args.targetId, chunk: args.chunk };
            } else if (fn === 'remove_chunk') {
              action = { type: 'remove', targetId: args.targetId };
            } else if (fn === 'move_chunk') {
              action = { type: 'move', targetId: args.targetId, position: args.position, refId: args.refId };
            } else if (fn === 'rewrite_chunks_batch') {
              action = { type: 'rewrite_batch', edits: args.edits };
            } else if (fn === 'add_chunks_batch') {
              action = { type: 'add_batch', items: args.items };
            } else if (fn === 'remove_chunks_batch') {
              action = { type: 'remove_batch', targetIds: args.targetIds };
            } else if (fn === 'move_chunks_batch') {
              action = { type: 'move_batch', moves: args.moves };
            }
            
            collectedActions.push(action);
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ success: true, action_prepared: true }) });
          } else {
            console.warn(`     ❌ Unknown chat tool requested: ${fn}`);
            followups.push({ role: 'tool', tool_call_id: tc.id, name: fn, content: JSON.stringify({ error: 'UNKNOWN_TOOL' }) });
          }
        }
        
        // If we have script editing tools, this is the final step - return the actions
        if (hasScriptEditingTools) {
          console.log(`🎯 [FINAL ACTIONS] Collected ${collectedActions.length} script editing actions - stopping iteration`);
          return {
            content: message.content,
            proposedActions: collectedActions
          };
        }
        
        // If no script editing tools and we haven't hit max iterations, continue the conversation
        if (currentIteration < maxIterations - 1) {
          console.log(`🔄 Making chat follow-up API call with ${followups.length} tool results... (continuing chain)`);
          const result = await callChatToolsLoop([...msgs, ...followups], maxIterations, currentIteration + 1);
          return result;
        } else {
          console.log(`⚠️ [MAX ITERATIONS] Reached maximum iterations (${maxIterations}), stopping`);
          return {
            content: message.content,
            proposedActions: []
          };
        }
      }

      console.log('✅ [CHAT ACTIONS] Complete - no tool calls needed\n');
      return choice.message;
    }

    const finalMessage = await callChatToolsLoop(baseMessages);
    
    // Use collected actions from tool calls if available, otherwise parse from content
    let actions = finalMessage?.proposedActions || [];
    let explanation = finalMessage?.content || 'Here are the changes I propose:';
    
    // If no tool-based actions, try to parse from JSON content (legacy format)
    if (actions.length === 0) {
      try {
        const parsed = JSON.parse(finalMessage?.content || '{}');
        actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
        explanation = parsed?.explanation || explanation;
      } catch (e) {
        console.warn('Failed to parse JSON content, using tool-based actions only');
      }
    }
    
    console.log('\n📋 [CHAT RESULT]');
    console.log('📝 Explanation:', explanation);
    console.log(`🎯 Actions generated: ${actions.length}`);
    actions.forEach((action, i) => {
      console.log(`   ${i + 1}. ${action.type} - ${action.targetId || 'N/A'}`);
    });
    console.log('✅ [CHAT ACTIONS] Complete\n');
    
    res.json({ mock: false, explanation, actions });
  } catch (e) {
    console.error('[chatActions] error:', e);
    res.status(500).json({ error: 'CHAT_FAIL' });
  }
});

// Process file via Python backend
app.post('/api/process-file', upload.single('file'), async (req, res) => {
  try {
    console.log(`[processFile] Received request:`, {
      hasFile: !!req.file,
      bodyKeys: Object.keys(req.body || {}),
      contentType: req.headers['content-type']
    });
    
    if (!req.file) {
      console.log(`[processFile] No file received in request`);
      return res.status(400).json({ error: 'BAD_INPUT', message: 'file required' });
    }
    
    console.log(`[processFile] Processing: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);
    console.log(`[processFile] Buffer info:`, {
      isBuffer: Buffer.isBuffer(req.file.buffer),
      bufferLength: req.file.buffer.length,
      first50Bytes: req.file.buffer.subarray(0, 50)
    });
    
    // Send raw PDF bytes to avoid multipart parsing issues
    console.log(`[processFile] Sending raw PDF to Python backend: ${PY_BACKEND}/process-pdf-raw`);
    
    const resp = await fetch(`${PY_BACKEND}/process-pdf-raw`, {
      method: 'POST',
      body: req.file.buffer,
      headers: {
        'Content-Type': 'application/pdf',
        'X-Filename': req.file.originalname,
        'Content-Length': req.file.size.toString()
      }
    });
    
    const data = await resp.json();
    console.log(`[processFile] Response status: ${resp.status}, success: ${data.success}, content length: ${data.content?.length || 0}`);
    
    if (!resp.ok) return res.status(resp.status).json(data);
    res.json(data);
  } catch (e) {
    console.error(`[processFile] Error:`, e);
    res.status(502).json({ ok: false, error: 'FILE_PROCESSING_PROXY_FAIL', details: String(e) });
  }
});

// Analyze advertisement via Python backend
app.post('/api/analyzeAd', async (req, res) => {
  try {
    const { url, content_description } = req.body || {};
    if (!url) return res.status(400).json({ error: 'BAD_INPUT', message: 'url required' });
    
    console.log(`[analyzeAd] Requesting: ${url}`);
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minute timeout for GPT-5 processing
    
    // Use custom HTTP request instead of fetch to avoid Node.js fetch timeout issues
    const resp = await new Promise((resolve, reject) => {
      const requestData = JSON.stringify({ url, content_description });
      
      const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/analyze-ad',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
          'Connection': 'keep-alive'
        },
        timeout: 900000, // 15 minutes
        agent: false // Don't use connection pooling
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              json: () => Promise.resolve(jsonData)
            });
          } catch (parseError) {
            resolve({
              ok: false,
              status: res.statusCode,
              json: () => Promise.resolve({ error: 'JSON parse error', details: parseError.message })
            });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      // Handle AbortController signal
      controller.signal.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('Request aborted'));
      });

      req.write(requestData);
      req.end();
    });
    
    clearTimeout(timeoutId);
    
    const data = await resp.json();
    console.log(`[analyzeAd] Response status: ${resp.status}, data:`, data);
    
    if (!resp.ok) return res.status(resp.status).json(data);
    res.json({ ok: true, analysis: data });
  } catch (e) {
    console.error(`[analyzeAd] Error:`, e);
    
    if (e.name === 'AbortError') {
      return res.status(408).json({ 
        ok: false, 
        error: 'TIMEOUT', 
        message: 'Video processing timed out after 5 minutes'
      });
    }
    
    res.status(502).json({ ok: false, error: 'PY_BACKEND_PROXY_FAIL', details: String(e) });
  }
});

// Get existing analysis data from video processing output
app.post('/api/getAnalysis', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'BAD_INPUT', message: 'url required' });
    
    console.log(`[getAnalysis] Looking for existing analysis for: ${url}`);
    
    // Create safe folder name from URL (matches backend video processing logic)
    const safeName = url.replace("https://", "").replace("http://", "")
      .replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 50);
    
    const analysisPath = path.join(__dirname, 'video_outputs', safeName, 'analysis.json');
    
    console.log(`[getAnalysis] Checking path: ${analysisPath}`);
    
    if (!fs.existsSync(analysisPath)) {
      console.log(`[getAnalysis] No analysis found at: ${analysisPath}`);
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Analysis not found for this URL' });
    }
    
    const analysisData = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    console.log(`[getAnalysis] Found analysis with ${analysisData.chunks?.length || 0} chunks`);
    
    res.json({ analysis: analysisData });
  } catch (e) {
    console.error(`[getAnalysis] Error:`, e);
    res.status(500).json({ error: 'SERVER_ERROR', details: String(e) });
  }
});

// Streaming Chat Endpoint with Agentic Behavior
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { prompt, workspaceNodes = [], script, chatHistory = [] } = req.body || {};
    
    console.log('\n🚀 [STREAMING CHAT] Starting agentic conversation...');
    console.log('📊 Request Summary:', {
      prompt_length: (prompt || '').length,
      workspace_nodes: workspaceNodes.length,
      script_chunks: script?.chunks?.length || 0,
      chat_history: chatHistory.length,
      model: CHAT_MODEL
    });
    
    if (!prompt) {
      return res.status(400).json({ error: 'BAD_INPUT', message: 'prompt required' });
    }
    
    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    if (!HAS_KEY) {
      res.write(`data: ${JSON.stringify({type: "thinking", content: "Mock mode: Analyzing your request..."})}\n\n`);
      res.write(`data: ${JSON.stringify({type: "tool_status", content: "🔧 Reading script content"})}\n\n`);
      res.write(`data: ${JSON.stringify({type: "content", content: "I would help you improve your script, but I'm in mock mode. Please add your OpenAI API key to enable real functionality."})}\n\n`);
      res.write(`data: ${JSON.stringify({type: "done"})}\n\n`);
      return res.end();
    }
    
    // Content access tools for workspace nodes
    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_workspace_content',
          description: 'Access content from workspace nodes (product specs, ads, instructions)',
          parameters: {
            type: 'object',
            properties: {
              node_types: {
                type: 'array',
                items: { type: 'string', enum: ['productSpec', 'ad', 'instructions'] },
                description: 'Types of nodes to retrieve content from'
              }
            },
            required: ['node_types']
          }
        }
      },
      {
        type: 'function', 
        function: {
          name: 'get_script_content',
          description: 'Read the current script chunks and their content',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'suggest_script_changes',
          description: 'Propose specific changes to script chunks with reasoning',
          parameters: {
            type: 'object',
            properties: {
              explanation: { type: 'string', description: 'Explanation of the changes being made' },
              actions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['rewrite', 'add', 'remove', 'move'], description: 'Type of action' },
                    targetId: { type: 'string', description: 'ID of chunk to target' },
                    script_text: { type: 'string', description: 'New script text for rewrite actions' },
                    camera_instruction: { type: 'string', description: 'New camera instruction for rewrite actions' },
                    position: { type: 'string', enum: ['before', 'after'], description: 'Position for add/move actions' },
                    refId: { type: 'string', description: 'Reference chunk ID for move actions' },
                    chunk: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        type: { type: 'string', enum: ['HOOK', 'PRODUCT', 'CTA'] },
                        script_text: { type: 'string' },
                        camera_instruction: { type: 'string' }
                      },
                      description: 'New chunk data for add actions'
                    }
                  },
                  required: ['type', 'targetId']
                }
              }
            },
            required: ['explanation', 'actions']
          }
        }
      }
    ];
    
    // Use configured chat system prompt with streaming enhancements
    const systemPrompt = prompts.chatActions.system + `\n\nSTREAMING BEHAVIOR:
- You have access to workspace content via tools
- Always use tools to access current context before making suggestions
- Show your analysis as you work through the user's request
- Be a helpful creative partner who understands video as a visual medium
- Each chunk = one shot = one video file in the editing system`;
    
    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-6), // Keep recent history
      { role: 'user', content: prompt }
    ];
    
    console.log('🤖 Starting agentic conversation loop...');
    
    // Agentic conversation loop - continue until agent determines it's done
    let conversationMessages = [...messages];
    let iterationCount = 0;
    const maxIterations = 5; // Reduced safety limit
    let announcedTools = new Set(); // Track announced tools across ALL iterations to prevent duplicates
    
    while (iterationCount < maxIterations) {
      iterationCount++;
      console.log(`\n🔄 Agentic iteration ${iterationCount}...`);
      
      // No fake thinking simulation - just show spinner UI
      
      try {
        const stream = await openai.chat.completions.create({
          model: CHAT_MODEL,
          messages: conversationMessages,
          tools,
          tool_choice: 'auto',
          stream: true,
          temperature: 1,
          reasoning_effort: 'medium', // Internal reasoning (not streamed)
          stream_options: { include_usage: true }
        });
        
        let assistantMessage = { role: 'assistant', content: '', tool_calls: [] };
        
        // Process streaming response
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          
          // OpenAI reasoning tokens are consumed internally but not streamed
          // UI shows spinner while processing, no fake thinking simulation
          
          // Stream content as it comes
          if (delta?.content) {
            assistantMessage.content += delta.content;
            res.write(`data: ${JSON.stringify({
              type: "content", 
              content: delta.content
            })}\n\n`);
          }
          
          // Handle tool calls
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              if (toolCall.index !== undefined) {
                // Initialize tool call if needed
                if (!assistantMessage.tool_calls[toolCall.index]) {
                  assistantMessage.tool_calls[toolCall.index] = {
                    id: toolCall.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' }
                  };
                }
                
                const tc = assistantMessage.tool_calls[toolCall.index];
                
                // Build tool name incrementally
                if (toolCall.function?.name) {
                  tc.function.name += toolCall.function.name;
                }
                
                // Build arguments incrementally
                if (toolCall.function?.arguments) {
                  tc.function.arguments += toolCall.function.arguments;
                }
                
                // Set ID if provided
                if (toolCall.id) {
                  tc.id = toolCall.id;
                }
                
                // Announce tool when name is complete and not already announced
                if (tc.function.name && !announcedTools.has(tc.function.name)) {
                  announcedTools.add(tc.function.name);
                  
                  const displayName = tc.function.name === 'get_workspace_content' ? 'Reading workspace content' : 
                                     tc.function.name === 'get_script_content' ? 'Analyzing current script' :
                                     tc.function.name === 'suggest_script_changes' ? 'Preparing script suggestions' : tc.function.name;
                  
                  res.write(`data: ${JSON.stringify({
                    type: "tool_status", 
                    content: `🔧 ${displayName}`
                  })}\n\n`);
                  
                  // No fake thinking messages - just show tool status
                }
              }
            }
          }
        }
        
        // Handle tool calls
        if (assistantMessage.tool_calls.length > 0) {
          console.log(`🔧 Processing ${assistantMessage.tool_calls.length} tool calls`);
          conversationMessages.push(assistantMessage);
          
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
            
            console.log(`  🛠️ Executing tool: ${toolName}`);
            // Don't send tool status here - already sent during streaming
            
            let toolResult = '';
            
            if (toolName === 'get_workspace_content') {
              const nodeTypes = toolArgs.node_types || [];
              const relevantNodes = workspaceNodes.filter(node => nodeTypes.includes(node.type));
              const content = relevantNodes.map(node => ({
                type: node.type,
                id: node.id,
                data: node.data
              }));
              toolResult = JSON.stringify({ nodes: content });
              
            } else if (toolName === 'get_script_content') {
              toolResult = JSON.stringify({
                script: script || null,
                chunks: script?.chunks || []
              });
              
            } else if (toolName === 'suggest_script_changes') {
              // Extract actions and explanation from the tool arguments
              const actions = toolArgs.actions || [];
              const explanation = toolArgs.explanation || 'Here are the suggested changes:';
              
              console.log(`     ↳ Suggesting ${actions.length} script changes`);
              actions.forEach((action, idx) => {
                console.log(`       ${idx + 1}. ${action.type} ${action.targetId}`)
              });
              
              toolResult = JSON.stringify({
                status: 'suggestions_prepared',
                explanation: explanation,
                actions: actions
              });
              
              // Stream the final suggestions to the user
              res.write(`data: ${JSON.stringify({
                type: "suggestions",
                content: {
                  explanation: explanation,
                  actions: actions
                }
              })}\n\n`);
            }
            
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: toolResult
            });
          }
          
          // Check if we made script suggestions - if so, we're done
          const hasSuggestions = assistantMessage.tool_calls.some(tc => tc.function.name === 'suggest_script_changes');
          if (hasSuggestions) {
            console.log('✅ Agent completed task with script suggestions');
            break; // Exit the while loop completely
          }
          
          // If no suggestions, continue the agentic loop
          continue;
        }
        
        // If we have final content without tool calls, we're done
        if (assistantMessage.content && assistantMessage.tool_calls.length === 0) {
          console.log('✅ Agent completed task with final response');
          break;
        }
        
        // If no content and no tool calls, something's wrong - break
        if (!assistantMessage.content && assistantMessage.tool_calls.length === 0) {
          console.log('⚠️ No content or tool calls - ending conversation');
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error in iteration ${iterationCount}:`, error);
        res.write(`data: ${JSON.stringify({
          type: "error", 
          content: `Error: ${error.message}`
        })}\n\n`);
        break;
      }
    }
    
    if (iterationCount >= maxIterations) {
      console.log(`⚠️ Reached maximum iterations (${maxIterations}) - stopping for safety`);
    }
    
    console.log('✅ Agentic conversation complete');
    res.write(`data: ${JSON.stringify({type: "done"})}\n\n`);
    res.end();
    
  } catch (error) {
    console.error('[streaming chat] error:', error);
    res.write(`data: ${JSON.stringify({
      type: "error", 
      content: `Server error: ${error.message}`
    })}\n\n`);
    res.end();
  }
});

const PORT = process.env.EXPRESS_PORT || 5174;
app.listen(PORT, () => console.log(`Marketing App server on :${PORT} (mock=${!HAS_KEY})`));