import React, { useState, useCallback, useRef } from 'react';
import { 
  Upload,
  Video,
  Play,
  Trash2,
  Zap,
  Camera,
  Scissors,
  Image,
  Film,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface WorkspaceNode {
  id: string;
  type: 'hook' | 'product' | 'cta' | 'transition' | 'broll' | 'final';
  position: { x: number; y: number };
  selected: boolean;
  expanded: boolean;
  data?: any;
}

interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

const NODE_VIDEO_LIMITS = {
  hook: { min: 1, max: 2, description: 'Hook videos to grab attention' },
  product: { min: 1, max: 3, description: 'Product showcase videos' },
  cta: { min: 1, max: 1, description: 'Call-to-action video' },
  transition: { min: 1, max: 2, description: 'Transition clips' },
  broll: { min: 2, max: 3, description: 'B-roll footage' },
  final: { min: 0, max: 0, description: 'Final assembled video' }
};





const NodeGraphWorkspace: React.FC = () => {
  // Modern workflow with shared nodes
  const [nodes] = useState<WorkspaceNode[]>([
    // Input nodes (left side)
    {
      id: 'hook-input',
      type: 'hook',
      position: { x: 100, y: 200 },
      selected: false,
      expanded: false,
      data: {
        title: 'Hook Content',
        description: 'Attention-grabbing opener',
        videos: [],
        status: 'ready',
        trackId: 'track-1'
      }
    },
    {
      id: 'product-input',
      type: 'product',
      position: { x: 100, y: 320 },
      selected: false,
      expanded: false,
      data: {
        title: 'Product Demo',
        description: 'Core product content',
        videos: [],
        status: 'ready',
        trackId: 'track-2'
      }
    },
    {
      id: 'cta-input',
      type: 'cta',
      position: { x: 100, y: 440 },
      selected: false,
      expanded: false,
      data: {
        title: 'Call to Action',
        description: 'Conversion driver',
        videos: [],
        status: 'ready',
        trackId: 'track-3'
      }
    },
    
    // Shared processing nodes (center)
    {
      id: 'shared-broll',
      type: 'broll',
      position: { x: 350, y: 260 },
      selected: false,
      expanded: false,
      data: {
        title: 'B-Roll Library',
        description: 'Shared supporting footage',
        videos: [],
        status: 'ready',
        trackId: 'shared'
      }
    },
    {
      id: 'shared-transitions',
      type: 'transition',
      position: { x: 350, y: 380 },
      selected: false,
      expanded: false,
      data: {
        title: 'Transition Effects',
        description: 'Shared scene transitions',
        videos: [],
        status: 'ready',
        trackId: 'shared'
      }
    },
    
    // Processing hub (center-right)
    {
      id: 'video-processor',
      type: 'product',
      position: { x: 580, y: 320 },
      selected: false,
      expanded: false,
      data: {
        title: 'Video Processor',
        description: 'Central processing hub',
        videos: [],
        status: 'ready',
        trackId: 'shared'
      }
    },
    
    // Output nodes (right side)
    {
      id: 'short-form',
      type: 'final',
      position: { x: 800, y: 200 },
      selected: false,
      expanded: false,
      data: {
        title: 'Short Form',
        description: '15-30s vertical video',
        videos: [],
        status: 'pending',
        trackId: 'track-1'
      }
    },
    {
      id: 'long-form',
      type: 'final',
      position: { x: 800, y: 320 },
      selected: false,
      expanded: false,
      data: {
        title: 'Long Form',
        description: '60-90s detailed video',
        videos: [],
        status: 'pending',
        trackId: 'track-2'
      }
    },
    {
      id: 'story-format',
      type: 'final',
      position: { x: 800, y: 440 },
      selected: false,
      expanded: false,
      data: {
        title: 'Story Format',
        description: '15s story-style video',
        videos: [],
        status: 'pending',
        trackId: 'track-3'
      }
    }
  ]);

  // Modern shared workflow connections
  const [connections] = useState<Connection[]>([
    // Input to shared nodes
    { id: 'conn-1', fromNodeId: 'hook-input', toNodeId: 'shared-broll' },
    { id: 'conn-2', fromNodeId: 'product-input', toNodeId: 'shared-broll' },
    { id: 'conn-3', fromNodeId: 'cta-input', toNodeId: 'shared-transitions' },
    
    // Shared nodes to processor
    { id: 'conn-4', fromNodeId: 'shared-broll', toNodeId: 'video-processor' },
    { id: 'conn-5', fromNodeId: 'shared-transitions', toNodeId: 'video-processor' },
    
    // Direct input to processor (bypassing shared nodes)
    { id: 'conn-6', fromNodeId: 'hook-input', toNodeId: 'video-processor' },
    { id: 'conn-7', fromNodeId: 'product-input', toNodeId: 'video-processor' },
    { id: 'conn-8', fromNodeId: 'cta-input', toNodeId: 'video-processor' },
    
    // Processor to outputs
    { id: 'conn-9', fromNodeId: 'video-processor', toNodeId: 'short-form' },
    { id: 'conn-10', fromNodeId: 'video-processor', toNodeId: 'long-form' },
    { id: 'conn-11', fromNodeId: 'video-processor', toNodeId: 'story-format' },
    
    // Some direct connections for variety
    { id: 'conn-12', fromNodeId: 'hook-input', toNodeId: 'short-form' },
    { id: 'conn-13', fromNodeId: 'cta-input', toNodeId: 'story-format' }
  ]);

  const workspaceRef = useRef<HTMLDivElement>(null);

  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [highlightedTrack, setHighlightedTrack] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNode(prev => prev === nodeId ? null : nodeId);
  }, []);

  const handleNodeSingleClick = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.data?.trackId) {
      // Single click highlights the track/path
      setHighlightedTrack(prev => 
        prev === node.data.trackId ? null : node.data.trackId
      );
      setSelectedPath(node.data.trackId);
    }
  }, [nodes]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    toggleNodeExpansion(nodeId);
  }, [toggleNodeExpansion]);

  // For static nodes, we'll just store video data in component state
  const [nodeVideos, setNodeVideos] = useState<Record<string, any[]>>({});

  const handleFileUpload = useCallback((nodeId: string, files: FileList) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const limits = NODE_VIDEO_LIMITS[node.type];
    const currentVideos = nodeVideos[nodeId] || [];
    
    if (currentVideos.length >= limits.max) {
      alert(`This node type can only have up to ${limits.max} video(s).`);
      return;
    }

    const newVideos: Array<{
      id: string;
      name: string;
      type: string;
      size: string;
      uploadedAt: string;
      file: File;
      url: string;
    }> = [];
    const filesToProcess = Math.min(files.length, limits.max - currentVideos.length);
    
    for (let i = 0; i < filesToProcess; i++) {
      const file = files[i];
      const fileData = {
        id: `video-${Date.now()}-${i}`,
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        uploadedAt: 'Just now',
        file: file,
        url: URL.createObjectURL(file)
      };
      newVideos.push(fileData);
    }

    setNodeVideos(prev => ({
      ...prev,
      [nodeId]: [...(prev[nodeId] || []), ...newVideos]
    }));
  }, [nodes, nodeVideos]);

  const removeVideo = useCallback((nodeId: string, videoId: string) => {
    setNodeVideos(prev => ({
      ...prev,
      [nodeId]: (prev[nodeId] || []).filter((v: any) => v.id !== videoId)
    }));
  }, []);





  // Generate spline path between two points
  const generateSplinePath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    // For horizontal flow, create smooth horizontal curves
    const controlDistance = Math.abs(dx) * 0.4;
    const cp1x = from.x + controlDistance;
    const cp1y = from.y + dy * 0.1;
    const cp2x = to.x - controlDistance;
    const cp2y = to.y - dy * 0.1;
    
    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
  };

  const getNodeAnchorPoint = (node: WorkspaceNode, side: 'left' | 'right' | 'top' | 'bottom') => {
    const nodeWidth = node.expanded ? 350 : 250;
    const nodeHeight = node.expanded ? 300 : 80;
    
    switch (side) {
      case 'left':
        return { x: node.position.x, y: node.position.y + nodeHeight / 2 };
      case 'right':
        return { x: node.position.x + nodeWidth, y: node.position.y + nodeHeight / 2 };
      case 'top':
        return { x: node.position.x + nodeWidth / 2, y: node.position.y };
      case 'bottom':
        return { x: node.position.x + nodeWidth / 2, y: node.position.y + nodeHeight };
      default:
        return { x: node.position.x + nodeWidth / 2, y: node.position.y + nodeHeight / 2 };
    }
  };

  const renderVideoUploadSlots = (node: WorkspaceNode) => {
    const limits = NODE_VIDEO_LIMITS[node.type];
    const currentVideos = nodeVideos[node.id] || [];

    const getNodeTypeTitle = (type: string) => {
      switch (type) {
        case 'hook': return 'Hook';
        case 'product': return 'Product';
        case 'cta': return 'CTA';
        case 'transition': return 'Transition';
        case 'broll': return 'B-Roll';
        default: return 'Video';
      }
    };

    const getNodeDescription = (type: string) => {
      switch (type) {
        case 'hook': return 'Create an attention-grabbing opening that stops viewers from scrolling.';
        case 'product': return 'Showcase your product features and benefits effectively.';
        case 'cta': return 'Drive action with a compelling call-to-action.';
        case 'transition': return 'Create smooth transitions between scenes.';
        case 'broll': return 'Add supporting footage to enhance your story.';
        default: return 'Upload your video content.';
      }
    };

    const getCameraInstructions = (type: string, clipIndex: number) => {
      const instructions = {
        hook: [
          "Start with a bold statement or question that immediately grabs attention. Use dynamic movement and bright visuals.",
          "Focus on the problem your audience faces. Keep the energy high with quick cuts and engaging visuals.",
          "Show the transformation or solution. Use before/after comparisons or dramatic reveals."
        ],
        product: [
          "Show the product in action with good lighting and multiple angles. Highlight key features clearly.",
          "Demonstrate specific benefits and use cases. Focus on how it solves problems for the user.",
          "Include close-up details and quality shots that build trust and credibility."
        ],
        cta: [
          "Create urgency with clear, direct language. Use text overlays and compelling visuals to drive action."
        ],
        transition: [
          "Use smooth camera movements like pans, zooms, or creative cuts to connect scenes seamlessly.",
          "Match the energy and mood of the surrounding content while providing visual continuity."
        ],
        broll: [
          "Capture lifestyle shots that support your main message. Focus on emotion and atmosphere.",
          "Include detail shots, environments, and supporting visuals that enhance the story.",
          "Film additional angles and cutaways that can be used to maintain viewer interest."
        ]
      };
      return instructions[type as keyof typeof instructions]?.[clipIndex] || "Follow standard filming practices with good lighting and stable footage.";
    };

        const slots = Array.from({ length: limits.max }, (_, index) => {
      const hasVideo = currentVideos[index];
      
      return (
        <div key={index} className="space-y-4">
          {/* Upload Box - Exactly like image */}
          {hasVideo ? (
            <div className="relative bg-slate-800 rounded-xl p-4 border border-slate-600">
              <button
                onClick={() => removeVideo(node.id, hasVideo.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
              >
                <span className="text-white text-xs">×</span>
              </button>
              <div className="aspect-video bg-slate-700 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                <img 
                  src="/api/placeholder/300/200"
                  alt="Product Screenshot"
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors">
                    Replace
                  </button>
                </div>
              </div>
              <p className="text-center text-white font-medium">{hasVideo.name}</p>
            </div>
          ) : (
            <div 
              className="bg-slate-800 rounded-xl p-8 border border-slate-600 cursor-pointer hover:border-purple-500 transition-colors"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files && files.length > 0) {
                    handleFileUpload(node.id, files);
                  }
                };
                input.click();
              }}
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Upload Video</h3>
                <p className="text-gray-400 text-sm">Click or drag to upload</p>
              </div>
            </div>
          )}
          
          {/* Camera Instructions - Exactly like image */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <span className="text-white font-medium">Camera Instructions</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Clip {index + 1} • Click to expand</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              {getCameraInstructions(node.type, index)}
            </p>
          </div>
        </div>
      );
    });

    return (
      <div className="h-full bg-slate-900 text-white p-8">
        {/* Header - Exactly like image */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white">{getNodeTypeTitle(node.type)}</h1>
            <p className="text-gray-300 text-lg mt-2">{getNodeDescription(node.type)}</p>
          </div>
          <button 
            className="text-gray-400 hover:text-white text-3xl"
            onClick={() => handleNodeDoubleClick(node.id)}
          >
            ×
          </button>
        </div>

        {/* Video Upload Section - Like image */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Video Upload</h2>
                <p className="text-gray-400">{getNodeTypeTitle(node.type)} • {limits.max} Clips</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-purple-400">{currentVideos.length}<span className="text-2xl text-gray-500">/{limits.max}</span></div>
              <div className="text-sm text-gray-400 uppercase tracking-wide">Clips Uploaded</div>
            </div>
          </div>
          
          {/* Progress Bar - Exactly like image */}
          <div className="w-full bg-slate-700 rounded-full h-2 mb-8">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentVideos.length / limits.max) * 100}%` }}
            ></div>
          </div>
          
          {/* Upload Grid - 3 columns like image */}
          <div className="grid grid-cols-3 gap-6">
            {slots}
          </div>
        </div>

        {/* Script Guidelines - Bottom section like image */}
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">ℹ</span>
              </div>
              <h3 className="text-xl font-bold text-white">Script Guidelines</h3>
            </div>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-gray-300 leading-relaxed">
            Create compelling content that resonates with your target audience. Focus on storytelling, emotional connection, and clear value proposition.
          </p>
        </div>
      </div>
    );
  };



  const renderNode = (node: WorkspaceNode) => {
    const isExpanded = expandedNode === node.id;
    const isHighlighted = highlightedTrack === node.data?.trackId;
    const nodeWidth = isExpanded ? 320 : 160;
    const nodeHeight = isExpanded ? 200 : 80;
    
    const getNodeIcon = () => {
      switch (node.type) {
        case 'hook': return <Zap className="w-4 h-4 text-purple-400" />;
        case 'product': return <Camera className="w-4 h-4 text-purple-400" />;
        case 'cta': return <Play className="w-4 h-4 text-purple-400" />;
        case 'transition': return <Scissors className="w-4 h-4 text-purple-400" />;
        case 'broll': return <Image className="w-4 h-4 text-purple-400" />;
        case 'final': return <Film className="w-4 h-4 text-purple-400" />;
        default: return <Video className="w-4 h-4 text-purple-400" />;
      }
    };

    const getStatusColor = () => {
      switch (node.data?.status) {
        case 'ready': return 'border-green-500/50 shadow-green-500/20';
        case 'partial': return 'border-yellow-500/50 shadow-yellow-500/20';
        case 'pending': return 'border-purple-500/50 shadow-purple-500/30';
        default: return 'border-gray-600/50 shadow-gray-600/20';
      }
    };

        // Determine if this is a shared node
    const isSharedNode = node.data?.trackId === 'shared';

    return (
      <div
        key={node.id}
        className={`absolute transition-all duration-700 backdrop-blur-lg cursor-pointer z-10 group
          ${isHighlighted 
            ? 'scale-110 shadow-2xl shadow-purple-500/60' 
            : 'hover:scale-105'
          }
          ${isExpanded ? 'shadow-2xl shadow-purple-500/40' : ''}
          hover:shadow-xl hover:shadow-purple-500/20`}
        style={{ 
          left: node.position.x, 
          top: node.position.y,
          width: nodeWidth,
          height: nodeHeight
        }}
          onClick={(e) => {
            e.stopPropagation();
          handleNodeSingleClick(node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleNodeDoubleClick(node.id);
        }}
      >
        {/* Clean Simple Node */}
        <div className={`h-full w-full relative rounded-xl border transition-all duration-300
          ${isSharedNode 
            ? 'bg-slate-800 border-purple-500 shadow-lg shadow-purple-500/20'
            : isHighlighted
              ? 'bg-slate-800 border-purple-400 shadow-lg shadow-purple-400/30'
              : 'bg-slate-900 border-slate-600 hover:border-slate-500'
          }`}
        >
          {/* Content */}
          <div className="h-full p-3 flex items-center">
            {/* Icon */}
            <div className={`flex-shrink-0 mr-3 rounded-lg flex items-center justify-center
              ${isSharedNode 
                ? 'w-10 h-10 bg-purple-600'
                : 'w-10 h-10 bg-purple-600'
              }`}>
              {getNodeIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-white truncate mb-1">
                {node.data?.title}
              </h3>
              <p className="text-xs text-gray-400 truncate">
                {node.data?.description}
              </p>
            </div>
          </div>

          {/* Shared node indicator */}
          {isSharedNode && (
            <div className="absolute top-2 right-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
            </div>
          )}
        </div>

        {/* Expanded Content - Modal Style */}
        {isExpanded && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleNodeDoubleClick(node.id); // Close modal when clicking backdrop
              }
            }}
          >
            <div 
              className="bg-slate-900 rounded-2xl w-[98vw] h-[95vh] overflow-hidden border border-slate-700/50 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {renderVideoUploadSlots(node)}
              </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div 
        ref={workspaceRef}
        className="absolute inset-0"
      >
        {/* Modern Header */}
        <div className="h-20 bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-xl">
          <div className="h-full flex items-center justify-between px-8">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Video Assembly Network
              </h1>
              <p className="text-sm text-slate-400 mt-1">Organic workflow for video components</p>
            </div>
            <div className="flex items-center space-x-8 text-sm text-slate-400">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full shadow-lg shadow-purple-500/50"></div>
                <span>Active Flow</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                <span>Ready</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                <span>Static</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative w-full h-full pt-8">
          {/* Modern subtle background pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                radial-gradient(circle at 1px 1px, rgba(139, 92, 246, 0.3) 1px, transparent 0)
              `,
              backgroundSize: '60px 60px'
            }}
          />
          
          {/* Organic connections with modern styling */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(147, 51, 234, 0.6)" />
                <stop offset="50%" stopColor="rgba(168, 85, 247, 0.8)" />
                <stop offset="100%" stopColor="rgba(147, 51, 234, 0.6)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {connections.map(conn => {
              const fromNode = nodes.find(n => n.id === conn.fromNodeId);
              const toNode = nodes.find(n => n.id === conn.toNodeId);
              
              if (!fromNode || !toNode) return null;
              
              const fromPoint = getNodeAnchorPoint(fromNode, 'right');
              const toPoint = getNodeAnchorPoint(toNode, 'left');
              const path = generateSplinePath(fromPoint, toPoint);
              
              // Check if this connection should be highlighted or selected
              const isConnectionHighlighted = highlightedTrack && 
                (fromNode.data?.trackId === highlightedTrack || toNode.data?.trackId === highlightedTrack);
              const isConnectionSelected = selectedPath && 
                (fromNode.data?.trackId === selectedPath && toNode.data?.trackId === selectedPath);
              
              return (
                <g key={conn.id}>
                  {/* Connection line with conditional highlighting */}
                  <path
                    d={path}
                    stroke={
                      isConnectionSelected ? "rgba(168, 85, 247, 1)" :
                      isConnectionHighlighted ? "rgba(168, 85, 247, 0.8)" : 
                      "rgba(147, 51, 234, 0.3)"
                    }
                    strokeWidth={
                      isConnectionSelected ? "5" :
                      isConnectionHighlighted ? "4" : "2"
                    }
                    fill="none"
                    strokeLinecap="round"
                    filter={isConnectionSelected || isConnectionHighlighted ? "url(#glow)" : "none"}
                    opacity={
                      isConnectionSelected ? "1" :
                      isConnectionHighlighted ? "0.9" : "0.4"
                    }
                    strokeDasharray={isConnectionSelected || isConnectionHighlighted ? "none" : "5,5"}
                  />
                </g>
              );
            })}
          </svg>
          
          {/* Static nodes positioned organically */}
          <div style={{ zIndex: 2, position: 'relative' }}>
            {nodes.map(renderNode)}
          </div>
          
          {/* Floating info panel */}
          <div className="absolute bottom-8 left-8 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-2">
              {highlightedTrack ? `Track ${highlightedTrack.split('-')[1]} Active` : 'Network Overview'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {highlightedTrack 
                ? `Showing ${highlightedTrack} workflow. Click another node to switch tracks.`
                : 'Click any node to highlight its track and connections.'
              }
            </p>
            <div className="space-y-2 text-xs text-slate-500">
              <div>• {nodes.length} video processing nodes</div>
              <div>• {connections.length} clean connections</div>
              <div>• 3 independent tracks</div>
              {highlightedTrack && (
                <div className="pt-2 border-t border-slate-700">
                  <div className="text-purple-400">
                    Active: {nodes.filter(n => n.data?.trackId === highlightedTrack).length} nodes in {highlightedTrack}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeGraphWorkspace;
