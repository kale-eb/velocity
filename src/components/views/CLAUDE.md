# Views Components Documentation

## Application Purpose
**Marketing content creation platform** for short-form video ads. Views provide alternative interfaces to interact with the same workspace data - currently includes a traditional sidebar-based editor as an alternative to the visual node system.

## Components

### StaticScriptView.jsx - Traditional Script Editor Interface

**Purpose**: Sidebar-based interface for script editing and content management, alternative to the visual node-based workspace.

**Props**: `nodes[]`, `colorScheme`, `onAddNode/Update/Delete`, `chatExpanded`, `onToggleChat`

**State Management:**
- `sidebarCollapsed`: Left sidebar visibility toggle
- `scriptContent`: Main script text editor content  
- `chatMessages[]` + `chatInput`: Chat system with mock AI responses
- `chatWidth` + `isResizing`: Resizable chat panel (300-600px)

**Core Functions:**
- Node creation: `handleAddProductSpec/Ad/Instructions()` with type-specific default data
- Chat system: `handleSendMessage()` with 1-second delayed mock AI responses (7 predefined responses)
- UI interactions: Resize handling, keyboard shortcuts (Enter to send)

**UI Layout:**
- **Left Sidebar** (collapsible w-80↔w-12): Categorized content sources, add buttons, node limits
- **Main Area**: Script editor with monospace textarea, header with AI chat toggle
- **Right Chat Panel** (resizable 300-600px): AI chat with drag handle, role-based message styling

**Node Organization:**
- Filters nodes by type: `productSpecs`, `ads`, `instructions`
- **Business Rules**: Product specs (unlimited), ads (max 6), instructions (max 4)
- **Display**: Shows type-specific data (document count, title/status, content preview)

**Theme System:**
Three modes with dynamic gradients and dot patterns - light (gray/blue), dark (black/purple), experimental (black/yellow)

## Integration & Data Flow

**Architecture:** `WorkspaceContainer` (master state) → `StaticScriptView` (filtered interface) → callbacks → updates

**Key Integration:**
- Receives filtered nodes (excludes script generator type)
- All operations via parent callbacks (`onAddNode`, `onUpdateNode`, `onDeleteNode`)
- Chat state managed locally, theme/visibility shared with container
- Seamless switching with Graph View using same underlying data

**Performance & UX:**
- Proper event listener cleanup, responsive design with collapsible/resizable panels
- Visual feedback (disabled states at limits, hover effects, delayed AI responses)
- Keyboard shortcuts and accessibility support

This component provides an effective traditional alternative to the node-based interface while maintaining full feature parity and data consistency.