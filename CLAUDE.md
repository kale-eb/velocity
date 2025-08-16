# Marketing App Codebase Documentation

## Application Concept

**Short-Form Video Ad Creation Platform** - A comprehensive React-based platform for creating short-form video advertisements for Instagram, Facebook, and TikTok. The platform combines AI-powered content generation with visual workflow management and video assembly tools.

### Core Concept
The platform operates through **two main workspaces** that work together:

1. **Script Generation Workspace** - AI-powered script creation and refinement
   - **Enhanced Static View**: Streamlined chunk-based script editor with integrated AI assistant and conversation history
   - **Node-based Visual Editor**: (Removed for MVP - focused on static interface)

2. **Video Assembly Workspace** - Timeline-based video production from script chunks
   - Modular video creation using hooks, product segments, and CTAs
   - Multiple variations per chunk for A/B testing
   - AI scoring for script adherence

### Additional Features
- **Home Dashboard** - Project management and quick actions
- **Content Database** - Centralized media and content management
- **Shared Infrastructure** - Authentication, storage, and AI services
- **Script Persistence** - Generated scripts persist across browser sessions
- **File Preview System** - Click to preview uploaded files with full-screen modal
- **Enhanced Chat UX** - Modern AI chat interface with conversation history and real-time feedback
- **Chat Conversation History** - Persistent storage of up to 5 conversations with automatic title generation
- **Persistent Chat Proposals** - AI suggestions and user responses persist across page reloads
- **Auto-expanding UI** - Script text boxes and camera inputs automatically resize to fit content
- **Video Analysis Pipeline** - AI-powered analysis of short-form video ads with frame extraction and OpenAI GPT-5-mini
- **Analysis State Persistence** - Backend-integrated approach for loading analyzed video data across sessions

The platform streamlines the entire process from initial concept to final video export, making professional marketing content creation accessible and efficient.

## Technology Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js + Python FastAPI for video processing
- **AI Integration**: OpenAI Agents API (GPT-5) with automatic 10-message context + GPT-4o for video analysis
- **Conversation Management**: Sliding window context for natural dialogue flow without manual tool calls
- **Storage**: localStorage for persistence, hybrid storage for workspace data
- **Icons**: Lucide React, **Connections**: SVG
- **Code Quality**: ESLint

## Project Structure (v0.9.0 - Post-Cleanup)
```
src/
├── components/
│   ├── script/                     # Script Generation Components
│   │   ├── chat/                   # AI Chat Assistant
│   │   │   └── ChatAssistant.jsx   # Enhanced chat with persistent proposals
│   │   └── nodes/                  # Script generation nodes
│   │       └── ScriptGenerationNode.jsx
│   ├── views/                      # Main workspace views
│   │   └── EnhancedStaticScriptView.tsx  # Primary script editor with collapsible shots
│   ├── workspace/                  # Workspace management
│   │   └── WorkspaceContainer.tsx  # Simplified state coordinator
│   ├── layout/                     # App-wide layout (planned)
│   ├── video/                      # Video Assembly Workspace (planned)
│   ├── content/                    # Content Database (planned)
│   ├── home/                       # Home page (planned)
│   └── ui/                         # Reusable UI components (planned)
│
├── stores/                         # Zustand state management
│   ├── workspaceStore.ts          # Simplified node management (removed visual positioning)
│   ├── projectStore.ts            # Project management
│   ├── scriptStore.ts             # Script generation and editing
│   └── uiStore.ts                 # UI state management
│
├── utils/                          # Utility functions
│   ├── localStorage.ts            # Enhanced persistence with ChatStorage and ScriptStorage
│   └── fileProcessor.ts           # File upload and processing
│
├── types/                          # TypeScript definitions
│   └── index.ts                   # Core type definitions with isAnalyzed flag
│
├── services/                       # External services (planned)
│   └── database/                  # Database integration (planned)
├── styles/                        # Global CSS + Tailwind
├── App.tsx                        # Main app with routing
└── main.tsx                       # Entry point
```

## Directory Overview

### Core Implementation (Current)
- **`components/script/`** - Script Generation Workspace with enhanced chat system
- **`components/views/`** - EnhancedStaticScriptView as primary interface
- **`components/workspace/`** - Simplified WorkspaceContainer without visual positioning
- **`utils/localStorage.ts`** - ChatStorage class for conversation persistence
- **`styles/`** - Global styling and Tailwind configuration

