import React, { useState } from 'react';
import { Sun, Film, Upload, X, Camera, ChevronDown, ChevronUp, Image, Plus, Search, Filter, Grid, List, Play, FileImage, FileVideo, FileAudio } from 'lucide-react';

// Props interface
interface VideoWorkflowUIProps {
  theme: 'light' | 'dark' | 'experimental';
}

const VideoWorkflowUI: React.FC<VideoWorkflowUIProps> = ({ theme }) => {
  // Theme variables
  const isDarkMode = theme === 'dark';
  const isExperimental = theme === 'experimental';
  const isLightMode = theme === 'light';
  // Add CSS keyframes for subtle purple animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes subtlePurpleGlow {
        0% {
          opacity: 0;
          transform: scale(0.8);
        }
        25% {
          opacity: 0.15;
          transform: scale(1);
        }
        50% {
          opacity: 0.08;
          transform: scale(1.05);
        }
        75% {
          opacity: 0.12;
          transform: scale(0.95);
        }
        100% {
          opacity: 0;
          transform: scale(0.8);
        }
      }
      
      @keyframes purpleBreath {
        0% {
          opacity: 0.05;
          transform: scale(1);
        }
        50% {
          opacity: 0.15;
          transform: scale(1.02);
        }
        100% {
          opacity: 0.05;
          transform: scale(1);
        }
      }
      
      @keyframes purplePulse {
        0% {
          box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
        }
        50% {
          box-shadow: 0 0 20px 5px rgba(139, 92, 246, 0.1);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  // Removed local isDarkMode state - now using theme prop
  const [currentRoadmap, setCurrentRoadmap] = useState(0);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [uploads] = useState<Record<string, any[]>>({});
  const [selectedVideos, setSelectedVideos] = useState<Record<string, any>>({});
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const [expandedInstructions, setExpandedInstructions] = useState<Record<string, boolean>>({});
  const [showAssetPopup, setShowAssetPopup] = useState(false);
  const [selectedUploadSlot, setSelectedUploadSlot] = useState<{nodeId: string, slotIndex: number} | null>(null);
  
  // Asset popup states
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetSortBy, setAssetSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [assetSortOrder, setAssetSortOrder] = useState<'asc' | 'desc'>('desc');
  const [assetFilterType, setAssetFilterType] = useState<'all' | 'video' | 'image' | 'audio'>('all');
  

  
  // Mock assets data - in real app this would come from a store/API
  const userAssets = [
    { id: '1', name: 'Product Demo.mp4', type: 'video', thumbnail: '/api/placeholder/80/60', duration: '0:45', size: '12.5 MB', tags: ['product', 'demo'] },
    { id: '2', name: 'Customer Testimonial.mp4', type: 'video', thumbnail: '/api/placeholder/80/60', duration: '1:20', size: '24.8 MB', tags: ['testimonial', 'customer'] },
    { id: '3', name: 'Behind Scenes.mp4', type: 'video', thumbnail: '/api/placeholder/80/60', duration: '2:15', size: '45.2 MB', tags: ['bts', 'behind scenes'] },
    { id: '4', name: 'Hero Image.jpg', type: 'image', thumbnail: '/api/placeholder/80/60', size: '2.1 MB', tags: ['hero', 'banner'] },
    { id: '5', name: 'Logo Animation.mp4', type: 'video', thumbnail: '/api/placeholder/80/60', duration: '0:30', size: '8.7 MB', tags: ['logo', 'animation'] },
    { id: '6', name: 'Team Photo.jpg', type: 'image', thumbnail: '/api/placeholder/80/60', size: '3.4 MB', tags: ['team', 'photo'] },
    { id: '7', name: 'Product Showcase.mp4', type: 'video', thumbnail: '/api/placeholder/80/60', duration: '1:45', size: '32.1 MB', tags: ['product', 'showcase'] },
    { id: '8', name: 'Background Music.mp3', type: 'audio', size: '4.2 MB', duration: '2:30', tags: ['music', 'background'] },
    { id: '9', name: 'Office Space.jpg', type: 'image', thumbnail: '/api/placeholder/80/60', size: '1.8 MB', tags: ['office', 'workspace'] },
    { id: '10', name: 'Tutorial Intro.mp4', type: 'video', thumbnail: '/api/placeholder/80/60', duration: '0:25', size: '15.3 MB', tags: ['tutorial', 'intro'] },
    { id: '11', name: 'Voiceover.mp3', type: 'audio', size: '6.8 MB', duration: '3:45', tags: ['voice', 'narration'] },
    { id: '12', name: 'Call to Action.mp4', type: 'video', thumbnail: '/api/placeholder/80/60', duration: '0:15', size: '7.9 MB', tags: ['cta', 'action'] },
  ];
  
  const roadmaps = [
    { id: 0, name: "Conversion Campaign", color: "#8b5cf6" },
    { id: 1, name: "Brand Awareness", color: "#8b5cf6" },
    { id: 2, name: "Engagement Drive", color: "#8b5cf6" }
  ];

  // Dynamic positioning based on screen size - truly centered flowchart
  const getNodePositions = () => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    // Calculate the available flowchart area (account for remaining header)
    const headerHeight = 80; // Only roadmap info section remains
    const flowchartHeight = viewportHeight - headerHeight;
    
    // Center point of the flowchart area - shifted left and up
    const centerX = viewportWidth * 0.45; // Move center point to 45% instead of 50%
    const centerY = headerHeight + (flowchartHeight * 0.35); // Move up to 35% for higher positioning
    
    // Responsive spacing that scales with screen size - reduced horizontal spread
    const horizontalSpacing = Math.min(Math.max(200, viewportWidth * 0.22), viewportWidth * 0.28); // 22-28% of screen width
    const verticalSpacing = Math.min(Math.max(120, flowchartHeight * 0.22), flowchartHeight * 0.35); // 22-35% of flowchart height
    
    // Account for node dimensions (highlighted nodes are 128x64, normal are 96x48)
    const nodeWidth = 64; // Half width for centering
    const nodeHeight = 32; // Half height for centering
    
    // Ensure nodes don't go off screen with margins
    const margin = 20;
    const maxX = viewportWidth - 128 - margin;
    const minX = margin;
    const maxY = viewportHeight - 64 - margin;
    const minY = headerHeight + margin;
    
    const clampX = (x: number) => Math.max(minX, Math.min(maxX, x - nodeWidth)) + nodeWidth;
    const clampY = (y: number) => Math.max(minY, Math.min(maxY, y - nodeHeight)) + nodeHeight;
    
    return {
      hook_shared: { 
        x: clampX(centerX - horizontalSpacing), 
        y: clampY(centerY - verticalSpacing) 
      },
      solution_shared: { 
        x: clampX(centerX + horizontalSpacing), 
        y: clampY(centerY + verticalSpacing * 0.3) 
      },
      prob1: { 
        x: clampX(centerX), 
        y: clampY(centerY - verticalSpacing * 0.8) 
      },
      hook2: { 
        x: clampX(centerX - horizontalSpacing), 
        y: clampY(centerY + verticalSpacing * 0.8) 
      },
      prob2: { 
        x: clampX(centerX), 
        y: clampY(centerY + verticalSpacing * 0.3) 
      },
      prob3: { 
        x: clampX(centerX), 
        y: clampY(centerY + verticalSpacing * 0.8) 
      },
      sol3: { 
        x: clampX(centerX + horizontalSpacing), 
        y: clampY(centerY + verticalSpacing * 1.2) 
      }
    };
  };
  
  const [nodePositions, setNodePositions] = useState(getNodePositions());
  
  // Update positions on window resize
  React.useEffect(() => {
    const handleResize = () => {
      setNodePositions(getNodePositions());
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nodes = [
    // Shared nodes
    { id: 'hook_shared', name: 'Hook', type: 'hook', track: 'shared', tracks: [0, 1, 2], uploadFormat: 1, maxUploads: 3, shared: true },
    { id: 'solution_shared', name: 'Solution', type: 'solution', track: 'shared', tracks: [0, 1], uploadFormat: 2, maxUploads: 4, shared: true },
    
    // Track 1 specific (Format 1: 3 horizontal)
    { id: 'prob1', name: 'Problem', type: 'problem', track: 0, uploadFormat: 1, maxUploads: 3, shared: false },
    
    // Track 2 specific (Format 2: 2x2 grid)
    { id: 'hook2', name: 'Hook', type: 'hook', track: 1, uploadFormat: 2, maxUploads: 4, shared: false },
    { id: 'prob2', name: 'Problem', type: 'problem', track: 1, uploadFormat: 2, maxUploads: 4, shared: false },
    
    // Track 3 specific (Format 3: single upload)
    { id: 'prob3', name: 'Problem', type: 'problem', track: 2, uploadFormat: 3, maxUploads: 1, shared: false },
    { id: 'sol3', name: 'Solution', type: 'solution', track: 2, uploadFormat: 3, maxUploads: 1, shared: false }
  ];

  const connections = [
    // Track 1 flow: hook_shared → prob1 → solution_shared
    { from: 'hook_shared', to: 'prob1', tracks: [0] },
    { from: 'prob1', to: 'solution_shared', tracks: [0] },
    
    // Track 2 flow: hook_shared → prob2 → solution_shared AND hook2 → prob2 → solution_shared
    { from: 'hook_shared', to: 'prob2', tracks: [1] },
    { from: 'hook2', to: 'prob2', tracks: [1] },
    { from: 'prob2', to: 'solution_shared', tracks: [1] },
    
    // Track 3 flow: hook_shared → prob3 → sol3
    { from: 'hook_shared', to: 'prob3', tracks: [2] },
    { from: 'prob3', to: 'sol3', tracks: [2] }
  ];

  const handleScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    
    // Simple scroll detection - no threshold needed
    if (e.deltaY > 0 && currentRoadmap < roadmaps.length - 1) {
      setCurrentRoadmap(currentRoadmap + 1);
    } else if (e.deltaY < 0 && currentRoadmap > 0) {
      setCurrentRoadmap(currentRoadmap - 1);
    }
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (clickTimeout) {
      // Double click - expand node
      clearTimeout(clickTimeout);
      setClickTimeout(null);
      setExpandedNode(nodeId);
    } else {
      // Single click - switch to path containing this node
      const timeout = setTimeout(() => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          if (node.shared && node.tracks) {
            // If it's a shared node, cycle through its tracks
            const currentIndex = node.tracks.indexOf(currentRoadmap);
            const nextIndex = (currentIndex + 1) % node.tracks.length;
            setCurrentRoadmap(node.tracks[nextIndex]);
          } else if (typeof node.track === 'number') {
            // If it's a track-specific node, switch to that track
            setCurrentRoadmap(node.track);
          }
        }
        setClickTimeout(null);
      }, 250);
      setClickTimeout(timeout);
    }
  };

  const toggleInstructions = (key: string) => {
    setExpandedInstructions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleUploadClick = (nodeId: string, slotIndex: number) => {
    setSelectedUploadSlot({ nodeId, slotIndex });
    setShowAssetPopup(true);
  };

  const handleAssetSelect = (asset: typeof userAssets[0]) => {
    if (selectedUploadSlot) {
      const slotKey = `${selectedUploadSlot.nodeId}-${selectedUploadSlot.slotIndex}`;
      setSelectedVideos(prev => ({
        ...prev,
        [slotKey]: asset
      }));
    }
    setShowAssetPopup(false);
    setSelectedUploadSlot(null);
  };



  // Filter and sort assets for popup
  const getFilteredAndSortedAssets = () => {
    let filtered = userAssets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                           asset.tags?.some(tag => tag.toLowerCase().includes(assetSearchQuery.toLowerCase()));
      const matchesType = assetFilterType === 'all' || asset.type === assetFilterType;
      return matchesSearch && matchesType;
    });

    // Sort assets
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (assetSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          // For demo, using id as date proxy
          comparison = parseInt(a.id) - parseInt(b.id);
          break;
        case 'size':
          const aSizeNum = parseFloat(a.size.replace(/[^0-9.]/g, ''));
          const bSizeNum = parseFloat(b.size.replace(/[^0-9.]/g, ''));
          comparison = aSizeNum - bSizeNum;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return assetSortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  // Get file type colors and icons
  const getFileTypeInfo = (type: string) => {
    switch (type) {
      case 'video':
        return { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: FileVideo };
      case 'image':
        return { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: FileImage };
      case 'audio':
        return { color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: FileAudio };
      default:
        return { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: Film };
    }
  };

  const nodeTypeDescriptions = {
    hook: "Create an attention-grabbing opening that stops viewers from scrolling.",
    problem: "Identify and articulate the pain point your audience faces.",
    solution: "Present your product or service as the solution to their problem."
  };

  const currentRoadmapName = roadmaps[currentRoadmap]?.name || '';
  const currentRoadmapColor = roadmaps[currentRoadmap]?.color || '#8b5cf6';

  return (
    <div className="min-h-screen bg-black">

      {/* Roadmap Info - Black with purple styling */}
      <div className="bg-black px-6 py-3 shadow-lg shadow-purple-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-4 h-4 rounded-full shadow-lg shadow-purple-500/50"
              style={{ backgroundColor: currentRoadmapColor }}
            />
            <span className="text-white font-medium">{currentRoadmapName}</span>
          </div>
          <div className="text-purple-300 text-sm bg-purple-900/20 px-3 py-1 rounded-full shadow-md shadow-purple-900/30">
            Click node to switch paths • Double-click to expand • {currentRoadmap + 1} of {roadmaps.length}
          </div>
        </div>
      </div>

      {/* Flowchart - Black background */}
      <div 
        className={`relative w-full h-screen cursor-default overflow-hidden ${
          isDarkMode ? 'bg-black' : 
          isExperimental ? 'bg-black' : 
          'bg-gray-100'
        }`}
        onWheel={handleScroll}
      >
        
        {/* Lines - Purple glow effects */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="purpleGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {connections.map((conn, i) => {
            const fromPos = nodePositions[conn.from as keyof typeof nodePositions];
            const toPos = nodePositions[conn.to as keyof typeof nodePositions];
            if (!fromPos || !toPos) return null;
            
            // Check if this connection is relevant to current track
            const isRelevantConnection = conn.tracks.includes(currentRoadmap);
            
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            
            // Determine if nodes are highlighted
            const fromHighlighted = fromNode?.shared ? fromNode.tracks?.includes(currentRoadmap) : fromNode?.track === currentRoadmap;
            const toHighlighted = toNode?.shared ? toNode.tracks?.includes(currentRoadmap) : toNode?.track === currentRoadmap;

            const x1 = fromPos.x + (fromHighlighted ? 128 : 96);
            const y1 = fromPos.y + (fromHighlighted ? 32 : 24);
            const x2 = toPos.x;
            const y2 = toPos.y + (toHighlighted ? 32 : 24);
            
            const cx1 = x1 + 80;
            const cx2 = x2 - 80;

            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${cx1} ${y1} ${cx2} ${y2} ${x2} ${y2}`}
                stroke={isRelevantConnection ? currentRoadmapColor : '#374151'}
                strokeWidth={isRelevantConnection ? "3" : "2"}
                fill="none"
                opacity={isRelevantConnection ? "1" : "0.2"}
                filter={isRelevantConnection ? "url(#purpleGlow)" : "none"}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>

        {/* Nodes - Static with purple shadows and click interactions */}
        {nodes.map(node => {
          const position = nodePositions[node.id as keyof typeof nodePositions];
          const uploadCount = uploads[node.id]?.length || 0;
          
          // Determine if node should be highlighted
          let isHighlighted = false;
          if (node.shared) {
            // Shared nodes are highlighted if current roadmap is in their tracks array
            isHighlighted = node.tracks?.includes(currentRoadmap) || false;
          } else {
            // Regular nodes are highlighted if they match current track
            isHighlighted = node.track === currentRoadmap;
          }
          
          return (
            <div
              key={node.id}
              className={`absolute transition-all duration-500 ${
                isHighlighted ? 'z-20 scale-110' : 'z-10 scale-75 opacity-40'
              }`}
              style={{ left: position.x, top: position.y }}
            >
              <div 
                className={`
                  ${isHighlighted ? 'w-32 h-16' : 'w-24 h-12'} 
                  ${isDarkMode ? 'bg-black' : 
                    isExperimental ? 'bg-black' : 
                    'bg-white border-2 border-gray-300'} 
                  rounded-xl 
                  flex items-center justify-center ${isHighlighted ? 'text-base' : 'text-sm'} font-medium 
                  cursor-pointer
                  transition-all duration-500 shadow-xl relative hover:scale-105
                `}
                style={{ 
                  color: isHighlighted ? currentRoadmapColor : '#6b7280',
                  boxShadow: isHighlighted 
                    ? `0 0 40px ${currentRoadmapColor}80, 0 0 20px ${currentRoadmapColor}50, 0 8px 32px rgba(139, 92, 246, 0.4)` 
                    : '0 0 20px rgba(139, 92, 246, 0.2), 0 4px 16px rgba(0,0,0,0.6)',
                }}
                onClick={(e) => handleNodeClick(node.id, e)}
              >
                {node.name}
                
                {/* Shared indicator - Purple theme */}
                {node.shared && (
                  <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full shadow-lg shadow-purple-500/50 ${
                    isHighlighted ? 'bg-purple-400' : 'bg-purple-700'
                  }`} />
                )}
                
                {/* Upload count indicator - Purple theme */}
                {uploadCount > 0 && (
                  <div 
                    className={`absolute -top-2 -right-2 rounded-full text-xs flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/50 ${
                      isHighlighted ? 'w-6 h-6' : 'w-5 h-5'
                    }`}
                    style={{ backgroundColor: isHighlighted ? currentRoadmapColor : '#7c3aed' }}
                  >
                    {uploadCount}
                  </div>
                )}
              </div>
            </div>
          );
        })}

      </div>

      {/* Black & Purple Glassmorphism Upload Modal */}
      {expandedNode && (
        <div className={`fixed inset-0 backdrop-blur-xl flex items-center justify-center p-6 z-50 ${
          isDarkMode ? 'bg-black/80' :
          isExperimental ? 'bg-black/80' :
          'bg-gray-900/50'
        }`}>
          <div className={`relative backdrop-blur-2xl rounded-3xl max-w-6xl w-full shadow-2xl overflow-hidden border ${
            isDarkMode ? 'bg-black/40 shadow-purple-500/20 border-purple-500/30' :
            isExperimental ? 'bg-black/40 shadow-yellow-500/20 border-yellow-400/30' :
            'bg-white/95 shadow-purple-500/30 border-purple-200'
          }`}>
            {/* Glassmorphism overlay */}
            <div className={`absolute inset-0 ${
              isDarkMode ? 'bg-gradient-to-br from-purple-900/20 via-black/10 to-purple-800/10' :
              isExperimental ? 'bg-gradient-to-br from-yellow-900/20 via-black/10 to-yellow-800/10' :
              'bg-gradient-to-br from-purple-100/30 via-white/5 to-purple-50/20'
            }`} />
            <div className={`absolute inset-0 ${
              isDarkMode ? 'bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.15),transparent_50%)]' :
              isExperimental ? 'bg-[radial-gradient(circle_at_30%_40%,rgba(251,191,36,0.15),transparent_50%)]' :
              'bg-[radial-gradient(circle_at_30%_40%,rgba(139,92,246,0.08),transparent_50%)]'
            }`} />
            <div className={`absolute inset-0 ${
              isDarkMode ? 'bg-[radial-gradient(circle_at_70%_60%,rgba(168,85,247,0.1),transparent_50%)]' :
              isExperimental ? 'bg-[radial-gradient(circle_at_70%_60%,rgba(245,158,11,0.1),transparent_50%)]' :
              'bg-[radial-gradient(circle_at_70%_60%,rgba(168,85,247,0.05),transparent_50%)]'
            }`} />
            
            {/* Black & Purple Glassmorphism Header */}
            <div className="relative bg-black/30 backdrop-blur-xl p-8 border-b border-purple-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
                    {nodes.find(n => n.id === expandedNode)?.name}
                  </h2>
                  <p className="text-lg text-purple-300 drop-shadow-md">
                    {expandedNode && nodeTypeDescriptions[nodes.find(n => n.id === expandedNode)?.type as keyof typeof nodeTypeDescriptions]}
                  </p>
                </div>
                <button
                  onClick={() => setExpandedNode(null)}
                  className="p-3 rounded-xl text-gray-400 hover:text-white hover:bg-purple-500/20 transition-all duration-200 backdrop-blur-sm border border-purple-500/30"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            {/* Black & Purple Glassmorphism Content Section */}
            <div className="relative bg-black/20 backdrop-blur-xl p-8">
              {(() => {
                const node = nodes.find(n => n.id === expandedNode);
                if (!node) return null;
                
                // Calculate upload progress
                const totalSlots = node.maxUploads;
                const uploadedCount = Object.keys(selectedVideos).filter(key => 
                  key.startsWith(node.id) && selectedVideos[key]
                ).length;
                const progressPercentage = (uploadedCount / totalSlots) * 100;
                
                return (
                  <div className="space-y-8">
                                            {/* Glassmorphism Video Upload Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">Video Upload</h3>
                            <p className="text-white/70 drop-shadow-md">{node.name} • {totalSlots} Clips</p>
                          </div>
                          <div className="text-right">
                            <div className="text-4xl font-bold text-white mb-1 drop-shadow-lg">
                              {uploadedCount}<span className="text-2xl text-white/60">/{totalSlots}</span>
                            </div>
                            <p className="text-sm text-white/60 drop-shadow-md">clips uploaded</p>
                          </div>
                        </div>
                        
                        {/* Black & Purple Glassmorphism Progress Bar */}
                        <div className="relative">
                          <div className="w-full bg-black/30 backdrop-blur-sm rounded-full h-3 border border-purple-500/30 shadow-lg">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out shadow-lg shadow-purple-500/30 relative overflow-hidden"
                              style={{ width: `${progressPercentage}%` }}
                            >
                              {/* Purple glassmorphism shimmer effect */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-300/40 to-transparent -skew-x-12 translate-x-[-100%] animate-pulse" />
                            </div>
                          </div>
                          {/* Progress percentage text */}
                          <div className="absolute -top-1 left-0 text-xs text-purple-300 font-medium drop-shadow-md">
                            {Math.round(progressPercentage)}% complete
                          </div>
                        </div>
                    
                    {/* Upload Grid */}
                    {node.uploadFormat === 1 && (
                      <div className="grid grid-cols-3 gap-6">
                        {Array.from({ length: 3 }).map((_, index) => {
                          const slotKey = `${node.id}-${index}`;
                          const selectedVideo = selectedVideos[slotKey];
                          
                          return (
                            <div key={index} className="space-y-4">
                              <div className="relative group">
                                <div 
                                  className="relative bg-black/30 backdrop-blur-xl rounded-2xl p-8 text-center hover:bg-black/40 transition-all duration-300 cursor-pointer border-2 border-dashed border-purple-500/40 hover:border-purple-400/70 min-h-[200px] flex flex-col justify-center shadow-lg hover:shadow-purple-500/30 transform hover:scale-[1.02]"
                                  onClick={() => !selectedVideo && handleUploadClick(node.id, index)}
                                >
                                  {/* Purple glassmorphism overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-purple-800/5 rounded-2xl" />
                                  {!selectedVideo && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-purple-600/10 animate-pulse rounded-2xl" />
                                  )}
                                  
                                  {selectedVideo ? (
                                    <div className="relative space-y-6 group">
                                      {/* Video Preview */}
                                      <div className="relative">
                                        <div className="w-24 h-16 mx-auto bg-gradient-to-br from-gray-600/80 to-purple-900/40 rounded-xl flex items-center justify-center shadow-xl border border-purple-400/20 backdrop-blur-sm">
                                          <Film className="w-8 h-8 text-purple-200" />
                                        </div>
                                        {/* Video duration badge */}
                                        <div className="absolute -top-1 -right-1 bg-purple-600/90 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-lg">
                                          {selectedVideo.duration}
                                        </div>
                                      </div>
                                      
                                      {/* Video Info */}
                                      <div className="text-center space-y-1">
                                        <p className="font-medium text-white text-sm leading-tight truncate px-2">{selectedVideo.name}</p>
                                        <p className="text-xs text-purple-300/80 font-medium">Ready to use</p>
                                      </div>
                                      
                                      {/* Subtle Action Buttons - Only show on hover */}
                                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                        <div className="flex gap-2 justify-center">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUploadClick(node.id, index);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-400/30 hover:border-purple-400/60 rounded-lg transition-all duration-200 backdrop-blur-sm"
                                          >
                                            Replace
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const newSelectedVideos = { ...selectedVideos };
                                              delete newSelectedVideos[slotKey];
                                              setSelectedVideos(newSelectedVideos);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-300 bg-gray-600/20 hover:bg-red-600/20 border border-gray-500/30 hover:border-red-400/40 rounded-lg transition-all duration-200 backdrop-blur-sm"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative space-y-4">
                                      {/* Upload Icon */}
                                      <div className="relative">
                                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-2xl flex items-center justify-center border-2 border-dashed border-purple-400/40 group-hover:border-purple-300/60 transition-all duration-300">
                                          <Upload className="w-8 h-8 text-purple-400 group-hover:text-purple-300 transition-colors duration-200" />
                                        </div>
                                        {/* Plus indicator */}
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center shadow-lg">
                                          <Plus className="w-3 h-3 text-white" />
                                        </div>
                                      </div>
                                      
                                      {/* Upload Text */}
                                      <div className="text-center space-y-2">
                                        <h4 className="text-base font-semibold text-purple-300 group-hover:text-purple-200 transition-colors duration-200">Add Video</h4>
                                        <p className="text-xs text-purple-300/60 group-hover:text-purple-200/80 transition-colors duration-200 leading-relaxed">
                                          Drag & drop or click to browse
                                        </p>
                                      </div>
                                      
                                      {/* Subtle hint */}
                                      <div className="text-center">
                                        <span className="inline-block px-3 py-1 bg-purple-600/10 border border-purple-500/20 rounded-full text-xs text-purple-400/80 font-medium">
                                          Clip {index + 1}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="bg-gradient-to-r from-gray-700/70 to-gray-800/70 rounded-xl backdrop-blur-sm border border-purple-500/20 hover:border-purple-400/30 transition-all duration-200">
                                <button
                                  onClick={() => toggleInstructions(`${node.id}-${index}`)}
                                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gradient-to-r hover:from-gray-600/80 hover:to-gray-700/80 transition-all duration-200 rounded-xl group"
                                >
                                  <div className="flex items-center space-x-2">
                                    <Camera className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" />
                                    <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors duration-200">Camera Tips</span>
                                  </div>
                                  {expandedInstructions[`${node.id}-${index}`] ? 
                                    <ChevronUp className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" /> : 
                                    <ChevronDown className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" />
                                  }
                                </button>
                                {expandedInstructions[`${node.id}-${index}`] && (
                                  <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed space-y-2 bg-gradient-to-r from-purple-900/10 to-transparent rounded-b-xl">
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Frame your shot at eye level</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Ensure good lighting on your face</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Keep background simple and clean</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Speak clearly and maintain eye contact</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Record in landscape orientation</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {node.uploadFormat === 2 && (
                      <div className="grid grid-cols-2 gap-6">
                        {Array.from({ length: 4 }).map((_, index) => {
                          const slotKey = `${node.id}-${index}`;
                          const selectedVideo = selectedVideos[slotKey];
                          
                          return (
                            <div key={index} className="space-y-4">
                              <div className="relative group">
                                <div 
                                  className="relative bg-black/30 backdrop-blur-xl rounded-2xl p-8 text-center hover:bg-black/40 transition-all duration-300 cursor-pointer border-2 border-dashed border-purple-500/40 hover:border-purple-400/70 min-h-[200px] flex flex-col justify-center shadow-lg hover:shadow-purple-500/30 transform hover:scale-[1.02]"
                                  onClick={() => !selectedVideo && handleUploadClick(node.id, index)}
                                >
                                  {/* Purple glassmorphism overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-purple-800/5 rounded-2xl" />
                                  {!selectedVideo && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-purple-600/10 animate-pulse rounded-2xl" />
                                  )}
                                  
                                  {selectedVideo ? (
                                    <div className="relative space-y-6 group">
                                      {/* Video Preview */}
                                      <div className="relative">
                                        <div className="w-24 h-16 mx-auto bg-gradient-to-br from-gray-600/80 to-purple-900/40 rounded-xl flex items-center justify-center shadow-xl border border-purple-400/20 backdrop-blur-sm">
                                          <Film className="w-8 h-8 text-purple-200" />
                                        </div>
                                        {/* Video duration badge */}
                                        <div className="absolute -top-1 -right-1 bg-purple-600/90 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-lg">
                                          {selectedVideo.duration}
                                        </div>
                                      </div>
                                      
                                      {/* Video Info */}
                                      <div className="text-center space-y-1">
                                        <p className="font-medium text-white text-sm leading-tight truncate px-2">{selectedVideo.name}</p>
                                        <p className="text-xs text-purple-300/80 font-medium">Ready to use</p>
                                      </div>
                                      
                                      {/* Subtle Action Buttons - Only show on hover */}
                                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                        <div className="flex gap-2 justify-center">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUploadClick(node.id, index);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-400/30 hover:border-purple-400/60 rounded-lg transition-all duration-200 backdrop-blur-sm"
                                          >
                                            Replace
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const newSelectedVideos = { ...selectedVideos };
                                              delete newSelectedVideos[slotKey];
                                              setSelectedVideos(newSelectedVideos);
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-300 bg-gray-600/20 hover:bg-red-600/20 border border-gray-500/30 hover:border-red-400/40 rounded-lg transition-all duration-200 backdrop-blur-sm"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative space-y-4">
                                      {/* Upload Icon */}
                                      <div className="relative">
                                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-2xl flex items-center justify-center border-2 border-dashed border-purple-400/40 group-hover:border-purple-300/60 transition-all duration-300">
                                          <Upload className="w-8 h-8 text-purple-400 group-hover:text-purple-300 transition-colors duration-200" />
                                        </div>
                                        {/* Plus indicator */}
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center shadow-lg">
                                          <Plus className="w-3 h-3 text-white" />
                                        </div>
                                      </div>
                                      
                                      {/* Upload Text */}
                                      <div className="text-center space-y-2">
                                        <h4 className="text-base font-semibold text-purple-300 group-hover:text-purple-200 transition-colors duration-200">Add Video</h4>
                                        <p className="text-xs text-purple-300/60 group-hover:text-purple-200/80 transition-colors duration-200 leading-relaxed">
                                          Drag & drop or click to browse
                                        </p>
                                      </div>
                                      
                                      {/* Subtle hint */}
                                      <div className="text-center">
                                        <span className="inline-block px-3 py-1 bg-purple-600/10 border border-purple-500/20 rounded-full text-xs text-purple-400/80 font-medium">
                                          Clip {index + 1}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="bg-gradient-to-r from-gray-700/70 to-gray-800/70 rounded-xl backdrop-blur-sm border border-purple-500/20 hover:border-purple-400/30 transition-all duration-200">
                                <button
                                  onClick={() => toggleInstructions(`${node.id}-${index}`)}
                                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gradient-to-r hover:from-gray-600/80 hover:to-gray-700/80 transition-all duration-200 rounded-xl group"
                                >
                                  <div className="flex items-center space-x-2">
                                    <Camera className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" />
                                    <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors duration-200">Camera Tips</span>
                                  </div>
                                  {expandedInstructions[`${node.id}-${index}`] ? 
                                    <ChevronUp className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" /> : 
                                    <ChevronDown className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" />
                                  }
                                </button>
                                {expandedInstructions[`${node.id}-${index}`] && (
                                  <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed space-y-2 bg-gradient-to-r from-purple-900/10 to-transparent rounded-b-xl">
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Frame your shot at eye level</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Ensure good lighting on your face</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Keep background simple and clean</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Speak clearly and maintain eye contact</p>
                                    <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Record in landscape orientation</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {node.uploadFormat === 3 && (
                      <div className="flex justify-center">
                        <div className="space-y-4 w-96">
                          <div className="relative group">
                            <div 
                              className="relative bg-black/30 backdrop-blur-xl rounded-2xl p-12 text-center hover:bg-black/40 transition-all duration-300 cursor-pointer border-2 border-dashed border-purple-500/40 hover:border-purple-400/70 min-h-[280px] flex flex-col justify-center shadow-lg hover:shadow-purple-500/30 transform hover:scale-[1.02]"
                              onClick={() => !selectedVideos[`${node.id}-0`] && handleUploadClick(node.id, 0)}
                            >
                              {/* Purple glassmorphism overlay */}
                              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-purple-800/5 rounded-2xl" />
                              {!selectedVideos[`${node.id}-0`] && (
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-purple-600/10 animate-pulse rounded-2xl" />
                              )}
                              
                              {selectedVideos[`${node.id}-0`] ? (
                                <div className="relative space-y-6 group">
                                  {/* Video Preview */}
                                  <div className="relative">
                                    <div className="w-28 h-20 mx-auto bg-gradient-to-br from-gray-600/80 to-purple-900/40 rounded-xl flex items-center justify-center shadow-xl border border-purple-400/20 backdrop-blur-sm">
                                      <Film className="w-12 h-12 text-purple-200" />
                                    </div>
                                    {/* Video duration badge */}
                                    <div className="absolute -top-2 -right-2 bg-purple-600/90 text-white text-sm px-3 py-1 rounded-full font-medium shadow-lg">
                                      {selectedVideos[`${node.id}-0`].duration}
                                    </div>
                                  </div>
                                  
                                  {/* Video Info */}
                                  <div className="text-center space-y-2">
                                    <p className="font-medium text-white text-lg leading-tight truncate px-4">{selectedVideos[`${node.id}-0`].name}</p>
                                    <p className="text-sm text-purple-300/80 font-medium">Ready to use</p>
                                  </div>
                                  
                                  {/* Subtle Action Buttons - Only show on hover */}
                                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                    <div className="flex gap-3 justify-center">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUploadClick(node.id, 0);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-400/30 hover:border-purple-400/60 rounded-lg transition-all duration-200 backdrop-blur-sm"
                                      >
                                        Replace
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newSelectedVideos = { ...selectedVideos };
                                          delete newSelectedVideos[`${node.id}-0`];
                                          setSelectedVideos(newSelectedVideos);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-red-300 bg-gray-600/20 hover:bg-red-600/20 border border-gray-500/30 hover:border-red-400/40 rounded-lg transition-all duration-200 backdrop-blur-sm"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative space-y-6">
                                  {/* Upload Icon */}
                                  <div className="relative">
                                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-3xl flex items-center justify-center border-2 border-dashed border-purple-400/40 group-hover:border-purple-300/60 transition-all duration-300">
                                      <Upload className="w-12 h-12 text-purple-400 group-hover:text-purple-300 transition-colors duration-200" />
                                    </div>
                                    {/* Plus indicator */}
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center shadow-lg">
                                      <Plus className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                  
                                  {/* Upload Text */}
                                  <div className="text-center space-y-3">
                                    <h4 className="text-xl font-semibold text-purple-300 group-hover:text-purple-200 transition-colors duration-200">Add Video</h4>
                                    <p className="text-sm text-purple-300/60 group-hover:text-purple-200/80 transition-colors duration-200 leading-relaxed">
                                      Drag & drop or click to browse
                                    </p>
                                  </div>
                                  
                                  {/* Subtle hint */}
                                  <div className="text-center">
                                    <span className="inline-block px-4 py-2 bg-purple-600/10 border border-purple-500/20 rounded-full text-sm text-purple-400/80 font-medium">
                                      Main Clip
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-gradient-to-r from-gray-700/70 to-gray-800/70 rounded-xl backdrop-blur-sm border border-purple-500/20 hover:border-purple-400/30 transition-all duration-200">
                            <button
                              onClick={() => toggleInstructions(`${node.id}-0`)}
                              className="w-full flex items-center justify-between p-4 text-left hover:bg-gradient-to-r hover:from-gray-600/80 hover:to-gray-700/80 transition-all duration-200 rounded-xl group"
                            >
                              <div className="flex items-center space-x-2">
                                <Camera className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" />
                                <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors duration-200">Camera Tips</span>
                              </div>
                              {expandedInstructions[`${node.id}-0`] ? 
                                <ChevronUp className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" /> : 
                                <ChevronDown className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors duration-200" />
                              }
                            </button>
                            {expandedInstructions[`${node.id}-0`] && (
                              <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed space-y-2 bg-gradient-to-r from-purple-900/10 to-transparent rounded-b-xl">
                                <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Frame your shot at eye level</p>
                                <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Ensure good lighting on your face</p>
                                <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Keep background simple and clean</p>
                                <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Speak clearly and maintain eye contact</p>
                                <p className="flex items-center"><span className="text-purple-400 mr-2">•</span> Record in landscape orientation</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            
            {/* Dark Bottom Section - Script Guidelines */}
            <div className="relative bg-black/20 backdrop-blur-xl p-8 rounded-b-3xl border-t border-purple-500/30">
              <h3 className="text-xl font-bold text-white mb-4">Script</h3>
              <p className="text-purple-400 leading-relaxed">
                {expandedNode && nodeTypeDescriptions[nodes.find(n => n.id === expandedNode)?.type as keyof typeof nodeTypeDescriptions]}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Asset Selection Modal */}
      {showAssetPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 z-50">
          <div className="relative bg-black/40 backdrop-blur-2xl rounded-3xl max-w-5xl w-full shadow-2xl shadow-purple-500/30 border border-purple-500/30 overflow-hidden">
            {/* Purple glassmorphism overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-purple-800/5" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(139,92,246,0.1),transparent_50%)]" />
            
            {/* Header */}
            <div className="relative bg-black/30 backdrop-blur-xl p-8 border-b border-purple-500/30">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Video Library</h3>
                  <p className="text-purple-300/80 text-sm">Choose from your available assets</p>
                </div>
                <button
                  onClick={() => setShowAssetPopup(false)}
                  className="p-3 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all duration-200 group"
                >
                  <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-wrap gap-4 items-center">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search assets, tags..."
                    value={assetSearchQuery}
                    onChange={(e) => setAssetSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-black/40 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400/50 transition-colors duration-200"
                  />
                </div>

                {/* Type Filter */}
                <div className="flex gap-2">
                  {['all', 'video', 'image', 'audio'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setAssetFilterType(type as any)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        assetFilterType === type
                          ? 'bg-purple-600/80 text-white'
                          : 'bg-gray-600/40 text-gray-300 hover:bg-gray-600/60'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Sort Options */}
                <select
                  value={`${assetSortBy}-${assetSortOrder}`}
                  onChange={(e) => {
                    const [sort, order] = e.target.value.split('-');
                    setAssetSortBy(sort as any);
                    setAssetSortOrder(order as any);
                  }}
                  className="px-3 py-2 bg-black/40 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-purple-400/50"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="size-desc">Largest First</option>
                  <option value="size-asc">Smallest First</option>
                  <option value="type-asc">Type A-Z</option>
                </select>
              </div>
            </div>
            
            {/* Content */}
            <div className="relative p-8 bg-gradient-to-br from-gray-800/50 via-purple-900/5 to-gray-900/50 backdrop-blur-sm">
              {/* Assets Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-h-96 overflow-y-auto pr-2">
                {getFilteredAndSortedAssets().map((asset) => {
                  const typeInfo = getFileTypeInfo(asset.type);
                  const IconComponent = typeInfo.icon;
                  
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleAssetSelect(asset)}
                      className="group bg-black/30 backdrop-blur-xl rounded-2xl p-5 cursor-pointer hover:bg-black/40 transition-all duration-300 border border-purple-500/30 hover:border-purple-400/50 transform hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-black/40 backdrop-blur-sm rounded-xl mb-4 flex items-center justify-center border border-purple-500/30 group-hover:border-purple-400/50 transition-all duration-200 overflow-hidden">
                        <IconComponent className={`w-8 h-8 ${typeInfo.color} group-hover:text-purple-200 transition-colors duration-200`} />
                        
                        {/* Duration badge */}
                        {asset.duration && (
                          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded-lg font-medium backdrop-blur-sm">
                            {asset.duration}
                          </div>
                        )}
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Asset Info */}
                      <div className="space-y-2">
                        <h4 className="text-white text-sm font-semibold leading-tight truncate group-hover:text-purple-100 transition-colors duration-200">
                          {asset.name}
                        </h4>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`${typeInfo.color} font-medium uppercase`}>{asset.type}</span>
                          <span className="text-gray-400">{asset.size}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-purple-500/20">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-sm">
                    {getFilteredAndSortedAssets().length} of {userAssets.length} assets
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAssetPopup(false)}
                      className="px-6 py-2 text-gray-400 hover:text-white border border-gray-600/50 hover:border-gray-500 rounded-xl transition-all duration-200 font-medium"
                    >
                      Cancel
                    </button>
                    <button className="px-6 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-purple-500/30">
                      Upload New
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoWorkflowUI;
