# Script Components Documentation

## Application Purpose
**Marketing content creation platform** for short-form video ads. Script components handle AI-powered script generation, editing, and refinement through natural language chat interactions.

## Overview
Components implementing intelligent script assistance with dual API support, real-time streaming, tool-based context access, and advanced chat UX for script refinement workflows.

## Components

### ChatAssistant.jsx - AI-Powered Script Assistant

**Purpose**: Advanced AI chat interface for natural language script editing and refinement with dual API architecture and real-time streaming capabilities.

**Props**: `disabled`, `script`, `onPropose`, `onApply`, `proposed`, `context`, `colorScheme`

**Advanced Architecture:**
- **Dual API Support**: Responses API (default) with tool calling vs Streaming API (fallback)
- **Real-time Streaming**: Server-sent events with proper stream handling and abort controls
- **Tool Integration**: Dynamic context access through workspace tools and instruction modules
- **Response Continuity**: Response ID tracking for conversation threading

**Key State Management:**
- `useResponsesAPI`: Toggle between Responses API (tools) vs Streaming API (simple chat)
- `responseHistory[]`: Response ID tracking for conversation continuity 
- `actionStates{}`: Accept/reject state tracking per message
- `currentStream`: Active stream management with abort capabilities
- `messages[]`: Complete conversation history with role-based organization

**Core Functions:**
- `sendMessageWithResponsesAPI()`: Tool-enabled AI with workspace access
- `sendMessageWithChatCompletions()`: Fallback streaming text generation
- `handleAcceptActions()`: Apply proposed script changes via parent callbacks
- `handleRejectActions()`: Dismiss suggestions and update UI state
- Auto-resize textarea with proper keyboard handling

**API Integration:**

**Responses API (`/api/chat/responses`):**
- **When**: `useResponsesAPI = true` (default)
- **Features**: Tool calling, workspace access, instruction loading, script analysis
- **Tools Available**: 
  - `get_available_references`: List workspace content
  - `read_reference`: Access specific nodes
  - `get_current_script`: Analyze script state
  - `suggest_script_changes`: Propose edits with structured actions
  - `get_instructions`: Load detailed guidance modules

**Streaming API (`/api/chat/stream`):**
- **When**: `useResponsesAPI = false` (fallback)
- **Features**: Simple text generation, real-time streaming
- **Use Case**: Basic conversations without tool access

**Advanced Features:**
- **Stream Processing**: Proper SSE parsing with JSON chunk handling
- **Abort Handling**: Clean stream termination with controller.abort()
- **Error Recovery**: Graceful degradation and user-friendly error messages
- **Context Selection**: Uses `context.selectedNodes` for targeted assistance
- **Action Proposals**: Structured script modifications with apply/reject workflow

**UI Components:**
- **Message Display**: Role-based styling (user/assistant) with proper theming
- **Action Cards**: Expandable suggestion blocks with accept/reject buttons
- **Stream Indicators**: Real-time typing indicators and processing status
- **Input Area**: Auto-resizing textarea with send button and loading states

**Theme Integration:**
- **Light Mode**: Gray/blue gradients with clean contrast
- **Dark Mode**: Black/purple themes with high contrast
- **Experimental**: Black/yellow experimental styling
- Dynamic button styling and proper disabled states

### chat/ Directory Structure

```
chat/
├── ChatAssistant.jsx     # Main AI chat interface
└── CLAUDE.md            # This documentation
```

**Future Components (Planned):**
- `MessageCard.jsx`: Reusable message display component
- `ActionProposal.jsx`: Structured action display and interaction
- `StreamingIndicator.jsx`: Advanced loading states and progress
- `ConversationHistory.jsx`: Persistent chat history management

## Data Flow Architecture

**Context Integration:**
```
WorkspaceContainer (nodes, script) → 
  StaticScriptView (context) →
    ChatAssistant (selectedNodes, script) →
      API (tools access) →
        Response (structured actions) →
          Parent callbacks (apply changes)
```

**Tool Access Pattern:**
```
User Message → 
  Responses API → 
    get_available_references → 
      read_reference(selectedNodes) →
        get_current_script →
          suggest_script_changes(actions[]) →
            Stream suggestions → 
              User accept/reject →
                onPropose/onApply callbacks
```

## Advanced Features

**Conversation Threading:**
- Response ID tracking maintains conversation context
- Previous response ID passed for context continuation  
- Proper conversation history management

**Script Action System:**
- **Action Types**: rewrite, add, remove, move chunks
- **Batch Operations**: Multiple chunk edits in single request
- **Structured Proposals**: JSON-formatted change suggestions
- **Apply/Reject Workflow**: User control over all changes

**Performance Optimizations:**
- React.memo for message components
- Debounced input handling
- Proper stream cleanup and memory management
- Efficient re-rendering with state locality

**Error Handling:**
- Network failure recovery
- Invalid JSON parsing protection
- Stream interruption handling
- User-friendly error messages

## Integration Points

**Parent Component Interface:**
- `onPropose(actions)`: Receive suggested changes
- `onApply(actions)`: Execute approved modifications
- `context.selectedNodes`: Workspace content for AI context
- `script`: Current script state for analysis

**Backend API Dependencies:**
- `/api/chat/responses`: Responses API with tools
- `/api/chat/stream`: Streaming fallback API
- Tool system integration via backend tools directory
- OpenAI GPT integration with function calling

This chat system provides sophisticated AI assistance for script editing while maintaining clean separation of concerns and robust error handling.