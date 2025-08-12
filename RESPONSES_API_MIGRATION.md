# Responses API Migration Guide for Marketing App

## Current Implementation (Chat Completions)
- Using `openai.chat.completions.create()` with streaming
- Model: `gpt-5-mini` 
- Custom tools for workspace content access
- Full chat history sent with each request

## Proposed Migration to Responses API

### Benefits for Marketing App
1. **Stateful Script Analysis**: Reasoning about script improvements persists across messages
2. **Reduced Token Usage**: No need to resend full conversation history
3. **Better Tool Integration**: Native support for web search (finding ad examples)
4. **Enhanced Reasoning**: Better multi-step planning for script generation

### Implementation Changes

#### Backend Changes (`server.js`)

Replace current streaming endpoint:

```javascript
// OLD: Chat Completions
const stream = await openai.chat.completions.create({
  model: CHAT_MODEL,
  messages: conversationMessages,
  tools,
  stream: true,
  temperature: 1,
  reasoning_effort: 'medium'
});

// NEW: Responses API
const response = await openai.responses.create({
  model: "gpt-5-mini", // or "o4-mini" for better reasoning
  input: [{
    role: "user",
    content: [{ type: "input_text", text: prompt }]
  }],
  previous_response_id: previousResponseId, // Maintain context
  tools: [
    { type: "web_search_preview" }, // Built-in web search
    ...customTools // Your existing tools
  ],
  reasoning: { effort: "medium" },
  stream: true
});
```

#### State Management
- Store `response.id` after each interaction
- Pass `previous_response_id` for continued conversations
- No need to maintain full chat history array

#### Tool Updates
```javascript
// Simplified tool calling with Responses API
const tools = [
  {
    type: "custom",
    name: "get_workspace_content",
    description: "Access script, ads, and instructions",
    // Responses API handles raw payloads better
  },
  {
    type: "web_search_preview", // Built-in!
    // AI can search for marketing trends, ad examples
  }
];
```

### Migration Steps

1. **Update Dependencies**
   ```bash
   npm install openai@latest  # Ensure latest version with Responses API
   ```

2. **Create New Endpoint** (test alongside existing)
   ```javascript
   app.post('/api/chat/responses', async (req, res) => {
     // New Responses API implementation
   });
   ```

3. **Update Frontend** (`ChatAssistant.jsx`)
   - Store `responseId` in component state
   - Pass `previousResponseId` with requests
   - Handle new response format

4. **Feature Enhancements**
   - Add web search for finding ad examples
   - Enable reasoning traces for debugging
   - Implement grammar constraints for consistent script formats

### Example: Script Generation with Responses API

```javascript
// Generate script with reasoning persistence
const response = await openai.responses.create({
  model: "o4-mini",
  input: "Generate a TikTok ad script for this product",
  tools: [
    { type: "web_search_preview" }, // Find trending formats
    { type: "custom", name: "analyze_competitors" },
    { type: "custom", name: "generate_script_chunks" }
  ],
  reasoning: { 
    effort: "high", // Deep analysis for script creation
    encrypted: false // Can see reasoning for debugging
  },
  verbosity: 2 // More detailed explanations
});

// Continue refining with context maintained
const refinement = await openai.responses.create({
  model: "o4-mini",
  input: "Make it more casual and add a stronger hook",
  previous_response_id: response.id, // Maintains all context!
  reasoning: { effort: "medium" }
});
```

## Timeline Recommendation

1. **Phase 1** (Week 1): Test Responses API in parallel endpoint
2. **Phase 2** (Week 2): Migrate chat assistant to Responses API
3. **Phase 3** (Week 3): Add advanced features (web search, reasoning traces)
4. **Phase 4** (Week 4): Optimize and remove old Chat Completions code

## Cost Considerations

- Responses API with reasoning models (o3, o4-mini) may have different pricing
- Reduced token usage from stateful conversations can offset costs
- Web search tool usage has separate pricing

## Monitoring

Track these metrics during migration:
- Response latency
- Token usage reduction
- Reasoning quality improvements
- Tool call success rates
- User satisfaction with responses