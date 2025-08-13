# OpenAI Agents API - Complete Documentation & Examples

## Table of Contents
1. [Installation & Setup](#installation--setup)
2. [Core Concepts](#core-concepts)
3. [Agents](#agents)
4. [Tools](#tools)
5. [Streaming](#streaming)
6. [Context Management](#context-management)
7. [Advanced Features](#advanced-features)
8. [Migration Guide](#migration-guide)
9. [Error Handling](#error-handling)
10. [Complete Examples](#complete-examples)

---

## Installation & Setup

### Prerequisites
Set OpenAI API Key:
```bash
export OPENAI_API_KEY=sk-...
```

### Installation
```bash
npm install @openai/agents 'zod@<=3.25.67'
```

### Basic Imports
```typescript
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
```

---

## Core Concepts

### Agent Architecture
An Agent is an LLM configured with:
- **Instructions** (system prompt)
- **Model** selection  
- **Tools** (functions, hosted tools, or other agents)
- **Context** (runtime state and dependencies)

### Key Differences from Responses API

| Feature | Responses API | Agents API |
|---------|--------------|------------|
| Tool Calling | Single phase: tools → text | Multiple rounds: tools ↔ text |
| Interleaving | No (rigid phases) | Yes (think → tools → think → tools) |
| Context | Manual injection | Built-in type-safe context |
| Streaming | Basic SSE chunks | Advanced event-based streams |
| Validation | Manual schemas | Built-in Zod validation |
| Agent Composition | Not supported | Agents can call other agents |

---

## Agents

### 1. Basic Agent

```typescript
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
  model: 'gpt-4o', // optional - defaults to system default
});

const result = await run(agent, 'Write a haiku about recursion.');
console.log(result.finalOutput);
```

### 2. Agent with Instructions

```typescript
const haikuAgent = new Agent({
  name: 'Haiku Agent',
  instructions: 'Always respond in haiku form.',
  model: 'o4-mini',
});
```

### 3. Agent with Tools

```typescript
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';

const getWeather = tool({
  name: 'get_weather',
  description: 'Return the weather for a given city.',
  parameters: z.object({ city: z.string() }),
  async execute({ city }) {
    return `The weather in ${city} is sunny.`;
  },
});

const weatherAgent = new Agent({
  name: 'Weather bot',
  instructions: 'You are a helpful weather bot.',
  model: 'o4-mini',
  tools: [getWeather],
});
```

### 4. Agent with Context

```typescript
interface Purchase {
  id: string;
  uid: string;
  deliveryStatus: string;
}

interface UserContext {
  uid: string;
  isProUser: boolean;
  fetchPurchases(): Promise<Purchase[]>;
}

const personalShopperAgent = new Agent<UserContext>({
  name: 'Personal shopper',
  instructions: 'Recommend products the user will love.',
});

// Usage with context
const result = await run(personalShopperAgent, 'Find me running shoes', {
  context: { 
    uid: 'abc', 
    isProUser: true, 
    fetchPurchases: async () => [] 
  },
});
```

### 5. Structured Output with Zod

```typescript
import { z } from 'zod';

const CalendarEvent = z.object({
  name: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
});

const calendarAgent = new Agent({
  name: 'Calendar assistant',
  instructions: 'Extract calendar events from text.',
  outputSchema: CalendarEvent,
});
```

### 6. Dynamic Instructions

```typescript
interface UserPreferences {
  language: string;
  formality: 'casual' | 'formal';
}

const adaptiveAgent = new Agent<UserPreferences>({
  name: 'Adaptive Assistant',
  instructions: (context) => {
    const { language, formality } = context || { language: 'English', formality: 'casual' };
    return `Respond in ${language} using a ${formality} tone.`;
  },
});
```

---

## Tools

### 1. Function Tools with Zod

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';

const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get the weather for a given city',
  parameters: z.object({ 
    city: z.string(),
    units: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  async execute({ city, units = 'celsius' }) {
    // Simulate API call
    return `The weather in ${city} is 22°${units === 'celsius' ? 'C' : 'F'} and sunny.`;
  },
});
```

### 2. Complex Parameter Schemas

```typescript
const createTaskTool = tool({
  name: 'create_task',
  description: 'Create a new task with details',
  parameters: z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']),
    dueDate: z.string().datetime().optional(),
    assignees: z.array(z.string()),
    tags: z.array(z.string()).default([]),
    metadata: z.record(z.any()).optional(),
  }),
  async execute(params) {
    console.log('Creating task:', params);
    return { id: 'task_123', status: 'created', ...params };
  },
});
```

### 3. Non-Strict JSON Schema Tool

```typescript
interface LooseToolInput { 
  text: string; 
}

const looseTool = tool({
  description: 'Echo input; be forgiving about typos',
  strict: false,
  parameters: {
    type: 'object',
    properties: { 
      text: { type: 'string' } 
    },
    required: ['text'],
    additionalProperties: true,
  },
  execute: async (input) => {
    if (typeof input !== 'object' || input === null || !('text' in input)) {
      return 'Invalid input. Please try again';
    }
    return (input as LooseToolInput).text;
  },
});
```

### 4. Tool with Context Access

```typescript
interface UserInfo {
  name: string;
  uid: number;
  preferences: Record<string, any>;
}

const fetchUserAge = tool({
  name: 'fetch_user_age',
  description: 'Return the age of the current user',
  parameters: z.object({}),
  execute: async (
    _args,
    runContext?: RunContext<UserInfo>
  ): Promise<string> => {
    const user = runContext?.context;
    if (!user) return 'User information not available';
    return `User ${user.name} is 47 years old`;
  },
});
```

### 5. Hosted Tools

```typescript
import { Agent, webSearchTool, fileSearchTool, codeInterpreterTool } from '@openai/agents';

const researchAgent = new Agent({
  name: 'Research assistant',
  instructions: 'Help users research topics and analyze files.',
  tools: [
    webSearchTool(),
    fileSearchTool('VS_ID'), // Vector store ID
    codeInterpreterTool(),
  ],
});
```

### 6. Agents as Tools

```typescript
// Create specialized sub-agent
const summarizer = new Agent({
  name: 'Summarizer',
  instructions: 'Generate a concise summary of the supplied text.',
});

// Convert to tool
const summarizerTool = summarizer.asTool({
  toolName: 'summarize_text',
  toolDescription: 'Generate a concise summary of the supplied text.',
});

// Use in main agent
const mainAgent = new Agent({
  name: 'Research assistant',
  instructions: 'Help users research and summarize information.',
  tools: [summarizerTool, webSearchTool()],
});
```

### 7. MCP Server Tools

```typescript
import { MCPServerStdio } from '@openai/agents';

// Local MCP server
const mcpServer = new MCPServerStdio({
  command: 'node',
  args: ['./mcp-server.js'],
});

const agent = new Agent({
  name: 'MCP Assistant',
  tools: [mcpServer],
});
```

---

## Streaming

### 1. Basic Streaming

```typescript
import { Agent, run } from '@openai/agents';

const storyteller = new Agent({
  name: 'Storyteller',
  instructions: 'You are a storyteller. Tell engaging stories about any topic.',
});

const stream = await run(storyteller, 'Tell me a story about a cat.', { 
  stream: true 
});

// Simple text output
stream.toTextStream({
  compatibleWithNodeStreams: true,
}).pipe(process.stdout);

// Wait for completion
await stream.completed;
```

### 2. Event-Based Streaming

```typescript
const stream = await run(agent, 'Analyze this data and suggest improvements', { 
  stream: true 
});

for await (const event of stream) {
  // Raw model events (tokens, tool calls, etc.)
  if (event.type === 'raw_model_stream_event') {
    console.log(`Model Event:`, event.data);
  }
  
  // Agent state changes
  if (event.type === 'agent_updated_stream_event') {
    console.log(`Agent Updated: ${event.agent.name}`);
  }
  
  // SDK specific events (tool calls, handoffs, etc.)
  if (event.type === 'run_item_stream_event') {
    console.log(`Run Item:`, event.item);
    
    if (event.item.type === 'tool_call') {
      console.log(`Tool Called: ${event.item.name}`);
    }
  }
}
```

### 3. Human-in-the-Loop Streaming

```typescript
let stream = await run(agent, 'Check weather in SF and Oakland', { 
  stream: true 
});

// Start streaming output
stream.toTextStream({ compatibleWithNodeStreams: true }).pipe(process.stdout);

// Wait for initial completion
await stream.completed;

// Handle interruptions (tool approval requests)
while (stream.interruptions?.length) {
  const state = stream.state;
  
  for (const interruption of stream.interruptions) {
    const toolName = interruption.rawItem.name;
    const toolArgs = interruption.rawItem.arguments;
    
    const approved = confirm(
      `Agent ${interruption.agent.name} wants to use tool ${toolName} with "${toolArgs}". Approve?`
    );
    
    if (approved) {
      state.approve(interruption);
    } else {
      state.reject(interruption);
    }
  }
  
  // Continue streaming after handling interruptions
  stream = await state.resume({ stream: true });
  stream.toTextStream({ compatibleWithNodeStreams: true }).pipe(process.stdout);
  await stream.completed;
}
```

### 4. Custom Stream Processing

```typescript
const stream = await run(agent, 'Generate a report', { stream: true });

let currentText = '';
let toolCalls = [];

for await (const event of stream) {
  switch (event.type) {
    case 'raw_model_stream_event':
      if (event.data.type === 'content.text.delta') {
        currentText += event.data.text;
        // Send incremental updates to client
        res.write(`data: ${JSON.stringify({ type: 'text', content: event.data.text })}\n\n`);
      }
      break;
      
    case 'run_item_stream_event':
      if (event.item.type === 'tool_call') {
        toolCalls.push(event.item);
        res.write(`data: ${JSON.stringify({ type: 'tool_call', name: event.item.name })}\n\n`);
      }
      break;
  }
}

// Send final result
res.write(`data: ${JSON.stringify({ type: 'complete', text: currentText, tools: toolCalls })}\n\n`);
```

---

## Context Management

### 1. Basic Context Pattern

```typescript
interface AppContext {
  user: {
    id: string;
    name: string;
    preferences: Record<string, any>;
  };
  database: Database;
  services: {
    emailService: EmailService;
    analyticsService: AnalyticsService;
  };
}

const appAgent = new Agent<AppContext>({
  name: 'App Assistant',
  instructions: 'Help users with app-related tasks.',
  tools: [getUserDataTool, sendEmailTool],
});
```

### 2. Context-Aware Tools

```typescript
const getUserDataTool = tool({
  name: 'get_user_data',
  description: 'Fetch user profile data',
  parameters: z.object({
    field: z.string().optional(),
  }),
  async execute({ field }, runContext?: RunContext<AppContext>) => {
    const { user, database } = runContext?.context || {};
    if (!user || !database) {
      throw new Error('User context not available');
    }
    
    const userData = await database.users.findById(user.id);
    return field ? userData[field] : userData;
  },
});

const sendEmailTool = tool({
  name: 'send_email',
  description: 'Send email to user',
  parameters: z.object({
    subject: z.string(),
    body: z.string(),
  }),
  async execute({ subject, body }, runContext?: RunContext<AppContext>) => {
    const { user, services } = runContext?.context || {};
    if (!user || !services) {
      throw new Error('Context not available');
    }
    
    await services.emailService.send({
      to: user.email,
      subject,
      body,
    });
    
    return 'Email sent successfully';
  },
});
```

### 3. Dynamic Context Injection

```typescript
interface RequestContext {
  requestId: string;
  timestamp: Date;
  userAgent: string;
  ipAddress: string;
}

async function handleRequest(req: Request) {
  const context: AppContext & RequestContext = {
    user: await getUserFromToken(req.headers.authorization),
    database: getDatabase(),
    services: getServices(),
    requestId: generateId(),
    timestamp: new Date(),
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
  
  const result = await run(appAgent, req.body.message, { context });
  return result;
}
```

### 4. Shared State Management

```typescript
interface SharedState {
  sessionData: Map<string, any>;
  cache: Cache;
  eventBus: EventEmitter;
}

const sharedState: SharedState = {
  sessionData: new Map(),
  cache: new LRUCache(100),
  eventBus: new EventEmitter(),
};

// Tools can modify shared state
const updateSessionTool = tool({
  name: 'update_session',
  description: 'Update session data',
  parameters: z.object({
    key: z.string(),
    value: z.any(),
  }),
  async execute({ key, value }, runContext?: RunContext<SharedState>) => {
    const state = runContext?.context;
    if (!state) throw new Error('No shared state');
    
    state.sessionData.set(key, value);
    state.eventBus.emit('session_updated', { key, value });
    
    return `Updated ${key} in session`;
  },
});
```

---

## Advanced Features

### 1. Guardrails

```typescript
import { Agent } from '@openai/agents';

const guardedAgent = new Agent({
  name: 'Guarded Assistant',
  instructions: 'Be helpful but safe.',
  inputGuardrails: [
    (input) => {
      if (input.includes('harmful')) {
        throw new Error('Harmful content detected');
      }
      return input;
    },
  ],
  outputGuardrails: [
    (output) => {
      // Filter sensitive information
      return output.replace(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, '****-****-****-****');
    },
  ],
});
```

### 2. Lifecycle Hooks

```typescript
const monitoredAgent = new Agent({
  name: 'Monitored Agent',
  instructions: 'Assistant with monitoring.',
  onStart: async (context) => {
    console.log('Agent started with context:', context);
    await analytics.track('agent_started', { agent: 'MonitoredAgent' });
  },
  onEnd: async (result, context) => {
    console.log('Agent completed:', result);
    await analytics.track('agent_completed', { 
      agent: 'MonitoredAgent',
      success: !result.error,
      duration: Date.now() - context.startTime,
    });
  },
});
```

### 3. Agent Handoffs

```typescript
// Specialized agents
const techSupportAgent = new Agent({
  name: 'Tech Support',
  instructions: 'Help with technical issues.',
  tools: [diagnosticTool, fixIssueTool],
});

const salesAgent = new Agent({
  name: 'Sales Agent',  
  instructions: 'Help with sales and billing.',
  tools: [getAccountTool, upgradeTool],
});

// Router agent
const routerAgent = new Agent({
  name: 'Customer Service Router',
  instructions: `Route customer inquiries to appropriate specialists.
  Use tech_support for technical issues.
  Use sales_agent for billing/account questions.`,
  tools: [
    techSupportAgent.asTool({ toolName: 'tech_support' }),
    salesAgent.asTool({ toolName: 'sales_agent' }),
  ],
});
```

### 4. Error Handling

```typescript
const robustTool = tool({
  name: 'robust_api_call',
  description: 'Make API call with retry logic',
  parameters: z.object({
    endpoint: z.string(),
    retries: z.number().default(3),
  }),
  async execute({ endpoint, retries }) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        if (i === retries - 1) {
          return { error: `Failed after ${retries} attempts: ${error.message}` };
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  },
});
```

### 5. Realtime Voice Agent

```typescript
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

const voiceAgent = new RealtimeAgent({
  name: 'Voice Assistant',
  instructions: 'You are a helpful voice assistant.',
  tools: [getWeatherTool],
});

const session = new RealtimeSession(voiceAgent);

// Connect and handle events
await session.connect({ apiKey: process.env.OPENAI_API_KEY });

session.on('audio', (audioData) => {
  // Handle audio output
  playAudio(audioData);
});

session.on('tool_call', (toolCall) => {
  console.log('Tool called:', toolCall.name);
});
```

---

## Migration Guide

### From Responses API to Agents API

#### 1. Tool Definition Migration

**Before (Responses API):**
```javascript
const tools = [{
  type: 'function',
  name: 'suggest_script_changes',
  description: 'Suggest changes to the script',
  parameters: {
    type: 'object',
    properties: {
      explanation: { type: 'string' },
      actions: { type: 'array', items: { type: 'object' } }
    },
    required: ['explanation', 'actions']
  }
}];
```

**After (Agents API):**
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
  async execute({ explanation, actions }, context) {
    // Send suggestions to client
    context?.sendSuggestions({ explanation, actions });
    return { status: 'suggestions_sent' };
  },
});
```

#### 2. Agent Definition Migration

**Before:**
```javascript
const systemPrompt = prompts.base_system.core;
const tools = toolManager.getToolsForAPI('responses', ['script']);

const response = await openai.responses.create({
  model: 'gpt-5-mini',
  input: messages,
  tools: tools,
  stream: true
});
```

**After:**
```typescript
const scriptAgent = new Agent({
  name: 'Script Assistant',
  model: 'gpt-4o',
  instructions: prompts.base_system.core,
  tools: [
    getScriptEditingContext,
    getCurrentScript,
    suggestScriptChanges,
  ],
});

const stream = await run(scriptAgent, userMessage, {
  stream: true,
  context: { script, workspaceNodes, user }
});
```

#### 3. Streaming Migration

**Before:**
```javascript
for await (const chunk of response) {
  if (chunk.type === 'response.content.delta') {
    res.write(`data: ${JSON.stringify({
      type: 'content',
      content: chunk.delta
    })}\n\n`);
  }
}
```

**After:**
```typescript
for await (const event of stream) {
  if (event.type === 'raw_model_stream_event' && event.data.type === 'content.text.delta') {
    res.write(`data: ${JSON.stringify({
      type: 'content',
      content: event.data.text
    })}\n\n`);
  }
  
  if (event.type === 'run_item_stream_event' && event.item.type === 'tool_call') {
    res.write(`data: ${JSON.stringify({
      type: 'tool_status',
      content: `🔧 ${event.item.name}`
    })}\n\n`);
  }
}
```

#### 4. Context Migration

**Before:**
```javascript
const context = {
  workspaceNodes: req.body.workspaceNodes || [],
  script: script,
  prompts: prompts
};

const result = tools.execute(toolName, toolArgs, context);
```

**After:**
```typescript
interface ScriptContext {
  script: Script;
  workspaceNodes: WorkspaceNode[];
  user: User;
  sendSuggestions: (data: SuggestionData) => void;
}

const result = await run(scriptAgent, message, {
  context: {
    script,
    workspaceNodes,
    user,
    sendSuggestions: (data) => {
      res.write(`data: ${JSON.stringify({
        type: 'suggestions',
        content: data
      })}\n\n`);
    }
  }
});
```

### Complete Migration Example

**New Express Endpoint:**
```typescript
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

// Define tools with Zod schemas
const getScriptEditingContext = tool({
  name: 'get_script_editing_context',
  description: 'Load script system context',
  parameters: z.object({}),
  async execute() {
    return { context: prompts.script_editing_context.content };
  },
});

const getCurrentScript = tool({
  name: 'get_current_script',
  description: 'Get current script data',
  parameters: z.object({}),
  async execute(_, runContext) {
    const { script } = runContext?.context || {};
    return { script };
  },
});

const suggestScriptChanges = tool({
  name: 'suggest_script_changes',
  description: 'Suggest script changes',
  parameters: z.object({
    explanation: z.string(),
    actions: z.array(z.object({
      type: z.enum(['rewrite', 'add', 'remove', 'move']),
      targetId: z.string(),
      script_text: z.string().optional(),
      camera_instruction: z.string().optional(),
    }))
  }),
  async execute({ explanation, actions }, runContext) {
    const { sendSuggestions } = runContext?.context || {};
    if (sendSuggestions) {
      sendSuggestions({ explanation, actions });
    }
    return { status: 'suggestions_sent' };
  },
});

// Create agent
const scriptAgent = new Agent({
  name: 'Script Assistant',
  model: 'gpt-4o',
  instructions: prompts.base_system.core,
  tools: [getScriptEditingContext, getCurrentScript, suggestScriptChanges],
});

// New endpoint
app.post('/api/chat/agent', async (req, res) => {
  try {
    const { prompt, script, workspaceNodes = [] } = req.body;
    
    // Setup streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Run agent with context
    const stream = await run(scriptAgent, prompt, {
      stream: true,
      context: {
        script,
        workspaceNodes,
        sendSuggestions: (data) => {
          res.write(`data: ${JSON.stringify({
            type: 'suggestions',
            content: data
          })}\n\n`);
        }
      }
    });
    
    // Handle streaming events
    for await (const event of stream) {
      if (event.type === 'raw_model_stream_event') {
        if (event.data.type === 'content.text.delta') {
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: event.data.text
          })}\n\n`);
        }
      }
      
      if (event.type === 'run_item_stream_event') {
        if (event.item.type === 'tool_call') {
          res.write(`data: ${JSON.stringify({
            type: 'tool_status',
            content: `🔧 ${event.item.name}`
          })}\n\n`);
        }
      }
    }
    
    // End stream
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
    
  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      content: error.message
    })}\n\n`);
    res.end();
  }
});
```

---

## Error Handling

### 1. Tool Execution Errors

```typescript
const reliableTool = tool({
  name: 'reliable_operation',
  description: 'Operation with error handling',
  parameters: z.object({ data: z.string() }),
  async execute({ data }) {
    try {
      // Risky operation
      const result = await processData(data);
      return { success: true, result };
    } catch (error) {
      console.error('Tool execution failed:', error);
      return { 
        success: false, 
        error: error.message,
        fallback: 'Used default processing'
      };
    }
  },
});
```

### 2. Agent Error Handling

```typescript
const robustAgent = new Agent({
  name: 'Robust Agent',
  instructions: 'Handle errors gracefully.',
  tools: [reliableTool],
  onError: async (error, context) => {
    console.error('Agent error:', error);
    await logError(error, context);
    return 'I encountered an error, but I can still help you with other tasks.';
  },
});
```

### 3. Stream Error Handling

```typescript
try {
  const stream = await run(agent, message, { stream: true });
  
  for await (const event of stream) {
    // Process events
  }
  
  await stream.completed;
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Stream was aborted');
  } else {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      content: 'An error occurred during processing'
    })}\n\n`);
  }
}
```

---

## Complete Examples

### 1. Script Editor Agent (Our Use Case)

```typescript
// types.ts
interface Script {
  id: string;
  title: string;
  chunks: ScriptChunk[];
}

