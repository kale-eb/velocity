# Pages Documentation

## Application Purpose
**Short-form video ad creation platform** - These are the main application pages that users navigate between for different workflows.

## Planned Pages

### HomePage.jsx
Project dashboard and landing page featuring:
- Recent projects grid with thumbnails and metadata
- Quick action buttons for creating new projects
- Project templates and getting started guides
- Analytics overview and platform announcements

### ContentDatabasePage.jsx
Centralized content management interface including:
- Grid/list view of all uploaded media and assets
- Advanced filtering and search capabilities
- Bulk upload and organization tools
- Content tagging and metadata management

### ScriptWorkspacePage.jsx
**Currently in development** - Will replace current WorkspaceContainer approach with:
- Page-level routing and state management
- Integration of Graph and Static views
- Improved project persistence and collaboration features

### VideoWorkspacePage.jsx
Timeline-based video assembly workspace featuring:
- SVG timeline with chunk-based video editing
- Multiple variant support for A/B testing
- Real-time preview and AI adherence scoring
- Export functionality with FFmpeg integration

## Implementation Status
Currently using WorkspaceContainer.jsx as the main interface. Migration to page-based architecture planned to support:
- Better routing and deep linking
- Workspace-specific state management
- Improved user navigation and project organization