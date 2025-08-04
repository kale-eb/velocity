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

The platform streamlines the entire process from initial concept to final video export, making professional marketing content creation accessible and efficient.

## Technology Stack
- **React 18** + **Vite** + **Tailwind CSS**
- **Lucide React** for icons, **SVG** for node connections
- **ESLint** for code quality

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
  data: { /* type-specific properties */ }
}
```

**Connection:** `{ id, fromNodeId, toNodeId }`
**Viewport:** `{ panOffset: {x, y}, zoomLevel: 25-200% }`

## Development Notes

**Architecture:** Single source of truth pattern with callback-based updates, React.memo for performance, proper cleanup in useEffect.

**Future Features:** Video assembly workspace, enhanced collaboration, component library extraction.