const { run } = require('@openai/agents');
const { scriptAgent } = require('./scriptAgent');

// Ensure dotenv is loaded
require('dotenv').config();

/**
 * OpenAI Agents API endpoint for script editing
 * Supports interleaved tool calling and text generation like Cursor
 */
async function handleAgentsRequest(req, res) {
  try {
    const { prompt, script, workspaceNodes = [], chatHistory = [], videoAnalyses = {} } = req.body;
    
    console.log('\n🚀 [AGENTS API] Starting...');
    console.log('📊 Request Summary:', {
      prompt_length: (prompt || '').length,
      script_chunks: script?.chunks?.length || 0,
      workspace_nodes: workspaceNodes.length,
      chat_history: chatHistory.length,
      video_analyses: Object.keys(videoAnalyses || {}).length,
      model: scriptAgent.model,
      has_api_key: !!process.env.OPENAI_API_KEY,
      api_key_prefix: process.env.OPENAI_API_KEY?.substring(0, 10) || 'none'
    });
    
    if (!process.env.OPENAI_API_KEY) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      
      res.write(`data: ${JSON.stringify({
        type: "content", 
        content: "Mock mode: Agents API would provide interleaved tool calling and text generation. Add OpenAI API key to enable."
      })}\n\n`);
      res.write(`data: ${JSON.stringify({type: "done", agent_response_id: "mock_agent_123"})}\n\n`);
      return res.end();
    }
    
    // Setup Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Build context for the agent
    const context = {
      script,
      workspaceNodes,
      videoAnalyses,
      user: req.user || { id: 'default_user' },
      
      // Callback functions for streaming responses
      sendSuggestions: (data) => {
        console.log('💡 Sending suggestions:', data.explanation.substring(0, 100) + '...');
        res.write(`data: ${JSON.stringify({
          type: 'suggestions',
          content: data
        })}\n\n`);
      },
      
      sendToolStatus: (message) => {
        console.log('🔧 Tool status:', message);
        res.write(`data: ${JSON.stringify({
          type: 'tool_status',
          content: message
        })}\n\n`);
      }
    };
    
    console.log('🤖 Running agent with context...');
    console.log('🔧 Context keys:', Object.keys(context));
    console.log('🧠 Agent name:', scriptAgent.name);
    
    // Validate that we're using the correct model - fail if not GPT-5-mini
    if (scriptAgent.model !== 'gpt-5-mini') {
      throw new Error(`Expected model 'gpt-5-mini' but agent is configured with '${scriptAgent.model}'`);
    }
    console.log('✅ Model validation passed: using', scriptAgent.model);
    
    // For now, just pass the current prompt to avoid format issues
    // TODO: Investigate proper chat history format for OpenAI Agents API
    console.log('🗣️ Chat context:', {
      history_count: chatHistory.length,
      current_prompt: prompt.substring(0, 50) + '...',
      sample_history: chatHistory.slice(0, 2)
    });
    
    // Run the agent with streaming enabled and current prompt only
    const stream = await run(scriptAgent, prompt, {
      stream: true,
      context: {
        ...context,
        // Add chat history to context instead of messages
        chatHistory: chatHistory
      }
    });
    
    console.log('📡 Processing agent stream...');
    console.log('📡 Stream type:', typeof stream);
    
    let eventCount = 0;
    
    // Process the streaming response
    for await (const event of stream) {
      eventCount++;
      console.log(`📦 Event ${eventCount}:`, event.type);
      
      if (event.type === 'raw_model_stream_event') {
        console.log(`📝 Raw event:`, event.data.type, JSON.stringify(event.data).substring(0, 100));
        
        // Handle text content streaming - the correct event type is 'output_text_delta'
        if (event.data.type === 'output_text_delta') {
          const text = event.data.delta || event.data.text || '';
          console.log(`💬 Streaming text:`, JSON.stringify(text));
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: text
          })}\n\n`);
        }
      } else if (event.type === 'run_item_stream_event') {
        // Handle tool calls and other run events
        if (event.item.type === 'tool_call') {
          console.log(`🔨 Tool called: ${event.item.name}`);
          res.write(`data: ${JSON.stringify({
            type: 'tool_call_start',
            tool_name: event.item.name
          })}\n\n`);
        }
      } else if (event.type === 'agent_updated_stream_event') {
        // Handle agent state updates
        console.log(`🔄 Agent updated: ${event.agent.name}`);
      }
    }
    
    // Wait for completion
    await stream.completed;
    
    console.log(`✅ Agents API stream completed (${eventCount} events processed)`);
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'done',
      agent_response_id: 'agent_' + Date.now()
    })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error('❌ [AGENTS API] Error:', error);
    
    res.write(`data: ${JSON.stringify({
      type: 'error',
      content: `Agents API error: ${error.message}`
    })}\n\n`);
    res.end();
  }
}

module.exports = { handleAgentsRequest };