### Application Structure (Planned)
- **`pages/`** - Top-level page components for routing
- **`components/layout/`** - Navigation, headers, theme providers
- **`components/video/`** - Video Assembly Workspace with timeline and editing
- **`components/content/`** - Content Database management interface
- **`components/home/`** - Dashboard and project management
- **`components/ui/`** - Reusable UI component library

### Supporting Infrastructure (Planned)
- **`hooks/`** - Custom React hooks for business logic
- **`services/`** - API integration, storage, and authentication
- **`store/`** - Global state management (Zustand/Redux)
- **`utils/`** - Helper functions and utilities
- **`types/`** - TypeScript type definitions

## Current Architecture

**Bootstrap Flow:** `main.jsx` → `App.jsx` → `WorkspaceContainer.tsx` → `EnhancedStaticScriptView.tsx`

**Data Flow:**
```
WorkspaceContainer (Simplified State Manager)
  ├── nodes[] (content sources only)
  ├── adAnalyses{} (video analysis data)
  ├── currentScript (script state)
  ├── chatConversations[] (persistent history)
  └── UI state (themes, sidebar)
      ↓
  Enhanced Static View (Primary Interface)
  (Script Editor + Chat History + File Preview)
```

**Migration Target:** Page-based routing with workspace-specific state management and shared component library.

## Key Features

### Chat Conversation System
- **Persistent History**: localStorage-based storage of up to 5 conversations
- **Conversation Management**: Create new chats, switch between existing conversations, delete old ones
- **Auto-title Generation**: Automatic conversation titles based on first user message
- **Real-time Auto-save**: Messages persist immediately across browser sessions
- **Oldest Auto-removal**: When 5-conversation limit reached, oldest is automatically removed

### Video Analysis Persistence  
- **Backend Integration Pattern**: Nodes marked as `isAnalyzed` trigger backend data loading
- **Analysis State Tracking**: Persistent `analysisTimestamp` and status across reloads
- **Single Source Architecture**: Backend serves as authoritative source for analysis data
- **Seamless Transition**: localStorage "fake backend" designed for easy database migration

### Enhanced Content Management
- **Static-First Interface**: Streamlined script editor with sidebar content organization
- **File Preview System**: Click-to-preview uploaded files with full-screen modal support
- **Video Embedding Fallback**: Instagram/social media iframe restrictions handled with "View on Platform" links
- **Content Source Nodes**: Product specs, ads, and instructions managed as simplified content nodes

### Theme System
Three modes (light/dark/experimental) with dynamic styling and consistent color schemes.

### Enhanced File Management System
- **PDF Processing Pipeline**: Python FastAPI backend with PyPDF2 for robust text extraction
- **CORS-Safe Architecture**: Express → Python raw byte transmission avoiding browser limitations
- **File Card UI**: Individual file cards with metadata, processing status, and deletion controls
- **Separated Data Storage**: File metadata for UI, extracted text for AI processing
- **File Preview System**: Click-to-preview uploaded files with full-screen modal support
- **Instagram Video Fallback**: Proper handling of iframe embedding restrictions with "View on Platform" links

### Backend Processing Pipeline
- **Timestamp-First Jump Cut Detection**: Extract timestamps only, then select most significant jump cuts
- **Scene-Based Frame Sampling**: Intelligent positioning within scenes (1/3, 2/3, start/middle/end)
- **Simplified Detection**: Removed delta intensity veto for better jump cut detection
- **30-Frame Target**: Optimized for 30 frames total with proper scene distribution
- **Video Processing**: Support for Instagram, TikTok, YouTube with automated transcription
- **Document Processing**: PDF, TXT, CSV, JSON, Markdown with full content extraction

## Component Overview

### WorkspaceContainer.tsx
Simplified state manager focused on static script view with enhanced chat functionality. Removed node-based workspace complexity while preserving essential UI components. Implements backend analysis data loading for analyzed nodes.

### EnhancedStaticScriptView.tsx
Primary workspace interface with enhanced chat system, file preview capabilities, and streamlined content management. Features integrated AI assistant with conversation history.

### ChatAssistant.jsx
Advanced AI chat interface with conversation history management, real-time streaming, and structured action proposals. Supports up to 5 persistent conversations with automatic title generation.

## Data Models

