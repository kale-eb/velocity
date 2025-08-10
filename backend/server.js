/* Marketing App Express Server */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const { OpenAI } = require('openai');

// Load prompts configuration
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const HAS_KEY = !!process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL_CHAT || 'gpt-5';
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mock: !HAS_KEY });
});

// Test endpoint to verify proxy is working
app.get('/api/test', (_req, res) => {
  console.log('[test] Proxy test endpoint hit');
  res.json({ message: 'Proxy is working!', timestamp: new Date().toISOString() });
});

// Proxy health for Python backend
app.get('/api/adBackendHealth', async (_req, res) => {
  try {
    const r = await fetch(`${PY_BACKEND}/health`).then(r => r.json());
    res.json({ ok: true, backend: r });
  } catch (e) {
    res.status(503).json({ ok: false, error: 'PY_BACKEND_UNAVAILABLE', details: String(e) });
  }
});

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
      model: MODEL
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
      console.log(`🤖 [CHAT API CALL] Making request to ${MODEL}... (iteration ${currentIteration + 1})`);
      console.log(`📨 Message count: ${msgs.length}`);
      
      const r = await openai.chat.completions.create({
        model: MODEL,
        messages: msgs,
        tools,
        tool_choice: 'auto',
        reasoning_effort: 'medium'  // Enable reasoning for chat actions (GPT-5)
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
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for GPT-5 processing
    
    const resp = await fetch(`${PY_BACKEND}/analyze-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, content_description }),
      signal: controller.signal
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
    
    res.json(analysisData);
  } catch (e) {
    console.error(`[getAnalysis] Error:`, e);
    res.status(500).json({ error: 'SERVER_ERROR', details: String(e) });
  }
});

const PORT = process.env.EXPRESS_PORT || 5174;
app.listen(PORT, () => console.log(`Marketing App server on :${PORT} (mock=${!HAS_KEY})`));