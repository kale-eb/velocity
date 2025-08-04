# Overall Implementation Plan

## Application Overview
**Short-Form Video Ad Creation Platform** - Frontend-focused React application for creating video advertisements with AI-powered script generation and timeline-based video assembly.

## Implementation Phases

### Phase 0: Foundation (Prerequisites)
**Priority: P0 - Must complete before Phase 1**

#### TypeScript Migration
- [ ] Install TypeScript and related dependencies
- [ ] Convert `.jsx` files to `.tsx` 
- [ ] Add type definitions for existing components
- [ ] Update build configuration for TypeScript
- [ ] Create type definitions in `/src/types/`

#### State Management Setup
- [ ] Install Zustand for global state management
- [ ] Create stores: `projectStore`, `scriptStore`, `uiStore`
- [ ] Migrate existing state from WorkspaceContainer to stores
- [ ] Implement state persistence with local storage

#### Data Infrastructure
- [ ] Create `/src/data/mock/` directory for mock API responses
- [ ] Set up local storage utilities for session data
- [ ] **Local PostgreSQL Setup**:
  - [ ] Install PostgreSQL locally
  - [ ] Create development database: `marketing_app_dev`
  - [ ] Design schema compatible with Supabase migration
  - [ ] Install `pg` (node-postgres) for database connection
  - [ ] Create database service layer with connection pooling
  - [ ] Implement migration system for schema changes

### Phase 1: Script Generation Workspace
**Priority: P1 - Core functionality**

#### Core Features
- [ ] Manual script generation with "Generate Script" button
- [ ] Chunk-based script editing (3 versions per chunk)
- [ ] AI-powered script editing chat integration
- [ ] Graph View enhancements for script generation flow
- [ ] Static View complete overhaul

#### API Integration
- [ ] Mock analyze-ad endpoint (3 sample JSON files)
- [ ] Mock script generation endpoint
- [ ] AI chat integration (Vercel AI SDK recommended)
- [ ] Browser caching for analyzed ads
- [ ] Local storage for projects and scripts

### Phase 2: Video Assembly Workspace  
**Priority: P1 - Core functionality**

#### Timeline System
- [ ] SVG-based timeline with chunk columns
- [ ] Drag & drop video upload
- [ ] Basic video preview system
- [ ] Chunk variant management
- [ ] Export pipeline (client preview + server render)

#### Advanced Features (Later in P2)
- [ ] Double-click chunk editing modal
- [ ] Video trimming and cropping interface
- [ ] AI adherence scoring (mocked)
- [ ] Real-time preview stitching

### Phase 3: Supporting Features
**Priority: P2 - Enhancement**

#### Pages & Navigation
- [ ] Home Dashboard page
- [ ] Content Database page
- [ ] Page-based routing implementation
- [ ] Global navigation and layout components

#### Infrastructure
- [ ] User authentication system
- [ ] Project management system
- [ ] Advanced state management
- [ ] Performance optimizations

## Technology Stack Decisions

### Frontend Core
- **React 18** with TypeScript
- **Vite** for build system
- **Tailwind CSS** for styling
- **Zustand** for state management

### AI Integration Options
1. **Vercel AI SDK** (Recommended)
   - Seamless React integration
   - Multiple provider support
   - Built-in streaming and UI helpers

2. **OpenAI SDK** (Alternative)
   - Direct API integration
   - More control over requests
   - Requires custom UI components

3. **Anthropic SDK** (Alternative)
   - Direct Claude API access
   - Good for complex reasoning tasks

### Data Management
- **Local Storage** for user preferences and session cache
- **PostgreSQL** for persistent data (projects, scripts, video metadata)
  - Local development: Direct PostgreSQL connection
  - Production: Seamless migration to Supabase (PostgreSQL-based)
- **Browser Cache API** for analyzed ad data and thumbnails
- **File System** for uploaded video assets (local dev) → **Supabase Storage** (production)

### Video Processing
- **Client-side**: Canvas API, Web Audio API for previews
- **Server-side**: FFmpeg for final export
- **File Upload**: HTML5 File API with drag & drop

## Development Workflow

### Current State Assessment
-  Basic workspace structure exists
-  Node-based visual editor functional
-  Theme system implemented
- L TypeScript not implemented
- L State management scattered
- L No API integration

### Next Steps
1. **Week 1-2**: TypeScript migration + state management
2. **Week 3-4**: Script generation core features
3. **Week 5-6**: AI integration and script editing
4. **Week 7-8**: Video workspace foundation
5. **Week 9-10**: Video timeline and basic features

### Success Criteria
- [ ] Scripts can be generated from connected nodes
- [ ] AI can edit scripts through chat interface
- [ ] Videos can be uploaded and arranged on timeline
- [ ] Basic export functionality works
- [ ] All data persists locally

## Risk Mitigation

### Technical Risks
- **AI API limits**: Implement mocking and fallbacks
- **Video processing performance**: Start with basic features
- **State complexity**: Use proven patterns (Zustand)
- **Browser compatibility**: Focus on modern browsers initially

### Development Risks
- **Scope creep**: Phase-based implementation
- **Technical debt**: TypeScript migration first
- **API dependency**: Mock-first development

## PostgreSQL Setup Guide

### Local Development Setup
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create development database
createdb marketing_app_dev

# Install Node.js database client
npm install pg @types/pg
npm install -D @types/node
```

### Database Schema Design
**Schema will be compatible with Supabase for easy migration**

```sql
-- Core tables for the platform
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  content JSONB NOT NULL, -- Store script chunks as JSON
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE analyzed_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(500) UNIQUE NOT NULL,
  analysis_data JSONB NOT NULL, -- Store full analysis JSON
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  timeline_data JSONB NOT NULL, -- Store timeline configuration
  export_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Database Service Implementation
```typescript
// /src/services/database.ts
import { Pool } from 'pg';

const pool = new Pool({
  user: 'your_username',
  host: 'localhost',
  database: 'marketing_app_dev',
  password: 'your_password',
  port: 5432,
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  // Migration-ready methods that work with Supabase
  projects: {
    create: async (project: Partial<Project>) => { ... },
    findById: async (id: string) => { ... },
    update: async (id: string, updates: Partial<Project>) => { ... },
  },
  scripts: {
    create: async (script: Partial<Script>) => { ... },
    findByProjectId: async (projectId: string) => { ... },
  }
};
```

### Migration to Supabase (Future)
1. Export schema: `pg_dump --schema-only marketing_app_dev > schema.sql`
2. Import to Supabase project
3. Update connection string to Supabase
4. Enable Row Level Security policies
5. Migrate file storage to Supabase Storage

## Future Considerations
- Multi-user collaboration features
- Cloud deployment and scaling
- Advanced video effects and transitions
- Platform publishing integrations
- Performance analytics and monitoring