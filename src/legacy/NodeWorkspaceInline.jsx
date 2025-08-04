import React, { useState, useCallback, useRef } from 'react';
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

const NodeWorkspaceInline = () => {
  const [nodes, setNodes] = useState([
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

  const [connections, setConnections] = useState([
    { id: 'conn-1', fromNodeId: 'product-spec', toNodeId: 'script-generator' },
    { id: 'conn-2', fromNodeId: 'ad-1', toNodeId: 'script-generator' }
  ]);

  const [dragState, setDragState] = useState({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 }
  });

  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [chatInput, setChatInput] = useState('');
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    nodeId: undefined
  });
  const [colorScheme, setColorScheme] = useState('light');

  const workspaceRef = useRef(null);

  // Style configurations
  const styles = {
    light: {
      workspace: {
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #f3f4f6, #ffffff, #f9fafb)',
        position: 'relative'
      },
      header: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottom: '1px solid #d1d5db',
        padding: '16px 24px',
        backdropFilter: 'blur(12px)'
      },
      workArea: {
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 73px)',
        overflow: 'auto',
        background: 'radial-gradient(circle at 25px 25px, rgba(75, 85, 99, 0.08) 1px, transparent 0), radial-gradient(circle at 75px 75px, rgba(75, 85, 99, 0.08) 1px, transparent 0)',
        backgroundSize: '50px 50px',
        minHeight: '800px',
        minWidth: '1200px'
      },
      node: {
        backgroundColor: 'white',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.1)',
        padding: '16px',
        position: 'absolute',
        cursor: 'move',
        transition: 'all 0.2s'
      },
      nodeHeader: {
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '8px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      },
      button: {
        backgroundColor: '#3b82f6',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      },
      contextMenu: {
        position: 'fixed',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #d1d5db',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        padding: '8px',
        zIndex: 50,
        backdropFilter: 'blur(12px)'
      }
    },
    dark: {
      workspace: {
        minHeight: '100vh',
        background: 'linear-gradient(to bottom right, #000000, #111111, #000000)',
        position: 'relative'
      },
      header: {
        backgroundColor: 'rgba(17, 17, 17, 0.9)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
        padding: '16px 24px',
        backdropFilter: 'blur(12px)'
      },
      workArea: {
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 73px)',
        overflow: 'auto',
        background: 'radial-gradient(circle at 25px 25px, rgba(168, 85, 247, 0.08) 1px, transparent 0), radial-gradient(circle at 75px 75px, rgba(168, 85, 247, 0.08) 1px, transparent 0)',
        backgroundSize: '50px 50px',
        minHeight: '800px',
        minWidth: '1200px'
      },
      node: {
        backgroundColor: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        borderRadius: '16px',
        boxShadow: '0 10px 15px -3px rgba(139, 92, 246, 0.15)',
        padding: '16px',
        position: 'absolute',
        cursor: 'move',
        transition: 'all 0.2s',
        color: '#f3f4f6'
      },
      nodeHeader: {
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        paddingBottom: '8px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      },
      button: {
        background: 'linear-gradient(to right, #8b5cf6, #6366f1)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      },
      contextMenu: {
        position: 'fixed',
        backgroundColor: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        padding: '8px',
        zIndex: 50,
        backdropFilter: 'blur(12px)'
      }
    }
  };

  const currentStyles = styles[colorScheme] || styles.light;

  // Node type specific colors
  const nodeColors = {
    ad: { primary: '#10b981', secondary: '#059669' },
    productSpec: { primary: '#3b82f6', secondary: '#2563eb' },
    script: { primary: '#8b5cf6', secondary: '#7c3aed' },
    instructions: { primary: '#f59e0b', secondary: '#d97706' }
  };

  // Handlers
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

  const cycleColorScheme = () => {
    setColorScheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const renderNode = (node) => {
    const isSelected = selectedNodes.has(node.id);
    const color = nodeColors[node.type] || nodeColors.ad;
    
    const nodeStyle = {
      ...currentStyles.node,
      left: node.position.x + 'px',
      top: node.position.y + 'px',
      width: node.expanded ? '320px' : '192px',
      borderColor: isSelected ? color.primary : currentStyles.node.border.split(' ')[2],
      boxShadow: dragState.nodeId === node.id 
        ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' 
        : isSelected 
          ? `0 10px 15px -3px ${color.primary}33`
          : currentStyles.node.boxShadow,
      transform: dragState.nodeId === node.id ? 'scale(1.02)' : 'scale(1)',
      zIndex: dragState.nodeId === node.id ? 50 : 1
    };

    switch (node.type) {
      case 'ad':
        return (
          <div
            key={node.id}
            style={nodeStyle}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div style={currentStyles.nodeHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: node.data.status === 'completed' ? '#10b981' :
                    node.data.status === 'processing' ? '#f59e0b' :
                    node.data.status === 'error' ? '#ef4444' : color.primary
                }}></div>
                <span style={{ fontWeight: '500', fontSize: '14px' }}>{node.data.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpansion(node.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: colorScheme === 'dark' ? '#d1d5db' : '#6b7280'
                }}
              >
                {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
            <div style={{ marginTop: '12px' }}>
              <input
                type="url"
                placeholder="Paste ad URL..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : '#d1d5db'}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.5)' : '#f9fafb',
                  color: colorScheme === 'dark' ? '#f3f4f6' : '#111827',
                  outline: 'none'
                }}
                value={node.data.url}
                onChange={(e) => {
                  e.stopPropagation();
                  setNodes(prevNodes =>
                    prevNodes.map(n =>
                      n.id === node.id
                        ? { ...n, data: { ...n.data, url: e.target.value } }
                        : n
                    )
                  );
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
            style={nodeStyle}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onClick={() => toggleNodeSelection(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div style={currentStyles.nodeHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '8px',
                  backgroundColor: `${color.primary}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={14} color={color.primary} />
                </div>
                <span style={{ fontWeight: '500', fontSize: '14px' }}>Product Spec</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  backgroundColor: `${color.primary}20`,
                  color: color.secondary,
                  fontWeight: '500'
                }}>
                  {node.data.documents.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeExpansion(node.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: colorScheme === 'dark' ? '#d1d5db' : '#6b7280'
                  }}
                >
                  {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
            </div>
            
            {node.expanded && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ maxHeight: '192px', overflowY: 'auto', marginBottom: '12px' }}>
                  {node.data.documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        marginBottom: '8px',
                        border: `1px solid ${colorScheme === 'dark' ? 'rgba(255,255,255,0.2)' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f9fafb'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        {doc.type === 'pdf' ? <FileImage size={14} color="#ef4444" /> :
                         doc.type === 'word' ? <FileText size={14} color="#3b82f6" /> :
                         <File size={14} color="#6b7280" />}
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>{doc.name}</p>
                          <p style={{ fontSize: '12px', color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280', margin: 0 }}>
                            {doc.size} • {doc.uploadedAt}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
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
                    setNodes(prevNodes =>
                      prevNodes.map(n =>
                        n.id === node.id
                          ? { ...n, data: { ...n.data, documents: [...n.data.documents, newDoc] } }
                          : n
                      )
                    );
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: `${color.primary}20`,
                    border: `1px solid ${color.primary}40`,
                    borderRadius: '12px',
                    color: color.secondary,
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Upload size={12} />
                  Add Document
                </button>
              </div>
            )}
          </div>
        );

      case 'script':
        return (
          <div
            key={node.id}
            style={{ ...nodeStyle, width: '384px' }}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onContextMenu={(e) => handleContextMenu(e, node.id)}
          >
            <div style={currentStyles.nodeHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '8px',
                  background: `linear-gradient(to bottom right, ${color.primary}20, ${color.secondary}20)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MessageSquare size={14} color={color.primary} />
                </div>
                <span style={{ fontWeight: '500', fontSize: '14px' }}>Script Generator</span>
              </div>
              {selectedNodes.size > 0 && (
                <span style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  backgroundColor: `${color.primary}20`,
                  color: color.secondary,
                  fontWeight: '500'
                }}>
                  {selectedNodes.size} selected
                </span>
              )}
            </div>
            
            <div style={{ marginTop: '12px' }}>
              <div style={{
                height: '160px',
                overflowY: 'auto',
                padding: '12px',
                marginBottom: '12px',
                border: `1px solid ${colorScheme === 'dark' ? 'rgba(139,92,246,0.2)' : 'rgba(219,234,254,0.4)'}`,
                borderRadius: '12px',
                backgroundColor: colorScheme === 'dark' ? 'rgba(139,92,246,0.05)' : 'rgba(219,234,254,0.2)'
              }}>
                {node.data.messages.map((msg, idx) => (
                  <div key={idx} style={{
                    fontSize: '12px',
                    marginBottom: '8px',
                    color: msg.role === 'user' 
                      ? (colorScheme === 'dark' ? '#a78bfa' : '#2563eb')
                      : (colorScheme === 'dark' ? '#e5e7eb' : '#4b5563')
                  }}>
                    <strong style={{ fontWeight: '500' }}>
                      {msg.role === 'user' ? 'You:' : 'AI:'}
                    </strong> {msg.content}
                  </div>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: `1px solid ${colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : '#d1d5db'}`,
                    borderRadius: '12px',
                    fontSize: '14px',
                    backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.5)' : '#f9fafb',
                    color: colorScheme === 'dark' ? '#f3f4f6' : '#111827',
                    outline: 'none'
                  }}
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
                      // Send message logic here
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Send message logic here
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '12px',
                    border: 'none',
                    background: `linear-gradient(to right, ${color.primary}, ${color.secondary})`,
                    color: 'white',
                    cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: chatInput.trim() ? 1 : 0.5
                  }}
                  disabled={!chatInput.trim()}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={currentStyles.workspace}>
      {/* Header */}
      <div style={currentStyles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: colorScheme === 'dark' ? '#f3f4f6' : '#111827' }}>
              AdCraft Studio
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={cycleColorScheme} style={currentStyles.button}>
              {colorScheme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
              <span style={{ fontSize: '12px', fontWeight: '500', textTransform: 'capitalize' }}>{colorScheme}</span>
            </button>
            <div style={{ fontSize: '14px', color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
              Right-click to add nodes • Drag to move • Click to select
            </div>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div
        ref={workspaceRef}
        style={currentStyles.workArea}
        onContextMenu={(e) => !contextMenu.visible && handleContextMenu(e)}
        onClick={hideContextMenu}
      >
        {/* Render nodes */}
        {nodes.map((node) => renderNode(node))}
        
        {/* Context menu */}
        {contextMenu.visible && (
          <div style={{ ...currentStyles.contextMenu, left: contextMenu.x, top: contextMenu.y }}>
            <button
              onClick={() => {
                const newNode = {
                  id: `ad-${Date.now()}`,
                  type: 'ad',
                  position: { x: contextMenu.x - 100, y: contextMenu.y - 50 },
                  selected: false,
                  expanded: false,
                  data: {
                    index: nodes.filter(n => n.type === 'ad').length + 1,
                    url: '',
                    title: `Ad ${nodes.filter(n => n.type === 'ad').length + 1}`,
                    status: 'empty'
                  }
                };
                setNodes(prev => [...prev, newNode]);
                hideContextMenu();
              }}
              style={{
                ...currentStyles.button,
                width: '100%',
                marginBottom: '4px',
                backgroundColor: 'transparent',
                color: colorScheme === 'dark' ? '#e5e7eb' : '#111827',
                justifyContent: 'flex-start'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = colorScheme === 'dark' ? 'rgba(139,92,246,0.1)' : 'rgba(243,244,246,1)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <Plus size={14} />
              Add Ad
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeWorkspaceInline;