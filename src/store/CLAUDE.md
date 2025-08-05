# Global State Management Documentation

## Application Purpose
**Short-form video ad creation platform** - Zustand stores provide type-safe, persistent state management with PostgreSQL database integration.

## ✅ Implemented Stores

### workspaceStore.ts
**Visual Node Editor State** (Implemented):
- Complete workspace state (nodes, connections, selection, viewport)
- Auto-connection logic for new nodes
- Node type limits enforcement (1 product spec, 6 ads, 4 instructions, 1 script)
- Drag & drop state management with coordinate transformations
- History system with undo/redo (20 actions)
- Reorganize functionality with predefined layouts
- **Database Integration**: Workspace state persistence via PostgreSQL

**Key Features**:
```typescript
// Node management with type safety
addNode: (type: NodeType, position: Point) => string | null
updateNode: (id: string, updates: Partial<WorkspaceNode>) => void
deleteNode: (id: string) => void

// Connection management
addConnection: (sourceId: string, targetId: string) => void
removeConnection: (id: string) => void

// Viewport state
setZoomLevel: (level: number) => void
setPanOffset: (offset: Point) => void
```

### projectStore.ts
**Project Management State** (Implemented):
- Current project tracking and metadata
- Project creation and selection
- **Database Integration**: Full CRUD operations via PostgreSQL service
- Type-safe project operations with UUID support

### scriptStore.ts
**Script Generation State** (Implemented):
- Script content management with chunk-based structure
- Generation state tracking and AI integration preparation
- **Database Integration**: Script persistence with JSONB content storage
- Support for multiple script versions per project

### uiStore.ts
**Global UI State** (Implemented):
- Theme management (light, dark, experimental)
- View mode switching (graph, static)
- Sidebar and chat panel state
- Loading and error state management
- **Persistence**: Local storage for user preferences

## 🔗 Database Integration

### **State Persistence**
All stores integrate with PostgreSQL database service:

```typescript
// Workspace state automatically persists
const { nodes, connections, zoomLevel, panOffset } = useWorkspaceStore()
// Saved to database via workspaceService.save()

// Project operations hit database directly
const project = await projectService.create({ name, description })
```

### **Type Safety**
- Full TypeScript integration with database service
- Compile-time error checking for all state operations
- IntelliSense support for complex nested data structures

### **Performance Optimizations**
- Zustand middleware for persistence (local storage + database)
- Selective re-rendering with granular subscriptions
- Connection pooling via database service
- JSONB storage for complex state objects

## 🔧 Planned Store Extensions

### videoStore.js
**Video Assembly Workspace state** including:
- Timeline state and chunk arrangements
- Video variants and selection paths
- Export queue and processing status
- Preview state and playback controls

### contentStore.js
**Content Database state** managing:
- Asset library and metadata
- Search filters and preferences
- Upload queue and processing status
- Content organization and tagging

## Architecture Benefits

### **Implemented**
- **Type Safety**: Full TypeScript integration with database types
- **Persistence**: Automatic state persistence with PostgreSQL + local storage
- **Performance**: Optimized re-rendering and database connection pooling
- **Reliability**: Database transactions and error handling
- **Migration Ready**: Seamless transition to Supabase production

### **State Patterns**
- **Normalized Data**: Efficient data structure for complex relationships
- **Database Sync**: Automatic synchronization between UI state and database
- **Undo/Redo**: Action history for workspace operations (implemented)
- **Optimistic Updates**: Immediate UI feedback with background database sync

## Development Workflow

### **State Management**
```typescript
// Type-safe store usage
const { addNode, nodes, connections } = useWorkspaceStore()
const { currentProject } = useProjectStore()
const { theme, setTheme } = useUIStore()
```

### **Database Operations**
```typescript
// Automatic persistence
workspaceService.save(projectId, { nodes, connections, zoomLevel, panOffset })

// Direct database operations
const project = await projectService.create({ name: "My Project" })
```

This state management architecture provides a robust, type-safe foundation that scales with the platform's complexity while maintaining excellent performance through intelligent database integration.