import React, { useState, useCallback, useRef, useMemo, forwardRef } from 'react';
import type { WorkspaceNode, Connection, Point, Theme } from '../../types';
import { 
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

const defaultNodes = [
  {
    id: 'product-spec',
    type: 'productSpec',
    position: { x: 200, y: -100 },  // Above origin
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
    position: { x: -150, y: 100 },  // Left of origin
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
    position: { x: 100, y: 200 },  // Near origin
    selected: false,
    expanded: true,
    data: {
      messages: [{role: 'assistant', content: 'Add your content and right-click to add more nodes!'}],
      isActive: false
    }
  }
];

interface NodeBasedWorkspaceProps {
  colorScheme: Theme;
  hideHeader?: boolean;
  zoomLevel?: number;
  savedViewportState?: {
    panOffset: Point;
    zoomLevel: number;
  };
  onWorkspaceBoundsChange?: (bounds: any) => void;
  onViewportStateChange?: (state: any) => void;
  onNodesChange?: (nodes: any[]) => void;
  onConnectionsChange?: (connections: any[]) => void;
  nodes?: any[];
  connections?: any[];
  onAddNode?: (type: string, data?: any) => string | null;
  onUpdateNode?: (id: string, updates: any) => void;
  onDeleteNode?: (id: string) => void;
  onReorganizeNodes?: () => void;
}

const NodeBasedWorkspaceFixed = forwardRef<HTMLDivElement, NodeBasedWorkspaceProps>(({ 
  colorScheme: externalColorScheme, 
  hideHeader = false, 
  zoomLevel = 100, 
  savedViewportState,
  onWorkspaceBoundsChange, 
  onViewportStateChange,
  onNodesChange,
  onConnectionsChange,
  nodes: propNodes = [],
  connections: propConnections = [],
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onReorganizeNodes
}, ref) => {
  // Local state for rendering (position, selected, expanded)
  const [localNodes, setLocalNodes] = useState<any[]>(propNodes.length > 0 ? propNodes : []);

  // Sync shared data with local rendering nodes
  React.useEffect(() => {
    // Always sync with propNodes (they come from Zustand store)
    setLocalNodes(propNodes);
  }, [propNodes]);

  // Notify parent only of data changes, not rendering changes
  const notifyDataChange = useCallback((updatedNodes) => {
    if (onNodesChange) {
      // Only send data that should be shared (not position/selected/expanded)
      const sharedData = updatedNodes.map(node => ({
        id: node.id,
        type: node.type,
        data: node.data
      }));
      onNodesChange(sharedData);
    }
  }, [onNodesChange]);

  const nodes = localNodes;
  const setNodes = setLocalNodes;

  const connections = propConnections.length > 0 ? propConnections : [
    { id: 'conn-1', fromNodeId: 'product-spec', toNodeId: 'script-generator' },
    { id: 'conn-2', fromNodeId: 'ad-1', toNodeId: 'script-generator' }
  ];

  const setConnections = useCallback((updaterOrValue) => {
    if (typeof updaterOrValue === 'function') {
      const newConnections = updaterOrValue(connections);
      onConnectionsChange && onConnectionsChange(newConnections);
    } else {
      onConnectionsChange && onConnectionsChange(updaterOrValue);
    }
  }, [connections, onConnectionsChange]);

  // Simplified drag state
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const dragRef = useRef({
    isDragging: false,
    nodeId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    element: null,
    originalPosition: null
  });

  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [chatInput, setChatInput] = useState('');
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    nodeId: undefined,
    workspaceX: 0,
    workspaceY: 0
  });
  const [internalColorScheme, setInternalColorScheme] = useState('light');
  const colorScheme = externalColorScheme || internalColorScheme;
  const [panOffset, setPanOffset] = useState(savedViewportState?.panOffset || { x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [canvasBounds, setCanvasBounds] = useState({ minX: 0, maxX: 1200, minY: 0, maxY: 800 });
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
  const [nodeBounds, setNodeBounds] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [showSelectionTip, setShowSelectionTip] = useState(true);
  const [tipTimeout, setTipTimeout] = useState(null);
  
  const workspaceRef = useRef(null);

  // Anchor and spline functions
  const getNodeAnchors = (node) => {
    try {
      if (!node || !node.position) {
        console.error('Invalid node passed to getNodeAnchors:', node);
        return { top: {x: 0, y: 0}, right: {x: 0, y: 0}, bottom: {x: 0, y: 0}, left: {x: 0, y: 0} };
      }

      let nodeWidth, nodeHeight;
      
      // Calculate exact dimensions based on node type and expansion state
      if (node.type === 'script') {
        nodeWidth = 384; // w-96 = 384px (fixed width for script)
        nodeHeight = 320; // fixed height for script generator
      } else {
        nodeWidth = node.expanded ? 320 : 192; // w-80 = 320px, w-48 = 192px
        
        // Calculate height based on content
        if (node.type === 'productSpec') {
          if (node.expanded) {
            const docsCount = node.data?.documents?.length || 0;
            // Header (80px) + docs container with padding + button
            nodeHeight = 80 + 16 + Math.min(docsCount * 60 + 48, 192) + 16 + 44 + 16; // more accurate calculation
          } else {
            nodeHeight = 80; // just header when collapsed
          }
        } else if (node.type === 'instructions') {
          if (node.expanded) {
            nodeHeight = 80 + 16 + 144 + 16; // header + padding + textarea (6 rows * 24px) + padding
          } else {
            nodeHeight = 80; // just header when collapsed
          }
        } else if (node.type === 'ad') {
          nodeHeight = node.expanded ? 80 + 16 + 44 + 16 : 80; // header + padding + input + padding or just header
        } else {
          nodeHeight = 120; // default
        }
      }
      
      const baseAnchors = {
        top: { x: node.position.x + nodeWidth / 2, y: node.position.y },
        right: { x: node.position.x + nodeWidth, y: node.position.y + nodeHeight / 2 },
        bottom: { x: node.position.x + nodeWidth / 2, y: node.position.y + nodeHeight },
        left: { x: node.position.x, y: node.position.y + nodeHeight / 2 }
      };
      
      // Script generator only has input anchors (no right anchor for outputs)
      if (node.type === 'script') {
        return {
          top: baseAnchors.top,
          bottom: baseAnchors.bottom,
          left: baseAnchors.left
        };
      }
      
      return baseAnchors;
    } catch (e) {
      console.error('Error in getNodeAnchors:', e, node);
      return { top: {x: 0, y: 0}, right: {x: 0, y: 0}, bottom: {x: 0, y: 0}, left: {x: 0, y: 0} };
    }
  };

  const findClosestAnchors = (fromNode, toNode) => {
    const fromAnchors = getNodeAnchors(fromNode);
    const toAnchors = getNodeAnchors(toNode);
    
    let minDistance = Infinity;
    let bestFromAnchor = fromAnchors.right;
    let bestToAnchor = toAnchors.left;
    
    Object.entries(fromAnchors).forEach(([fromKey, fromAnchor]) => {
      Object.entries(toAnchors).forEach(([toKey, toAnchor]) => {
        const distance = Math.sqrt(
          Math.pow(fromAnchor.x - toAnchor.x, 2) + 
          Math.pow(fromAnchor.y - toAnchor.y, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          bestFromAnchor = fromAnchor;
          bestToAnchor = toAnchor;
        }
      });
    });
    
    return { from: bestFromAnchor, to: bestToAnchor };
  };

  const generateSplinePath = (from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Control point distance based on connection length
    const controlDistance = Math.min(distance * 0.5, 100);
    
    // Determine control point direction based on relative positions
    let cp1x, cp1y, cp2x, cp2y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal bias
      if (dx > 0) {
        cp1x = from.x + controlDistance;
        cp1y = from.y;
        cp2x = to.x - controlDistance;
        cp2y = to.y;
      } else {
        cp1x = from.x - controlDistance;
        cp1y = from.y;
        cp2x = to.x + controlDistance;
        cp2y = to.y;
      }
    } else {
      // Vertical bias
      if (dy > 0) {
        cp1x = from.x;
        cp1y = from.y + controlDistance;
        cp2x = to.x;
        cp2y = to.y - controlDistance;
      } else {
        cp1x = from.x;
        cp1y = from.y - controlDistance;
        cp2x = to.x;
        cp2y = to.y + controlDistance;
      }
    }
    
    return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
  };

  // Collision detection functions
  const rectanglesOverlap = (rect1, rect2) => {
    return !(rect1.right <= rect2.left || 
             rect2.right <= rect1.left || 
             rect1.bottom <= rect2.top || 
             rect2.bottom <= rect1.top);
  };

  const getNodeBounds = (node) => {
    if (!node || !node.position) {
      console.error('Invalid node or missing position:', node);
      return {
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100
      };
    }
    
    const anchors = getNodeAnchors(node);
    const nodeWidth = (anchors.right.x - anchors.left.x);
    const nodeHeight = (anchors.bottom.y - anchors.top.y);
    
    return {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + nodeWidth,
      bottom: node.position.y + nodeHeight,
      width: nodeWidth,
      height: nodeHeight
    };
  };

  const checkDragCollision = (draggedNode, newPosition, otherNodes) => {
    try {
      const draggedBounds = getNodeBounds({...draggedNode, position: newPosition});

      return otherNodes
        .filter(node => node.id !== draggedNode.id)
        .filter(node => {
          try {
            return rectanglesOverlap(draggedBounds, getNodeBounds(node));
          } catch (e) {
            console.error('Error in collision check:', e);
            return false;
          }
        });
    } catch (e) {
      console.error('Error in checkDragCollision:', e);
      return [];
    }
  };

  const pushOverlappingNodes = (draggedNode, newPosition, allNodes) => {
    const collisions = checkDragCollision(draggedNode, newPosition, allNodes);
    if (collisions.length === 0) return allNodes;

    const updatedNodes = [...allNodes];
    const draggedBounds = getNodeBounds({...draggedNode, position: newPosition});

    collisions.forEach(collidingNode => {
      const collidingBounds = getNodeBounds(collidingNode);
      
      // Calculate push direction and distance
      const centerX1 = draggedBounds.left + draggedBounds.width / 2;
      const centerY1 = draggedBounds.top + draggedBounds.height / 2;
      const centerX2 = collidingBounds.left + collidingBounds.width / 2;
      const centerY2 = collidingBounds.top + collidingBounds.height / 2;
      
      const dx = centerX2 - centerX1;
      const dy = centerY2 - centerY1;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance === 0) return; // Avoid division by zero
      
      // Normalize direction
      const pushX = (dx / distance) * 50; // Push by 50px
      const pushY = (dy / distance) * 50;
      
      // Update the colliding node's position
      const nodeIndex = updatedNodes.findIndex(n => n.id === collidingNode.id);
      if (nodeIndex !== -1) {
        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          position: {
            x: collidingNode.position.x + pushX,
            y: collidingNode.position.y + pushY
          }
        };
      }
    });

    return updatedNodes;
  };

  const pushOverlappingNodesImmediate = (expandedNode, allNodes) => {
    try {
      // Simple bounds calculation for expansion pushing
      const expandedWidth = expandedNode.expanded ? 320 : 192;
      const expandedHeight = expandedNode.type === 'script' ? 320 : 
        (expandedNode.expanded ? 240 : 80); // simplified height

      const expandedBounds = {
        left: expandedNode.position.x,
        top: expandedNode.position.y,
        right: expandedNode.position.x + expandedWidth,
        bottom: expandedNode.position.y + expandedHeight,
        width: expandedWidth,
        height: expandedHeight
      };

      return allNodes.map(node => {
        if (node.id === expandedNode.id) return node;

        // Simple bounds for other nodes
        const nodeWidth = node.expanded ? 320 : 192;
        const nodeHeight = node.type === 'script' ? 320 : 
          (node.expanded ? 240 : 80);

        const nodeBounds = {
          left: node.position.x,
          top: node.position.y,
          right: node.position.x + nodeWidth,
          bottom: node.position.y + nodeHeight,
          width: nodeWidth,
          height: nodeHeight
        };

        // Check if nodes overlap
        const overlaps = !(expandedBounds.right <= nodeBounds.left || 
          nodeBounds.right <= expandedBounds.left || 
          expandedBounds.bottom <= nodeBounds.top || 
          nodeBounds.bottom <= expandedBounds.top);

        if (!overlaps) return node;

        // Calculate push direction
        const expandedCenterX = expandedBounds.left + expandedBounds.width / 2;
        const expandedCenterY = expandedBounds.top + expandedBounds.height / 2;
        const nodeCenterX = nodeBounds.left + nodeBounds.width / 2;
        const nodeCenterY = nodeBounds.top + nodeBounds.height / 2;

        const dx = nodeCenterX - expandedCenterX;
        const dy = nodeCenterY - expandedCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
          // Push down if centers are same
          return {
            ...node,
            position: {
              x: node.position.x,
              y: node.position.y + 150
            }
          };
        }

        // Calculate minimum distance to push node completely outside expanded bounds
        const gap = 50; // Increased gap from 20px to 50px
        const minXDistance = (expandedBounds.width / 2) + (nodeWidth / 2) + gap;
        const minYDistance = (expandedBounds.height / 2) + (nodeHeight / 2) + gap;
        
        // Determine which direction to push based on current overlap
        let newX = node.position.x;
        let newY = node.position.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal push
          if (dx > 0) {
            // Push right
            newX = expandedBounds.right + gap;
          } else {
            // Push left
            newX = expandedBounds.left - nodeWidth - gap;
          }
        } else {
          // Vertical push
          if (dy > 0) {
            // Push down
            newY = expandedBounds.bottom + gap;
          } else {
            // Push up
            newY = expandedBounds.top - nodeHeight - gap;
          }
        }

        return {
          ...node,
          position: {
            x: newX,
            y: newY
          }
        };
      });
    } catch (e) {
      console.error('Error in pushOverlappingNodesImmediate:', e);
      return allNodes;
    }
  };

  const isDarkMode = colorScheme === 'dark';
  const isExperimental = colorScheme === 'experimental';

  const cycleColorScheme = () => {
    if (!externalColorScheme) {
      setInternalColorScheme(prev => {
        if (prev === 'light') return 'dark';
        if (prev === 'dark') return 'experimental';
        return 'light';
      });
    }
  };

  // Simple workspace panning - start fresh
  const handleWorkspaceMouseDown = (e) => {
    if (e.target === workspaceRef.current && !dragRef.current.isDragging) {
      setIsPanning(true);
      e.preventDefault();
    }
  };

  const handleWorkspaceMouseMove = (e) => {
    if (isPanning && canvasBounds) {
      const scale = zoomLevel / 100;
      
      setPanOffset(prev => {
        let newX = prev.x + e.movementX;
        let newY = prev.y + e.movementY;
        
        // Calculate pan limits - viewport must stay within canvas bounds
        
        // Rightmost pan: when left edge of canvas hits left edge of viewport
        const maxPanX = -canvasBounds.minX * scale;
        
        // Leftmost pan: when right edge of canvas hits right edge of viewport
        const minPanX = viewportSize.width - canvasBounds.maxX * scale;
        
        // Bottommost pan: when top edge of canvas hits top edge of viewport  
        const maxPanY = -canvasBounds.minY * scale;
        
        // Topmost pan: when bottom edge of canvas hits bottom edge of viewport
        const minPanY = viewportSize.height - canvasBounds.maxY * scale;
        
        // Apply constraints - clamp pan offset within canvas bounds
        newX = Math.max(minPanX, Math.min(maxPanX, newX));
        newY = Math.max(minPanY, Math.min(maxPanY, newY));
        
        return { x: newX, y: newY };
      });
    }
  };

  const handleWorkspaceMouseUp = () => {
    setIsPanning(false);
    
    // Save viewport state when panning ends
    if (onViewportStateChange) {
      onViewportStateChange({
        panOffset,
        zoomLevel
      });
    }
  };

  // Update viewport size on mount and resize
  React.useEffect(() => {
    const updateViewportSize = () => {
      if (workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        setViewportSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);

    return () => {
      window.removeEventListener('resize', updateViewportSize);
    };
  }, []);

  // Calculate dynamic canvas bounds based on nodes
  React.useEffect(() => {
    // Don't update bounds while dragging
    if (draggedNodeId) return;
    
    const BUFFER = 300; // Buffer around all nodes
    
    // ALWAYS start with viewport as minimum canvas
    let newMinX = 0;
    let newMaxX = viewportSize.width;
    let newMinY = 0;
    let newMaxY = viewportSize.height;
    
    if (nodes.length === 0) {
      setCanvasBounds({
        minX: 0,
        maxX: viewportSize.width,
        minY: 0,
        maxY: viewportSize.height
      });
      setNodeBounds(null);
      return;
    }

    // Calculate actual node bounds
    const calculatedNodeBounds = nodes.reduce((bounds, node) => {
      // Simple dimensions - we'll expand canvas generously anyway
      const width = 400;
      const height = 300;
      
      return {
        minX: Math.min(bounds.minX, node.position.x),
        maxX: Math.max(bounds.maxX, node.position.x + width),
        minY: Math.min(bounds.minY, node.position.y),
        maxY: Math.max(bounds.maxY, node.position.y + height)
      };
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });
    
    setNodeBounds(calculatedNodeBounds);

    // Canvas should ALWAYS encompass all nodes + buffer, can shrink when nodes move back
    // Maximum bounds: 3k horizontal (-3000 to +3000), 2k vertical (-2000 to +2000)
    const MAX_HORIZONTAL = 3000;
    const MAX_VERTICAL = 2000;
    
    newMinX = Math.max(-MAX_HORIZONTAL, Math.min(0, calculatedNodeBounds.minX - BUFFER));
    newMaxX = Math.min(MAX_HORIZONTAL, Math.max(viewportSize.width, calculatedNodeBounds.maxX + BUFFER));
    newMinY = Math.max(-MAX_VERTICAL, Math.min(0, calculatedNodeBounds.minY - BUFFER));
    newMaxY = Math.min(MAX_VERTICAL, Math.max(viewportSize.height, calculatedNodeBounds.maxY + BUFFER));

    setCanvasBounds({
      minX: newMinX,
      maxX: newMaxX,
      minY: newMinY,
      maxY: newMaxY
    });
  }, [nodes, viewportSize, draggedNodeId]);

  // Calculate dynamic zoom limits
  const calculateZoomLimits = useCallback(() => {
    const MAX_ZOOM = 300; // Maximum 3x zoom
    
    if (!canvasBounds || !viewportSize.width || !viewportSize.height) {
      return { min: 100, max: MAX_ZOOM };
    }
    
    // Calculate the scale needed to fit all canvas content in viewport
    const canvasWidth = canvasBounds.maxX - canvasBounds.minX;
    const canvasHeight = canvasBounds.maxY - canvasBounds.minY;
    
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      return { min: 100, max: MAX_ZOOM };
    }
    
    const scaleX = viewportSize.width / canvasWidth;
    const scaleY = viewportSize.height / canvasHeight;
    
    // Minimum zoom ensures canvas fills viewport (cannot zoom out past canvas borders)
    const minZoom = Math.min(scaleX, scaleY) * 100;
    
    return {
      min: Math.max(25, minZoom), // At least 25% but never smaller than what fits canvas
      max: MAX_ZOOM
    };
  }, [canvasBounds, viewportSize]);

  // Update zoom limits in parent
  React.useEffect(() => {
    if (onWorkspaceBoundsChange) {
      const limits = calculateZoomLimits();
      onWorkspaceBoundsChange({
        ...canvasBounds,
        zoomLimits: limits
      });
    }
  }, [canvasBounds, calculateZoomLimits, onWorkspaceBoundsChange]);

  // Initialize with saved state on mount
  React.useEffect(() => {
    if (savedViewportState?.panOffset) {
      setPanOffset(savedViewportState.panOffset);
    }
  }, []); // Only on mount

  // Notify parent component when nodes change
  React.useEffect(() => {
    if (onNodesChange) {
      onNodesChange(nodes);
    }
  }, [nodes, onNodesChange]);


  // Add workspace panning event listeners  
  React.useEffect(() => {
    if (isPanning) {
      document.addEventListener('mousemove', handleWorkspaceMouseMove);
      document.addEventListener('mouseup', handleWorkspaceMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleWorkspaceMouseMove);
      document.removeEventListener('mouseup', handleWorkspaceMouseUp);
    };
  }, [isPanning]);

  // Handle keyboard events for deletion
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Don't trigger if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (selectedNodes.size > 0) {
          e.preventDefault();
          setShowDeleteConfirm(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes.size]);

  // Handle selection tip auto-dismiss and reset
  React.useEffect(() => {
    if (selectedNodes.size > 0) {
      setShowSelectionTip(true);
      
      // Clear existing timeout
      if (tipTimeout) {
        clearTimeout(tipTimeout);
      }
      
      // Set new timeout to hide after 5 seconds
      const newTimeout = setTimeout(() => {
        setShowSelectionTip(false);
      }, 5000);
      
      setTipTimeout(newTimeout);
    } else {
      // Clear timeout when no selection
      if (tipTimeout) {
        clearTimeout(tipTimeout);
        setTipTimeout(null);
      }
      setShowSelectionTip(true); // Reset for next selection
    }
    
    return () => {
      if (tipTimeout) {
        clearTimeout(tipTimeout);
      }
    };
  }, [selectedNodes.size]);

  const confirmDelete = () => {
    // Filter out nodes that can't be deleted (script generator)
    const deletableNodes = Array.from(selectedNodes).filter(nodeId => nodeId !== 'script-generator');
    
    if (deletableNodes.length > 0) {
      saveToHistory();
      setNodes(prev => prev.filter(node => !deletableNodes.includes(node.id)));
      setConnections(prev => prev.filter(conn => 
        !deletableNodes.includes(conn.fromNodeId) && !deletableNodes.includes(conn.toNodeId)
      ));
    }
    
    setSelectedNodes(new Set());
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // History management for undo/redo functionality
  const saveToHistory = React.useCallback(() => {
    setHistory(prev => {
      const newHistory = [...prev, { nodes, connections }];
      // Keep only last 20 states to prevent memory issues
      return newHistory.slice(-20);
    });
    // Clear redo history when new action is performed
    setRedoHistory([]);
  }, [nodes, connections]);

  const undo = () => {
    if (history.length === 0) return;
    
    // Save current state to redo history
    setRedoHistory(prev => [...prev, { nodes, connections }]);
    
    const previousState = history[history.length - 1];
    setNodes(previousState.nodes);
    setConnections(previousState.connections);
    setHistory(prev => prev.slice(0, -1));
    setSelectedNodes(new Set()); // Clear selection after undo
  };

  const redo = () => {
    if (redoHistory.length === 0) return;
    
    // Save current state to undo history
    setHistory(prev => [...prev, { nodes, connections }]);
    
    const nextState = redoHistory[redoHistory.length - 1];
    setNodes(nextState.nodes);
    setConnections(nextState.connections);
    setRedoHistory(prev => prev.slice(0, -1));
    setSelectedNodes(new Set()); // Clear selection after redo
  };

  const clearSelection = () => {
    setSelectedNodes(new Set());
  };

  const reorganizeNodes = () => {
    // Save for undo
    saveToHistory();
    
    // Get node types
    const scriptGen = nodes.find(n => n.type === 'script');
    if (!scriptGen) return; // Safety check
    
    const ads = nodes.filter(n => n.type === 'ad').sort((a, b) => a.id.localeCompare(b.id));
    const productSpecs = nodes.filter(n => n.type === 'productSpec');
    const instructions = nodes.filter(n => n.type === 'instructions').sort((a, b) => a.id.localeCompare(b.id));
    
    // Calculate ads column center first
    let adsCenterY = 0;
    if (ads.length > 0) {
      // Calculate the vertical center of the ads column
      const adSpacing = 120;
      const totalAdHeight = (ads.length - 1) * adSpacing;
      adsCenterY = 0; // Keep ads centered around 0
    }
    
    // Position script generator CENTER at the same Y as ads center
    // Use actual script generator dimensions
    const scriptGenHeight = 320; // Actual height from getNodeDimensions
    const scriptGenY = adsCenterY - (scriptGenHeight / 2);
    
    // Layout constants
    const CENTER_X = 0;
    const CENTER_Y = scriptGenY;
    
    // Calculate actual script generator center position for alignment
    const scriptGenWidth = 384; // Actual width from getNodeDimensions  
    const scriptGenCenterX = CENTER_X + (scriptGenWidth / 2) - 100; // Real center of script generator, shifted left
    
    // Predefined positions for ads (left side) based on count - centered around ads center
    const AD_POSITIONS = {
      1: [{ x: -300, y: adsCenterY }],
      2: [{ x: -300, y: adsCenterY - 60 }, { x: -300, y: adsCenterY + 60 }],
      3: [{ x: -300, y: adsCenterY - 120 }, { x: -300, y: adsCenterY }, { x: -300, y: adsCenterY + 120 }],
      4: [{ x: -300, y: adsCenterY - 180 }, { x: -300, y: adsCenterY - 60 }, { x: -300, y: adsCenterY + 60 }, { x: -300, y: adsCenterY + 180 }],
      5: [{ x: -300, y: adsCenterY - 240 }, { x: -300, y: adsCenterY - 120 }, { x: -300, y: adsCenterY }, { x: -300, y: adsCenterY + 120 }, { x: -300, y: adsCenterY + 240 }],
      6: [{ x: -300, y: adsCenterY - 300 }, { x: -300, y: adsCenterY - 180 }, { x: -300, y: adsCenterY - 60 }, { x: -300, y: adsCenterY + 60 }, { x: -300, y: adsCenterY + 180 }, { x: -300, y: adsCenterY + 300 }]
    };
    
    // Predefined positions for instructions (bottom) - arranged in 2 rows, max 2 per row, proper spacing
    // Script generator is 320px tall, so place instructions well below its bottom
    // Instructions horizontally centered with script generator's actual center (192px from its left edge)
    const INSTRUCTION_POSITIONS = {
      1: [{ x: scriptGenCenterX, y: CENTER_Y + scriptGenHeight + 50 }],
      2: [{ x: scriptGenCenterX - 120, y: CENTER_Y + scriptGenHeight + 50 }, { x: scriptGenCenterX + 120, y: CENTER_Y + scriptGenHeight + 50 }],
      3: [{ x: scriptGenCenterX - 120, y: CENTER_Y + scriptGenHeight + 50 }, { x: scriptGenCenterX + 120, y: CENTER_Y + scriptGenHeight + 50 }, { x: scriptGenCenterX, y: CENTER_Y + scriptGenHeight + 180 }],
      4: [{ x: scriptGenCenterX - 120, y: CENTER_Y + scriptGenHeight + 50 }, { x: scriptGenCenterX + 120, y: CENTER_Y + scriptGenHeight + 50 }, { x: scriptGenCenterX - 120, y: CENTER_Y + scriptGenHeight + 180 }, { x: scriptGenCenterX + 120, y: CENTER_Y + scriptGenHeight + 180 }]
    };
    
    // Predefined positions for product specs (closer to top of script generator)
    // Product specs horizontally centered with script generator's actual center (192px from its left edge)
    const PRODUCT_SPEC_POSITIONS = {
      1: [{ x: scriptGenCenterX, y: CENTER_Y - 180 }],
      2: [{ x: scriptGenCenterX - 120, y: CENTER_Y - 180 }, { x: scriptGenCenterX + 120, y: CENTER_Y - 180 }],
      3: [{ x: scriptGenCenterX - 240, y: CENTER_Y - 180 }, { x: scriptGenCenterX, y: CENTER_Y - 180 }, { x: scriptGenCenterX + 240, y: CENTER_Y - 180 }]
    };
    
    // Create updated nodes array
    const updatedNodes = nodes.map(node => {
      if (node.type === 'script') {
        // Position script generator at center
        return { ...node, position: { x: CENTER_X, y: CENTER_Y } };
      } else if (node.type === 'ad') {
        // Use predefined positions based on total ad count
        const index = ads.findIndex(ad => ad.id === node.id);
        const positions = AD_POSITIONS[ads.length] || AD_POSITIONS[6];
        return {
          ...node,
          position: positions[index] || { x: -300, y: 0 }
        };
      } else if (node.type === 'productSpec') {
        // Use predefined positions for product specs
        const index = productSpecs.findIndex(spec => spec.id === node.id);
        const positions = PRODUCT_SPEC_POSITIONS[productSpecs.length] || PRODUCT_SPEC_POSITIONS[1];
        return {
          ...node,
          position: positions[index] || { x: 0, y: -250 }
        };
      } else if (node.type === 'instructions') {
        // Use predefined positions based on total instruction count
        const index = instructions.findIndex(inst => inst.id === node.id);
        const positions = INSTRUCTION_POSITIONS[instructions.length] || INSTRUCTION_POSITIONS[4];
        return {
          ...node,
          position: positions[index] || { x: 0, y: 250 }
        };
      }
      return node;
    });
    
    // Update nodes
    setNodes(updatedNodes);
    
    // Calculate bounds of all nodes to center viewport properly
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    updatedNodes.forEach(node => {
      const bounds = getNodeBounds(node);
      minX = Math.min(minX, bounds.left);
      maxX = Math.max(maxX, bounds.right);
      minY = Math.min(minY, bounds.top);
      maxY = Math.max(maxY, bounds.bottom);
    });
    
    // Calculate center of all nodes
    const nodesCenter = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
    
    // Reset viewport to center on reorganized nodes
    const viewportWidth = workspaceRef.current?.clientWidth || 1200;
    const viewportHeight = workspaceRef.current?.clientHeight || 800;
    
    // Pan offset to center the nodes in viewport
    setPanOffset({ 
      x: (viewportWidth / 2) - nodesCenter.x,
      y: (viewportHeight / 2) - nodesCenter.y
    });
    setZoomLevel(100);
    
    // Save viewport state
    if (onViewportStateChange) {
      onViewportStateChange({
        panOffset: { 
          x: (viewportWidth / 2) - nodesCenter.x,
          y: (viewportHeight / 2) - nodesCenter.y
        },
        zoomLevel: 100
      });
    }
  };

  // Context menu handlers
  const handleContextMenu = useCallback((e, nodeId) => {
    e.preventDefault();
    
    // Get workspace container bounds
    const workspaceRect = workspaceRef.current?.getBoundingClientRect();
    if (!workspaceRect) return;
    
    // Convert screen coordinates to workspace coordinates for node placement
    // The nodes are in a transformed container, so we need to reverse the transformation
    const scale = zoomLevel / 100;
    const relativeX = e.clientX - workspaceRect.left;
    const relativeY = e.clientY - workspaceRect.top;
    
    // Reverse the container transform: translate then scale
    const workspaceX = (relativeX - panOffset.x) / scale;
    const workspaceY = (relativeY - panOffset.y) / scale;
    
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodeId,
      workspaceX,
      workspaceY
    });
  }, [zoomLevel, panOffset]);

  const hideContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  // Find a valid position for new nodes with collision detection
  const findValidSpawnPosition = useCallback((targetX, targetY, nodeType) => {
    const nodeWidth = 192; // Default collapsed width
    const nodeHeight = 80; // Default collapsed height
    
    // Simple dimension calculation for collision detection
    const getSimpleNodeDimensions = (node) => {
      if (node.type === 'script') {
        return { width: 384, height: 320 };
      }
      const width = node.expanded ? 320 : 192;
      const height = node.expanded ? 200 : 80; // Simplified height
      return { width, height };
    };
    
    // Check if position is clear
    const isPositionClear = (x, y) => {
      const newBounds = {
        left: x,
        top: y,
        right: x + nodeWidth,
        bottom: y + nodeHeight
      };
      
      const hasCollision = nodes.some(node => {
        const existingDims = getSimpleNodeDimensions(node);
        const existingBounds = {
          left: node.position.x,
          top: node.position.y,
          right: node.position.x + existingDims.width,
          bottom: node.position.y + existingDims.height
        };
        
        // Check overlap with small buffer
        const buffer = 20;
        const overlaps = !(
          newBounds.right + buffer <= existingBounds.left || 
          existingBounds.right + buffer <= newBounds.left || 
          newBounds.bottom + buffer <= existingBounds.top || 
          existingBounds.bottom + buffer <= newBounds.top
        );
        
        return overlaps;
      });
      
      return !hasCollision;
    };
    
    // Try the target position first
    if (isPositionClear(targetX, targetY)) {
      return { x: targetX, y: targetY };
    }
    
    // Search in expanding circles for a clear spot
    const step = 50;
    for (let radius = step; radius <= 300; radius += step) {
      const positions = [
        { x: targetX + radius, y: targetY }, // Right
        { x: targetX - radius, y: targetY }, // Left
        { x: targetX, y: targetY + radius }, // Below
        { x: targetX, y: targetY - radius }, // Above
        { x: targetX + radius, y: targetY + radius }, // Bottom-right
        { x: targetX - radius, y: targetY + radius }, // Bottom-left
        { x: targetX + radius, y: targetY - radius }, // Top-right
        { x: targetX - radius, y: targetY - radius }, // Top-left
      ];
      
      for (const pos of positions) {
        if (isPositionClear(pos.x, pos.y)) {
          return pos;
        }
      }
    }
    
    // Fallback to target position if no clear spot found
    return { x: targetX, y: targetY };
  }, [nodes]);

  const addAdNode = useCallback(() => {
    const existingAds = nodes.filter(n => n.type === 'ad').length;
    
    // Check limit
    if (existingAds >= 6) {
      alert('Maximum of 6 advertisement nodes allowed');
      hideContextMenu();
      return;
    }
    
    // Always use local positioning logic for cursor-based spawning
    if (onAddNode) {
      // Find valid position at cursor location with collision detection
      const spawnPosition = findValidSpawnPosition(contextMenu.workspaceX, contextMenu.workspaceY, 'ad');
      
      // Use the parent's addNode function which handles connections automatically
      onAddNode('ad', {
        position: spawnPosition,
        title: `Ad ${existingAds + 1}`,
        url: '',
        status: 'draft'
      });
    } else {
      console.warn('No onAddNode callback provided')
    }
    hideContextMenu();
  }, [onAddNode, nodes, hideContextMenu, saveToHistory, findValidSpawnPosition, contextMenu.workspaceX, contextMenu.workspaceY]);

  const addInstructionsNode = useCallback(() => {
    const existingInstructions = nodes.filter(n => n.type === 'instructions').length;
    
    // Check limit
    if (existingInstructions >= 4) {
      alert('Maximum of 4 instruction nodes allowed');
      hideContextMenu();
      return;
    }
    
    if (onAddNode) {
      // Find valid position at cursor location with collision detection
      const spawnPosition = findValidSpawnPosition(contextMenu.workspaceX, contextMenu.workspaceY, 'instructions');
      
      // Use the parent's addNode function which handles connections automatically
      onAddNode('instructions', {
        position: spawnPosition,
        content: ''
      });
    } else {
      console.warn('No onAddNode callback provided')
    }
    hideContextMenu();
  }, [onAddNode, nodes, hideContextMenu, saveToHistory, findValidSpawnPosition, contextMenu.workspaceX, contextMenu.workspaceY]);

  const addProductSpecNode = useCallback(() => {
    if (onAddNode) {
      // Find valid position at cursor location with collision detection
      const spawnPosition = findValidSpawnPosition(contextMenu.workspaceX, contextMenu.workspaceY, 'productSpec');
      
      // Use the parent's addNode function which handles connections automatically
      onAddNode('productSpec', {
        position: spawnPosition,
        documents: []
      });
    } else {
      console.warn('No onAddNode callback provided')
    }
    hideContextMenu();
  }, [onAddNode, hideContextMenu, saveToHistory, nodes, findValidSpawnPosition, contextMenu.workspaceX, contextMenu.workspaceY]);

  const deleteNode = useCallback((nodeId) => {
    if (nodeId === 'script-generator') {
      hideContextMenu();
      return;
    }
    
    saveToHistory();
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
  }, [hideContextMenu, saveToHistory]);

  // Drag system
  const startDrag = useCallback((e, nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggedNodeId(nodeId);
    
    // Calculate the current screen position of the node considering zoom and pan
    const scale = zoomLevel / 100;
    const nodeScreenX = (node.position.x * scale) + panOffset.x;
    const nodeScreenY = (node.position.y * scale) + panOffset.y;
    
    // Store the offset between mouse and node's screen position
    dragRef.current = {
      isDragging: true,
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - nodeScreenX,
      offsetY: e.clientY - nodeScreenY
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragRef.current.isDragging) return;
      
      // Calculate where the node should be in screen space
      const nodeScreenX = moveEvent.clientX - dragRef.current.offsetX;
      const nodeScreenY = moveEvent.clientY - dragRef.current.offsetY;
      
      // Convert screen position back to workspace coordinates
      const workspaceX = (nodeScreenX - panOffset.x) / scale;
      const workspaceY = (nodeScreenY - panOffset.y) / scale;

      const updatedNodes = nodes.map(node => 
        node.id === dragRef.current.nodeId
          ? { ...node, position: { x: workspaceX, y: workspaceY } }
          : node
      );
      setNodes(updatedNodes);
    };

    const handleMouseUp = () => {
      if (!dragRef.current.isDragging) return;
      
      // Apply collision detection
      setNodes(currentNodes => {
        const draggedNode = currentNodes.find(n => n.id === dragRef.current.nodeId);
        if (!draggedNode) return currentNodes;

        const validPosition = findValidDropPosition(draggedNode, currentNodes, viewportSize);
        
        const updatedNodes = currentNodes.map(node => 
          node.id === dragRef.current.nodeId
            ? { ...node, position: validPosition }
            : node
        );
        
        return updatedNodes;
      });

      // Cleanup
      dragRef.current.isDragging = false;
      setDraggedNodeId(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Trigger workspace bounds recalculation after drag completes
      setTimeout(() => {
        if (onWorkspaceBoundsChange) {
          const finalNodes = nodes; // Use current nodes state
          const bounds = {
            minX: Math.min(...finalNodes.map(n => n.position.x)),
            maxX: Math.max(...finalNodes.map(n => n.position.x + 300)),
            minY: Math.min(...finalNodes.map(n => n.position.y)),
            maxY: Math.max(...finalNodes.map(n => n.position.y + 200))
          };
          onWorkspaceBoundsChange(bounds);
        }
      }, 10);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
  }, [nodes, panOffset, zoomLevel, onWorkspaceBoundsChange]);

  const getNodeDimensions = (node) => {
    // More accurate dimension calculations
    if (node.type === 'script') {
      return { width: 384, height: 320 }; // w-96, fixed height
    }
    
    const width = node.expanded ? 320 : 192; // w-80 : w-48
    let height;
    
    if (node.type === 'productSpec') {
      if (node.expanded) {
        const docsCount = node.data?.documents?.length || 0;
        height = 80 + 16 + Math.min(docsCount * 60 + 48, 192) + 16 + 44 + 16;
      } else {
        height = 80;
      }
    } else if (node.type === 'instructions') {
      height = node.expanded ? 80 + 16 + 144 + 16 : 80;
    } else if (node.type === 'ad') {
      height = node.expanded ? 80 + 16 + 44 + 16 : 80;
    } else {
      height = 120; // default
    }
    
    return { width, height };
  };

  const findValidDropPosition = (draggedNode, otherNodes, viewport) => {
    const draggedDims = getNodeDimensions(draggedNode);
    let validX = draggedNode.position.x;
    let validY = draggedNode.position.y;
    
    // Keep trying to find a valid position until no overlaps exist
    let maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      let hasOverlap = false;
      
      // Check against ALL other nodes
      for (const otherNode of otherNodes) {
        if (otherNode.id === draggedNode.id) continue;
        
        const otherDims = getNodeDimensions(otherNode);
        
        const draggedBounds = {
          left: validX,
          top: validY,
          right: validX + draggedDims.width,
          bottom: validY + draggedDims.height
        };

        const otherBounds = {
          left: otherNode.position.x,
          top: otherNode.position.y,
          right: otherNode.position.x + otherDims.width,
          bottom: otherNode.position.y + otherDims.height
        };

        // Check if they overlap (with small buffer for visual separation)
        const buffer = 5;
        const overlaps = !(
          draggedBounds.right + buffer <= otherBounds.left || 
          otherBounds.right + buffer <= draggedBounds.left || 
          draggedBounds.bottom + buffer <= otherBounds.top || 
          otherBounds.bottom + buffer <= draggedBounds.top
        );

        if (overlaps) {
          hasOverlap = true;
          
          // Calculate all possible positions to avoid this node
          const gap = 20;
          const options = [
            { x: otherBounds.right + gap, y: validY }, // Right
            { x: otherBounds.left - draggedDims.width - gap, y: validY }, // Left
            { x: validX, y: otherBounds.bottom + gap }, // Below
            { x: validX, y: otherBounds.top - draggedDims.height - gap } // Above
          ];

          // Choose the closest valid option
          let bestOption = null;
          let bestDistance = Infinity;

          for (const option of options) {
            // Allow negative coordinates within canvas bounds
            const MAX_HORIZONTAL = 3000;
            const MAX_VERTICAL = 2000;
            if (option.x >= -MAX_HORIZONTAL && option.x <= MAX_HORIZONTAL && 
                option.y >= -MAX_VERTICAL && option.y <= MAX_VERTICAL) {
              const distance = Math.sqrt(
                Math.pow(option.x - draggedNode.position.x, 2) + 
                Math.pow(option.y - draggedNode.position.y, 2)
              );
              if (distance < bestDistance) {
                bestDistance = distance;
                bestOption = option;
              }
            }
          }

          if (bestOption) {
            validX = bestOption.x;
            validY = bestOption.y;
            break; // Restart checking from the beginning with new position
          }
        }
      }
      
      // If no overlaps found, we have a valid position
      if (!hasOverlap) {
        break;
      }
      
      attempts++;
    }

    // Allow dragging anywhere within the current canvas bounds
    // Don't constrain to viewport - let nodes be placed at canvas edges
    const MAX_HORIZONTAL = 3000;
    const MAX_VERTICAL = 2000;
    
    const constrainedX = Math.max(-MAX_HORIZONTAL, Math.min(validX, MAX_HORIZONTAL - 200));
    const constrainedY = Math.max(-MAX_VERTICAL, Math.min(validY, MAX_VERTICAL - 100));
    
    return { x: constrainedX, y: constrainedY };
  };

  // Get current drag state for rendering
  const isDragging = !!draggedNodeId;

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
    setNodes(prevNodes => {
      try {
        const updatedNodes = prevNodes.map(node =>
          node.id === nodeId ? { ...node, expanded: !node.expanded } : node
        );
        
        const expandedNode = updatedNodes.find(n => n.id === nodeId);
        if (expandedNode && expandedNode.expanded) {
          // Push overlapping nodes when expanding
          try {
            return pushOverlappingNodesImmediate(expandedNode, updatedNodes);
          } catch (e) {
            console.error('Error in pushOverlappingNodesImmediate:', e);
            return updatedNodes; // Return without pushing if error occurs
          }
        }
        
        return updatedNodes;
      } catch (e) {
        console.error('Error in toggleNodeExpansion:', e);
        return prevNodes; // Return unchanged nodes if error occurs
      }
    });
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
                  ...(node.data?.messages || []),
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
                    ...(node.data?.messages || []),
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

  // Get workspace background classes
  const getWorkspaceClasses = () => {
    if (isExperimental) {
      return 'min-h-screen bg-gradient-to-br from-black via-gray-900 to-yellow-900/20';
    } else if (isDarkMode) {
      return 'min-h-screen bg-gradient-to-br from-black via-gray-900 to-black';
    } else {
      return 'min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-50';
    }
  };

  // Get header classes
  const getHeaderClasses = () => {
    if (isExperimental) {
      return 'backdrop-blur-md border-b px-6 py-4 bg-black/90 border-yellow-400/30';
    } else if (isDarkMode) {
      return 'backdrop-blur-md border-b px-6 py-4 bg-gray-900/90 border-purple-500/30';
    } else {
      return 'backdrop-blur-md border-b px-6 py-4 bg-white/95 border-gray-300';
    }
  };

  // Get node base classes
  const getNodeBaseClasses = (node) => {
    const isSelected = selectedNodes.has(node.id);
    const isNodeDragging = draggedNodeId === node.id;
    
    let baseClasses = 'absolute backdrop-blur-sm rounded-2xl transition-all duration-200 cursor-move ';
    
    // Permanent glow that gets brighter when dragging
    if (isNodeDragging) {
      baseClasses += 'shadow-2xl scale-[1.02] z-50 ';
    } else {
      baseClasses += 'shadow-lg ';
    }
    
    if (node.type === 'ad') {
      if (isExperimental) {
        baseClasses += 'bg-black border border-green-400/60 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-green-400/40 ';
        } else {
          baseClasses += 'shadow-green-400/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-green-400/50 ';
        } else {
          baseClasses += 'hover:shadow-green-400/30 hover:border-green-300/70 ';
        }
      } else if (isDarkMode) {
        baseClasses += 'bg-gray-900/95 border border-white/40 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-emerald-500/40 ';
        } else {
          baseClasses += 'shadow-emerald-500/25 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-white/60 ';
        } else {
          baseClasses += 'hover:shadow-emerald-500/35 hover:border-white/60 ';
        }
      } else {
        baseClasses += 'bg-white border border-emerald-200/80 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-emerald-500/30 ';
        } else {
          baseClasses += 'shadow-emerald-500/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-emerald-400/50 ';
        } else {
          baseClasses += 'hover:shadow-emerald-500/25 hover:border-emerald-300/90 ';
        }
      }
    } else if (node.type === 'productSpec') {
      if (isExperimental) {
        baseClasses += 'bg-black border border-cyan-400/60 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-cyan-400/40 ';
        } else {
          baseClasses += 'shadow-cyan-400/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-cyan-400/50 ';
        }
      } else if (isDarkMode) {
        baseClasses += 'bg-gray-900/95 border border-white/40 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-blue-500/40 ';
        } else {
          baseClasses += 'shadow-blue-500/25 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-white/60 ';
        }
      } else {
        baseClasses += 'bg-white border border-blue-200/80 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-blue-500/30 ';
        } else {
          baseClasses += 'shadow-blue-500/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-blue-400/50 ';
        }
      }
    } else if (node.type === 'instructions') {
      if (isExperimental) {
        baseClasses += 'bg-black border border-orange-400/60 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-orange-400/40 ';
        } else {
          baseClasses += 'shadow-orange-400/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-orange-400/50 ';
        }
      } else if (isDarkMode) {
        baseClasses += 'bg-gray-900/95 border border-white/40 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-orange-500/40 ';
        } else {
          baseClasses += 'shadow-orange-500/25 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-white/60 ';
        }
      } else {
        baseClasses += 'bg-white border border-orange-200/80 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-orange-500/30 ';
        } else {
          baseClasses += 'shadow-orange-500/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-orange-400/50 ';
        }
      }
    } else if (node.type === 'script') {
      if (isExperimental) {
        baseClasses += 'bg-black border border-pink-400/60 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-pink-400/40 ';
        } else {
          baseClasses += 'shadow-pink-400/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-pink-400/50 ';
        }
      } else if (isDarkMode) {
        baseClasses += 'bg-gray-900/95 border border-white/40 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-purple-500/40 ';
        } else {
          baseClasses += 'shadow-purple-500/25 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-white/60 ';
        }
      } else {
        baseClasses += 'bg-white border border-purple-200/80 ';
        if (isNodeDragging) {
          baseClasses += 'shadow-purple-500/30 ';
        } else {
          baseClasses += 'shadow-purple-500/20 ';
        }
        if (isSelected) {
          baseClasses += 'ring-2 ring-purple-400/50 ';
        }
      }
    }
    
    return baseClasses;
  };

  const renderNode = (node) => {
    const isSelected = selectedNodes.has(node.id);
    const baseClasses = getNodeBaseClasses(node);

    switch (node.type) {
      case 'ad':
        return (
          <div
            key={node.id}
            className={baseClasses + (node.expanded ? 'w-80' : 'w-48')}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => startDrag(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              isExperimental ? 'border-green-400/30' : 
              isDarkMode ? 'border-white/20' : 
              'border-gray-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  node.data?.status === 'completed' ? 'bg-emerald-500' :
                  node.data?.status === 'processing' ? 'bg-amber-500' :
                  node.data?.status === 'error' ? 'bg-red-500' : 
                  'bg-emerald-400'
                }`}></div>
                <span className={`font-medium text-sm ${
                  isExperimental ? 'text-gray-100' :
                  isDarkMode ? 'text-gray-100' :
                  'text-gray-900'
                }`}>{node.data?.title || 'Untitled'}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpansion(node.id);
                }}
                className={`transition-colors p-1 rounded-lg ${
                  isExperimental ? 'text-green-400 hover:text-green-300 hover:bg-green-400/10' :
                  isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700/50' :
                  'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {node.expanded && (
              <div className="p-4">
                <input
                  type="url"
                  placeholder="Paste ad URL..."
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm transition-all ${
                    isExperimental ? 'bg-gray-900/80 border-green-400/40 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-green-400/50 focus:border-green-300/70' :
                    isDarkMode ? 'bg-gray-800/80 border-white/30 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-white/50 focus:border-white/60' :
                    'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-500'
                  } shadow-inner`}
                  value={node.data?.url || ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateNodeData(node.id, { url: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        );

      case 'productSpec':
        return (
          <div
            key={node.id}
            className={baseClasses + (node.expanded ? 'w-80' : 'w-48')}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => startDrag(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              isExperimental ? 'border-cyan-400/30' :
              isDarkMode ? 'border-white/20' :
              'border-gray-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isExperimental ? 'bg-cyan-400/20' :
                  isDarkMode ? 'bg-blue-500/20' :
                  'bg-blue-100'
                }`}>
                  <FileText size={14} className={
                    isExperimental ? 'text-cyan-400' :
                    isDarkMode ? 'text-blue-400' :
                    'text-blue-600'
                  } />
                </div>
                <span className={`font-medium text-sm ${
                  isExperimental ? 'text-gray-100' :
                  isDarkMode ? 'text-gray-100' :
                  'text-gray-900'
                }`}>Product Spec</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-1 rounded-lg ${
                  isExperimental ? 'text-cyan-400 bg-cyan-400/20 border border-cyan-400/30' :
                  isDarkMode ? 'text-blue-400 bg-blue-500/20 border border-white/20' :
                  'text-gray-700 bg-gray-100 border border-gray-300'
                }`}>
                  {node.data?.documents?.length || 0}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeExpansion(node.id);
                  }}
                  className={`transition-colors p-1 rounded-lg ${
                    isExperimental ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10' :
                    isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700/50' :
                    'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
            </div>
            
            {node.expanded && (
              <div className="p-4">
                <div className="space-y-3">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(node.data.documents || []).map((doc) => (
                      <div
                        key={doc.id}
                        className={`flex items-center justify-between p-2 border rounded-lg transition-colors group ${
                          isExperimental ? 'bg-gray-900/80 border-cyan-400/30 hover:bg-gray-800/80' :
                          isDarkMode ? 'bg-gray-800/60 border-white/20 hover:bg-gray-700/60' :
                          'bg-gray-50 border-blue-200/40 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {doc.type === 'pdf' && <FileImage size={14} className="text-red-500" />}
                          {doc.type === 'word' && <FileText size={14} className="text-blue-500" />}
                          {doc.type === 'txt' && <File size={14} className="text-slate-500" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${
                              isExperimental ? 'text-gray-100' :
                              isDarkMode ? 'text-gray-100' :
                              'text-gray-900'
                            }`}>
                              {doc.name}
                            </p>
                            <p className={`text-xs ${
                              isExperimental ? 'text-gray-300' :
                              isDarkMode ? 'text-gray-300' :
                              'text-gray-600'
                            }`}>
                              {doc.size} • {doc.uploadedAt}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(!node.data?.documents || node.data.documents.length === 0) && (
                      <div className={`text-center py-6 ${
                        isExperimental ? 'text-gray-300' :
                        isDarkMode ? 'text-gray-300' :
                        'text-gray-600'
                      }`}>
                        <Upload size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No documents added</p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className={`w-full border text-sm py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all font-medium ${
                      isExperimental ? 'bg-cyan-400/20 hover:bg-cyan-400/30 border-cyan-400/30 text-cyan-400' :
                      isDarkMode ? 'bg-blue-500/20 hover:bg-blue-500/30 border-white/20 text-blue-400' :
                      'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600'
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
            className={baseClasses + (node.expanded ? 'w-80' : 'w-48')}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => startDrag(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              isExperimental ? 'border-orange-400/30' : 
              isDarkMode ? 'border-white/20' : 
              'border-gray-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isExperimental ? 'bg-orange-400/20' :
                  isDarkMode ? 'bg-orange-500/20' :
                  'bg-orange-100'
                }`}>
                  <FileText size={14} className={
                    isExperimental ? 'text-orange-400' :
                    isDarkMode ? 'text-orange-400' :
                    'text-orange-600'
                  } />
                </div>
                <span className={`font-medium text-sm ${
                  isExperimental ? 'text-gray-100' :
                  isDarkMode ? 'text-gray-100' :
                  'text-gray-900'
                }`}>Instructions</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpansion(node.id);
                }}
                className={`transition-colors p-1 rounded-lg ${
                  isExperimental ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-400/10' :
                  isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700/50' :
                  'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>

            {node.expanded && (
              <div className="p-4">
                <textarea
                  placeholder="Add your instructions here..."
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm transition-all resize-none ${
                    isExperimental ? 'bg-gray-900/80 border-orange-400/40 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-300/70' :
                    isDarkMode ? 'bg-gray-800/80 border-white/30 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-white/50 focus:border-white/60' :
                    'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-500'
                  } shadow-inner`}
                  rows={6}
                  value={node.data?.content || ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateNodeData(node.id, { content: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        );

      case 'script':
        return (
          <div
            key={node.id}
            className={baseClasses + 'w-96'}
            style={{ left: node.position.x, top: node.position.y }}
            onMouseDown={(e) => startDrag(e, node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              isExperimental ? 'border-pink-400/30' :
              isDarkMode ? 'border-white/20' :
              'border-gray-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  isExperimental ? 'bg-gradient-to-br from-yellow-400/20 to-amber-500/20' :
                  isDarkMode ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20' :
                  'bg-gradient-to-br from-blue-500/10 to-indigo-500/10'
                }`}>
                  <MessageSquare size={14} className={
                    isExperimental ? 'text-pink-400' :
                    isDarkMode ? 'text-purple-400' :
                    'text-purple-600'
                  } />
                </div>
                <span className={`font-medium text-sm ${
                  isExperimental ? 'text-gray-100' :
                  isDarkMode ? 'text-gray-100' :
                  'text-gray-900'
                }`}>Script Generator</span>
              </div>
              <div className="flex items-center space-x-2">
                {selectedNodes.size > 0 && (
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                    isExperimental ? 'text-pink-400 bg-pink-400/20 border border-pink-400/30' :
                    isDarkMode ? 'text-purple-400 bg-purple-500/20 border border-white/20' :
                    'text-gray-700 bg-gray-100 border border-gray-300'
                  }`}>
                    {selectedNodes.size} selected
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4">
              <div className="space-y-3">
                <div className={`h-40 overflow-y-auto space-y-2 border rounded-xl p-3 ${
                  isExperimental ? 'bg-gray-900/40 border-yellow-400/30' :
                  isDarkMode ? 'bg-gray-800/40 border-purple-500/20' :
                  'bg-slate-50/40 border-slate-200/40'
                }`}>
                  {(node.data?.messages || []).map((msg, idx) => (
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
                    className={`flex-1 px-3 py-2.5 border rounded-xl text-sm transition-all ${
                      isExperimental ? 'bg-gray-900/80 border-pink-400/40 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-pink-400/50 focus:border-pink-300/70' :
                      isDarkMode ? 'bg-gray-800/80 border-white/30 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-white/50 focus:border-white/60' :
                      'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-500'
                    } shadow-inner`}
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
                      isExperimental ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600' :
                      isDarkMode ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600' :
                      'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
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

  return (
    <div className={getWorkspaceClasses()}>
      {!hideHeader && (
        <div className={getHeaderClasses()}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
            </div>
            
            {!externalColorScheme && (
              <button
                onClick={cycleColorScheme}
                className={`p-2 rounded-xl transition-all duration-200 flex items-center space-x-2 ${
                  isExperimental ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300' :
                  isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300' :
                  'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                }`}
                title={`Current: ${colorScheme} - Click to cycle`}
              >
                {colorScheme === 'light' && <Sun size={16} />}
                {colorScheme === 'dark' && <Moon size={16} />}
                {colorScheme === 'experimental' && <Zap size={16} />}
                <span className="text-xs font-medium capitalize">{colorScheme}</span>
              </button>
            )}
            
            {selectedNodes.size > 0 && (
              <div className={`flex items-center space-x-2 text-sm ${
                isExperimental ? 'text-yellow-400' :
                isDarkMode ? 'text-purple-400' : 
                'text-gray-700'
              }`}>
                <span className="font-medium">{selectedNodes.size} nodes selected</span>
                <button
                  onClick={() => setSelectedNodes(new Set())}
                  className={`transition-colors ${
                    isExperimental ? 'text-yellow-300 hover:text-yellow-200' :
                    isDarkMode ? 'text-purple-300 hover:text-purple-200' : 
                    'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className={`text-sm ${
              isExperimental ? 'text-yellow-200/80' :
              isDarkMode ? 'text-purple-300/80' : 
              'text-gray-600'
            }`}>
              Right-click to add nodes • Drag to move • Click to select
            </div>
          </div>
        </div>
      )}

      <div 
        ref={workspaceRef}
        className={`relative w-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${hideHeader ? 'h-full' : 'h-[calc(100vh-73px)]'}`}
        style={{ 
          backgroundImage: isExperimental ? `
            radial-gradient(circle at 25px 25px, rgba(234, 179, 8, 0.25) 1px, transparent 0),
            radial-gradient(circle at 75px 75px, rgba(234, 179, 8, 0.25) 1px, transparent 0)
          ` : isDarkMode ? `
            radial-gradient(circle at 25px 25px, rgba(168, 85, 247, 0.18) 1px, transparent 0),
            radial-gradient(circle at 75px 75px, rgba(168, 85, 247, 0.18) 1px, transparent 0)
          ` : `
            radial-gradient(circle at 25px 25px, rgba(75, 85, 99, 0.15) 1px, transparent 0),
            radial-gradient(circle at 75px 75px, rgba(75, 85, 99, 0.15) 1px, transparent 0)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: `${panOffset.x}px ${panOffset.y}px, ${panOffset.x + 25}px ${panOffset.y + 25}px`,
          minHeight: `${(canvasBounds.maxY - canvasBounds.minY) * (zoomLevel / 100)}px`,
          minWidth: `${(canvasBounds.maxX - canvasBounds.minX) * (zoomLevel / 100)}px`
        }}
        onMouseDown={handleWorkspaceMouseDown}
        onContextMenu={(e) => !contextMenu.visible && handleContextMenu(e)}
        onClick={hideContextMenu}
      >
        {/* Floating Undo/Redo buttons - Top Left */}
        <div className="absolute top-4 left-4 flex items-center space-x-2 z-50">
          <button
            onClick={undo}
            disabled={history.length === 0}
            className={`p-2 rounded-xl transition-all duration-200 flex items-center space-x-2 backdrop-blur-sm ${
              history.length === 0 
                ? isExperimental ? 'opacity-50 cursor-not-allowed bg-gray-800/50 text-gray-500 border border-gray-700/30' :
                  isDarkMode ? 'opacity-50 cursor-not-allowed bg-gray-800/50 text-gray-500 border border-gray-700/30' :
                  'opacity-50 cursor-not-allowed bg-gray-100/90 text-gray-400 border border-gray-200/30'
                : isExperimental ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300 border border-yellow-400/30' :
                  isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 border border-purple-500/30' :
                  'bg-white/90 text-gray-700 hover:bg-gray-100/90 hover:text-gray-900 border border-gray-200/50'
            }`}
            title={`Undo (${history.length} actions available)`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
            <span className="text-xs font-medium">Undo</span>
          </button>
          
          <button
            onClick={redo}
            disabled={redoHistory.length === 0}
            className={`p-2 rounded-xl transition-all duration-200 flex items-center space-x-2 backdrop-blur-sm ${
              redoHistory.length === 0 
                ? isExperimental ? 'opacity-50 cursor-not-allowed bg-gray-800/50 text-gray-500 border border-gray-700/30' :
                  isDarkMode ? 'opacity-50 cursor-not-allowed bg-gray-800/50 text-gray-500 border border-gray-700/30' :
                  'opacity-50 cursor-not-allowed bg-gray-100/90 text-gray-400 border border-gray-200/30'
                : isExperimental ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300 border border-yellow-400/30' :
                  isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 border border-purple-500/30' :
                  'bg-white/90 text-gray-700 hover:bg-gray-100/90 hover:text-gray-900 border border-gray-200/50'
            }`}
            title={`Redo (${redoHistory.length} actions available)`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v-6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 7" />
            </svg>
            <span className="text-xs font-medium">Redo</span>
          </button>
          
          {selectedNodes.size > 0 && (
            <button
              onClick={clearSelection}
              className={`p-2 rounded-xl transition-all duration-200 flex items-center space-x-2 backdrop-blur-sm ${
                isExperimental ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300 border border-yellow-400/30' :
                isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 border border-purple-500/30' :
                'bg-white/90 text-gray-700 hover:bg-gray-100/90 hover:text-gray-900 border border-gray-200/50'
              }`}
              title={`Clear selection (${selectedNodes.size} nodes)`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              <span className="text-xs font-medium">Clear</span>
            </button>
          )}
          
          <button
            onClick={onReorganizeNodes || reorganizeNodes}
            className={`p-2 rounded-xl transition-all duration-200 flex items-center space-x-2 backdrop-blur-sm ${
              isExperimental ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300 border border-yellow-400/30' :
              isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 border border-purple-500/30' :
              'bg-white/90 text-gray-700 hover:bg-gray-100/90 hover:text-gray-900 border border-gray-200/50'
            }`}
            title="Reorganize nodes to default layout"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            <span className="text-xs font-medium">Reorganize</span>
          </button>
        </div>

        {/* SVG for spline connections */}
        <svg 
          className="absolute pointer-events-none"
          style={{ 
            zIndex: 1,
            left: 0,
            top: 0,
            width: '100%',
            height: '100%'
          }}
        >
          {connections.map((connection) => {
            try {
              const fromNode = nodes.find(n => n.id === connection.fromNodeId);
              const toNode = nodes.find(n => n.id === connection.toNodeId);
              
              if (!fromNode || !toNode) return null;
              
              // Hide splines connected to the node being dragged
              const isConnectedToDraggedNode = isDragging && 
                (connection.fromNodeId === draggedNodeId || connection.toNodeId === draggedNodeId);
              
              const anchors = findClosestAnchors(fromNode, toNode);
              if (!anchors || !anchors.from || !anchors.to) return null;
              
              // Apply zoom and pan transformation to anchor points
              const scale = zoomLevel / 100;
              const transformedFrom = {
                x: (anchors.from.x * scale) + panOffset.x,
                y: (anchors.from.y * scale) + panOffset.y
              };
              const transformedTo = {
                x: (anchors.to.x * scale) + panOffset.x,
                y: (anchors.to.y * scale) + panOffset.y
              };
              
              const pathData = generateSplinePath(transformedFrom, transformedTo);
              if (!pathData) return null;
              
              return (
              <g 
                key={connection.id}
                className={`transition-opacity duration-200 ${
                  isConnectedToDraggedNode ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {/* Glow effect */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={
                    isExperimental ? 'rgba(234, 179, 8, 0.2)' :
                    isDarkMode ? 'rgba(168, 85, 247, 0.2)' :
                    'rgba(59, 130, 246, 0.2)'
                  }
                  strokeWidth="6"
                  filter="blur(4px)"
                />
                {/* Main path */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={
                    isExperimental ? 'rgba(234, 179, 8, 0.4)' :
                    isDarkMode ? 'rgba(168, 85, 247, 0.4)' :
                    'rgba(59, 130, 246, 0.4)'
                  }
                  strokeWidth="1"
                  className="animate-pulse"
                />
                {/* Connection dots */}
                <circle
                  cx={transformedFrom.x}
                  cy={transformedFrom.y}
                  r="4"
                  fill={
                    isExperimental ? 'rgb(234, 179, 8)' :
                    isDarkMode ? 'rgb(168, 85, 247)' :
                    'rgb(59, 130, 246)'
                  }
                />
                <circle
                  cx={transformedTo.x}
                  cy={transformedTo.y}
                  r="4"
                  fill={
                    isExperimental ? 'rgb(234, 179, 8)' :
                    isDarkMode ? 'rgb(168, 85, 247)' :
                    'rgb(59, 130, 246)'
                  }
                />
              </g>
              );
            } catch (e) {
              console.error('Error rendering connection:', connection.id, e);
              return null;
            }
          })}
        </svg>

        <div 
          style={{ 
            zIndex: 2, 
            position: 'relative',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
            transformOrigin: '0 0'
          }}
        >
          {nodes.map((node) => renderNode(node))}
        </div>
        
        {contextMenu.visible && (
          <div
            className={`fixed backdrop-blur-md border rounded-2xl shadow-xl py-2 z-50 transition-colors duration-200 ${
              isExperimental ? 'bg-black/95 border-yellow-400/30' :
              isDarkMode ? 'bg-gray-900/95 border-purple-500/30' :
              'bg-white/95 border-gray-300'
            }`}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.nodeId ? (
              <button
                onClick={() => deleteNode(contextMenu.nodeId)}
                className={`w-full px-4 py-2.5 text-left flex items-center space-x-3 transition-colors text-sm rounded-xl mx-2 font-medium ${
                  isExperimental ? 'text-red-400 hover:bg-red-500/10' :
                  isDarkMode ? 'text-red-400 hover:bg-red-500/10' :
                  'text-red-600 hover:bg-red-50'
                }`}
                disabled={contextMenu.nodeId === 'script-generator'}
              >
                <X size={14} />
                <span>Delete</span>
              </button>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addAdNode();
                  }}
                  disabled={nodes.filter(n => n.type === 'ad').length >= 6}
                  className={`w-full px-4 py-2.5 text-left flex items-center space-x-3 transition-colors text-sm rounded-xl mx-2 font-medium ${
                    nodes.filter(n => n.type === 'ad').length >= 6
                      ? 'opacity-50 cursor-not-allowed text-gray-500'
                      : isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10' :
                        isDarkMode ? 'text-gray-200 hover:bg-purple-500/10' :
                        'text-gray-800 hover:bg-gray-100'
                  }`}
                  title={nodes.filter(n => n.type === 'ad').length >= 6 ? 'Maximum 6 ad nodes allowed' : ''}
                >
                  <Plus size={14} />
                  <span>Add Ad {nodes.filter(n => n.type === 'ad').length >= 6 && '(Max 6)'}</span>
                </button>
                <button
                  onClick={addInstructionsNode}
                  disabled={nodes.filter(n => n.type === 'instructions').length >= 4}
                  className={`w-full px-4 py-2.5 text-left flex items-center space-x-3 transition-colors text-sm rounded-xl mx-2 font-medium ${
                    nodes.filter(n => n.type === 'instructions').length >= 4
                      ? 'opacity-50 cursor-not-allowed text-gray-500'
                      : isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10' :
                        isDarkMode ? 'text-gray-200 hover:bg-purple-500/10' :
                        'text-gray-800 hover:bg-gray-100'
                  }`}
                  title={nodes.filter(n => n.type === 'instructions').length >= 4 ? 'Maximum 4 instruction nodes allowed' : ''}
                >
                  <FileText size={14} />
                  <span>Add Instructions {nodes.filter(n => n.type === 'instructions').length >= 4 && '(Max 4)'}</span>
                </button>
                {!nodes.find(n => n.type === 'productSpec') && (
                  <button
                    onClick={addProductSpecNode}
                    className={`w-full px-4 py-2.5 text-left flex items-center space-x-3 transition-colors text-sm rounded-xl mx-2 font-medium ${
                      isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10' :
                      isDarkMode ? 'text-gray-200 hover:bg-purple-500/10' :
                      'text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <FileText size={14} />
                    <span>Add Product Spec</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
        
        {selectedNodes.size > 0 && showSelectionTip && (
          <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-md transition-all duration-300 max-w-sm ${
            isExperimental ? 'bg-yellow-600 text-black' :
            isDarkMode ? 'bg-purple-600 text-gray-100' :
            'bg-gray-800 text-white'
          }`}>
            <div className="flex items-start justify-between space-x-3">
              <div className="text-sm font-medium">
                {selectedNodes.size} nodes selected - Use script generator to modify them • Press Backspace to delete
              </div>
              <button
                onClick={() => setShowSelectionTip(false)}
                className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
                  isExperimental ? 'hover:bg-yellow-700/50 text-black/80' :
                  isDarkMode ? 'hover:bg-purple-700/50 text-gray-300' :
                  'hover:bg-gray-700/50 text-gray-300'
                }`}
                title="Dismiss tip"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 ${
              isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
            }`}>
              <h3 className="text-lg font-semibold mb-4">Delete Nodes</h3>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Are you sure you want to delete {Array.from(selectedNodes).filter(id => id !== 'script-generator').length} node{Array.from(selectedNodes).filter(id => id !== 'script-generator').length === 1 ? '' : 's'}?
                {selectedNodes.has('script-generator') && (
                  <span className="block mt-2 text-sm text-yellow-600">
                    Note: The Script Generator cannot be deleted.
                  </span>
                )}
              </p>
              <div className="flex space-x-3 justify-end">
                <button
                  onClick={cancelDelete}
                  className={`px-4 py-2 rounded-xl transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default React.memo(NodeBasedWorkspaceFixed);