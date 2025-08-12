import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Home, Folder, Settings, Minus, Sun, Moon, Zap, Database, Download, Upload, Trash2 } from 'lucide-react';
// import NodeBasedWorkspaceFixed from './NodeBasedWorkspaceFixed';
import EnhancedStaticScriptView from '../views/EnhancedStaticScriptView';
// import ScriptGenerationNode from '../script/nodes/ScriptGenerationNode';
// import ChatAssistant from '../script/chat/ChatAssistant';
import { useWorkspaceStore, useUIStore, useProjectStore } from '../../stores';
import { storage, WorkspaceStorage, AdStorage, ScriptStorage, AutoSave, DataPortability } from '../../utils/localStorage';
import type { NodeType, Point } from '../../types';

// API helper functions for script generation
const apiHelpers = {
  async generateScript(inputs: any, adAnalyses: any = {}) {
    try {
      const response = await fetch('/api/generateScript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, adAnalyses })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Script generation failed:', error);
      throw error;
    }
  },

  async chatActions(data: any) {
    try {
      const response = await fetch('/api/chatActions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Chat actions failed:', error);
      throw error;
    }
  },

  async analyzeAd(url: string, contentDescription?: string) {
    try {
      const response = await fetch('/api/analyzeAd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, content_description: contentDescription })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Ad analysis failed:', error);
      throw error;
    }
  }
};

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

  // State for tracking loaded data
  const [adAnalyses, setAdAnalyses] = React.useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [storageInfo, setStorageInfo] = React.useState({ totalSize: 0, itemCount: 0, items: {} });
  const [showDataManagement, setShowDataManagement] = React.useState(false);
  const [currentScript, setCurrentScript] = React.useState<any>(null);
  
  // Use a ref to prevent double initialization in StrictMode
  const initializationRef = React.useRef(false);

  // COMMENTED OUT: Node-based workspace loading 
  // Simple initialization for static script view only
  React.useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;
    
    // Force static view for MVP
    setCurrentView('static');

    // Load saved script only
    try {
      console.log('🔄 WorkspaceContainer: Loading scripts from localStorage...');
      const savedScripts = ScriptStorage.loadGeneratedScripts();
      const savedCurrentScript = savedScripts['current_script'] || null;
      
      if (savedCurrentScript) {
        console.log('📜 WorkspaceContainer: Found saved script with', savedCurrentScript.chunks?.length || 0, 'chunks');
        setCurrentScript(savedCurrentScript);
      } else {
        console.log('📜 WorkspaceContainer: No saved script found');
      }
    } catch (error) {
      console.error('❌ WorkspaceContainer: Failed to load saved script:', error);
    }
    
    setIsLoading(false);
  }, []);

  /* COMMENTED OUT NODE WORKSPACE LOADING:
  React.useEffect(() => {
    // Force static view for MVP
    setCurrentView('static');

    // Prevent double initialization in StrictMode
    if (initializationRef.current) {
      console.log('Already initializing, skipping...');
      return;
    }
    
    initializationRef.current = true;
    [COMMENTED OUT - see above for simple version]
    */
  
  // Removed: connections auto-add effect (graph view disabled for MVP)

  // COMMENTED OUT: Auto-save workspace changes (not needed for static view)
  /*
  React.useEffect(() => {
    if (isLoading) return; // Don't save during initial load
    
    if (nodes.length > 0) {
      console.log('🔄 Auto-saving workspace changes...');
      const uiState = {
        currentView,
        theme,
        sidebarOpen,
        chatOpen
      };
      
      AutoSave.scheduleWorkspaceSave(
        nodes,
        [], // Do not persist connections for MVP static view
        { panOffset, zoomLevel, canvasBounds },
        uiState
      );
    }
  }, [nodes, connections, panOffset, zoomLevel, currentView, theme, isLoading]);

  // Auto-save ad analyses changes
  React.useEffect(() => {
    if (isLoading) return;
    
    if (Object.keys(adAnalyses).length > 0) {
      console.log('🔄 Auto-saving processed ads...');
      AdStorage.saveProcessedAds(adAnalyses);
    }
  }, [adAnalyses, isLoading]);
  */

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
  const currentNodes = nodes.filter(node => node.type !== 'scriptGenerator'); // Static view shows all except script generator
  const currentConnections: any[] = []; // No connections in MVP static view
  
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

  const handleAddNode = useCallback((nodeType: string, data: any = {}): string | null => {
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
    } else if (nodeType === 'scriptGenerator') {
      // Only allow one script generator
      const generatorCount = nodes.filter(n => n.type === 'scriptGenerator').length;
      if (generatorCount >= 1) {
        return null;
      }
    }
    
    const scriptGenerator = nodes.find(n => n.type === 'scriptGenerator');
    
    // Use provided position from data if available, otherwise calculate
    let position: Point = { x: 100, y: 100 };
    if ((data as any).position) {
      position = (data as any).position as Point;
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

    // Use store action to add node (connections disabled in MVP)
    console.log('Calling addNode with position:', position)
    const nodeId = addNode(nodeType as NodeType, position);
    console.log('Node added with ID:', nodeId)
    console.log('=== END HANDLE ADD NODE ===')
    return nodeId;
  }, [nodes, addNode, connections.length]);

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

  // Script management functions
  const handleScriptUpdate = useCallback((script: any) => {
    console.log('🔄 WorkspaceContainer.handleScriptUpdate called:', {
      hasScript: !!script,
      chunks: script?.chunks?.length || 0
    });
    
    setCurrentScript(script);
    if (script) {
      ScriptStorage.saveScript('current_script', script);
      console.log('💾 WorkspaceContainer: Saved current script to localStorage');
    }
  }, []);

  const handleScriptClear = useCallback(() => {
    setCurrentScript(null);
    ScriptStorage.saveScript('current_script', null);
    console.log('🗑️ Cleared current script from localStorage');
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

  // Apply theme class to document for global scrollbar styles
  React.useEffect(() => {
    // Remove all theme classes
    document.documentElement.classList.remove('light', 'dark', 'experimental');
    // Add current theme class
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Data management functions
  const updateStorageInfo = React.useCallback(() => {
    const info = storage.getStorageInfo();
    setStorageInfo(info);
  }, []);

  const handleExportData = React.useCallback(() => {
    try {
      DataPortability.downloadBackup();
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  }, []);

  const handleImportData = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content && DataPortability.importAllData(content)) {
        // Refresh the page to reload imported data
        window.location.reload();
      } else {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  }, []);

  const handleClearData = React.useCallback(() => {
    if (confirm('Are you sure you want to clear all saved data? This action cannot be undone.')) {
      storage.clear();
      // Refresh the page to reset the app
      window.location.reload();
    }
  }, []);

  // Update storage info when data changes
  React.useEffect(() => {
    if (!isLoading) {
      updateStorageInfo();
    }
  }, [nodes, adAnalyses, isLoading, updateStorageInfo]);

  const renderWorkspaceContent = () => {
    // Always render static view for MVP
    return (
      <EnhancedStaticScriptView 
        nodes={currentNodes} 
        colorScheme={theme}
        onAddNode={handleAddNode}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        chatExpanded={chatOpen}
        onToggleChat={toggleChat}
        adAnalyses={adAnalyses}
        currentScript={currentScript}
        onScriptUpdate={handleScriptUpdate}
        onScriptClear={handleScriptClear}
        onAdAnalyzed={(nodeId: string, analysis: any) => {
          console.log('💾 Saving ad analysis for', nodeId);
          setAdAnalyses(prev => ({ ...prev, [nodeId]: analysis }));
          AdStorage.addProcessedAd(nodeId, analysis);
        }}
      />
    );
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

                  {/* Data Management Section */}
                  <div>
                    <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
                      isDarkMode ? 'text-purple-400/80' : 
                      isExperimental ? 'text-yellow-400/80' : 
                      'text-gray-500'
                    }`}>
                      Data Management
                    </h3>
                    <div className="space-y-2">
                      {/* Storage Info */}
                      <div className={`px-3 py-2.5 text-xs rounded-lg border ${
                        isDarkMode ? 'text-purple-200/80 bg-purple-500/5 border-purple-500/20' : 
                        isExperimental ? 'text-yellow-200/80 bg-yellow-400/5 border-yellow-400/20' : 
                        'text-gray-600 bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <Database size={14} />
                          <span>{Math.round(storageInfo.totalSize / 1024)}KB</span>
                        </div>
                        <div className="mt-1 text-xs opacity-75">
                          {storageInfo.itemCount} items saved
                        </div>
                      </div>

                      {/* Export Data */}
                      <button
                        onClick={handleExportData}
                        className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all group ${
                          isDarkMode ? 'text-purple-200 hover:bg-purple-500/10 hover:text-purple-100' : 
                          isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100' : 
                          'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Download size={16} className={`mr-3 transition-colors ${
                          isDarkMode ? 'text-purple-400 group-hover:text-purple-300' : 
                          isExperimental ? 'text-yellow-400 group-hover:text-yellow-300' : 
                          'text-gray-500'
                        }`} />
                        Export Data
                      </button>

                      {/* Import Data */}
                      <label className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all cursor-pointer group ${
                        isDarkMode ? 'text-purple-200 hover:bg-purple-500/10 hover:text-purple-100' : 
                        isExperimental ? 'text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100' : 
                        'text-gray-700 hover:bg-gray-100'
                      }`}>
                        <Upload size={16} className={`mr-3 transition-colors ${
                          isDarkMode ? 'text-purple-400 group-hover:text-purple-300' : 
                          isExperimental ? 'text-yellow-400 group-hover:text-yellow-300' : 
                          'text-gray-500'
                        }`} />
                        Import Data
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportData}
                          className="hidden"
                        />
                      </label>

                      {/* Clear Data */}
                      <button
                        onClick={handleClearData}
                        className={`w-full flex items-center px-3 py-2.5 text-sm rounded-lg transition-all group ${
                          isDarkMode ? 'text-red-300 hover:bg-red-500/10 hover:text-red-200' : 
                          isExperimental ? 'text-red-300 hover:bg-red-400/10 hover:text-red-200' : 
                          'text-red-600 hover:bg-red-50 hover:text-red-700'
                        }`}
                      >
                        <Trash2 size={16} className={`mr-3 transition-colors ${
                          isDarkMode ? 'text-red-400 group-hover:text-red-300' : 
                          isExperimental ? 'text-red-400 group-hover:text-red-300' : 
                          'text-red-500'
                        }`} />
                        Clear All Data
                      </button>
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
          {/* Workspace Header with Tabs (view toggle hidden for MVP) */}
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
          </div>

          {/* Workspace Area */}
          <div className="flex-1 relative overflow-hidden">
            {renderWorkspaceContent()}
          </div>

        </div>
      </div>
    </div>
  );
};

export default WorkspaceContainer;