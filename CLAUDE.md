# Marketing App Codebase Documentation

## Application Concept

**Short-Form Video Ad Creation Platform** - A comprehensive React-based platform for creating short-form video advertisements for Instagram, Facebook, and TikTok. The platform combines AI-powered content generation with visual workflow management and video assembly tools.

### Core Concept
The platform operates through **two main workspaces** that work together:

1. **Script Generation Workspace** - AI-powered script creation and refinement
   - **Graph View**: Visual node-based editor connecting product specs, ad examples, and instructions into a script generator
   - **Static View**: Traditional chunk-based script editor with integrated AI assistant

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
- **Enhanced Chat UX** - Modern AI chat interface with real-time feedback
- **Video Analysis Pipeline** - AI-powered analysis of short-form video ads with frame extraction and OpenAI GPT-5-mini

The platform streamlines the entire process from initial concept to final video export, making professional marketing content creation accessible and efficient.

## Technology Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js + Python FastAPI for video processing
- **AI Integration**: OpenAI GPT-5-mini for script generation and video analysis
- **Storage**: localStorage for persistence, file upload processing
- **Icons**: Lucide React, **Connections**: SVG
- **Code Quality**: ESLint

## Project Structure
```
src/
├── pages/                          # Main application pages
│   ├── HomePage.jsx                # Project dashboard (planned)
│   ├── ContentDatabasePage.jsx     # Content management (planned)
│   ├── ScriptWorkspacePage.jsx     # Script generation (in development) 
│   └── VideoWorkspacePage.jsx      # Video assembly (planned)
│
├── components/
│   ├── layout/                     # App-wide layout components (planned)
│   ├── script/                     # Script Generation Workspace
│   │   ├── graph/                  # Graph View (node-based) - current implementation
│   │   ├── static/                 # Static View (traditional editor) - current implementation  
│   │   └── shared/                 # Shared script components (planned)
│   ├── video/                      # Video Assembly Workspace (planned)
│   │   ├── timeline/               # SVG timeline components
│   │   ├── preview/                # Video preview components
│   │   ├── editing/                # Video editing modals
│   │   └── upload/                 # Video upload components
│   ├── content/                    # Content Database components (planned)
│   ├── home/                       # Home page components (planned)
│   └── ui/                         # Reusable UI components
│
├── hooks/                          # Custom React hooks (planned)
├── services/                       # API and external services (planned)
│   ├── api/                        # API integration
│   ├── storage/                    # Storage services  
│   └── auth/                       # Authentication
├── store/                          # Global state management (planned)
├── utils/                          # Utility functions
├── types/                          # TypeScript definitions (planned)
├── styles/                         # Global CSS + Tailwind
├── App.jsx                         # Main app with routing
└── main.jsx                        # Entry point
```

## Directory Overview

### Core Implementation (Current)
- **`components/script/`** - Script Generation Workspace with Graph and Static views
- **`components/workspace/`** - Legacy workspace components (being migrated)
- **`components/views/`** - Current view implementations
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

**Bootstrap Flow:** `main.jsx` → `App.jsx` → `WorkspaceContainer.jsx` → view components

**Data Flow:**
```
WorkspaceContainer (Master State)
  ├── nodes[] + connections[] (shared workspace data)
  ├── viewport state (pan/zoom persistence)
  └── UI state (themes, views, sidebar)
      ↓
  Graph View ←→ Static View
  (Visual Editor)  (Traditional Interface)
```

**Migration Target:** Page-based routing with workspace-specific state management and shared component library.

## Key Features

### Node-Based Workspace
- **Node Types**: Product Spec, Ad, Script Generator (384×320px), Instructions
- **Smart Interactions**: Drag & drop with collision detection, radial positioning algorithm
- **Advanced Features**: Zoom/pan with bounds, undo/redo (20 actions), reorganize with predefined layouts

### Dual Interface Modes
- **Graph View**: Visual node editor with SVG connections, multi-select, context menus
- **Static View**: Traditional sidebar with script editor, categorized content, AI chat integration

### State Management
- **Single Source**: WorkspaceContainer manages master state
- **View Filtering**: Graph shows all nodes, Static excludes script generator
- **Persistence**: Viewport state saved across view switches

### Theme System
Three modes (light/dark/experimental) with dynamic styling and consistent color schemes.

### Enhanced File Management System
- **PDF Processing Pipeline**: Python FastAPI backend with PyPDF2 for robust text extraction
- **CORS-Safe Architecture**: Express → Python raw byte transmission avoiding browser limitations
- **File Card UI**: Individual file cards with metadata, processing status, and deletion controls
- **Separated Data Storage**: File metadata for UI, extracted text for AI processing

### Backend Processing Pipeline
- **Timestamp-First Jump Cut Detection**: Extract timestamps only, then select most significant jump cuts
- **Scene-Based Frame Sampling**: Intelligent positioning within scenes (1/3, 2/3, start/middle/end)
- **Simplified Detection**: Removed delta intensity veto for better jump cut detection
- **30-Frame Target**: Optimized for 30 frames total with proper scene distribution
- **Video Processing**: Support for Instagram, TikTok, YouTube with automated transcription
- **Document Processing**: PDF, TXT, CSV, JSON, Markdown with full content extraction

## Component Overview

### WorkspaceContainer.jsx
Master state manager handling node lifecycle, view switching, and viewport persistence. Implements radial collision detection for node positioning.

### NodeBasedWorkspaceFixed.jsx  
Advanced visual editor with drag & drop, coordinate transformations, collision detection, canvas bounds management, and 20-action history system.

### StaticScriptView.jsx
Traditional three-panel interface (sidebar/editor/chat) with resizable panels, mock AI chat, and content organization.

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