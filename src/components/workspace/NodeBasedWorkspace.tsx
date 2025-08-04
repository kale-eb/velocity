import React, { useState, useCallback, useRef } from 'react';
import type { Theme } from '../../types';
import { 
  Play, 
  FileText, 
  MessageSquare, 
  Plus, 
  Send, 
  X, 
  ChevronDown, 
  ChevronRight,
  Save,
  MoreHorizontal,
  Upload,
  File,
  FileImage,
  Moon,
  Sun,
  Zap
} from 'lucide-react';

const NodeBasedWorkspace: React.FC = () => {
  console.log('NodeBasedWorkspace component starting to render');
  
  const [nodes, setNodes] = useState<any[]>([
    {
      id: 'product-spec',
      type: 'productSpec',
      position: { x: 500, y: 50 },
      selected: false,
      expanded: false,
      data: {
        documents: [
          {
            id: 'doc-1',
            name: 'Product_Requirements.pdf',
            type: 'pdf',
            size: '2.4 MB',
            uploadedAt: '2 hours ago'
          },
          {
            id: 'doc-2',
            name: 'Target_Audience.docx',
            type: 'word',
            size: '1.1 MB',
            uploadedAt: '1 day ago'
          }
        ]
      }
    },
    {
      id: 'ad-1',
      type: 'ad',
      position: { x: 100, y: 200 },
      selected: false,
      expanded: false,
      data: {
        index: 1,
        url: '',
        title: 'Ad 1',
        status: 'empty'
      }
    },
    {
      id: 'script-generator',
      type: 'script',
      position: { x: 450, y: 250 },
      selected: false,
      expanded: true,
      data: {
        messages: [{role: 'assistant', content: 'Add your content and right-click to add more nodes!'}],
        isActive: false
      }
    }
  ]);

  const [connections, setConnections] = useState<any[]>([
    { id: 'conn-1', fromNodeId: 'product-spec', toNodeId: 'script-generator' },
    { id: 'conn-2', fromNodeId: 'ad-1', toNodeId: 'script-generator' }
  ]);

  const [dragState, setDragState] = useState<any>({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 }
  });

  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [chatInput, setChatInput] = useState('');
  const [contextMenu, setContextMenu] = useState<any>({
    visible: false, 
    x: 0, 
    y: 0,
    nodeId: undefined
  });
  const [nextAdIndex, setNextAdIndex] = useState(2);
  const [nextInstructionsIndex, setNextInstructionsIndex] = useState(1);
  const [colorScheme, setColorScheme] = useState<Theme>('light');
  
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Color scheme definitions - easy to modify later
  const colorSchemes = {
    light: {
      ad: { primary: 'emerald', accent: 'emerald-600' },
      productSpec: { primary: 'blue', accent: 'blue-600' },
      script: { primary: 'purple', accent: 'purple-600' },
      instructions: { primary: 'amber', accent: 'amber-600' }
    },
    dark: {
      ad: { primary: 'emerald', accent: 'emerald-400' },
      productSpec: { primary: 'blue', accent: 'blue-400' },
      script: { primary: 'purple', accent: 'purple-400' },
      instructions: { primary: 'amber', accent: 'amber-400' }
    },
    experimental: {
      ad: { primary: 'green', accent: 'green-400' },
      productSpec: { primary: 'cyan', accent: 'cyan-400' },
      script: { primary: 'pink', accent: 'pink-400' },
      instructions: { primary: 'orange', accent: 'orange-400' }
    }
  };

  const getNodeColors = (nodeType) => {
    const scheme = colorSchemes[colorScheme];
    return scheme[nodeType] || scheme.ad;
  };

  const isDarkMode = colorScheme === 'dark';
  const isExperimental = colorScheme === 'experimental';

  const cycleColorScheme = () => {
    setColorScheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'experimental';
      return 'light';
    });
  };
  
  // Check if two rectangles overlap
  const rectanglesOverlap = (rect1, rect2) => {
    return !(rect1.right <= rect2.left || 
             rect2.right <= rect1.left || 
             rect1.bottom <= rect2.top || 
             rect2.bottom <= rect1.top);
  };

  // Get node rectangle bounds
  const getNodeBounds = (node) => {
    const { width, height } = getNodeDimensions(node);
    return {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + width,
      bottom: node.position.y + height,
      width,
      height
    };
  };

  // Get node dimensions based on current expanded state
  const getNodeDimensions = (node) => {
    if (node.type === 'instructions') {
      return {
        width: node.expanded ? 320 : 160,
        height: node.expanded ? 180 : 48
      };
    } else if (node.type === 'script') {
      return { width: 384, height: 300 };
    } else if (node.type === 'productSpec') {
      const baseHeight = 56;
      if (node.expanded) {
        const documentHeight = Math.max(node.data.documents.length * 60, 100);
        const buttonHeight = 40;
        const padding = 32;
        return {
          width: node.expanded ? 320 : 192,
          height: baseHeight + documentHeight + buttonHeight + padding
        };
      }
      return {
        width: node.expanded ? 320 : 192,
        height: baseHeight
      };
    } else {
      return {
        width: node.expanded ? 320 : 192,
        height: 120
      };
    }
  };

  // Get all anchor points for a node
  const getNodeAnchors = (node) => {
    const { width, height } = getNodeDimensions(node);
    const { x, y } = node.position;
    
    const anchors = {
      top: { x: x + width / 2, y: y },
      bottom: { x: x + width / 2, y: y + height },
      left: { x: x, y: y + height / 2 },
      right: { x: x + width, y: y + height / 2 }
    };

    if (node.type === 'script') {
      return {
        top: anchors.top,
        left: anchors.left,
        bottom: anchors.bottom
      };
    }

    return anchors;
  };

  // Find the closest anchor points between two nodes
  const findClosestAnchors = (fromNode, toNode) => {
    const fromAnchors = getNodeAnchors(fromNode);
    const toAnchors = getNodeAnchors(toNode);
    
    let minDistance = Infinity;
    let bestConnection = { from: fromAnchors.right, to: toAnchors.left, fromAnchor: 'right', toAnchor: 'left' };
    
    Object.entries(fromAnchors).forEach(([fromKey, fromPoint]) => {
      Object.entries(toAnchors).forEach(([toKey, toPoint]) => {
        const distance = Math.sqrt(
          Math.pow(fromPoint.x - toPoint.x, 2) + Math.pow(fromPoint.y - toPoint.y, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          bestConnection = { 
            from: fromPoint, 
            to: toPoint, 
            fromAnchor: fromKey, 
            toAnchor: toKey 
          };
        }
      });
    });
    
    return bestConnection;
  };

  // Generate spline path between two points with anchor direction
  const generateSplinePath = (from, to, fromAnchor, toAnchor) => {
    const getControlOffset = (anchor) => {
      switch (anchor) {
        case 'top': return { x: 0, y: -80 };
        case 'bottom': return { x: 0, y: 80 };
        case 'left': return { x: -80, y: 0 };
        case 'right': return { x: 80, y: 0 };
        default: return { x: 0, y: 0 };
      }
    };
    
    const fromOffset = getControlOffset(fromAnchor);
    const toOffset = getControlOffset(toAnchor);
    
    const cp1x = from.x + fromOffset.x;
    const cp1y = from.y + fromOffset.y;
    const cp2x = to.x + toOffset.x;
    const cp2y = to.y + toOffset.y;
    
    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
  };

  // Context menu handlers
  const handleContextMenu = useCallback((e, nodeId) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodeId
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const addAdNode = useCallback(() => {
    const newId = `ad-${nextAdIndex}`;
    const newNode = {
      id: newId,
      type: 'ad',
      position: { x: 100, y: 200 + (nextAdIndex - 1) * 150 },
      selected: false,
      expanded: false,
      data: {
        index: nextAdIndex,
        url: '',
        title: `Ad ${nextAdIndex}`,
        status: 'empty'
      }
    };
    
    setNodes(prev => [...prev, newNode]);
    setConnections(prev => [...prev, {
      id: `conn-ad-${nextAdIndex}`,
      fromNodeId: newId,
      toNodeId: 'script-generator'
    }]);
    setNextAdIndex(prev => prev + 1);
    hideContextMenu();
  }, [nextAdIndex, hideContextMenu]);

  const addInstructionsNode = useCallback(() => {
    const newId = `instructions-${nextInstructionsIndex}`;
    const newNode = {
      id: newId,
      type: 'instructions',
      position: { x: 750, y: 150 + (nextInstructionsIndex - 1) * 100 },
      selected: false,
      expanded: false,
      data: {
        content: '',
        title: `Instructions ${nextInstructionsIndex}`
      }
    };
    
    setNodes(prev => [...prev, newNode]);
    setConnections(prev => [...prev, {
      id: `conn-inst-${nextInstructionsIndex}`,
      fromNodeId: newId,
      toNodeId: 'script-generator'
    }]);
    setNextInstructionsIndex(prev => prev + 1);
    hideContextMenu();
  }, [nextInstructionsIndex, hideContextMenu]);

  const deleteNode = useCallback((nodeId) => {
    if (nodeId === 'script-generator') {
      hideContextMenu();
      return;
    }
    
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setConnections(prev => prev.filter(conn => 
      conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId
    ));
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
    
    hideContextMenu();
  }, [hideContextMenu]);

  // Drag handlers
  const handleMouseDown = useCallback((e, nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDragState({
      isDragging: true,
      nodeId,
      offset: {
        x: e.clientX - node.position.x,
        y: e.clientY - node.position.y
      }
    });
    e.preventDefault();
  }, [nodes]);

  const handleMouseMove = useCallback((e) => {
    if (!dragState.isDragging || !dragState.nodeId) return;

    const newPosition = {
      x: e.clientX - dragState.offset.x,
      y: e.clientY - dragState.offset.y
    };

    setNodes(prevNodes => 
      prevNodes.map(node => 
        node.id === dragState.nodeId
          ? { ...node, position: newPosition }
          : node
      )
    );
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState({ isDragging: false, nodeId: null, offset: { x: 0, y: 0 } });
  }, []);

  React.useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  const toggleNodeSelection = (nodeId) => {
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const toggleNodeExpansion = (nodeId) => {
    setNodes(prevNodes => 
      prevNodes.map(node =>
        node.id === nodeId ? { ...node, expanded: !node.expanded } : node
      )
    );
  };

  const updateNodeData = (nodeId, updates) => {
    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === nodeId 
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  };

  const removeDocument = (nodeId, documentId) => {
    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === nodeId && node.type === 'productSpec'
          ? {
              ...node,
              data: {
                ...node.data,
                documents: node.data.documents.filter(doc => doc.id !== documentId)
              }
            }
          : node
      )
    );
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return <FileImage size={14} className="text-red-500" />;
      case 'word':
        return <FileText size={14} className="text-blue-500" />;
      case 'txt':
        return <File size={14} className="text-slate-500" />;
      default:
        return <File size={14} className="text-slate-500" />;
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === 'script-generator'
          ? {
              ...node,
              data: {
                ...node.data,
                messages: [
                  ...node.data.messages,
                  { role: 'user', content: chatInput }
                ]
              }
            }
          : node
      )
    );

    setTimeout(() => {
      const responses = [
        "I'll help you optimize your ad content based on the selected nodes.",
        "Let me analyze the product specifications and generate targeted ad copy.",
        "I can enhance your ads with better messaging and call-to-action phrases.",
        "Based on your instructions, I'll create more compelling ad variations.",
        "I'll adjust the tone and focus to better match your target audience."
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      setNodes(prevNodes =>
        prevNodes.map(node =>
          node.id === 'script-generator'
            ? {
                ...node,
                data: {
                  ...node.data,
                  messages: [
                    ...node.data.messages,
                    { role: 'assistant', content: randomResponse }
                  ]
                }
              }
            : node
        )
      );
    }, 1000);

    setChatInput('');
  };

  const renderNode = (node) => {
    const isSelected = selectedNodes.has(node.id);
    const { width, height } = getNodeDimensions(node);
    
    const getThemeClasses = (nodeType) => {
      const nodeColors = nodeType ? getNodeColors(nodeType) : null;
      
      if (isExperimental) {
        return {
          card: (nodeColors) => `bg-black border border-${nodeColors.primary}-400/60 shadow-lg shadow-${nodeColors.primary}-400/10 ${
            isSelected ? `ring-2 ring-${nodeColors.primary}-400/50 shadow-${nodeColors.primary}-400/20` : `hover:shadow-${nodeColors.primary}-400/15 hover:border-${nodeColors.primary}-300/70`
          }`,
          border: (nodeColors) => `border-${nodeColors.primary}-400/30`,
          text: 'text-gray-100',
          textSecondary: 'text-gray-300',
          icon: (nodeColors) => `text-${nodeColors.accent}`,
          iconBg: (nodeColors) => `bg-${nodeColors.primary}-400/20`,
          button: (nodeColors) => `text-${nodeColors.accent} hover:text-${nodeColors.primary}-300 hover:bg-${nodeColors.primary}-400/10`,
          input: (nodeColors) => `bg-gray-900/80 border border-${nodeColors.primary}-400/40 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-${nodeColors.primary}-400/50 focus:border-${nodeColors.primary}-300/70 shadow-inner`,
          badge: (nodeColors) => `text-${nodeColors.accent} bg-${nodeColors.primary}-400/20 border border-${nodeColors.primary}-400/30`
        };
      } else if (isDarkMode) {
        return {
          card: (nodeColors) => `bg-gray-900/95 border border-white/40 shadow-xl shadow-${nodeColors.primary}-500/15 ${
            isSelected ? `ring-2 ring-white/60 shadow-${nodeColors.primary}-500/25` : `hover:shadow-${nodeColors.primary}-500/20 hover:border-white/60`
          }`,
          border: () => 'border-white/20',
          text: 'text-gray-100',
          textSecondary: 'text-gray-300',
          icon: (nodeColors) => `text-${nodeColors.accent}`,
          iconBg: (nodeColors) => `bg-${nodeColors.primary}-500/20`,
          button: () => `text-gray-300 hover:text-white hover:bg-gray-700/50`,
          input: () => `bg-gray-800/80 border border-white/30 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-white/50 focus:border-white/60 shadow-inner`,
          badge: (nodeColors) => `text-${nodeColors.accent} bg-${nodeColors.primary}-500/20 border border-white/20`
        };
      } else {
        return {
          card: (nodeColors) => `bg-white border border-${nodeColors.primary}-200/80 shadow-lg shadow-${nodeColors.primary}-900/10 ${
            isSelected ? `ring-2 ring-${nodeColors.primary}-400/50 shadow-${nodeColors.primary}-500/15` : `hover:shadow-${nodeColors.primary}-900/15 hover:border-${nodeColors.primary}-300/90`
          }`,
          border: () => 'border-gray-200',
          text: 'text-gray-900',
          textSecondary: 'text-gray-600',
          icon: (nodeColors) => `text-${nodeColors.accent}`,
          iconBg: (nodeColors) => `bg-${nodeColors.primary}-100`,
          button: () => 'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
          input: () => 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-500 shadow-inner',
          badge: () => 'text-gray-700 bg-gray-100 border border-gray-300'
        };
      }
    };

    const theme = getThemeClasses(node.type);
    const nodeColors = getNodeColors(node.type);
    const baseClasses = `absolute backdrop-blur-sm rounded-2xl shadow-sm transition-all duration-200 cursor-move ${theme.card(nodeColors)} ${dragState.nodeId === node.id ? 'shadow-xl scale-[1.02] z-50' : ''}`;

    // Get anchor positions for this node
    const anchors = getNodeAnchors(node);

    const renderAnchors = () => {
      const anchorElements = [];
      Object.entries(anchors).forEach(([anchorKey, anchor]) => {
        const relativeX = anchor.x - node.position.x;
        const relativeY = anchor.y - node.position.y;
        
        anchorElements.push(
          <div
            key={`anchor-${anchorKey}`}
            className={`absolute w-3 h-3 rounded-full pointer-events-none transition-opacity duration-200 ${
              isExperimental ? `bg-${nodeColors.primary}-400/30 border border-${nodeColors.primary}-300/60` :
              isDarkMode ? 'bg-white/30 border border-white/60' :
              'bg-gray-500 border border-gray-700'
            }`}
            style={{
              left: relativeX - 6,
              top: relativeY - 6,
              opacity: dragState.isDragging ? 0.8 : 0,
              zIndex: 1000
            }}
          />
        );
      });
      return anchorElements;
    };

    switch (node.type) {
      case 'ad':
        return (
          <div
            key={node.id}
            className={`${baseClasses} ${node.expanded ? 'w-80' : 'w-48'}`}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            {renderAnchors()}
            <div className={`p-4 border-b flex items-center justify-between ${theme.border(nodeColors)}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  node.data.status === 'completed' ? 'bg-emerald-500' :
                  node.data.status === 'processing' ? 'bg-amber-500' :
                  node.data.status === 'error' ? 'bg-red-500' : 
                  `bg-${nodeColors.primary}-400`
                }`}></div>
                <span className={`font-medium text-sm ${theme.text}`}>{node.data.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpansion(node.id);
                }}
                className={`transition-colors p-1 rounded-lg ${theme.button(nodeColors)}`}
              >
                {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            <div className="p-4">
              <input
                type="url"
                placeholder="Paste ad URL..."
                className={`w-full px-3 py-2.5 border rounded-xl text-sm transition-all ${theme.input(nodeColors)}`}
                value={node.data.url}
                onChange={(e) => {
                  e.stopPropagation();
                  updateNodeData(node.id, { url: e.target.value });
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        );

      case 'productSpec':
        return (
          <div
            key={node.id}
            className={`${baseClasses} ${node.expanded ? 'w-80' : 'w-48'}`}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            {renderAnchors()}
            <div className={`p-4 border-b flex items-center justify-between ${theme.border()}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${theme.iconBg(nodeColors)}`}>
                  <FileText size={14} className={theme.icon(nodeColors)} />
                </div>
                <span className={`font-medium text-sm ${theme.text}`}>Product Spec</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-1 rounded-lg ${theme.badge(nodeColors)}`}>
                  {node.data.documents.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeExpansion(node.id);
                  }}
                  className={`transition-colors p-1 rounded-lg ${theme.button(nodeColors)}`}
                >
                  {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
            </div>
            
            {node.expanded && (
              <div className="p-4">
                <div className="space-y-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {node.data.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className={`flex items-center justify-between p-2 border rounded-lg transition-colors group ${
                          isExperimental 
                            ? `bg-gray-900/80 border-${nodeColors.primary}-400/30 hover:bg-gray-800/80` 
                            : isDarkMode 
                              ? 'bg-gray-800/60 border-white/20 hover:bg-gray-700/60' 
                              : `bg-gray-50 border-${nodeColors.primary}-200/40 hover:bg-gray-100`
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {getFileIcon(doc.type)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${theme.text}`}>
                              {doc.name}
                            </p>
                            <p className={`text-xs ${theme.textSecondary}`}>
                              {doc.size} • {doc.uploadedAt}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDocument(node.id, doc.id);
                          }}
                          className={`opacity-0 group-hover:opacity-100 transition-all p-1 rounded ${
                            isExperimental 
                              ? 'text-red-400 hover:text-red-300' 
                              : isDarkMode 
                                ? 'text-red-400 hover:text-red-300' 
                                : 'text-red-500 hover:text-red-600'
                          }`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    
                    {node.data.documents.length === 0 && (
                      <div className={`text-center py-6 ${theme.textSecondary}`}>
                        <Upload size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No documents added</p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newDoc = {
                        id: `doc-${Date.now()}`,
                        name: 'New_Document.pdf',
                        type: 'pdf',
                        size: '1.2 MB',
                        uploadedAt: 'Just now'
                      };
                      updateNodeData(node.id, {
                        documents: [...node.data.documents, newDoc]
                      });
                    }}
                    className={`w-full border text-sm py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all font-medium ${
                      isExperimental 
                        ? `bg-${nodeColors.primary}-400/20 hover:bg-${nodeColors.primary}-400/30 border-${nodeColors.primary}-400/30 text-${nodeColors.accent}` 
                        : isDarkMode 
                          ? `bg-${nodeColors.primary}-500/20 hover:bg-${nodeColors.primary}-500/30 border-white/20 text-${nodeColors.accent}` 
                          : `bg-${nodeColors.primary}-50 hover:bg-${nodeColors.primary}-100 border-${nodeColors.primary}-200 text-${nodeColors.accent}`
                    }`}
                  >
                    <Upload size={12} />
                    <span>Add Document</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'instructions':
        return (
          <div
            key={node.id}
            className={`${baseClasses} ${node.expanded ? 'w-80' : 'w-40'} ${node.expanded ? 'h-auto' : 'h-12'}`}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            {renderAnchors()}
            {!node.expanded ? (
              <div className="h-full flex items-center justify-between px-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                    isExperimental ? 'bg-amber-500/25' : isDarkMode ? 'bg-indigo-500/25' : 'bg-indigo-500/15'
                  }`}>
                    <MoreHorizontal size={12} className={
                      isExperimental ? 'text-amber-400' : isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                    } />
                  </div>
                  <span className={`font-medium text-xs ${theme.text}`}>Instructions</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeExpansion(node.id);
                  }}
                  className={`transition-colors p-1 rounded-lg ${theme.button}`}
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                      isExperimental ? 'bg-amber-500/25' : isDarkMode ? 'bg-indigo-500/25' : 'bg-indigo-500/15'
                    }`}>
                      <MoreHorizontal size={12} className={
                        isExperimental ? 'text-amber-400' : isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                      } />
                    </div>
                    <span className={`font-medium text-sm ${theme.text}`}>Instructions</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNodeExpansion(node.id);
                    }}
                    className={`transition-colors p-1 rounded-lg ${theme.button}`}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
                <textarea
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm resize-none transition-all ${theme.input}`}
                  rows={3}
                  placeholder="Add specific instructions for the AI..."
                  value={node.data.content}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateNodeData(node.id, { content: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeExpansion(node.id);
                  }}
                  className={`w-full text-sm py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all font-medium shadow-sm text-white ${
                    isExperimental 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600' 
                      : isDarkMode 
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600' 
                        : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                  }`}
                >
                  <Save size={12} />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>
        );

      case 'script':
        return (
          <div
            key={node.id}
            className={`${baseClasses} w-96`}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            {renderAnchors()}
            <div className={`p-4 border-b flex items-center justify-between ${theme.border}`}>
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isExperimental 
                    ? 'bg-gradient-to-br from-yellow-400/20 to-amber-500/20' 
                    : isDarkMode 
                      ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20' 
                      : 'bg-gradient-to-br from-blue-500/10 to-indigo-500/10'
                }`}>
                  <MessageSquare size={14} className={theme.icon} />
                </div>
                <span className={`font-medium text-sm ${theme.text}`}>Script Generator</span>
              </div>
              <div className="flex items-center space-x-2">
                {selectedNodes.size > 0 && (
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${theme.badge}`}>
                    {selectedNodes.size} selected
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4">
              <div className="space-y-3">
                <div className={`h-40 overflow-y-auto space-y-2 border rounded-xl p-3 ${
                  isExperimental 
                    ? 'bg-gray-900/40 border-yellow-400/30' 
                    : isDarkMode 
                      ? 'bg-gray-800/40 border-purple-500/20' 
                      : 'bg-slate-50/40 border-slate-200/40'
                }`}>
                  {node.data.messages.map((msg, idx) => (
                    <div key={idx} className={`text-xs ${
                      msg.role === 'user' 
                        ? (isExperimental ? 'text-yellow-300' : isDarkMode ? 'text-purple-300' : 'text-blue-600')
                        : (isExperimental ? 'text-yellow-100' : isDarkMode ? 'text-gray-300' : 'text-slate-600')
                    }`}>
                      <strong className="font-medium">{msg.role === 'user' ? 'You:' : 'AI:'}</strong> {msg.content}
                    </div>
                  ))}
                </div>
                
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className={`flex-1 px-3 py-2.5 border rounded-xl text-sm transition-all ${theme.input}`}
                    placeholder={selectedNodes.size > 0 ? "Ask me to modify selected items..." : "Select nodes first..."}
                    value={chatInput}
                    onChange={(e) => {
                      e.stopPropagation();
                      setChatInput(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        sendChatMessage();
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sendChatMessage();
                    }}
                    className={`p-2.5 rounded-xl transition-all disabled:opacity-50 shadow-sm text-white ${
                      isExperimental 
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600' 
                        : isDarkMode 
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600' 
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                    }`}
                    disabled={!chatInput.trim()}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  console.log('About to return JSX from NodeBasedWorkspace');
  console.log('Current state - nodes:', nodes.length, 'colorScheme:', colorScheme);
  
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isExperimental 
        ? 'bg-gradient-to-br from-black via-gray-900 to-yellow-900/20'
        : isDarkMode 
          ? 'bg-gradient-to-br from-black via-gray-900 to-black' 
          : 'bg-gradient-to-br from-gray-100 via-white to-gray-50'
    }`}>
      <div className={`backdrop-blur-md border-b px-6 py-4 transition-colors duration-300 ${
        isExperimental
          ? 'bg-black/90 border-yellow-400/30'
          : isDarkMode 
            ? 'bg-gray-900/90 border-purple-500/30' 
            : 'bg-white/95 border-gray-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex space-x-1.5">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            </div>
            <h1 className={`text-lg font-semibold ${
              isExperimental ? 'text-yellow-100' :
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>AdCraft Studio</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={cycleColorScheme}
              className={`p-2 rounded-xl transition-all duration-200 flex items-center space-x-2 ${
                isExperimental 
                  ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300' 
                  : isDarkMode 
                    ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
              }`}
              title={`Current: ${colorScheme} - Click to cycle`}
            >
              {colorScheme === 'light' && <Sun size={16} />}
              {colorScheme === 'dark' && <Moon size={16} />}
              {colorScheme === 'experimental' && <Zap size={16} />}
              <span className="text-xs font-medium capitalize">{colorScheme}</span>
            </button>
            
            {selectedNodes.size > 0 && (
              <div className={`flex items-center space-x-2 text-sm ${
                isExperimental ? 'text-yellow-400' :
                isDarkMode ? 'text-purple-400' : 'text-gray-700'
              }`}>
                <span className="font-medium">{selectedNodes.size} nodes selected</span>
                <button
                  onClick={() => setSelectedNodes(new Set())}
                  className={`transition-colors ${
                    isExperimental ? 'text-yellow-300 hover:text-yellow-200' :
                    isDarkMode ? 'text-purple-300 hover:text-purple-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className={`text-sm ${
              isExperimental ? 'text-yellow-200/80' :
              isDarkMode ? 'text-purple-300/80' : 'text-gray-600'
            }`}>
              Right-click to add nodes • Drag to move • Click to select
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={workspaceRef}
        className="relative w-full h-[calc(100vh-73px)] overflow-auto"
        style={{ 
          backgroundImage: isExperimental ? `
            radial-gradient(circle at 25px 25px, rgba(234, 179, 8, 0.12) 1px, transparent 0),
            radial-gradient(circle at 75px 75px, rgba(234, 179, 8, 0.12) 1px, transparent 0)
          ` : isDarkMode ? `
            radial-gradient(circle at 25px 25px, rgba(168, 85, 247, 0.08) 1px, transparent 0),
            radial-gradient(circle at 75px 75px, rgba(168, 85, 247, 0.08) 1px, transparent 0)
          ` : `
            radial-gradient(circle at 25px 25px, rgba(75, 85, 99, 0.08) 1px, transparent 0),
            radial-gradient(circle at 75px 75px, rgba(75, 85, 99, 0.08) 1px, transparent 0)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: '0 0, 25px 25px',
          minHeight: '800px',
          minWidth: '1200px'
        }}
        onContextMenu={(e) => !contextMenu.visible && handleContextMenu(e)}
        onClick={hideContextMenu}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {connections.map(conn => {
            const fromNode = nodes.find(n => n.id === conn.fromNodeId);
            const toNode = nodes.find(n => n.id === conn.toNodeId);
            
            if (!fromNode || !toNode) return null;
            
            const shouldHide = dragState.isDragging && 
              (dragState.nodeId === conn.fromNodeId || dragState.nodeId === conn.toNodeId);
            
            if (shouldHide) return null;
            
            const closestAnchors = findClosestAnchors(fromNode, toNode);
            const path = generateSplinePath(
              closestAnchors.from, 
              closestAnchors.to, 
              closestAnchors.fromAnchor, 
              closestAnchors.toAnchor
            );

            const connectionColors = isExperimental 
              ? { bg: "rgba(234, 179, 8, 0.20)", fg: "rgba(234, 179, 8, 0.8)" }
              : isDarkMode 
                ? { bg: "rgba(168, 85, 247, 0.15)", fg: "rgba(168, 85, 247, 0.6)" }
                : { bg: "rgba(75, 85, 99, 0.10)", fg: "rgba(75, 85, 99, 0.6)" };
            
            return (
              <g key={conn.id}>
                <path
                  d={path}
                  stroke={connectionColors.bg}
                  strokeWidth="16"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={path}
                  stroke={connectionColors.fg}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>
        
        <div style={{ zIndex: 2, position: 'relative' }}>
          {nodes.map((node) => renderNode(node))}
        </div>
        
        {contextMenu.visible && (
          <div
            className={`fixed backdrop-blur-md border rounded-2xl shadow-xl py-2 z-50 transition-colors duration-200 ${
              isExperimental
                ? 'bg-black/95 border-yellow-400/30'
                : isDarkMode 
                  ? 'bg-gray-900/95 border-purple-500/30' 
                  : 'bg-white/95 border-gray-300'
            }`}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.nodeId ? (
              <button
                onClick={() => deleteNode(contextMenu.nodeId)}
                className={`w-full px-4 py-2.5 text-left flex items-center space-x-3 transition-colors text-sm rounded-xl mx-2 font-medium ${
                  isExperimental
                    ? 'text-red-400 hover:bg-red-500/10'
                    : isDarkMode 
                      ? 'text-red-400 hover:bg-red-500/10' 
                      : 'text-red-600 hover:bg-red-50'
                }`}
                disabled={contextMenu.nodeId === 'script-generator'}
              >
                <X size={14} />
                <span>Delete</span>
              </button>
            ) : (
              <>
                <button
                  onClick={addAdNode}
                  className={`w-full px-4 py-2.5 text-left flex items-center space-x-3 transition-colors text-sm rounded-xl mx-2 font-medium ${
                    isExperimental
                      ? 'text-yellow-200 hover:bg-yellow-400/10'
                      : isDarkMode 
                        ? 'text-gray-200 hover:bg-purple-500/10' 
                        : 'text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <Plus size={14} />
                  <span>Add Ad</span>
                </button>
                <button
                  onClick={addInstructionsNode}
                  className={`w-full px-4 py-2.5 text-left flex items-center space-x-3 transition-colors text-sm rounded-xl mx-2 font-medium ${
                    isExperimental
                      ? 'text-yellow-200 hover:bg-yellow-400/10'
                      : isDarkMode 
                        ? 'text-gray-200 hover:bg-purple-500/10' 
                        : 'text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <MoreHorizontal size={14} />
                  <span>Add Instructions</span>
                </button>
              </>
            )}
          </div>
        )}
        
        {selectedNodes.size > 0 && (
          <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-md transition-colors duration-200 ${
            isExperimental
              ? 'bg-yellow-600 text-black'
              : isDarkMode 
                ? 'bg-purple-600 text-gray-100' 
                : 'bg-gray-800 text-white'
          }`}>
            <div className="text-sm font-medium">
              {selectedNodes.size} nodes selected - Use script generator to modify them
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeBasedWorkspace;