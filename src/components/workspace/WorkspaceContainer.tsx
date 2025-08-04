import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Home, Folder, Settings, Minus, Sun, Moon, Zap } from 'lucide-react';
import NodeBasedWorkspaceFixed from './NodeBasedWorkspaceFixed';
import StaticScriptView from '../views/StaticScriptView';
import { useWorkspaceStore, useUIStore, useProjectStore } from '../../stores';
import type { NodeType, Point } from '../../types';

const WorkspaceContainer: React.FC = () => {
  // UI Store
  const { 
    currentView, setCurrentView,
    theme, setTheme,
    sidebarOpen, setSidebarOpen,
    chatOpen, setChatOpen 
  } = useUIStore();

  // Workspace Store
  const {
    nodes,
    connections,
    zoomLevel,
    panOffset,
    canvasBounds,
    addNode,
    updateNode,
    deleteNode,
    addConnection,
    removeConnection,
    setZoomLevel,
    reorganizeNodes,
    resetWorkspace
  } = useWorkspaceStore();

  // Project Store
  const { currentProjectId, createProject } = useProjectStore();

  // Use a ref to prevent double initialization in StrictMode
  const initializationRef = React.useRef(false);

  // Initialize default project if none exists
  React.useEffect(() => {
    // Check if we already have data
    if (currentProjectId || nodes.length > 0) {
      console.log('Already have data, skipping initialization');
      return;
    }
    
    // Prevent double initialization in StrictMode
    if (initializationRef.current) {
      console.log('Already initializing, skipping...');
      return;
    }
    
    initializationRef.current = true;
    
    console.log('=== INITIALIZATION START ===');
    console.log('Current state:', { currentProjectId, nodeCount: nodes.length });
    
    // Create project first
    const projectId = createProject('My First Project', 'Demo project with sample nodes');
    console.log('Created project:', projectId);
    
    // Add nodes immediately
    console.log('Adding productSpec node...');
    addNode('productSpec', { x: 100, y: 100 });
    
    console.log('Adding ad node...');
    addNode('ad', { x: 300, y: 100 });
    
    console.log('Adding script node...');
    addNode('script', { x: 200, y: 250 });
    
    console.log('=== INITIALIZATION COMPLETE ===');
  }, []); // Only depend on mount
  
  // Add connections after nodes are created
  React.useEffect(() => {
    if (nodes.length >= 3 && connections.length === 0) {
      console.log('Checking for connections...', { nodeCount: nodes.length, connectionCount: connections.length });
      
      const productSpec = nodes.find(n => n.type === 'productSpec');
      const ad = nodes.find(n => n.type === 'ad');
      const scriptGen = nodes.find(n => n.type === 'script');
      
      console.log('Found nodes:', { productSpec: !!productSpec, ad: !!ad, scriptGen: !!scriptGen });
      
      if (productSpec && scriptGen && !connections.some(c => 
        c.fromNodeId === productSpec.id && c.toNodeId === scriptGen.id
      )) {
        console.log('Adding productSpec -> scriptGen connection');
        addConnection(productSpec.id, scriptGen.id);
      }
      
      if (ad && scriptGen && !connections.some(c => 
        c.fromNodeId === ad.id && c.toNodeId === scriptGen.id
      )) {
        console.log('Adding ad -> scriptGen connection');
        addConnection(ad.id, scriptGen.id);
      }
    }
  }, [nodes, connections, addConnection]);

  // Local state for legacy compatibility
  const [activeTab, setActiveTab] = useState<'Scripting' | 'Video Assembly'>('Scripting');
  const [zoomLimits, setZoomLimits] = useState({ min: 25, max: 200 });

  const workspaceRef = useRef<HTMLDivElement>(null);
  const nodeBasedWorkspaceRef = useRef<HTMLDivElement>(null);

  const tabs: ('Scripting' | 'Video Assembly')[] = ['Scripting', 'Video Assembly'];

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoomLevel = parseInt(e.target.value);
    setZoomLevel(newZoomLevel);
  }, [setZoomLevel]);

  // Get current nodes/connections based on active view
  const currentNodes = currentView === 'graph' 
    ? nodes  // Graph view shows all nodes
    : nodes.filter(node => node.type !== 'script'); // Static view shows all except script generator
  const currentConnections = currentView === 'graph' ? connections : [];
  
  console.log('Current connections being passed to workspace:', {
    count: currentConnections.length,
    connections: currentConnections,
    allStoreConnections: connections,
    currentView
  });

  const handleNodesChange = useCallback((newNodes: any[]) => {
    // This will be handled by individual store actions instead of bulk updates
    console.log('Nodes changed:', newNodes);
  }, []);

  const handleConnectionsChange = useCallback((newConnections: any[]) => {
    // This will be handled by individual store actions instead of bulk updates
    console.log('Connections changed:', newConnections);
  }, []);

  const handleAddNode = useCallback((nodeType: NodeType, data: any = {}) => {
    console.log('=== HANDLE ADD NODE ===')
    console.log('Node type:', nodeType)
    console.log('Data:', data)
    console.log('Current nodes:', nodes.length)
    console.log('Current connections:', connections.length)
    // Check node limits
    if (nodeType === 'ad') {
      const adCount = nodes.filter(n => n.type === 'ad').length;
      if (adCount >= 6) {
        return null; // Silently reject - UI handles disabled state
      }
    } else if (nodeType === 'instructions') {
      const instructionCount = nodes.filter(n => n.type === 'instructions').length;
      if (instructionCount >= 4) {
        return null; // Silently reject - UI handles disabled state
      }
    }
    
    const scriptGenerator = nodes.find(n => n.type === 'script');
    
    // Use provided position from data if available, otherwise calculate
    let position: Point;
    if (data.position) {
      position = data.position;
      console.log('Using provided position:', position);
    } else if (scriptGenerator) {
      // Start near script generator
      const baseX = scriptGenerator.position.x;
      const baseY = scriptGenerator.position.y - 120; // Place above script generator
      
      // Simple collision detection - find open spot in a grid around script generator
      const gridSize = 60;
      let foundSpot = false;
      
      for (let radius = 0; radius < 5 && !foundSpot; radius++) {
        for (let angle = 0; angle < 8 && !foundSpot; angle++) {
          const testX = baseX + (Math.cos(angle * Math.PI / 4) * radius * gridSize);
          const testY = baseY + (Math.sin(angle * Math.PI / 4) * radius * gridSize);
          
          // Check if this position conflicts with existing nodes
          const hasConflict = nodes.some(node => {
            const dx = Math.abs(node.position.x - testX);
            const dy = Math.abs(node.position.y - testY);
            return dx < 100 && dy < 80; // Node spacing buffer
          });
          
          if (!hasConflict) {
            position = { x: testX, y: testY };
            foundSpot = true;
          }
        }
      }
      
      // Fallback if no spot found
      if (!foundSpot) {
        position = { x: baseX + Math.random() * 200 - 100, y: baseY + Math.random() * 200 - 100 };
      }
    } else {
      // No script generator, use random position
      position = { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    }

    // Use store action to add node (it handles connections automatically)
    console.log('Calling addNode with position:', position)
    const nodeId = addNode(nodeType, position);
    console.log('Node added with ID:', nodeId)
    console.log('=== END HANDLE ADD NODE ===')
    return nodeId;
  }, [nodes, addNode]);

  const handleUpdateNode = useCallback((nodeId: string, updates: any) => {
    updateNode(nodeId, updates);
  }, [updateNode]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    deleteNode(nodeId);
  }, [deleteNode]);

  const handleWorkspaceBoundsChange = useCallback((bounds: any) => {
    if (bounds && bounds.zoomLimits) {
      setZoomLimits(bounds.zoomLimits);
      
      // Adjust current zoom if it's outside new limits
      setZoomLevel(
        Math.max(bounds.zoomLimits.min, Math.min(bounds.zoomLimits.max, zoomLevel))
      );
    }
  }, [zoomLevel, setZoomLevel]);

  const handleViewportStateChange = useCallback((viewportState: any) => {
    // This can be removed as viewport state is now handled by the store
    console.log('Viewport state changed:', viewportState);
  }, []);

  const cycleColorScheme = () => {
    const themes = ['light', 'dark', 'experimental'] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const toggleChat = () => {
    setChatOpen(!chatOpen);
  };

  const isDarkMode = theme === 'dark';
  const isExperimental = theme === 'experimental';

  const renderWorkspaceContent = () => {
    if (activeTab === 'Scripting') {
      if (currentView === 'graph') {
        return (
          <div ref={workspaceRef} className="relative w-full h-full overflow-hidden">
            <NodeBasedWorkspaceFixed 
              ref={nodeBasedWorkspaceRef}
              colorScheme={theme} 
              hideHeader={true} 
              zoomLevel={zoomLevel}
              nodes={currentNodes}
              connections={currentConnections}
              savedViewportState={{ panOffset, zoomLevel }}
              onWorkspaceBoundsChange={handleWorkspaceBoundsChange}
              onViewportStateChange={handleViewportStateChange}
              onNodesChange={handleNodesChange}
              onConnectionsChange={handleConnectionsChange}
              onAddNode={handleAddNode}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onReorganizeNodes={reorganizeNodes}
            />
          </div>
        );
      } else {
        return (
          <StaticScriptView 
            nodes={currentNodes} 
            colorScheme={theme}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            chatExpanded={chatOpen}
            onToggleChat={toggleChat}
          />
        );
      }
    } else if (activeTab === 'Video Assembly') {
      return (
        <div className="w-full h-full bg-gray-50 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2">🎬</div>
            <p className="text-lg font-medium">Video Assembly Workspace</p>
            <p className="text-sm">Timeline and video editing tools coming soon</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`h-screen w-screen flex ${isDarkMode ? 'bg-gray-900' : isExperimental ? 'bg-black' : 'bg-gray-100'} overflow-hidden`}>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className={`${!sidebarOpen ? 'w-12' : 'w-64'} ${
          isDarkMode ? 'bg-black border-purple-500/20' : 
          isExperimental ? 'bg-black border-yellow-400/30' : 
          'bg-white border-gray-200'
        } border-r flex-shrink-0 transition-all duration-300`}>
          <div className="h-full flex flex-col">
            {/* Sidebar Header */}
            <div className={`h-12 flex items-center justify-between px-4 border-b ${
              isDarkMode ? 'border-purple-500/20' : 
              isExperimental ? 'border-yellow-400/30' : 
              'border-gray-200'
            }`}>
              {sidebarOpen && (
                <span className={`font-medium ${
                  isDarkMode ? 'text-purple-100' : 
                  isExperimental ? 'text-yellow-100' : 
                  'text-gray-800'
                }`}>Navigation</span>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`p-1 rounded ${
                  isDarkMode ? 'text-purple-400 hover:text-purple-200' : 
                  isExperimental ? 'text-yellow-400 hover:text-yellow-300' : 
                  'text-gray-400 hover:text-gray-600'
                }`}
              >
                {!sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              {sidebarOpen ? (
                <div className="p-4 space-y-4">
                  {/* Navigation Section */}
                  <div>
                    <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
                      isDarkMode ? 'text-purple-400/80' : 
                      isExperimental ? 'text-yellow-400/80' : 
                      'text-gray-500'
                    }`}>
                      Navigation
                    </h3>
                    <div className="space-y-1">
                      <button className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all group ${
                        isDarkMode ? 'text-purple-200 hover:bg-purple-500/10 hover:text-purple-100' : 
                        isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100' : 
                        'text-gray-700 hover:bg-gray-100'
                      }`}>
                        <Home size={16} className={`mr-3 transition-colors ${
                          isDarkMode ? 'text-purple-400 group-hover:text-purple-300' : 
                          isExperimental ? 'text-yellow-400 group-hover:text-yellow-300' : 
                          'text-gray-500'
                        }`} />
                        Dashboard
                      </button>
                      <button className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all group ${
                        isDarkMode ? 'text-purple-200 hover:bg-purple-500/10 hover:text-purple-100' : 
                        isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100' : 
                        'text-gray-700 hover:bg-gray-100'
                      }`}>
                        <Folder size={16} className={`mr-3 transition-colors ${
                          isDarkMode ? 'text-purple-400 group-hover:text-purple-300' : 
                          isExperimental ? 'text-yellow-400 group-hover:text-yellow-300' : 
                          'text-gray-500'
                        }`} />
                        Projects
                      </button>
                      <button className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all group ${
                        isDarkMode ? 'text-purple-200 hover:bg-purple-500/10 hover:text-purple-100' : 
                        isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100' : 
                        'text-gray-700 hover:bg-gray-100'
                      }`}>
                        <Settings size={16} className={`mr-3 transition-colors ${
                          isDarkMode ? 'text-purple-400 group-hover:text-purple-300' : 
                          isExperimental ? 'text-yellow-400 group-hover:text-yellow-300' : 
                          'text-gray-500'
                        }`} />
                        Settings
                      </button>
                    </div>
                  </div>

                  {/* Projects Section */}
                  <div>
                    <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
                      isDarkMode ? 'text-purple-400/80' : 
                      isExperimental ? 'text-yellow-400/80' : 
                      'text-gray-500'
                    }`}>
                      Recent Projects
                    </h3>
                    <div className="space-y-2">
                      <div className={`px-3 py-2.5 text-sm rounded-lg border transition-all ${
                        isDarkMode ? 'text-purple-100 bg-purple-500/10 border-purple-500/30' : 
                        isExperimental ? 'text-yellow-100 bg-yellow-400/10 border-yellow-400/30' : 
                        'text-gray-700 bg-blue-50 border-blue-200'
                      }`}>
                        Marketing Campaign A
                      </div>
                      <div className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-all ${
                        isDarkMode ? 'text-purple-200/80 hover:bg-purple-500/10 hover:text-purple-100' : 
                        isExperimental ? 'text-yellow-200/80 hover:bg-yellow-400/10 hover:text-yellow-100' : 
                        'text-gray-700 hover:bg-gray-100'
                      }`}>
                        Product Launch Video
                      </div>
                      <div className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-all ${
                        isDarkMode ? 'text-purple-200/80 hover:bg-purple-500/10 hover:text-purple-100' : 
                        isExperimental ? 'text-yellow-200/80 hover:bg-yellow-400/10 hover:text-yellow-100' : 
                        'text-gray-700 hover:bg-gray-100'
                      }`}>
                        Social Media Assets
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-2 space-y-2">
                  <button className="w-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                    <Home size={16} />
                  </button>
                  <button className="w-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                    <Folder size={16} />
                  </button>
                  <button className="w-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                    <Settings size={16} />
                  </button>
                </div>
              )}

              {/* Color Scheme Toggle - Bottom of sidebar */}
              <div className={`mt-auto p-4 border-t ${
                isDarkMode ? 'border-purple-500/20' : 
                isExperimental ? 'border-yellow-400/30' : 
                'border-gray-200'
              }`}>
                {sidebarOpen ? (
                  <button
                    onClick={cycleColorScheme}
                    className={`w-full p-3 rounded-xl transition-all duration-200 flex items-center space-x-3 backdrop-blur-sm ${
                      isExperimental ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300 border border-yellow-400/30' :
                      isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 border border-purple-500/30' :
                      'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                    }`}
                    title={`Current: ${theme} - Click to cycle`}
                  >
                    {theme === 'light' && <Sun size={18} />}
                    {theme === 'dark' && <Moon size={18} />}
                    {theme === 'experimental' && <Zap size={18} />}
                    <span className="text-sm font-medium capitalize">{theme} Mode</span>
                  </button>
                ) : (
                  <button 
                    onClick={cycleColorScheme}
                    className={`w-full p-3 rounded-xl transition-all duration-200 flex items-center justify-center backdrop-blur-sm ${
                      isExperimental ? 'bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 hover:text-yellow-300 border border-yellow-400/30' :
                      isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:text-purple-300 border border-purple-500/30' :
                      'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                    }`}
                    title={`Current: ${theme} - Click to cycle`}
                  >
                    {theme === 'light' && <Sun size={18} />}
                    {theme === 'dark' && <Moon size={18} />}
                    {theme === 'experimental' && <Zap size={18} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Workspace Header with Tabs */}
          <div className={`h-12 flex items-center px-4 flex-shrink-0 border-b ${
            isDarkMode ? 'bg-black border-purple-500/20' : 
            isExperimental ? 'bg-black/90 border-yellow-400/30' : 
            'bg-white border-gray-200'
          }`}>
            <div className="flex items-center space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
                    activeTab === tab
                      ? isDarkMode ? 'bg-purple-500/20 text-purple-100 border-b-2 border-purple-400 shadow-lg shadow-purple-500/10' : isExperimental ? 'bg-yellow-400/20 text-yellow-300 border-b-2 border-yellow-400' : 'bg-blue-500 text-white border-b-2 border-blue-500'
                      : isDarkMode ? 'text-purple-400/70 hover:text-purple-200 hover:bg-purple-500/10 hover:shadow-md hover:shadow-purple-500/5' : isExperimental ? 'text-yellow-400/60 hover:text-yellow-300 hover:bg-yellow-400/10' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
              <button className={`ml-2 p-2 rounded transition-colors ${
                isDarkMode ? 'text-purple-400 hover:text-purple-200 hover:bg-purple-500/10' : 
                isExperimental ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10' : 
                'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}>
                <Plus size={16} />
              </button>
            </div>

            {/* View Toggle - Right side of header */}
            {activeTab === 'Scripting' && (
              <div className="ml-auto flex items-center space-x-2">
                <button
                  onClick={() => setCurrentView('graph')}
                  className={`px-3 py-1 text-sm rounded transition-all duration-200 ${
                    currentView === 'graph'
                      ? isDarkMode ? 'bg-purple-500/20 text-purple-100 border border-purple-400/30 shadow-md shadow-purple-500/10' : isExperimental ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'bg-blue-500 text-white'
                      : isDarkMode ? 'text-purple-400/70 hover:text-purple-200 hover:bg-purple-500/10' : isExperimental ? 'text-yellow-400/60 hover:text-yellow-300 hover:bg-yellow-400/10' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  Graph View
                </button>
                <button
                  onClick={() => setCurrentView('static')}
                  className={`px-3 py-1 text-sm rounded transition-all duration-200 ${
                    currentView === 'static'
                      ? isDarkMode ? 'bg-purple-500/20 text-purple-100 border border-purple-400/30 shadow-md shadow-purple-500/10' : isExperimental ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'bg-blue-500 text-white'
                      : isDarkMode ? 'text-purple-400/70 hover:text-purple-200 hover:bg-purple-500/10' : isExperimental ? 'text-yellow-400/60 hover:text-yellow-300 hover:bg-yellow-400/10' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  Static View
                </button>
              </div>
            )}
          </div>

          {/* Workspace Area */}
          <div className="flex-1 relative overflow-hidden">
            {renderWorkspaceContent()}
            
            {/* Floating Zoom Slider */}
            {activeTab === 'Scripting' && currentView === 'graph' && (
              <div className="absolute bottom-6 left-6">
                <div className="relative w-64 py-4">
                  <input
                    type="range"
                    min={zoomLimits.min}
                    max={zoomLimits.max}
                    value={zoomLevel}
                    onChange={handleZoomChange}
                    className="w-full h-6 appearance-none cursor-pointer bg-transparent zoom-slider"
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none h-1 rounded-full"
                    style={{
                      width: '100%',
                      background: isDarkMode ? 'rgba(75, 85, 99, 0.4)' : 'rgba(156, 163, 175, 0.4)'
                    }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 pointer-events-none h-1 rounded-full"
                    style={{
                      width: `${(zoomLevel - zoomLimits.min) / (zoomLimits.max - zoomLimits.min) * 100}%`,
                      background: isExperimental 
                        ? '#EAB308' 
                        : isDarkMode 
                        ? 'linear-gradient(90deg, #A855F7, #C084FC)'
                        : '#3B82F6',
                      boxShadow: isDarkMode ? '0 0 8px rgba(168, 85, 247, 0.5)' : 'none'
                    }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-150"
                    style={{
                      left: `${(zoomLevel - zoomLimits.min) / (zoomLimits.max - zoomLimits.min) * 100}%`,
                      width: `${12 + (zoomLevel / zoomLimits.max) * 12}px`,
                      height: `${12 + (zoomLevel / zoomLimits.max) * 12}px`,
                      marginLeft: `-${(12 + (zoomLevel / zoomLimits.max) * 12) / 2}px`,
                      background: isExperimental 
                        ? '#F59E0B' 
                        : isDarkMode 
                        ? '#000000'
                        : '#3B82F6',
                      border: isDarkMode ? '2px solid #A855F7' : isExperimental ? '2px solid #F59E0B' : '2px solid #3B82F6',
                      boxShadow: isDarkMode 
                        ? '0 0 12px rgba(168, 85, 247, 0.8), 0 0 24px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.2)'
                        : isExperimental 
                        ? '0 0 12px rgba(245, 158, 11, 0.6)'
                        : '0 0 8px rgba(59, 130, 246, 0.4)'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default WorkspaceContainer;