interface ScriptChunk {
  id: string;
  type: 'HOOK' | 'PRODUCT' | 'BENEFIT' | 'SOCIAL' | 'CTA';
  script_text: string;
  camera_instruction: string;
}

interface ScriptContext {
  script: Script;
  workspaceNodes: WorkspaceNode[];
  user: User;
  sendSuggestions: (data: any) => void;
  sendToolStatus: (message: string) => void;
}

// tools.ts
const getScriptEditingContext = tool({
  name: 'get_script_editing_context',
  description: 'Load contextual information about the script system',
  parameters: z.object({}),
  async execute(_, runContext?: RunContext<ScriptContext>) {
    runContext?.context.sendToolStatus?.('Loading script system context');
    return {
      context: `This app uses a chunk-based approach for short-form video scripts. 
      Each chunk represents one shot/scene with script_text and camera_instruction.
      Chunk types include HOOK, PRODUCT, BENEFIT, SOCIAL, and CTA.`
    };
  },
});

const getCurrentScript = tool({
  name: 'get_current_script',
  description: 'Get the current script chunks and metadata',
  parameters: z.object({}),
  async execute(_, runContext?: RunContext<ScriptContext>) {
    const { script, sendToolStatus } = runContext?.context || {};
    sendToolStatus?.('Analyzing current script');
    return { script };
  },
});

