# Global State Management Documentation

## Application Purpose
**Short-form video ad creation platform** - Global stores manage shared application state using Zustand for efficient state management across workspaces.

## Planned Stores

### projectStore.js
**Project-level state management** including:
- Current project data and metadata
- Project settings and preferences
- Collaboration state and user permissions
- Auto-save queue and sync status

### scriptStore.js
**Script Generation Workspace state** featuring:
- Node graph state (nodes, connections, positions)
- Script content and chunk organization
- AI chat history and context
- Viewport state (zoom, pan, selection)

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

### uiStore.js
**Global UI state** including:
- Theme preferences and settings
- Navigation state and sidebar collapse
- Modal and overlay management
- Notification and toast queue

## Architecture Benefits
- **Performance**: Selective re-rendering with granular subscriptions
- **Persistence**: Automatic state persistence with local storage
- **DevTools**: Integration with Redux DevTools for debugging
- **TypeScript**: Type-safe state management with full IntelliSense

## State Patterns
- **Normalized Data**: Efficient data structure for complex relationships
- **Optimistic Updates**: Immediate UI feedback with background sync
- **Undo/Redo**: Action history for workspace operations
- **Real-time Sync**: WebSocket integration for collaborative features

This architecture will support scalable state management as the platform grows in complexity and user base.