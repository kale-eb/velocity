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
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'config/prompts.json'), 'utf8'));

// Load new tools system
const tools = require('./tools');

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

function deterministicSections(inputs) {
  const sections = [
    { 
      id: 'sec1', 
      type: 'HOOK', 
      script_text: 'Stop scrolling — meet the bottle that keeps up with your lifestyle.', 
      video_type: 'JUMP_CUTS',
      shots: [
        { camera: 'Tight face shot, eye level', portion: 'Stop scrolling —' },
        { camera: 'Quick zoom on bottle', portion: 'meet the bottle that keeps up with your lifestyle.' }
      ],
      source: 'single_video'
    },
    { 
      id: 'sec2', 
      type: 'BODY', 
      script_text: '24 hours cold, 12 hours hot, completely leak-proof and fits any cup holder.', 
      video_type: 'B_ROLL',
      shots: [
        { camera: 'Product macro on stainless texture', portion: '24 hours cold, 12 hours hot,' },
        { camera: 'Testing leak-proof seal', portion: 'completely leak-proof' },
        { camera: 'Bottle sliding into car cup holder', portion: 'and fits any cup holder.' }
      ],
      source: 'multiple_videos'
    },
    { 
      id: 'sec3', 
      type: 'CTA', 
      script_text: 'Hydrate smarter. Shop now and upgrade your hydration game.', 
      video_type: 'A_ROLL_WITH_OVERLAY',
      base_layer: { camera: 'Person holding bottle, direct to camera', extends_full_section: true },
      overlay_shots: [
        { camera: 'Logo animation with website URL', portion: 'Shop now', start_time: '50%' }
      ]
    }
  ];
  return { id: `s_${Date.now()}`, title: inputs?.title || 'Generated Script', sections };
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
      console.log('[generateScript] mock mode returning deterministic sections');
      return res.json({ mock: true, script: deterministicSections(inputs) });
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
    
    // Support both new sections format and legacy chunks format
    const sectionCount = Array.isArray(parsed?.sections) ? parsed.sections.length : 0;
    const chunkCount = Array.isArray(parsed?.chunks) ? parsed.chunks.length : 0;
    const isNewFormat = sectionCount > 0;
    
    console.log('\n📜 [SCRIPT RESULT]');
    console.log(`📊 Generated script: "${parsed?.title || 'Untitled'}"`)
    
    if (isNewFormat) {
      console.log(`🎯 Sections created: ${sectionCount}`);
      
      // Count total shots across all sections
      const totalShots = parsed.sections.reduce((total, section) => {
        const shots = section.shots?.length || 0;
        const overlays = section.overlay_shots?.length || 0;
        return total + shots + overlays + (section.base_layer ? 1 : 0);
      }, 0);
      console.log(`📸 Total shots: ${totalShots}`);
      
      // Break down by video type
      const videoTypes = (parsed.sections || []).reduce((acc, section) => {
        acc[section.video_type] = (acc[section.video_type] || 0) + 1;
        return acc;
      }, {});
      console.log('🎬 Video type breakdown:', videoTypes);
      
      // DETAILED SECTION ANALYSIS
      console.log('\n📝 DETAILED SECTION ANALYSIS:');
      console.log('==========================================');
      parsed.sections.forEach((section, idx) => {
        const sectionShots = section.shots?.length || 0;
        const overlayShots = section.overlay_shots?.length || 0;
        const baseLayer = section.base_layer ? 1 : 0;
        const sectionTotal = sectionShots + overlayShots + baseLayer;
        
        console.log(`\n${idx + 1}. Section: ${section.id}`);
        console.log(`   Type: ${section.type} | Video Type: ${section.video_type}`);
        console.log(`   Script: "${section.script_text || 'EMPTY SCRIPT TEXT'}"`);
        console.log(`   Total Shots: ${sectionTotal}`);
        
        if (section.shots?.length > 0) {
          console.log(`   Regular Shots (${section.shots.length}):`);
          section.shots.forEach((shot, shotIdx) => {
            console.log(`     ${shotIdx + 1}. Camera: "${shot.camera || 'EMPTY'}" | Portion: "${shot.portion || 'EMPTY'}"`);
          });
        } else {
          console.log(`   ❌ NO REGULAR SHOTS`);
        }
        
        if (section.overlay_shots?.length > 0) {
          console.log(`   Overlay Shots (${section.overlay_shots.length}):`);
          section.overlay_shots.forEach((shot, shotIdx) => {
            console.log(`     ${shotIdx + 1}. Camera: "${shot.camera || 'EMPTY'}" | Portion: "${shot.portion || 'EMPTY'}" | Start: ${shot.start_time || 'N/A'}`);
          });
        }
        
        if (section.base_layer) {
          console.log(`   Base Layer: "${section.base_layer.camera || 'EMPTY'}" | Full Section: ${section.base_layer.extends_full_section || false}`);
        }
        
        // Validation warnings
        if (sectionTotal === 0) {
          console.log(`   🚨 WARNING: NO SHOTS FOUND IN THIS SECTION!`);
        }
        if (!section.script_text || section.script_text.trim() === '') {
          console.log(`   🚨 WARNING: EMPTY SCRIPT TEXT!`);
        }
      });
      
      console.log('==========================================\n');
      
      // Overall validation - sections must have at least one shot
      const emptySections = parsed.sections.filter(s => 
        (!s.shots || s.shots.length === 0) && 
        (!s.overlay_shots || s.overlay_shots.length === 0) && 
        !s.base_layer
      );
      
      if (emptySections.length > 0) {
        console.log(`❌ SCRIPT VALIDATION FAILED: ${emptySections.length}/${sectionCount} sections have NO SHOTS:`);
        emptySections.forEach(s => console.log(`   - ${s.id} (${s.type}/${s.video_type}): "${s.script_text?.substring(0, 40)}..."`));
      } else {
        console.log(`✅ SCRIPT VALIDATION PASSED: All ${sectionCount} sections have shots`);
      }
    } else {
      // Legacy format
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
      script_sections: script?.sections?.length || 0,
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
          } else if (['rewrite_section', 'add_section', 'remove_section', 'move_section', 'rewrite_sections_batch', 'add_sections_batch', 'remove_sections_batch', 'move_sections_batch'].includes(fn)) {
            // Handle script editing tools - these will be collected for final response
            console.log(`     ↳ Converting ${fn} tool call to action`);
            hasScriptEditingTools = true;
            let action;
            
            if (fn === 'rewrite_section') {
              action = { type: 'rewrite_section', targetId: args.targetId };
              if (args.script_text !== undefined) action.script_text = args.script_text;
              if (args.shots !== undefined) action.shots = args.shots;
            } else if (fn === 'add_section') {
              action = { type: 'add_section', position: args.position, targetId: args.targetId, section: args.section };
            } else if (fn === 'remove_section') {
              action = { type: 'remove_section', targetId: args.targetId };
            } else if (fn === 'move_section') {
              action = { type: 'move_section', targetId: args.targetId, position: args.position, refId: args.refId };
            } else if (fn === 'rewrite_sections_batch') {
              action = { type: 'rewrite_sections_batch', edits: args.edits };
            } else if (fn === 'add_sections_batch') {
              action = { type: 'add_sections_batch', items: args.items };
            } else if (fn === 'remove_sections_batch') {
              action = { type: 'remove_sections_batch', targetIds: args.targetIds };
            } else if (fn === 'move_sections_batch') {
              action = { type: 'move_sections_batch', moves: args.moves };
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

// Responses API Endpoint with Tool-Based Reference System
app.post('/api/chat/responses', async (req, res) => {
  try {
    const { prompt, selectedReferences = [], script, chatHistory = [], previousResponseId, previousToolOutputs = [] } = req.body || {};
    
    console.log('\n🚀 [RESPONSES API] Starting...');
    console.log('📊 Request Summary:', {
      prompt_length: (prompt || '').length,
      selected_references: selectedReferences.length,
      script_sections: script?.sections?.length || 0,
      chat_history: chatHistory.length,
      has_previous_response: !!previousResponseId,
      has_tool_outputs: previousToolOutputs.length,
      model: CHAT_MODEL
    });
    
    if (!HAS_KEY) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      
      res.write(`data: ${JSON.stringify({type: "content", content: prompts.mock_responses.responses_api_mock})}\n\n`);
      res.write(`data: ${JSON.stringify({type: "done", response_id: "mock_response_123"})}\n\n`);
      return res.end();
    }
    
    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Use smart tool loading from new tools system
    const { tools: loadedTools, categories, reasoning } = tools.getSmartTools(
      prompt,
      'responses',
      { selectedReferences, script, chatHistory }
    );
    
    console.log('🔧 Tool loading reasoning:', reasoning);
    console.log('🛠️ Loaded tools:', JSON.stringify(loadedTools, null, 2));
    
    // Build minimal system prompt with tool-based instruction loading
    let systemPrompt = prompts.base_system.core + prompts.base_system.tool_aware_extension.replace(
      '{{selectedReferences}}', 
      selectedReferences.length > 0 ? selectedReferences.join(', ') : 'none'
    );

    // Build input for Responses API - always include full context
    const input = [{
      role: "system",
      content: systemPrompt
    }];
    
    // Add recent chat history for context
    if (chatHistory.length > 0) {
      chatHistory.slice(-6).forEach(msg => {
        input.push({
          role: msg.role,
          content: msg.content
        });
      });
    }
    
    // Add current user message
    let inputContent = prompt;
    if (selectedReferences.length > 0) {
      inputContent += `\n\nNote: Please pay special attention to these selected references: ${selectedReferences.join(', ')}`;
    }
    
    input.push({
      role: "user",
      content: inputContent
    });
    
    console.log('🤖 Creating Responses API call...');
    
    try {
      // Build API request with proper continuation support
      const apiRequest = {
        model: CHAT_MODEL, // gpt-5-mini
        input: input,
        tools: loadedTools,
        stream: true
      };
      
      // Add previous response context if available
      if (previousResponseId && previousToolOutputs.length > 0) {
        apiRequest.previous_response_id = previousResponseId;
        apiRequest.tool_outputs = previousToolOutputs;
      } else if (previousResponseId) {
        // If we have a previous response but no tool outputs, skip the previous_response_id
        // to avoid the "No tool output found" error
        console.log('⚠️ Skipping previous_response_id due to missing tool outputs');
      }
      
      const response = await openai.responses.create(apiRequest);
      
      let assistantMessage = { role: 'assistant', content: '', tool_calls: [] };
      let announcedTools = new Set();
      let finalActions = [];
      let responseId = null;
      
      // Process streaming response
      let currentToolCall = null;
      let toolCallArgs = '';
      let toolOutputs = []; // Store tool outputs for potential continuation
      let hasStreamedContent = false; // Track if we've already sent content
      
      for await (const chunk of response) {
        // Minimal logging for non-delta chunks
        if (!chunk.type.includes('delta') && chunk.type === 'response.created') {
          console.log('🚀 Responses API started');
        }
        
        // Handle different chunk types from Responses API
        if (chunk.type === 'response.output_item.added') {
          // New output item (could be text or tool call)
          if (chunk.item?.type === 'function_call') {
            // Extract the tool name - it's in chunk.item.name
            const toolName = chunk.item.name;
            console.log('🔨 Starting tool call:', toolName);
            
            currentToolCall = {
              id: chunk.item.call_id || chunk.item.id, // Try call_id first, fallback to id
              type: 'function',
              function: {
                name: toolName,
                arguments: ''
              }
            };
            
            // Only announce if we have a valid tool name
            if (toolName) {
              const displayName = tools.getDisplayName(toolName);
              res.write(`data: ${JSON.stringify({
                type: "tool_status", 
                content: `🔧 ${displayName}`
              })}\n\n`);
            }
          } else if (chunk.item?.type === 'message') {
            // Message output item - might contain content
            console.log('📝 Message item added');
          }
          
        } else if (chunk.type === 'response.function_call_arguments.delta') {
          // Building tool call arguments
          if (currentToolCall && chunk.delta) {
            toolCallArgs += chunk.delta;
          }
          
        } else if (chunk.type === 'response.function_call_arguments.done') {
          // Tool call arguments complete - only execute once!
          if (currentToolCall && toolCallArgs) {
            console.log('🔧 Executing tool:', currentToolCall.function.name, 'with args:', toolCallArgs);
            
            // Execute tool ONCE
            try {
              const toolArgs = JSON.parse(toolCallArgs);
              const context = {
                workspaceNodes: req.body.workspaceNodes || [],
                script: script,
                prompts: prompts
              };
              
              const result = tools.execute(currentToolCall.function.name, toolArgs, context);
              console.log('📊 Tool result:', JSON.stringify(result).substring(0, 200));
              
              // Store tool output for potential future use - make sure we use the right call ID
              console.log('🔗 Storing tool output for call_id:', currentToolCall.id);
              toolOutputs.push({
                tool_call_id: currentToolCall.id,
                tool_name: currentToolCall.function.name,
                output: JSON.stringify(result)
              });
              
              // Handle suggest_script_changes specially
              if (currentToolCall.function.name === 'suggest_script_changes' && result.actions) {
                finalActions = result.actions;
                
                res.write(`data: ${JSON.stringify({
                  type: "suggestions",
                  content: {
                    explanation: result.explanation,
                    actions: result.actions
                  }
                })}\n\n`);
              } else {
                // Don't send tool results as content - let the AI process them
                // The AI will generate its own response based on the tool results
                console.log('Tool executed, awaiting AI response...');
              }
              
            } catch (error) {
              console.error(`Tool execution error:`, error);
              res.write(`data: ${JSON.stringify({
                type: "content",
                content: `Error executing tool: ${error.message}`
              })}\n\n`);
            }
            
            // Reset for next tool
            currentToolCall = null;
            toolCallArgs = '';
          }
          
        } else if (chunk.type === 'response.content.delta' || chunk.type === 'response.output_text.delta') {
          // Text content (handle both possible chunk types)
          const content = chunk.delta || chunk.content;
          if (content) {
            hasStreamedContent = true; // Mark that we've sent content
            res.write(`data: ${JSON.stringify({
              type: "content", 
              content: content
            })}\n\n`);
          }
          
        } else if (chunk.type === 'response.completed') {
          responseId = chunk.response?.id;
          console.log(`✅ Responses API complete with ID: ${responseId}`);
          
          // Debug: log the response structure
          console.log('🔍 Response output structure:');
          if (chunk.response?.output) {
            chunk.response.output.forEach((item, i) => {
              console.log(`  [${i}] type: ${item.type}, content length: ${item.content?.length || 0}`);
              if (item.content) {
                item.content.forEach((c, j) => {
                  console.log(`    [${j}] content type: ${c.type}, text length: ${c.text?.length || 0}`);
                  if (c.text) console.log(`        text preview: "${c.text.substring(0, 100)}..."`);
                });
              }
            });
          }
          console.log(`🏁 hasStreamedContent: ${hasStreamedContent}`);
          
          // Extract content from completed response ONLY if we haven't streamed any yet
          let foundTextContent = false;
          if (!hasStreamedContent && chunk.response?.output) {
            for (const outputItem of chunk.response.output) {
              if (outputItem.type === 'message' && outputItem.content) {
                for (const contentPart of outputItem.content) {
                  if (contentPart.type === 'output_text' && contentPart.text) {
                    console.log('📤 Sending final content:', contentPart.text.substring(0, 100));
                    res.write(`data: ${JSON.stringify({
                      type: "content", 
                      content: contentPart.text
                    })}\n\n`);
                    foundTextContent = true;
                  }
                }
              }
            }
          }
          
          // If no text content was found but tools were executed, make a continuation call
          // Unless suggest_script_changes was called (it provides complete response via suggestions)
          const calledSuggestScriptChanges = toolOutputs.some(t => 
            t.tool_name === 'suggest_script_changes'
          );
          if (!foundTextContent && !hasStreamedContent && toolOutputs.length > 0 && !calledSuggestScriptChanges) {
            console.log('🔄 Making continuation call...');
            
            try {
              // Build continuation input with function call outputs
              const continuationInput = [...input];
              
              // Add function call outputs to input
              toolOutputs.forEach((output, idx) => {
                const outputItem = {
                  type: "function_call_output",
                  call_id: output.tool_call_id,
                  output: output.output
                };
                continuationInput.push(outputItem);
              });
              
              const continuationResponse = await openai.responses.create({
                model: CHAT_MODEL,
                input: continuationInput,
                previous_response_id: responseId,
                stream: true
              });
              
              let continuationStreamed = false;
              for await (const chunk of continuationResponse) {
                if (chunk.type === 'response.content.delta' || chunk.type === 'response.output_text.delta') {
                  const content = chunk.delta || chunk.content;
                  if (content) {
                    continuationStreamed = true;
                    res.write(`data: ${JSON.stringify({
                      type: "content",
                      content: content
                    })}\n\n`);
                  }
                } else if (chunk.type === 'response.completed') {
                  // Only handle final content if we haven't streamed any
                  if (!continuationStreamed && chunk.response?.output) {
                    for (const outputItem of chunk.response.output) {
                      if (outputItem.type === 'message' && outputItem.content) {
                        for (const contentPart of outputItem.content) {
                          if (contentPart.type === 'output_text' && contentPart.text) {
                            res.write(`data: ${JSON.stringify({
                              type: "content", 
                              content: contentPart.text
                            })}\n\n`);
                          }
                        }
                      }
                    }
                  }
                  break;
                }
              }
              
              console.log('✅ Continuation completed');
              
            } catch (error) {
              console.error('❌ Continuation call failed:', error);
              res.write(`data: ${JSON.stringify({
                type: "content",
                content: `I can see your script "${script?.title || 'current script'}" with ${script?.chunks?.length || 0} chunks. It looks like it's about ${script?.chunks?.[0]?.script_text?.substring(0, 50) || 'your video content'}... How can I help you improve it?`
              })}\n\n`);
            }
          }
          break;
        }
      }
      
      // The Responses API should automatically provide the final response after tool execution
      
      // Send final done message
      res.write(`data: ${JSON.stringify({
        type: "done", 
        response_id: responseId
      })}\n\n`);
      res.end();
      
    } catch (error) {
      console.error('[Responses API] error:', error);
      res.write(`data: ${JSON.stringify({
        type: "error", 
        content: `Responses API error: ${error.message}`
      })}\n\n`);
      res.end();
    }
    
  } catch (error) {
    console.error('[Responses API setup] error:', error);
    res.status(500).json({ error: 'RESPONSES_FAIL' });
  }
});

// DELETED - Legacy streaming endpoint removed (using /api/chat/agents instead)
/*app.post('/api/chat/stream', async (req, res) => {
  try {
    const { prompt, workspaceNodes = [], script, chatHistory = [] } = req.body || {};
    
    console.log('\n🚀 [STREAMING CHAT] Starting agentic conversation...');
    console.log('📊 Request Summary:', {
      prompt_length: (prompt || '').length,
      workspace_nodes: workspaceNodes.length,
      script_sections: script?.sections?.length || 0,
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
      res.write(`data: ${JSON.stringify({type: "thinking", content: prompts.mock_responses.thinking})}\n\n`);
      res.write(`data: ${JSON.stringify({type: "tool_status", content: prompts.mock_responses.tool_status})}\n\n`);
      res.write(`data: ${JSON.stringify({type: "content", content: prompts.mock_responses.streaming_mock})}\n\n`);
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
          name: 'get_current_script',
          description: 'Get the current script sections and metadata',
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
    
    // Use minimal base prompt for streaming API
    const systemPrompt = prompts.base_system.core;
    
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
                  
                  const displayName = tools.getDisplayName(tc.function.name);
                  
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
              
            } else if (toolName === 'get_current_script') {
              toolResult = JSON.stringify({
                script: script || null,
                sections: script?.sections || []
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
});*/

// OpenAI Agents API endpoint
const { handleAgentsRequest } = require('./agents/endpoint');
app.post('/api/chat/agents', handleAgentsRequest);

const PORT = process.env.EXPRESS_PORT || 5174;
app.listen(PORT, () => console.log(`Marketing App server on :${PORT} (mock=${!HAS_KEY})`));