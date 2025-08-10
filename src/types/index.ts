// Core application types

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// Node types
export type NodeType = 'ad' | 'instructions' | 'script' | 'scriptGenerator' | 'productSpec';

export interface NodePosition {
  x: number;
  y: number;
}

export interface BaseNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  isSelected?: boolean;
  isDragging?: boolean;
  data?: any;
}

export interface AdNode extends BaseNode {
  type: 'ad';
  data: {
    title: string;
    url: string;
    status: string;
    analysis?: AdAnalysis;
    isAnalyzing?: boolean;
  };
}

export interface InstructionsNode extends BaseNode {
  type: 'instructions';
  data: {
    content: string;
  };
}

export interface ProductSpecNode extends BaseNode {
  type: 'productSpec';
  data: {
    documents: Array<{
      id: string;
      name: string;
      type: string;
      size: string;
      uploadedAt: string;
    }>;
  };
}

export interface ScriptGeneratorNode extends BaseNode {
  type: 'script';
  data: {
    messages: Array<{role: string; content: string}>;
    isActive: boolean;
    hasScript?: boolean;
    isGenerating?: boolean;
    scriptId?: string;
  };
}

export interface ScriptGenerationNode extends BaseNode {
  type: 'scriptGenerator';
  data: {
    inputs: {
      product_specs: string;
      ad_refs: string[];
      extra_instructions: string;
    };
    script?: {
      id: string;
      title: string;
      chunks: Array<{
        id: string;
        type: 'HOOK' | 'PRODUCT' | 'CTA';
        script_text: string;
        camera_instruction: string;
      }>;
    };
    adAnalyses?: Record<string, any>;
    lastGenerated?: string;
    isGenerating?: boolean;
    expanded?: boolean;
  };
}

export type WorkspaceNode = AdNode | InstructionsNode | ProductSpecNode | ScriptGeneratorNode | ScriptGenerationNode;

// Connection types
export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  sourceType?: NodeType;
  targetType?: NodeType;
}

// Workspace state
export interface WorkspaceState {
  nodes: WorkspaceNode[];
  connections: Connection[];
  selectedNodeId: string | null;
  zoomLevel: number;
  panOffset: Point;
  canvasBounds: Bounds;
  dragState: {
    isDragging: boolean;
    draggedNodeId: string | null;
    startPosition: Point | null;
    offset: Point | null;
  };
  history: {
    past: WorkspaceState[];
    present: WorkspaceState;
    future: WorkspaceState[];
  };
}

// Script types
export interface ScriptChunk {
  id: string;
  type: 'hook' | 'body' | 'cta';
  versions: ScriptVersion[];
  selectedVersion: number;
  metadata?: {
    cameraDirection?: string;
    visualNotes?: string;
    duration?: number;
  };
}

export interface ScriptVersion {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Script {
  id: string;
  projectId: string;
  chunks: ScriptChunk[];
  status: 'draft' | 'generated' | 'editing' | 'final';
  createdAt: Date;
  updatedAt: Date;
}

// Ad analysis types
export interface AdAnalysisChunk {
  id: string;
  type: 'hook' | 'body' | 'cta';
  startTime: number;
  endTime: number;
  visual: {
    description: string;
    cameraAngle: string;
    lighting: string;
    movement: string;
    textOverlay?: string;
    background: string;
  };
  audio: {
    transcript: string;
    tone: string;
    backgroundMusic: string;
    volume: string;
  };
}

export interface AdAnalysis {
  id: string;
  url: string;
  summary: string;
  visualStyle: string;
  audioStyle: string;
  duration: number;
  chunks: AdAnalysisChunk[];
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  workspace: WorkspaceState;
  scripts: Script[];
  createdAt: Date;
  updatedAt: Date;
}

// UI state types
export type ViewMode = 'graph' | 'static';
export type Theme = 'light' | 'dark' | 'experimental';

export interface UIState {
  currentView: ViewMode;
  theme: Theme;
  sidebarOpen: boolean;
  chatOpen: boolean;
  loading: boolean;
  error: string | null;
}

// API types
export interface APIError {
  message: string;
  code?: string;
  details?: any;
}

export interface APIResponse<T> {
  data?: T;
  error?: APIError;
  success: boolean;
}

// Video types (for future video workspace)
export interface VideoChunk {
  id: string;
  type: 'hook' | 'product' | 'cta';
  file?: File;
  thumbnail?: string;
  duration?: number;
  selected: boolean;
  metadata: {
    trimStart?: number;
    trimEnd?: number;
    cropArea?: CropArea;
    version?: string;
    notes?: string;
  };
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Timeline {
  columns: ChunkColumn[];
  selectedPath: string[];
  zoomLevel: number;
  viewportOffset: Point;
}

export interface ChunkColumn {
  id: string;
  type: 'hook' | 'product' | 'cta';
  position: Point;
  chunks: VideoChunk[];
}