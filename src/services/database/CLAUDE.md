# Database Service Documentation

## Application Purpose
**Short-form video ad creation platform** - Database service provides type-safe PostgreSQL operations with Supabase migration support.

## Database Architecture

### **🗂️ Core Tables**

#### **Projects** (`projects`)
- **Purpose**: Top-level project containers
- **Structure**: UUID primary key, name, description, timestamps
- **Relationships**: Parent to scripts, workspace states, video projects

#### **Scripts** (`scripts`) 
- **Purpose**: AI-generated script content with chunk-based structure
- **Structure**: JSONB content field storing script chunks with multiple versions
- **Features**: Status tracking (draft → generated → editing → final)
- **Foreign Keys**: Links to projects with CASCADE delete

#### **Workspace States** (`workspace_states`)
- **Purpose**: Persists visual node editor state
- **Structure**: JSONB fields for nodes, connections, zoom, pan offset
- **Features**: One-to-one relationship with projects
- **Data**: Complete workspace persistence across browser sessions

#### **Analyzed Ads** (`analyzed_ads`)
- **Purpose**: Performance cache for expensive AI analysis results
- **Structure**: URL-based cache with JSONB analysis data
- **Features**: UNIQUE constraint on URL, automatic cache invalidation
- **Benefits**: Prevents re-analyzing same ads, improves user experience

#### **Video Projects** (`video_projects`)
- **Purpose**: Future video assembly workspace data (Phase 2)
- **Structure**: Timeline data and export settings in JSONB
- **Relationships**: Links to source scripts

### **🔗 Database Relationships**
```
PROJECTS (1) ──┬── SCRIPTS (N)
               ├── WORKSPACE_STATES (1)
               └── VIDEO_PROJECTS (N)

ANALYZED_ADS (Independent cache)
```

## Service Layer Architecture

### **Connection Management**
```typescript
// Efficient connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### **Service Modules**

#### **Project Service** (`projectService`)
- `create()` - Create new projects
- `findById()` - Retrieve project by UUID
- `findAll()` - List all projects with ordering
- `update()` - Partial project updates
- `delete()` - Remove projects with CASCADE cleanup

#### **Script Service** (`scriptService`)
- `create()` - Store generated scripts with JSONB content
- `findByProjectId()` - Get all scripts for a project
- `update()` - Version script content and status
- `delete()` - Remove scripts

#### **Ad Analysis Service** (`adAnalysisService`)
- `findByUrl()` - Check cache for existing analysis
- `cache()` - Store analysis results with UPSERT logic
- `clearOldCache()` - Maintenance for cache cleanup

#### **Workspace Service** (`workspaceService`)
- `save()` - Persist complete workspace state
- `load()` - Restore workspace configuration
- UPSERT logic for single workspace per project

## **⚡ Performance Features**

### **Optimized Indexes**
```sql
CREATE INDEX idx_scripts_project_id ON scripts(project_id);
CREATE INDEX idx_analyzed_ads_url ON analyzed_ads(url);
CREATE INDEX idx_workspace_states_project_id ON workspace_states(project_id);
```

### **Automatic Timestamps**
```sql
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **JSONB Performance**
- Efficient storage for complex nested data
- Fast queries on JSON fields
- Index support for JSON operations

## **🚀 Migration Strategy**

### **Local Development**
- PostgreSQL 15 with direct connection
- Full schema control and development flexibility
- Easy reset and initialization with npm scripts

### **Production (Supabase)**
- Seamless migration with compatible schema
- Row Level Security policy support
- Built-in authentication integration
- Automatic backups and scaling

### **Migration Commands**
```bash
# Initialize local database
npm run db:init

# Reset database completely  
npm run db:reset

# Export schema for production
pg_dump --schema-only marketing_app_dev > migration.sql
```

## **🔧 Development Workflow**

### **Environment Configuration**
```bash
# .env.example
DB_HOST=localhost
DB_PORT=5432
DB_NAME=marketing_app_dev
DB_USER=your_username
DB_PASSWORD=your_password
```

### **Health Monitoring**
```typescript
// Built-in health checks
const isHealthy = await healthCheck();
```

### **Type Safety**
- Full TypeScript integration with application types
- Compile-time error checking for database operations
- IntelliSense support for all database methods

## **🎯 Benefits**

### **Developer Experience**
- Type-safe database operations
- Clear service boundaries
- Comprehensive error handling
- Easy testing and mocking

### **Performance**
- Connection pooling for efficiency
- Intelligent caching strategies
- Optimized queries with proper indexes
- JSONB for complex data structures

### **Scalability**
- Migration-ready architecture
- Service layer abstraction
- Environment-based configuration
- Production deployment flexibility

This database service provides the robust foundation needed for the platform's script generation and video assembly workflows while maintaining excellent performance and developer experience.