const suggestScriptChanges = tool({
  name: 'suggest_script_changes',
  description: 'Suggest changes to the script - creates interactive UI for user approval',
  parameters: z.object({
    explanation: z.string().describe('Clear explanation of proposed changes'),
    actions: z.array(z.object({
      type: z.enum(['rewrite', 'add', 'remove', 'move']),
      targetId: z.string(),
      script_text: z.string().optional(),
      camera_instruction: z.string().optional(),
      position: z.enum(['before', 'after']).optional(),
    }))
  }),
  async execute({ explanation, actions }, runContext?: RunContext<ScriptContext>) {
    const { sendSuggestions } = runContext?.context || {};
    
    if (sendSuggestions) {
      sendSuggestions({ explanation, actions });
    }
    
    return { 
      status: 'suggestions_sent', 
      message: 'Interactive suggestions have been prepared for your review.' 
    };
  },
});

// agent.ts
const scriptAgent = new Agent<ScriptContext>({
  name: 'Script Assistant',
  model: 'gpt-4o',
  instructions: `You are a helpful assistant for editing short-form video scripts.

  When users ask about script editing:
  1. Call get_script_editing_context and get_current_script to load information
  2. Explain your proposed changes in natural language
  3. Call suggest_script_changes to create interactive suggestions
  
  You can call tools multiple times and explain your reasoning throughout.
  Keep responses conversational and helpful.`,
  tools: [getScriptEditingContext, getCurrentScript, suggestScriptChanges],
});

