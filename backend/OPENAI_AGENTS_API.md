# OpenAI Agents API Documentation

## Overview

The OpenAI Agents API is a modern framework for building AI agents that can perform complex multi-step tasks with tool calling, streaming, and context management. Unlike the Responses API which has a rigid two-phase structure (tools → text), the Agents API allows **interleaved tool calling and text generation** similar to Cursor/Windsurf.

## Key Differences from Responses API

| Feature | Responses API | Agents API |
|---------|--------------|------------|
| Tool Calling | Single phase only | Multiple rounds of tools + text |
| Text Generation | After tools complete | Can interleave with tool calls |
| Streaming | Basic SSE | Advanced event-based streaming |
| Context Management | Manual | Built-in context injection |
| Agent Composition | Not supported | Agents can call other agents |
| Validation | Manual | Built-in with Zod schemas |

## Core Concepts

### 1. Agent Definition

An Agent is an LLM configured with:
- **Instructions** (system prompt)
- **Model** selection
- **Tools** (functions, hosted tools, or other agents)

```typescript
const agent = new Agent({
  name: 'ScriptEditor',
  instructions: 'You are a script editing assistant...',
  model: 'o4-mini',
  tools: [getScriptTool, suggestChangesTool],
});
```

### 2. Tools System

#### Tool Types

**Function Tools** - Convert any function into a tool:
```typescript
const suggestScriptChanges = tool({
  name: 'suggest_script_changes',
  description: 'Suggest changes to the script',
  parameters: z.object({
    explanation: z.string(),
    actions: z.array(z.object({
      type: z.enum(['rewrite', 'add', 'remove', 'move']),
      targetId: z.string(),
      script_text: z.string().optional(),
      camera_instruction: z.string().optional(),
    }))
  }),
  async execute({ explanation, actions }) {
    // Process suggestions
    return { status: 'suggestions_prepared', actions };
  },
});
```

**Hosted Tools** - Run on OpenAI servers:
- Web search
- File search
- Code interpreter
- Image generation
- Computer use

**Agent Tools** - Use agents as tools:
```typescript
const editorAgent = agent.asTool();
```

### 3. Context Management

Two-dimensional context system:

#### Local Context (RunContext)
- Runtime dependencies and state
- Not sent to LLM
- Type-safe with TypeScript

```typescript
interface AppContext {
  script: Script;
  user: User;
  database: Database;
}

const result = await run(agent, message, {
  context: { script, user, database }
});
```

#### Agent/LLM Context
- Information visible to the model
- Injected via:
  - Static instructions
  - Dynamic messages
  - Tool retrieval
  - Search/RAG

### 4. Streaming

Advanced streaming with multiple event types:

```typescript
const stream = await run(agent, 'Edit my script', { stream: true });

// Simple text streaming
stream.toTextStream().pipe(response);

// Detailed event handling
for await (const event of stream) {
  switch(event.type) {
    case 'raw_model_stream_event':
      // Handle model chunks
      break;
    case 'run_item_stream_event':
      // Handle tool calls, handoffs
      break;
    case 'agent_updated_stream_event':
      // Handle state changes
      break;
  }
}

await stream.completed;
```

### 5. Multi-Step Execution Pattern

The key advantage - **interleaved execution**:

```typescript
// Agent can:
// 1. Think (reasoning)
// 2. Call tools (get_current_script)
// 3. Generate text ("I see your script has...")
// 4. Call more tools (suggest_script_changes)
// 5. Generate more text ("I've prepared suggestions...")
// All in a single run!
```

## Implementation for Script Editing

### Current Responses API Limitation
```javascript
// Phase 1: Tools only
get_script_editing_context() → get_current_script()
// Phase 2: Text only (can't call suggest_script_changes!)
"Here are my suggestions..." [JSON as text - wrong!]
```

### With Agents API
```javascript
// Single run with interleaved execution
1. get_script_editing_context()
2. get_current_script()
3. "I'll make your script longer with dynamic camera angles..."
4. suggest_script_changes() // Actually calls the tool!
5. "I've prepared interactive suggestions for you to review."
```

## Migration Path

### 1. Install Agents SDK
```bash
npm install @openai/agents
```

### 2. Define Agent
```typescript
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';

const scriptAgent = new Agent({
  name: 'ScriptAssistant',
  model: 'gpt-4o',
  instructions: prompts.base_system.core,
  tools: [
    getScriptEditingContext,
    getCurrentScript,
    suggestScriptChanges,
  ],
});
```

### 3. Run with Context
```typescript
app.post('/api/chat/agent', async (req, res) => {
  const { prompt, script, chatHistory } = req.body;
  
  const stream = await run(scriptAgent, prompt, {
    stream: true,
    context: { script, chatHistory },
  });
  
  // Stream to client
  stream.toTextStream().pipe(res);
});
```

### 4. Handle Tool Execution
```typescript
const suggestScriptChanges = tool({
  name: 'suggest_script_changes',
  parameters: scriptChangeSchema,
  async execute(params, context) {
    // Send suggestions event to client
    res.write(`data: ${JSON.stringify({
      type: 'suggestions',
      content: { 
        explanation: params.explanation,
        actions: params.actions 
      }
    })}\n\n`);
    
    return { status: 'suggestions_sent' };
  }
});
```

## Benefits for Our Use Case

1. **Natural Flow**: AI can explain changes then call tool (like Cursor)
2. **No Hallucination**: Real tool calls, not JSON in text
3. **Better UX**: Streaming text + interactive suggestions
4. **Simpler Logic**: No continuation call complexity
5. **Future-Proof**: Modern API with active development

## Next Steps

1. Test Agents API with a simple prototype
2. Migrate tool definitions to new format
3. Update streaming handlers for new event types
4. Implement context injection for script/workspace data
5. Deploy and compare performance

## Resources

- [Agents Guide](https://openai.github.io/openai-agents-js/guides/agents/)
- [Tools Documentation](https://openai.github.io/openai-agents-js/guides/tools/)
- [Streaming Guide](https://openai.github.io/openai-agents-js/guides/streaming/)
- [Context Management](https://openai.github.io/openai-agents-js/guides/context/)
- [SDK Reference](https://openai.github.io/openai-agents-js/)