**Node Structure:**
```javascript
{
  id: string,
  type: 'productSpec' | 'ad' | 'script' | 'instructions',
  position: { x: number, y: number },
  selected: boolean,
  expanded: boolean,
  data: { 
    content: string,              // Combined extracted text for AI
    uploadedFiles: [              // File metadata for UI
      {
        id: string,
        name: string,
        size: number,
        type: string,
        uploadedAt: string,
        success: boolean,
        error?: string,
        pageCount?: number
      }
    ],
    extractedTexts: string[]      // Raw extracted texts
  }
}
```

**Connection:** `{ id, fromNodeId, toNodeId }`
**Viewport:** `{ panOffset: {x, y}, zoomLevel: 25-200% }`

**File Processing Flow:**
```
Frontend Upload → Express (multipart) → Python (raw bytes) → PyPDF2 Extraction → 
  ↓
{uploadedFiles: [...], extractedTexts: [...], content: "combined text"}
```

**Chat Storage Pattern:**
```
User Message → Auto-save to localStorage → Conversation Management → 
  ↓
{conversations: [max 5], currentConversationId, messages: [], titles: []}
```

**Analysis Persistence Flow:**
```
Node Analysis → Backend Storage → Project Load → 
  ↓
Fetch Analysis Data (if isAnalyzed) → Update Node State → UI Reflects Analyzed Status
```

## Backend Processing Architecture

### Jump Cut Detection Algorithm

**Multi-Metric Similarity Analysis:**
- **Perceptual Hash (75%)**: DCT-based structural comparison for major scene changes
- **Histogram Comparison (25%)**: Color distribution analysis for lighting consistency
- **Delta Intensity**: Brightness difference measurement for veto system

**Intelligent Veto System:**
```python
def _is_jump_cut(frame1, frame2, threshold=0.73):
    combined_sim = _combined_similarity(frame1, frame2)  # 75% phash + 25% histogram
    delta_intensity = _delta_intensity(frame1, frame2)
    
    initial_jump_cut = combined_sim < threshold
    delta_veto = delta_intensity > 0.9  # Veto if brightness too similar
    
    return initial_jump_cut and not delta_veto
```

**Configuration:**
- Jump cut threshold: 0.73 (similarity scores below this trigger detection)
- Delta intensity veto: >0.9 similarity prevents false positives
- Target frames: 20 per video with scene-based gap filling

### Debug Tools

**Unified Debug Interface (`debug_jump_cuts.py`):**
- Real-time frame-by-frame analysis with similarity metrics
- Veto status visualization (initial detection vs final result)
- Interactive threshold adjustment with live recalculation
- Generates `jump_cut_debug_report.html` for offline analysis

## Development Notes

**Architecture:** Single source of truth pattern with callback-based updates, React.memo for performance, proper cleanup in useEffect.

**Future Features:** Video assembly workspace, enhanced collaboration, component library extraction.

## AI Tools System

### Tool Management (`/backend/tools/`)

Centralized, context-aware tool system for AI assistant:

**Structure:**
- `tools.json`: Complete tool registry with schemas and metadata
- `toolManager.js`: Smart tool loading based on conversation context
- `toolExecutors.js`: Centralized tool execution handlers
- `index.js`: Clean module interface

**Smart Loading:** AI loads only relevant tools based on conversation:
- Casual chat → core tools only
- "Help with script" → core + script + instruction tools
- "Read workspace" → core + workspace tools

**Benefits:**
- 🎯 Context-aware: 75% reduction in tool overhead
- 🚀 Efficient: Minimal token usage for casual conversations  
- 🛠️ Maintainable: Add tools via JSON, not code changes
- 📊 Observable: Clear reasoning for tool loading decisions

### Prompt Configuration System

All AI prompts stored in `/backend/config/prompts.json`:

**Structure:**
- `base_system`: Minimal core prompt for efficient conversations
- `instruction_modules`: Detailed task-specific guidance loaded on-demand
- `mock_responses`: Fallback messages when API key unavailable

**Dynamic Loading:** AI loads detailed instructions only when needed:
- Casual conversation → minimal 200-token prompt
- Complex task → minimal prompt + relevant instruction modules
- **Result:** ~75% reduction in instruction token usage

**Benefits:**
- Template support with variable substitution (e.g., `{{selectedReferences}}`)
- Easy A/B testing of prompt variations  
- No code changes needed for content updates
- Separation of concerns between logic and content