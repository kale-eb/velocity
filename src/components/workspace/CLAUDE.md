# Workspace Components Documentation

## Application Purpose
**Marketing content creation platform** for short-form video ads. The workspace provides a node-based visual editor for organizing product specs, ads, and instructions into script generation workflows.

## Overview
Core components implementing the visual node editor with drag-and-drop, collision detection, zoom/pan navigation, and state management.

## Components

### WorkspaceContainer.jsx - The Orchestrator

**Purpose**: Central coordinator managing shared state, view switching, and data flow.

**Key State:**
- `nodes[]` & `connections[]`: Master data for all views
- `activeTab`: 'Scripting' | 'Video Assembly'  
- `currentView`: 'Graph View' | 'Static View'
- `savedViewportState`: Pan/zoom persistence across views
- `colorScheme`: 'light' | 'dark' | 'experimental'

**Core Functions:**
- `handleAddNode()`: Creates nodes with radial collision detection, enforces limits (6 ads, 4 instructions)
- `handleUpdateNode()` / `handleDeleteNode()`: Node lifecycle management
- View filtering: Graph shows all nodes, Static excludes script generator
- Viewport persistence: Saves/restores pan/zoom when switching views

**Data Flow:** Master state → child components → callbacks → state updates

---

### NodeBasedWorkspaceFixed.jsx - Advanced Visual Editor

**Purpose**: Full-featured node-based workspace with drag/drop, collision detection, zoom/pan, and interaction features.

**Key State:**
- Dual state system: `localNodes` (rendering) + `propNodes` (shared data)
- `selectedNodes`, `draggedNodes`, `panOffset`, `zoomLevel`, `canvasBounds`
- History system: `undoHistory`/`redoHistory` (20 actions max)

**Core Features:**
- **Drag System**: Screen-to-workspace coordinate transformation with proper offset handling
- **Collision Detection**: Rectangle overlap with center-to-center push algorithms
- **Dynamic Dimensions**: Node sizes based on type and expansion state (script: 384×320px)
- **Canvas Management**: Dynamic bounds expansion (max 3000×2000px), viewport constraints
- **Reorganize**: Predefined position matrices, script generator centered with ads column
- **SVG Connections**: Bézier curve splines with dynamic anchor points
- **Context Menu**: Right-click node spawning with collision avoidance

**Performance**: React.memo, cached calculations, debounced updates, proper cleanup

### NodeBasedWorkspace.jsx - Legacy Implementation

**Purpose**: Original workspace, superseded by NodeBasedWorkspaceFixed.jsx.

**Differences**: Direct state manipulation, basic drag/collision, simple splines, no history/undo, hardcoded dimensions.

## Integration Architecture

**Data Flow:** `WorkspaceContainer` (master state) ↔ `NodeBasedWorkspaceFixed` (rendering) ↔ callbacks → other views

**Key Patterns:**
- Single source of truth with bidirectional sync
- View-specific filtering (Graph: all nodes, Static: excludes script generator)
- Viewport persistence across view switches
- Radial collision detection for node positioning
- Screen ↔ workspace coordinate transformations

This system demonstrates advanced React patterns for interactive editors with emphasis on performance and maintainable architecture.