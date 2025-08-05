# Services Documentation

## Application Purpose
**Short-form video ad creation platform** - Services handle external integrations, API communication, database operations, and core business logic.

## ✅ Implemented Services

### database/
**PostgreSQL Database Service Layer** (Implemented):
- `index.ts` - Complete database service with TypeScript integration
- `schema.sql` - Comprehensive database schema with UUID support
- `init.ts` - Database initialization and setup scripts

**Database Features**:
- Full CRUD operations for projects, scripts, workspace states
- Ad analysis caching system for performance optimization
- Connection pooling and health monitoring
- Migration-ready architecture for Supabase deployment
- Automatic timestamp management with triggers
- JSONB storage for complex data structures (nodes, connections, script chunks)

**Database Schema Overview**:
- `projects` - Top-level project containers
- `scripts` - AI-generated script content with chunk-based structure
- `workspace_states` - Visual editor persistence (nodes, connections, viewport)
- `analyzed_ads` - Cached ad analysis results
- `video_projects` - Future video assembly timeline data

## 🔧 Planned Service Structure

### api/
**Backend API integration** including:
- `script.js` - Script generation and AI-powered content creation
- `video.js` - Video processing, export, and adherence scoring
- `content.js` - Content database management and asset operations
- `ai.js` - Direct AI service integration (GPT-4, Claude, etc.)

### storage/
**File and data storage services**:
- `s3.js` - S3-compatible storage for videos, images, and assets
- `local.js` - Local storage utilities for user preferences and cache

### auth/
**Authentication and user management**:
- `auth.js` - User authentication, session management, and permissions

## Key Integration Points
- **Database Operations**: Type-safe CRUD operations with PostgreSQL
- **AI Services**: Script generation, video analysis, and content scoring
- **Media Processing**: Video upload, thumbnail generation, and format conversion
- **Data Persistence**: Project data, workspace states, and asset metadata
- **External APIs**: Platform integrations (TikTok, Instagram, YouTube)
- **Supabase Migration**: Seamless transition from local PostgreSQL to production

## Database Service Features
- **Type Safety**: Full TypeScript integration with application types
- **Connection Management**: Efficient pooling and health monitoring
- **Performance**: Optimized indexes and JSONB for complex queries
- **Migration Path**: Local development → Supabase production deployment
- **Caching**: Built-in ad analysis result caching
- **Persistence**: Workspace state and viewport persistence

## Development Workflow
- `npm run db:init` - Initialize database schema
- `npm run db:reset` - Reset database and reinitialize
- Environment configuration via `.env` files
- Health check endpoints for monitoring

These services provide a robust foundation for all data operations across the Script Generation and Video Assembly workspaces, with a production-ready database architecture supporting the platform's growth.