// server.ts
app.post('/api/chat/agent', async (req, res) => {
  try {
    const { prompt, script, workspaceNodes = [], chatHistory = [] } = req.body;
    
    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const stream = await run(scriptAgent, prompt, {
      stream: true,
      context: {
        script,
        workspaceNodes,
        user: req.user,
        sendSuggestions: (data) => {
          res.write(`data: ${JSON.stringify({
            type: 'suggestions',
            content: data
          })}\n\n`);
        },
        sendToolStatus: (message) => {
          res.write(`data: ${JSON.stringify({
            type: 'tool_status',
            content: message
          })}\n\n`);
        }
      }
    });
    
    // Stream events
    for await (const event of stream) {
      if (event.type === 'raw_model_stream_event') {
        if (event.data.type === 'content.text.delta') {
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: event.data.text
          })}\n\n`);
        }
      }
    }
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error('Agent error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      content: error.message
    })}\n\n`);
    res.end();
  }
});
```

### 2. Multi-Agent Customer Service

```typescript
// Specialized agents
const techSupportAgent = new Agent({
  name: 'Tech Support Specialist',
  instructions: 'Diagnose and resolve technical issues step by step.',
  tools: [runDiagnosticTool, fixCommonIssuesTool, escalateToEngineerTool],
});

const billingAgent = new Agent({
  name: 'Billing Specialist', 
  instructions: 'Help with billing, payments, and account questions.',
  tools: [getAccountInfoTool, processRefundTool, updatePaymentMethodTool],
});

