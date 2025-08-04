import { Pool, PoolClient } from 'pg';
import type { Project, Script, WorkspaceState, AdAnalysis } from '../../types';
import fs from 'fs';
import path from 'path';

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || process.env.USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'marketing_app_dev',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
});

// Database initialization
export const initializeDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    client.release();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Generic query function
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

// Project operations
export const projectService = {
  create: async (project: Partial<Project>): Promise<Project> => {
    const { name, description } = project;
    const result = await query(
      'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  },

  findById: async (id: string): Promise<Project | null> => {
    const result = await query('SELECT * FROM projects WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  findAll: async (): Promise<Project[]> => {
    const result = await query('SELECT * FROM projects ORDER BY created_at DESC');
    return result.rows;
  },

  update: async (id: string, updates: Partial<Project>): Promise<Project | null> => {
    const { name, description } = updates;
    const result = await query(
      'UPDATE projects SET name = COALESCE($2, name), description = COALESCE($3, description) WHERE id = $1 RETURNING *',
      [id, name, description]
    );
    return result.rows[0] || null;
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await query('DELETE FROM projects WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
};

// Script operations
export const scriptService = {
  create: async (script: Partial<Script & { project_id: string }>): Promise<Script> => {
    const { project_id, content, status = 'draft' } = script;
    const result = await query(
      'INSERT INTO scripts (project_id, content, status) VALUES ($1, $2, $3) RETURNING *',
      [project_id, JSON.stringify(content), status]
    );
    return { ...result.rows[0], content: JSON.parse(result.rows[0].content) };
  },

  findById: async (id: string): Promise<Script | null> => {
    const result = await query('SELECT * FROM scripts WHERE id = $1', [id]);
    if (result.rows[0]) {
      return { ...result.rows[0], content: JSON.parse(result.rows[0].content) };
    }
    return null;
  },

  findByProjectId: async (projectId: string): Promise<Script[]> => {
    const result = await query('SELECT * FROM scripts WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return result.rows.map((row: any) => ({
      ...row,
      content: JSON.parse(row.content)
    }));
  },

  update: async (id: string, updates: Partial<Script>): Promise<Script | null> => {
    const { content, status } = updates;
    const result = await query(
      'UPDATE scripts SET content = COALESCE($2, content), status = COALESCE($3, status) WHERE id = $1 RETURNING *',
      [id, content ? JSON.stringify(content) : null, status]
    );
    if (result.rows[0]) {
      return { ...result.rows[0], content: JSON.parse(result.rows[0].content) };
    }
    return null;
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await query('DELETE FROM scripts WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
};

// Analyzed ads cache operations
export const adAnalysisService = {
  findByUrl: async (url: string): Promise<AdAnalysis | null> => {
    const result = await query('SELECT * FROM analyzed_ads WHERE url = $1', [url]);
    if (result.rows[0]) {
      return JSON.parse(result.rows[0].analysis_data);
    }
    return null;
  },

  cache: async (url: string, analysis: AdAnalysis): Promise<void> => {
    await query(
      'INSERT INTO analyzed_ads (url, analysis_data) VALUES ($1, $2) ON CONFLICT (url) DO UPDATE SET analysis_data = $2, cached_at = NOW()',
      [url, JSON.stringify(analysis)]
    );
  },

  clearOldCache: async (daysOld: number = 30): Promise<number> => {
    const result = await query(
      'DELETE FROM analyzed_ads WHERE cached_at < NOW() - INTERVAL \'$1 days\'',
      [daysOld]
    );
    return result.rowCount;
  }
};

// Workspace state operations
export const workspaceService = {
  save: async (projectId: string, workspaceState: Partial<WorkspaceState>): Promise<void> => {
    const { nodes, connections, zoomLevel, panOffset } = workspaceState;
    await query(
      `INSERT INTO workspace_states (project_id, nodes, connections, zoom_level, pan_offset) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (project_id) DO UPDATE SET 
         nodes = $2, connections = $3, zoom_level = $4, pan_offset = $5`,
      [
        projectId,
        JSON.stringify(nodes || []),
        JSON.stringify(connections || []),
        zoomLevel || 100,
        JSON.stringify(panOffset || { x: 0, y: 0 })
      ]
    );
  },

  load: async (projectId: string): Promise<Partial<WorkspaceState> | null> => {
    const result = await query('SELECT * FROM workspace_states WHERE project_id = $1', [projectId]);
    if (result.rows[0]) {
      const row = result.rows[0];
      return {
        nodes: JSON.parse(row.nodes),
        connections: JSON.parse(row.connections),
        zoomLevel: row.zoom_level,
        panOffset: JSON.parse(row.pan_offset)
      };
    }
    return null;
  }
};

// Connection health check
export const healthCheck = async (): Promise<boolean> => {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  await pool.end();
};

// Export the pool for advanced usage if needed
export { pool };