const salesAgent = new Agent({
  name: 'Sales Specialist',
  instructions: 'Help customers understand products and upgrade plans.',
  tools: [getProductInfoTool, createQuoteTool, scheduleCallTool],
});

// Router agent
const customerServiceAgent = new Agent({
  name: 'Customer Service Router',
  instructions: `You are a customer service router. Analyze customer inquiries and route them to the appropriate specialist:
  
  - Use tech_support for: bugs, errors, technical problems, integration issues
  - Use billing_specialist for: payments, refunds, invoices, account billing
  - Use sales_specialist for: product questions, upgrades, new features, pricing
  
  You can also handle simple questions directly.`,
  tools: [
    techSupportAgent.asTool({ toolName: 'tech_support' }),
    billingAgent.asTool({ toolName: 'billing_specialist' }),
    salesAgent.asTool({ toolName: 'sales_specialist' }),
  ],
});
```

### 3. Research Assistant with Web Search

```typescript
const researchAgent = new Agent({
  name: 'Research Assistant',
  instructions: `You are a research assistant. Help users find information and analyze it.
  
  For research tasks:
  1. Use web search to find current information
  2. Summarize findings clearly
  3. Provide sources and verify information when possible`,
  tools: [
    webSearchTool(),
    tool({
      name: 'analyze_sources',
      description: 'Analyze and compare multiple sources',
      parameters: z.object({
        sources: z.array(z.string()),
        topic: z.string(),
      }),
      async execute({ sources, topic }) {
        // Analyze source credibility and compare information
        return {
          analysis: `Analyzed ${sources.length} sources about ${topic}`,
          credibility_scores: sources.map(s => ({ source: s, score: 0.8 })),
          summary: 'Cross-referenced information across sources'
        };
      },
    }),
  ],
});
```

This comprehensive documentation should give you everything needed to successfully migrate from the Responses API to the Agents API and avoid implementation mistakes!