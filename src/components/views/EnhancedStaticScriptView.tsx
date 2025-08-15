import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  MessageSquare, 
  Send,
  X,
  Plus,
  Upload,
  Sparkles,
  RotateCcw,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  ExternalLink,
  Shield
} from 'lucide-react';
import type { Theme } from '../../types';
import ChatAssistant from '../script/chat/ChatAssistant';
import { extractTextFromFile, getSupportedFileTypes, getFileTypeDescription } from '../../utils/fileProcessor';
import { AdStorage } from '../../utils/localStorage';


interface EnhancedStaticScriptViewProps {
  nodes?: any[];
  colorScheme: Theme;
  onAddNode?: (type: string, data?: any) => string | null;
  onUpdateNode?: (id: string, updates: any) => void;
  onDeleteNode?: (id: string) => void;
  chatExpanded: boolean;
  onToggleChat: () => void;
  adAnalyses?: Record<string, any>;
  onAdAnalyzed?: (nodeId: string, analysis: any) => void;
  currentScript?: any;
  onScriptUpdate?: (script: any) => void;
  onScriptClear?: () => void;
}

const EnhancedStaticScriptView: React.FC<EnhancedStaticScriptViewProps> = ({ 
  nodes = [], 
  colorScheme = 'light',
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  chatExpanded,
  onToggleChat,
  adAnalyses = {},
  onAdAnalyzed,
  currentScript,
  onScriptUpdate,
  onScriptClear
}) => {
  // State for managing expanded cards and script generation
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // Track local script state that syncs with parent
  const [localScript, setLocalScript] = useState(currentScript);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [chatWidth, setChatWidth] = useState(384);
  const [isResizing, setIsResizing] = useState(false);
  const [analyzingAds, setAnalyzingAds] = useState<Set<string>>(new Set());
  // adAnalyses is now passed as prop from parent component
  const [showTooltip, setShowTooltip] = useState<{ show: boolean; x: number; y: number; message: string }>({ show: false, x: 0, y: 0, message: '' });
  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number; nodeId: string; nodeType: string } | null>(null);
  const [filePreview, setFilePreview] = useState<{ show: boolean; file: any; content: string } | null>(null);
  const [collapsedShots, setCollapsedShots] = useState<Set<string>>(new Set()); // Track collapsed shot sections

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isDarkMode = colorScheme === 'dark';
  const isExperimental = colorScheme === 'experimental';

  // Sync local script with parent prop
  useEffect(() => {
    console.log('📜 EnhancedStaticScriptView: currentScript prop changed:', {
      hasScript: !!currentScript,
      format: 'sections',
      count: currentScript?.sections?.length || 0,
      title: currentScript?.title || 'No title'
    });
    setLocalScript(currentScript);
  }, [currentScript]);

  // Filter nodes by type
  const productSpecs = nodes.filter(node => node.type === 'productSpec');
  const ads = nodes.filter(node => node.type === 'ad');
  const instructions = nodes.filter(node => node.type === 'instructions');

  const toggleCard = (cardId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(cardId)) {
      newExpanded.delete(cardId);
    } else {
      newExpanded.add(cardId);
    }
    setExpandedCards(newExpanded);
  };

  const toggleShotsVisibility = (sectionId: string) => {
    const newCollapsed = new Set(collapsedShots);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedShots(newCollapsed);
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string, nodeType: string) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      nodeId,
      nodeType
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    if (onDeleteNode && confirm('Are you sure you want to delete this node?')) {
      onDeleteNode(nodeId);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking elsewhere
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Close file preview with Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && filePreview) {
        closeFilePreview();
      }
    };
    
    if (filePreview) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [filePreview]);

  const toggleSourceSelection = (nodeId: string, nodeType: string, event?: React.MouseEvent) => {
    // For ads, only allow selection if analyzed
    if (nodeType === 'ad') {
      const node = nodes.find(n => n.id === nodeId);
      if (!isAdAnalyzed(nodeId, node)) {
        if (event) {
          setShowTooltip({ 
            show: true, 
            x: event.clientX, 
            y: event.clientY, 
            message: 'Ad not analyzed yet. Add a link and analyze it first.' 
          });
          setTimeout(() => setShowTooltip({ show: false, x: 0, y: 0, message: '' }), 2000);
        }
        return; // Can't select unanalyzed ads
      }
    }

    const newSelected = new Set(selectedSources);
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId);
    } else {
      newSelected.add(nodeId);
    }
    setSelectedSources(newSelected);
  };

  const saveScript = (nextScript: any) => {
    console.log('📜 saveScript called with:', {
      sections: nextScript?.sections?.length || 0,
      title: nextScript?.title || 'No title',
      hasOnScriptUpdate: !!onScriptUpdate
    });
    
    if (localScript) {
      setUndoStack(prev => [...prev.slice(-19), localScript]); // Keep last 20
      setRedoStack([]);
    }
    
    // Update local state immediately for responsive UI
    setLocalScript(nextScript);
    
    // Also update parent state
    if (onScriptUpdate) {
      console.log('📜 Calling onScriptUpdate...');
      onScriptUpdate(nextScript);
    }
    console.log('📜 Script save completed');
  };

  const undo = () => {
    if (undoStack.length === 0 || !localScript) return;
    const prevScript = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [localScript, ...prev.slice(0, 19)]);
    saveScript(prevScript);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const nextScript = redoStack[0];
    setRedoStack(prev => prev.slice(1));
    setUndoStack(prev => [...prev, localScript!]);
    saveScript(nextScript);
  };


  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      console.log('🚀 [FRONTEND] Starting script generation...');
      
      if (localScript?.sections && localScript.sections.length > 0) {
        const confirmed = confirm('Regenerate and overwrite existing sections?');
        if (!confirmed) return;
      }

      // Gather selected content
      const selectedNodes = nodes.filter(node => selectedSources.has(node.id));
      console.log('📊 Selected nodes for generation:', {
        total: selectedNodes.length,
        productSpecs: selectedNodes.filter(n => n.type === 'productSpec').length,
        ads: selectedNodes.filter(n => n.type === 'ad').length,
        instructions: selectedNodes.filter(n => n.type === 'instructions').length
      });
      
      const inputs = {
        product_specs: selectedNodes
          .filter(node => node.type === 'productSpec')
          .map(node => node.data?.content || '')
          .join('\n\n'),
        ad_refs: selectedNodes
          .filter(node => node.type === 'ad')
          .map(node => node.data?.url || '')
          .filter(Boolean),
        extra_instructions: selectedNodes
          .filter(node => node.type === 'instructions')
          .map(node => node.data?.content || '')
          .join('\n\n')
      };

      console.log('📝 Input content summary:', {
        productSpecsLength: inputs.product_specs.length,
        adRefsCount: inputs.ad_refs.length,
        extraInstructionsLength: inputs.extra_instructions.length
      });

      // Get ad analyses for selected ads
      const selectedAdAnalyses: Record<string, any> = {};
      selectedNodes
        .filter(node => node.type === 'ad' && node.data?.url && adAnalyses[node.id])
        .forEach(node => {
          selectedAdAnalyses[node.data.url] = adAnalyses[node.id];
        });
      
      console.log('🎬 Ad analyses available:', Object.keys(selectedAdAnalyses).length);

      // Detailed logging of what's being sent to the LLM
      const requestPayload = { 
        inputs: inputs,
        adAnalyses: selectedAdAnalyses 
      };
      
      console.log('📋 [DETAILED] Script Generation Request Payload:');
      console.log('=====================================');
      console.log('📝 Product Specs:', {
        length: inputs.product_specs.length,
        preview: inputs.product_specs.substring(0, 200) + (inputs.product_specs.length > 200 ? '...' : ''),
        fullContent: inputs.product_specs
      });
      console.log('🎥 Video References:', inputs.ad_refs);
      console.log('📌 Extra Instructions:', {
        length: inputs.extra_instructions.length,
        preview: inputs.extra_instructions.substring(0, 200) + (inputs.extra_instructions.length > 200 ? '...' : ''),
        fullContent: inputs.extra_instructions
      });
      console.log('🎬 Ad Analyses:', selectedAdAnalyses);
      console.log('=====================================');
      console.log('📦 Full Request Payload:', requestPayload);
      console.log('=====================================');

      console.log('📡 Making API call to /api/generateScript...');
      const response = await fetch('/api/generateScript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      console.log('✅ [FRONTEND] Script generation response received:', {
        mock: result.mock,
        hasScript: !!result.script,
        format: 'sections',
        count: result.script?.sections?.length || 0
      });
      
      // Check for new sections format
      const hasValidScript = result?.script && result.script.sections && result.script.sections.length > 0;
      
      if (hasValidScript) {
        console.log('💾 [FRONTEND] Saving generated script...');
        saveScript(result.script);
        console.log('✅ [FRONTEND] Script generation complete!');
      } else {
        console.error('❌ [FRONTEND] No script sections in response');
        alert('Failed to generate script');
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Script generation failed:', error);
      alert('Error generating script. Please check your connection.');
    } finally {
      setIsGenerating(false);
    }
  };

  const applyActions = (actions: any[]) => {
    if (!localScript) return;
    
    let sections = [...localScript.sections];
    
    for (const action of actions) {
      console.log('Applying section action:', action);
      
      if (action.type === 'rewrite_section') {
        sections = sections.map(s => {
          if (s.id === action.targetId) {
            const updates: any = {};
            if (action.script_text !== undefined) updates.script_text = action.script_text;
            if (action.shots !== undefined) updates.shots = action.shots;
            return { ...s, ...updates };
          }
          return s;
        });
      } else if (action.type === 'add_section') {
        const idx = sections.findIndex(s => s.id === action.targetId);
        const newSection = action.section || {
          id: `section_${Date.now()}`,
          type: 'BODY',
          script_text: '',
          video_type: 'B_ROLL',
          shots: []
        };
        if (idx >= 0) {
          if (action.position === 'before') {
            sections.splice(idx, 0, newSection);
          } else {
            sections.splice(idx + 1, 0, newSection);
          }
        } else {
          sections.push(newSection);
        }
      } else if (action.type === 'remove_section') {
        sections = sections.filter(s => s.id !== action.targetId);
      } else if (action.type === 'move_section') {
        const fromIdx = sections.findIndex(s => s.id === action.targetId);
        const toIdx = sections.findIndex(s => s.id === action.refId);
        if (fromIdx >= 0 && toIdx >= 0) {
          const [movedSection] = sections.splice(fromIdx, 1);
          const insertAt = action.position === 'before' ? toIdx : toIdx + 1;
          sections.splice(insertAt, 0, movedSection);
        }
      } else if (action.type === 'rewrite_sections_batch') {
        const edits = Array.isArray(action.edits) ? action.edits : [];
        for (const edit of edits) {
          sections = sections.map(s => {
            if (s.id === edit.targetId) {
              const updates: any = {};
              if (edit.script_text !== undefined) updates.script_text = edit.script_text;
              if (edit.shots !== undefined) updates.shots = edit.shots;
              return { ...s, ...updates };
            }
            return s;
          });
        }
      } else if (action.type === 'add_sections_batch') {
        const items = Array.isArray(action.items) ? action.items : [];
        for (const item of items) {
          const idx = sections.findIndex(s => s.id === item.targetId);
          const newSection = item.section || {
            id: `section_${Date.now()}_${Math.random()}`,
            type: 'BODY',
            script_text: '',
            video_type: 'B_ROLL',
            shots: []
          };
          if (idx >= 0) {
            if (item.position === 'before') {
              sections.splice(idx, 0, newSection);
            } else {
              sections.splice(idx + 1, 0, newSection);
            }
          } else {
            sections.push(newSection);
          }
        }
      } else if (action.type === 'remove_sections_batch') {
        const idsToRemove = new Set(action.targetIds || []);
        sections = sections.filter(s => !idsToRemove.has(s.id));
      } else if (action.type === 'move_sections_batch') {
        const moves = Array.isArray(action.moves) ? action.moves : [];
        for (const move of moves) {
          const fromIdx = sections.findIndex(s => s.id === move.targetId);
          const toIdx = sections.findIndex(s => s.id === move.refId);
          if (fromIdx >= 0 && toIdx >= 0) {
            const [movedSection] = sections.splice(fromIdx, 1);
            const insertAt = move.position === 'before' ? toIdx : toIdx + 1;
            sections.splice(insertAt, 0, movedSection);
          }
        }
      }
    }
    
    console.log('Updated sections after applying actions:', sections);
    saveScript({ ...localScript, sections });
  };

  const handleAnalyzeAd = async (nodeId: string, url: string) => {
    if (!url.trim()) {
      alert('Please enter a URL first');
      return;
    }

    try {
      setAnalyzingAds(prev => new Set(prev).add(nodeId));
      
      // First check if we already have this URL analyzed locally
      const existingAnalysis = adAnalyses[nodeId];
      if (existingAnalysis && existingAnalysis.url === url) {
        console.log('✅ Using local cached ad analysis for', url);
        setSelectedSources(prev => new Set(prev).add(nodeId));
        return; // Return the existing analysis, skip all processing
      }

      // Check if ANY other node has analyzed this same URL
      const existingUrlAnalysis = Object.values(adAnalyses).find(analysis => analysis.url === url);
      if (existingUrlAnalysis) {
        console.log('✅ Found existing analysis for same URL, reusing for', url);
        if (onAdAnalyzed) {
          onAdAnalyzed(nodeId, { ...existingUrlAnalysis, cached: true });
        }
        setSelectedSources(prev => new Set(prev).add(nodeId));
        return; // Reuse analysis from different node
      }

      // Check localStorage for any cached analysis of this URL
      try {
        const localStorageAds = AdStorage.loadProcessedAds();
        const cachedAnalysisEntry = Object.entries(localStorageAds).find(([_, analysis]) => 
          analysis && analysis.url === url
        );
        
        if (cachedAnalysisEntry) {
          const [_, cachedAnalysis] = cachedAnalysisEntry;
          console.log('✅ Using localStorage cached analysis for', url);
          if (onAdAnalyzed) {
            onAdAnalyzed(nodeId, { ...cachedAnalysis, cached: true });
          }
          setSelectedSources(prev => new Set(prev).add(nodeId));
          return; // Return cached analysis from localStorage
        }
      } catch (localStorageError) {
        console.log('LocalStorage check failed, proceeding with fresh analysis');
      }

      // No cached version found, analyze fresh
      console.log('🔄 Processing new ad analysis for', url);
      const response = await fetch('/api/analyzeAd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      // Save analysis through parent callback
      if (onAdAnalyzed) {
        onAdAnalyzed(nodeId, { ...(result.analysis || result), url, cached: false });
      }
      
      // Auto-select the ad after analysis
      setSelectedSources(prev => new Set(prev).add(nodeId));
      
    } catch (error) {
      console.error('Ad analysis failed:', error);
      alert('Failed to analyze ad. Please check the URL and try again.');
    } finally {
      setAnalyzingAds(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  const handleFileUpload = async (files: FileList, nodeId: string) => {
    console.log(`📁 Starting file upload for node ${nodeId}:`, Array.from(files).map(f => f.name));
    
    const existingNode = nodes.find(n => n.id === nodeId);
    const existingFiles = existingNode?.data?.uploadedFiles || [];
    const extractedTexts = existingNode?.data?.extractedTexts || [];
    
    const newFiles: Array<{
      id: string;
      name: string;
      size: number;
      type: string;
      uploadedAt: string;
      success: boolean;
      error?: string;
      pageCount?: number;
    }> = [];
    const newExtractedTexts: string[] = [];
    
    for (const file of Array.from(files)) {
      console.log(`🔄 Processing file: ${file.name} (${file.type}, ${(file.size/1024).toFixed(1)}KB)`);
      
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const result = await extractTextFromFile(file);
      
      const fileInfo = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        success: result.success,
        error: result.error,
        pageCount: result.metadata?.pageCount
      };
      
      newFiles.push(fileInfo);
      
      if (result.success) {
        // Store the raw extracted text separately for AI processing
        newExtractedTexts.push(result.content);
        console.log(`✅ Successfully processed: ${file.name} - ${result.content.length} characters extracted`);
      } else {
        console.warn(`⚠️ Failed to process: ${file.name} - ${result.error}`);
      }
    }
    
    if (onUpdateNode) {
      // Combine all extracted texts for AI processing
      const allExtractedTexts = [...extractedTexts, ...newExtractedTexts];
      const combinedContent = allExtractedTexts.join('\n\n');
      
      console.log(`💾 Updating node ${nodeId} with ${newFiles.length} new files`);
      console.log(`📊 File processing summary:`, {
        totalFiles: files.length,
        successful: newFiles.filter(f => f.success).length,
        failed: newFiles.filter(f => !f.success).length,
        totalContentLength: combinedContent.length
      });
      
      onUpdateNode(nodeId, {
        data: {
          ...existingNode?.data,
          content: combinedContent, // Combined extracted text for AI
          uploadedFiles: [...existingFiles, ...newFiles], // Individual file metadata for UI
          extractedTexts: allExtractedTexts // Raw extracted texts
        }
      });
    }
  };

  const handleDeleteFile = (nodeId: string, fileId: string) => {
    const existingNode = nodes.find(n => n.id === nodeId);
    if (!existingNode || !onUpdateNode) return;
    
    const updatedFiles = (existingNode.data?.uploadedFiles || []).filter((f: any) => f.id !== fileId);
    const fileIndex = (existingNode.data?.uploadedFiles || []).findIndex((f: any) => f.id === fileId);
    const updatedExtractedTexts = [...(existingNode.data?.extractedTexts || [])];
    
    if (fileIndex >= 0) {
      updatedExtractedTexts.splice(fileIndex, 1);
    }
    
    const combinedContent = updatedExtractedTexts.join('\n\n');
    
    onUpdateNode(nodeId, {
      data: {
        ...existingNode.data,
        content: combinedContent,
        uploadedFiles: updatedFiles,
        extractedTexts: updatedExtractedTexts
      }
    });
    
    console.log(`🗑️ Deleted file ${fileId} from node ${nodeId}`);
  };

  const handleFilePreview = (file: any, nodeId: string) => {
    const existingNode = nodes.find(n => n.id === nodeId);
    if (!existingNode) return;

    const fileIndex = (existingNode.data?.uploadedFiles || []).findIndex((f: any) => f.id === file.id);
    const content = existingNode.data?.extractedTexts?.[fileIndex] || 'No content available';
    
    setFilePreview({ show: true, file, content });
    console.log(`👁️ Previewing file: ${file.name}`);
  };

  const closeFilePreview = () => {
    setFilePreview(null);
  };

  const handleAddProductSpec = () => {
    if (onAddNode) {
      onAddNode('productSpec', {
        content: '',
        documents: []
      });
    }
  };

  const handleAddAd = () => {
    if (onAddNode) {
      onAddNode('ad', {
        title: 'Video Reference',
        url: '',
        status: 'draft'
      });
    }
  };

  const handleAddInstructions = () => {
    if (onAddNode) {
      onAddNode('instructions', {
        content: 'Add your instructions here...'
      });
    }
  };

  const selectedCount = selectedSources.size;
  const hasSelectedSources = selectedCount > 0;

  // Helper function to check if an ad is analyzed
  const isAdAnalyzed = (nodeId: string, node: any) => {
    // Check both the adAnalyses cache and the node's isAnalyzed flag
    return adAnalyses[nodeId] || node?.data?.isAnalyzed;
  };

  // Helper function to get embeddable video URL
  const getEmbeddableUrl = (url: string): string | null => {
    try {
      // Instagram posts and reels - NOTE: Instagram blocks iframe embedding for most content
      if (url.includes('instagram.com/p/') || url.includes('instagram.com/reel/') || url.includes('instagram.com/reels/')) {
        const postId = url.match(/\/p\/([^\/\?]+)/)?.[1] || 
                      url.match(/\/reel\/([^\/\?]+)/)?.[1] || 
                      url.match(/\/reels\/([^\/\?]+)/)?.[1];
        if (postId) {
          // Try the embed URL, but it will likely be blocked by Instagram's X-Frame-Options
          return `https://www.instagram.com/p/${postId}/embed/`;
        }
      }
      
      // TikTok videos
      if (url.includes('tiktok.com') && url.includes('/video/')) {
        const videoId = url.match(/\/video\/(\d+)/)?.[1];
        if (videoId) {
          return `https://www.tiktok.com/embed/v2/${videoId}`;
        }
      }
      
      // YouTube videos (shorts or regular)
      if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/shorts/')) {
        let videoId = '';
        if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/watch')) {
          videoId = url.split('v=')[1]?.split('&')[0] || '';
        } else if (url.includes('youtube.com/shorts/')) {
          videoId = url.split('shorts/')[1].split('?')[0];
        }
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  };


  const getWorkspaceClasses = () => {
    if (isExperimental) {
      return 'h-full bg-gradient-to-br from-black via-gray-900 to-yellow-900/20 text-yellow-100';
    } else if (isDarkMode) {
      return 'h-full bg-gradient-to-br from-black via-gray-900 to-black text-purple-100';
    } else {
      return 'h-full bg-gradient-to-br from-gray-100 via-white to-gray-50 text-gray-900';
    }
  };

  // Resize logic for chat panel
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 300;
      const maxWidth = 600;
      
      setChatWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className={`${getWorkspaceClasses()} flex relative`}
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
        backgroundPosition: '0 0, 25px 25px'
      }}
    >
      {/* Left Sidebar - Content Sources */}
      <div className={`w-80 transition-all duration-300 border-r flex-shrink-0 flex flex-col ${
        isDarkMode ? 'bg-black border-purple-500/20' : 
        isExperimental ? 'bg-black border-yellow-400/30' : 
        'bg-gray-50 border-gray-200'
      }`}>
        <div className={`flex-1 overflow-y-auto p-4 ${
          isDarkMode ? 'dark-scrollbar' :
          isExperimental ? 'experimental-scrollbar' :
          'custom-scrollbar'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`font-semibold ${
              isDarkMode ? 'text-purple-100' : 
              isExperimental ? 'text-yellow-100' : 
              'text-gray-900'
            }`}>
              Content Sources
            </h2>
            
            {/* Generate Button - only show when no script exists */}
            {(!localScript || !localScript.sections || localScript.sections.length === 0) && (
              <button
                onClick={handleGenerate}
                disabled={!hasSelectedSources || isGenerating}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  hasSelectedSources && !isGenerating
                    ? isDarkMode ? 'bg-purple-500 hover:bg-purple-600 text-white' :
                      isExperimental ? 'bg-yellow-500 hover:bg-yellow-600 text-black' :
                      'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title="Generate new script using AI"
              >
                <Sparkles size={14} />
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            )}
          </div>
          
          {/* Context Indicator */}
          {selectedCount > 0 && (
            <div className={`mb-4 p-2 rounded text-sm ${
              isDarkMode ? 'bg-purple-500/20 text-purple-100' :
              isExperimental ? 'bg-yellow-400/20 text-yellow-100' :
              'bg-blue-50 text-blue-700'
            }`}>
              Context: {selectedCount} sources selected
            </div>
          )}
          
          <div className="space-y-4">
            {/* Product Specs Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${
                  isDarkMode ? 'text-purple-300' : 
                  isExperimental ? 'text-yellow-300' : 
                  'text-gray-700'
                }`}>
                  Product Specs ({productSpecs.length})
                </h3>
                <button
                  onClick={handleAddProductSpec}
                  className={`p-1 rounded transition-colors ${
                    isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' : 
                    isExperimental ? 'hover:bg-yellow-400/20 text-yellow-400' : 
                    'hover:bg-gray-200 text-gray-600'
                  }`}
                  title="Add Product Spec"
                >
                  <Plus size={14} />
                </button>
              </div>
              
              {productSpecs.length === 0 ? (
                <p className={`text-xs ${
                  isDarkMode ? 'text-purple-400/60' : 
                  isExperimental ? 'text-yellow-400/60' : 
                  'text-gray-500'
                }`}>
                  No product specs
                </p>
              ) : (
                productSpecs.map(spec => (
                  <div 
                    key={spec.id} 
                    className={`mb-2 border rounded cursor-pointer transition-all ${
                      selectedSources.has(spec.id)
                        ? isDarkMode ? 'bg-purple-500/20 border-purple-400 ring-1 ring-purple-400' :
                          isExperimental ? 'bg-yellow-400/20 border-yellow-400 ring-1 ring-yellow-400' :
                          'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                        : isDarkMode ? 'bg-purple-500/10 border-purple-500/40 hover:bg-purple-500/15' : 
                          isExperimental ? 'bg-yellow-400/10 border-yellow-400/20 hover:bg-yellow-400/15' : 
                          'bg-gray-100 border-gray-200 hover:bg-gray-150'
                    }`}
                    onClick={(e) => toggleSourceSelection(spec.id, 'productSpec', e)}
                    onContextMenu={(e) => handleContextMenu(e, spec.id, 'productSpec')}
                    title="Right-click for options"
                  >
                    {/* Card Header */}
                    <div className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCard(spec.id);
                          }}
                          className="p-1 hover:bg-black/5 rounded"
                        >
                          {expandedCards.has(spec.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        
                        <div className="flex-1">
                          <div className="text-sm font-medium">Product Spec</div>
                          <div className="text-xs opacity-75">
                            {spec.data?.uploadedFiles?.length ? 
                              `${spec.data.uploadedFiles.length} file${spec.data.uploadedFiles.length !== 1 ? 's' : ''}` : 
                              'No files uploaded'
                            }
                          </div>
                        </div>
                        
                        {selectedSources.has(spec.id) && (
                          <div className={`p-1 rounded ${
                            isDarkMode ? 'bg-purple-400 text-white' :
                            isExperimental ? 'bg-yellow-400 text-black' :
                            'bg-blue-500 text-white'
                          }`}>
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {expandedCards.has(spec.id) && (
                      <div className="px-2 pb-2 border-t border-black/10" onClick={(e) => e.stopPropagation()}>
                        <div className="pt-2 space-y-2">
                          {/* Upload Button */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => fileInputRefs.current[spec.id]?.click()}
                              className={`flex items-center gap-1 px-2 py-1 text-xs border rounded ${
                                isDarkMode ? 'border-purple-500/40 hover:bg-purple-500/10 text-purple-300' :
                                isExperimental ? 'border-yellow-400/30 hover:bg-yellow-400/10 text-yellow-300' :
                                'border-gray-300 hover:bg-gray-100 text-gray-600'
                              }`}
                            >
                              <Upload size={10} />
                              Add Files
                            </button>
                            
                            {spec.data?.uploadedFiles?.length > 0 && (
                              <button
                                onClick={() => onUpdateNode?.(spec.id, { 
                                  data: { ...spec.data, uploadedFiles: [], extractedTexts: [], content: '' } 
                                })}
                                className="px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded"
                              >
                                Clear All
                              </button>
                            )}
                          </div>
                          
                          <input
                            ref={el => fileInputRefs.current[spec.id] = el}
                            type="file"
                            hidden
                            multiple
                            accept=".txt,.pdf,.csv,.json,.md,.markdown"
                            onChange={e => e.target.files && handleFileUpload(e.target.files, spec.id)}
                          />
                          
                          {/* File Cards */}
                          {spec.data?.uploadedFiles?.length > 0 && (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {spec.data.uploadedFiles.map((file: any) => (
                                <div
                                  key={file.id}
                                  className={`p-2 border rounded text-xs cursor-pointer transition-colors hover:bg-opacity-75 ${
                                    file.success
                                      ? isDarkMode ? 'bg-purple-500/5 border-purple-500/40 hover:bg-purple-500/10' :
                                        isExperimental ? 'bg-yellow-400/5 border-yellow-400/20 hover:bg-yellow-400/10' :
                                        'bg-green-50 border-green-200 hover:bg-green-100'
                                      : isDarkMode ? 'bg-red-500/5 border-red-500/20' :
                                        isExperimental ? 'bg-red-400/5 border-red-400/20' :
                                        'bg-red-50 border-red-200'
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (file.success) {
                                      handleFilePreview(file, spec.id);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirm(`Delete ${file.name}?`)) {
                                      handleDeleteFile(spec.id, file.id);
                                    }
                                  }}
                                  title={file.success ? "Click to preview, right-click to delete" : "Processing failed"}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium truncate">{file.name}</div>
                                      <div className={`flex items-center gap-1 text-xs ${
                                        isDarkMode ? 'text-purple-400/70' :
                                        isExperimental ? 'text-yellow-400/70' :
                                        'text-gray-500'
                                      }`}>
                                        <span>{(file.size / 1024).toFixed(1)}KB</span>
                                        {file.pageCount && <span>• {file.pageCount} pages</span>}
                                        <span>• {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                    <div className={`ml-2 px-1 py-0.5 rounded text-xs ${
                                      file.success 
                                        ? isDarkMode ? 'bg-purple-500/20 text-purple-300' :
                                          isExperimental ? 'bg-yellow-400/20 text-yellow-600' :
                                          'bg-green-100 text-green-700'
                                        : isDarkMode ? 'bg-red-500/20 text-red-300' :
                                          isExperimental ? 'bg-red-400/20 text-red-600' :
                                          'bg-red-100 text-red-700'
                                    }`}>
                                      {file.success ? 'Processed' : 'Failed'}
                                    </div>
                                  </div>
                                  {file.error && (
                                    <div className="mt-1 text-xs text-red-400">{file.error}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Ads Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${
                  isDarkMode ? 'text-purple-300' : 
                  isExperimental ? 'text-yellow-300' : 
                  'text-gray-700'
                }`}>
                  Ads ({ads.length}/6)
                </h3>
                <button
                  onClick={handleAddAd}
                  disabled={ads.length >= 6}
                  className={`p-1 rounded transition-colors ${
                    ads.length >= 6
                      ? 'opacity-30 cursor-not-allowed text-gray-400'
                      : isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' : 
                        isExperimental ? 'hover:bg-yellow-400/20 text-yellow-400' : 
                        'hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  <Plus size={14} />
                </button>
              </div>
              
              {ads.length === 0 ? (
                <p className={`text-xs ${
                  isDarkMode ? 'text-purple-400/60' : 
                  isExperimental ? 'text-yellow-400/60' : 
                  'text-gray-500'
                }`}>
                  No ads
                </p>
              ) : (
                ads.map(ad => {
                  const isAnalyzed = adAnalyses[ad.id];
                  const isAnalyzing = analyzingAds.has(ad.id);
                  const canSelect = isAnalyzed && !isAnalyzing;
                  
                  return (
                    <div 
                      key={ad.id} 
                      className={`mb-2 border rounded transition-all cursor-pointer ${
                        selectedSources.has(ad.id)
                          ? isDarkMode ? 'bg-purple-500/20 border-purple-400 ring-1 ring-purple-400' :
                            isExperimental ? 'bg-yellow-400/20 border-yellow-400 ring-1 ring-yellow-400' :
                            'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                          : isDarkMode ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15' : 
                            isExperimental ? 'bg-yellow-400/10 border-yellow-400/20 hover:bg-yellow-400/15' : 
                            'bg-gray-100 border-gray-200 hover:bg-gray-150'
                      }`}
                      onClick={(e) => toggleSourceSelection(ad.id, 'ad', e)}
                      onContextMenu={(e) => handleContextMenu(e, ad.id, 'ad')}
                      title="Right-click for options"
                    >
                      {/* Card Header */}
                      <div className="p-2">
                        {!ad.data?.url || !isAnalyzed ? (
                          // Not analyzed - show card header with expand option
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCard(ad.id);
                                }}
                                className="p-1 hover:bg-black/5 rounded"
                              >
                                {expandedCards.has(ad.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              </button>
                              
                              <div className="flex-1">
                                <div className="text-sm font-medium">Video Reference</div>
                                <div className={`text-xs ${isDarkMode ? 'text-orange-400' : isExperimental ? 'text-orange-400' : 'text-orange-600'}`}>
                                  Not analyzed yet
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Analyzed - show selectable card
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCard(ad.id);
                                  }}
                                  className="p-1 hover:bg-black/5 rounded"
                                >
                                  {expandedCards.has(ad.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                                
                                <div className="flex-1">
                                  <div className="text-sm font-medium">Video Reference</div>
                                  <div className={`text-xs flex items-center gap-1 ${
                                    isDarkMode ? 'text-green-400' :
                                    isExperimental ? 'text-green-400' :
                                    'text-green-600'
                                  }`}>
                                    <Check size={10} />
                                    Analyzed
                                  </div>
                                </div>
                                
                                {selectedSources.has(ad.id) && (
                                  <div className={`p-1 rounded ${
                                    isDarkMode ? 'bg-purple-400 text-white' :
                                    isExperimental ? 'bg-yellow-400 text-black' :
                                    'bg-blue-500 text-white'
                                  }`}>
                                    <Check size={12} />
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            
                            {/* Expanded content for analyzed ads */}
                            {expandedCards.has(ad.id) && (
                              <div className="px-2 pb-2 border-t border-black/10 mt-2" onClick={(e) => e.stopPropagation()}>
                                <div className="pt-2 space-y-3">
                                  {/* Video Embed */}
                                  {ad.data?.url && getEmbeddableUrl(ad.data.url) && (
                                    <div className="relative bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                                      <iframe
                                        src={getEmbeddableUrl(ad.data.url) || ''}
                                        className="absolute inset-0 w-full h-full"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title="Ad Video"
                                        onError={(e) => {
                                          console.log('Iframe failed to load, likely blocked by platform');
                                          // Could show fallback UI here
                                        }}
                                      />
                                      {/* Fallback for when iframe is blocked */}
                                      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <div className="text-center p-4">
                                          <div className="text-white text-sm mb-2">Video preview not available</div>
                                          <a 
                                            href={ad.data.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 text-xs underline"
                                          >
                                            View on {ad.data.url.includes('instagram') ? 'Instagram' : 
                                                    ad.data.url.includes('tiktok') ? 'TikTok' : 'Platform'}
                                          </a>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Analysis Summary */}
                                  {isAdAnalyzed(ad.id, ad) && (
                                    <div className="text-xs opacity-75">
                                      <div className="font-medium mb-1">Analysis Summary:</div>
                                      <div className="text-xs">
                                        {adAnalyses[ad.id]?.chunks?.length || 'N/A'} frames analyzed
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* URL for non-embeddable content */}
                                  {ad.data?.url && !getEmbeddableUrl(ad.data.url) && (
                                    <div className="text-xs opacity-75">
                                      <div className="font-medium mb-1">URL:</div>
                                      <div className="break-all">{ad.data.url}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Expanded content for unanalyzed ads */}
                        {(!ad.data?.url || !isAnalyzed) && expandedCards.has(ad.id) && (
                          <div className="px-2 pb-2 border-t border-black/10 mt-2" onClick={(e) => e.stopPropagation()}>
                            <div className="pt-2 space-y-2">
                              <input
                                value={ad.data?.url || ''}
                                onChange={e => onUpdateNode?.(ad.id, {
                                  data: { ...ad.data, url: e.target.value }
                                })}
                                placeholder="Paste ad URL (Instagram, TikTok, YouTube)..."
                                className={`w-full p-2 text-xs border rounded ${
                                  isDarkMode ? 'bg-black border-purple-500/40 text-purple-100 placeholder-purple-400/50' :
                                  isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100 placeholder-yellow-400/50' :
                                  'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAnalyzeAd(ad.id, ad.data?.url || '')}
                                  disabled={!ad.data?.url?.trim() || isAnalyzing}
                                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded font-medium transition-colors ${
                                    ad.data?.url?.trim() && !isAnalyzing
                                      ? isDarkMode ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30' :
                                        isExperimental ? 'bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/30' :
                                        'bg-blue-500 hover:bg-blue-600 text-white'
                                      : isDarkMode ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/30' :
                                        isExperimental ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/30' :
                                        'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  }`}
                                >
                                  {adAnalyses[ad.id]?.cached ? <Shield size={10} /> : <Sparkles size={10} />}
                                  {isAnalyzing ? 'Analyzing...' : adAnalyses[ad.id]?.cached ? 'Cached' : 'Analyze Video'}
                                </button>
                                
                                {ad.data?.url && (
                                  <a
                                    href={ad.data.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`p-1.5 border rounded ${
                                      isDarkMode ? 'border-purple-500/20 text-purple-300 hover:bg-purple-500/10' :
                                      isExperimental ? 'border-yellow-400/30 text-yellow-300 hover:bg-yellow-400/10' :
                                      'border-gray-300 text-gray-600 hover:bg-gray-100'
                                    }`}
                                  >
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Instructions Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${
                  isDarkMode ? 'text-purple-300' : 
                  isExperimental ? 'text-yellow-300' : 
                  'text-gray-700'
                }`}>
                  Instructions ({instructions.length}/4)
                </h3>
                <button
                  onClick={handleAddInstructions}
                  disabled={instructions.length >= 4}
                  className={`p-1 rounded transition-colors ${
                    instructions.length >= 4
                      ? 'opacity-30 cursor-not-allowed text-gray-400'
                      : isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' : 
                        isExperimental ? 'hover:bg-yellow-400/20 text-yellow-400' : 
                        'hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  <Plus size={14} />
                </button>
              </div>
              
              {instructions.length === 0 ? (
                <p className={`text-xs ${
                  isDarkMode ? 'text-purple-400/60' : 
                  isExperimental ? 'text-yellow-400/60' : 
                  'text-gray-500'
                }`}>
                  No instructions
                </p>
              ) : (
                instructions.map(instruction => (
                  <div 
                    key={instruction.id} 
                    className={`mb-2 border rounded cursor-pointer transition-all ${
                      selectedSources.has(instruction.id)
                        ? isDarkMode ? 'bg-purple-500/20 border-purple-400 ring-1 ring-purple-400' :
                          isExperimental ? 'bg-yellow-400/20 border-yellow-400 ring-1 ring-yellow-400' :
                          'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                        : isDarkMode ? 'bg-purple-500/10 border-purple-500/40 hover:bg-purple-500/15' : 
                          isExperimental ? 'bg-yellow-400/10 border-yellow-400/20 hover:bg-yellow-400/15' : 
                          'bg-gray-100 border-gray-200 hover:bg-gray-150'
                    }`}
                    onClick={(e) => toggleSourceSelection(instruction.id, 'instructions', e)}
                    onContextMenu={(e) => handleContextMenu(e, instruction.id, 'instructions')}
                    title="Right-click for options"
                  >
                    {/* Card Header */}
                    <div className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCard(instruction.id);
                          }}
                          className="p-1 hover:bg-black/5 rounded"
                        >
                          {expandedCards.has(instruction.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        
                        <div className="flex-1">
                          <div className="text-sm font-medium">Instructions</div>
                          <div className="text-xs opacity-75 truncate">
                            {instruction.data?.content ? 
                              instruction.data.content.slice(0, 30) + '...' : 
                              'No content'
                            }
                          </div>
                        </div>
                        
                        {selectedSources.has(instruction.id) && (
                          <div className={`p-1 rounded ${
                            isDarkMode ? 'bg-purple-400 text-white' :
                            isExperimental ? 'bg-yellow-400 text-black' :
                            'bg-blue-500 text-white'
                          }`}>
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Content */}
                    {expandedCards.has(instruction.id) && (
                      <div className="px-2 pb-2 border-t border-black/10" onClick={(e) => e.stopPropagation()}>
                        <div className="pt-2">
                          <textarea
                            value={instruction.data?.content || ''}
                            onChange={e => onUpdateNode?.(instruction.id, {
                              data: { ...instruction.data, content: e.target.value }
                            })}
                            placeholder="Add instructions for tone, target audience, requirements..."
                            className={`w-full h-20 p-2 text-xs border rounded resize-none ${
                              isDarkMode ? 'bg-black border-purple-500/40 text-purple-100' :
                              isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100' :
                              'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Script Editor */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`px-6 py-3 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-black border-purple-500/20' : 
          isExperimental ? 'bg-black border-yellow-400/30' : 
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-4">
            <h1 className={`text-lg font-semibold ${
              isDarkMode ? 'text-purple-100' : 
              isExperimental ? 'text-yellow-100' : 
              'text-gray-900'
            }`}>
              Script Editor
            </h1>
            
            {localScript && (
              <div className="flex items-center gap-2">
                <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className={`p-2 rounded transition-colors ${
                    undoStack.length > 0
                      ? isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' :
                        isExperimental ? 'hover:bg-yellow-400/20 text-yellow-400' :
                        'hover:bg-gray-200 text-gray-600'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw size={16} />
                </button>
                
                <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className={`p-2 rounded transition-colors ${
                    redoStack.length > 0
                      ? isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' :
                        isExperimental ? 'hover:bg-yellow-400/20 text-yellow-400' :
                        'hover:bg-gray-200 text-gray-600'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <RotateCw size={16} />
                </button>
              </div>
            )}
          </div>
          
          {/* Delete Script Button */}
          {localScript && localScript.sections && localScript.sections.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete the generated script? This action cannot be undone.')) {
                  if (onScriptClear) {
                    onScriptClear();
                  }
                  setUndoStack([]);
                  setRedoStack([]);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode ? 'bg-red-500 hover:bg-red-600 text-white' :
                isExperimental ? 'bg-red-500 hover:bg-red-600 text-white' :
                'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <Trash2 size={14} />
              Delete Script
            </button>
          )}
          
          <button
            onClick={onToggleChat}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              chatExpanded
                ? isDarkMode ? 'bg-purple-500/20 text-purple-100 border border-purple-400/30' :
                  isExperimental ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' :
                  'bg-blue-500 text-white'
                : isDarkMode ? 'text-purple-400/70 hover:text-purple-200 hover:bg-purple-500/10' :
                  isExperimental ? 'text-yellow-400/60 hover:text-yellow-300 hover:bg-yellow-400/10' :
                  'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <MessageSquare size={16} />
            <span className="text-sm">AI Chat</span>
          </button>
        </div>

        {/* Script Content */}
        <div className={`flex-1 p-6 overflow-y-auto ${
          isDarkMode ? 'bg-black dark-scrollbar' :
          isExperimental ? 'bg-black experimental-scrollbar' :
          'bg-gray-50 custom-scrollbar'
        }`}>
          {!localScript || localScript.sections.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText size={48} className={`mx-auto mb-4 ${
                  isDarkMode ? 'text-purple-400/50' :
                  isExperimental ? 'text-yellow-400/50' :
                  'text-gray-400'
                }`} />
                <h3 className={`text-lg font-medium mb-2 ${
                  isDarkMode ? 'text-purple-200' :
                  isExperimental ? 'text-yellow-200' :
                  'text-gray-600'
                }`}>
                  No script generated yet
                </h3>
                <p className={`text-sm ${
                  isDarkMode ? 'text-purple-400/60' :
                  isExperimental ? 'text-yellow-400/60' :
                  'text-gray-500'
                }`}>
                  Select content sources and click Generate to create a script
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {localScript.sections.map((section, index) => (
                <div key={section.id} className={`border-2 rounded-lg p-4 ${
                  isDarkMode ? 'bg-black border-purple-400 shadow-lg shadow-purple-500/40' :
                  isExperimental ? 'bg-black border-yellow-400 shadow-lg shadow-yellow-400/40' :
                  'bg-white border-blue-400 shadow-lg shadow-blue-400/20'
                }`} style={{
                  boxShadow: isDarkMode ? '0 0 20px rgba(147, 51, 234, 0.4), 0 0 40px rgba(147, 51, 234, 0.2)' :
                    isExperimental ? '0 0 20px rgba(251, 191, 36, 0.4), 0 0 40px rgba(251, 191, 36, 0.2)' :
                    '0 0 12px rgba(96, 165, 250, 0.2), 0 0 24px rgba(96, 165, 250, 0.1)'
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        section.type === 'HOOK' 
                          ? 'bg-green-100 text-green-800'
                          : section.type === 'BODY'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {section.type}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        section.video_type === 'JUMP_CUTS'
                          ? 'bg-orange-100 text-orange-800'
                          : section.video_type === 'B_ROLL'
                          ? 'bg-cyan-100 text-cyan-800'
                          : section.video_type === 'A_ROLL_WITH_OVERLAY'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-pink-100 text-pink-800'
                      }`}>
                        {section.video_type}
                      </span>
                      <span className={`text-xs ${
                        isDarkMode ? 'text-purple-400/60' :
                        isExperimental ? 'text-yellow-400/60' :
                        'text-gray-500'
                      }`}>
                        {(() => {
                          const regularShots = section.shots?.length || 0;
                          const overlayShots = section.overlay_shots?.length || 0;
                          const baseLayer = section.base_layer ? 1 : 0;
                          const totalShots = regularShots + overlayShots + baseLayer;
                          return `${totalShots} shots`;
                        })()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {index > 0 && (
                        <button
                          onClick={() => {
                            const sections = [...localScript.sections];
                            [sections[index], sections[index - 1]] = [sections[index - 1], sections[index]];
                            saveScript({ ...localScript, sections });
                          }}
                          className={`p-1 rounded hover:bg-gray-200 ${
                            isDarkMode ? 'text-purple-400 hover:bg-purple-500/20' :
                            isExperimental ? 'text-yellow-400 hover:bg-yellow-400/20' :
                            'text-gray-600'
                          }`}
                        >
                          <ArrowUp size={14} />
                        </button>
                      )}
                      
                      {index < localScript.sections.length - 1 && (
                        <button
                          onClick={() => {
                            const sections = [...localScript.sections];
                            [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
                            saveScript({ ...localScript, sections });
                          }}
                          className={`p-1 rounded hover:bg-gray-200 ${
                            isDarkMode ? 'text-purple-400 hover:bg-purple-500/20' :
                            isExperimental ? 'text-yellow-400 hover:bg-yellow-400/20' :
                            'text-gray-600'
                          }`}
                        >
                          <ArrowDown size={14} />
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          if (confirm('Delete this section?')) {
                            const sections = localScript.sections.filter(s => s.id !== section.id);
                            saveScript({ ...localScript, sections });
                          }
                        }}
                        className="p-1 rounded text-red-400 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${
                        isDarkMode ? 'text-purple-300' :
                        isExperimental ? 'text-yellow-300' :
                        'text-gray-700'
                      }`}>
                        Script text
                      </label>
                      <textarea
                        value={section.script_text}
                        onChange={(e) => {
                          const sections = localScript.sections.map(s =>
                            s.id === section.id ? { ...s, script_text: e.target.value } : s
                          );
                          saveScript({ ...localScript, sections });
                        }}
                        rows={1}
                        style={{
                          minHeight: '28px',
                          height: 'auto',
                          overflow: 'hidden',
                          resize: 'none'
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                          }
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = target.scrollHeight + 'px';
                        }}
                        className={`w-full p-2 text-sm border rounded ${
                          isDarkMode ? 'bg-black border-purple-500/20 text-purple-100' :
                          isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100' :
                          'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                    
                    {/* Regular shots for non-A_ROLL_WITH_OVERLAY sections */}
                    {section.video_type !== 'A_ROLL_WITH_OVERLAY' && section.shots && section.shots.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`text-sm font-medium ${
                            isDarkMode ? 'text-purple-300' :
                            isExperimental ? 'text-yellow-300' :
                            'text-gray-700'
                          }`}>
                            Shots ({section.shots.length})
                          </label>
                          <button
                            onClick={() => toggleShotsVisibility(section.id)}
                            className={`p-1 rounded hover:bg-opacity-20 transition-colors ${
                              isDarkMode ? 'hover:bg-purple-400 text-purple-300' :
                              isExperimental ? 'hover:bg-yellow-400 text-yellow-300' :
                              'hover:bg-gray-200 text-gray-500'
                            }`}
                            title={collapsedShots.has(section.id) ? 'Expand shots' : 'Collapse shots'}
                          >
                            {collapsedShots.has(section.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                        {!collapsedShots.has(section.id) && (
                          <div className="space-y-2">
                            {section.shots.map((shot, shotIndex) => (
                              <div key={shotIndex} className={`border rounded p-2 ${
                                isDarkMode ? 'border-purple-500/30 bg-purple-500/10' :
                                isExperimental ? 'border-yellow-400/30 bg-yellow-400/10' :
                                'border-gray-200 bg-gray-50'
                              }`}>
                                <div className="text-xs font-medium mb-1">Shot {shotIndex + 1}</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">Camera:</span>
                                  <input
                                    type="text"
                                    value={shot.camera}
                                    onChange={(e) => {
                                      const sections = localScript.sections.map(s => {
                                        if (s.id === section.id) {
                                          const updatedShots = [...s.shots];
                                          updatedShots[shotIndex] = { ...shot, camera: e.target.value };
                                          return { ...s, shots: updatedShots };
                                        }
                                        return s;
                                      });
                                      saveScript({ ...localScript, sections });
                                    }}
                                    className={`flex-1 px-1 py-0.5 text-xs border rounded ${
                                      isDarkMode ? 'bg-black border-purple-500/20 text-purple-100' :
                                      isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100' :
                                      'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    placeholder="Camera instruction..."
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* A-Roll with Overlay Display */}
                    {section.video_type === 'A_ROLL_WITH_OVERLAY' && (section.base_layer || section.overlay_shots?.length > 0) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`text-sm font-medium ${
                            isDarkMode ? 'text-purple-300' :
                            isExperimental ? 'text-yellow-300' :
                            'text-gray-700'
                          }`}>
                            A-Roll with Overlay Setup
                          </label>
                          <button
                            onClick={() => toggleShotsVisibility(section.id)}
                            className={`p-1 rounded hover:bg-opacity-20 transition-colors ${
                              isDarkMode ? 'hover:bg-purple-400 text-purple-300' :
                              isExperimental ? 'hover:bg-yellow-400 text-yellow-300' :
                              'hover:bg-gray-200 text-gray-500'
                            }`}
                            title={collapsedShots.has(section.id) ? 'Expand shots' : 'Collapse shots'}
                          >
                            {collapsedShots.has(section.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                        {!collapsedShots.has(section.id) && (
                          <div className="space-y-2">
                            {section.base_layer && (
                              <div className={`border rounded p-2 ${
                                isDarkMode ? 'border-purple-500/30 bg-purple-500/10' :
                                isExperimental ? 'border-yellow-400/30 bg-yellow-400/10' :
                                'border-gray-200 bg-gray-50'
                              }`}>
                                <div className="text-xs font-medium mb-1">Base Layer (Full Section)</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">Camera:</span>
                                  <input
                                    type="text"
                                    value={section.base_layer.camera}
                                    onChange={(e) => {
                                      const sections = localScript.sections.map(s => {
                                        if (s.id === section.id) {
                                          return { ...s, base_layer: { ...s.base_layer, camera: e.target.value } };
                                        }
                                        return s;
                                      });
                                      saveScript({ ...localScript, sections });
                                    }}
                                    className={`flex-1 px-1 py-0.5 text-xs border rounded ${
                                      isDarkMode ? 'bg-black border-purple-500/20 text-purple-100' :
                                      isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100' :
                                      'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    placeholder="Base layer camera instruction..."
                                  />
                                </div>
                              </div>
                            )}
                            {section.overlay_shots?.map((overlay, overlayIndex) => (
                              <div key={overlayIndex} className={`border rounded p-2 ${
                                isDarkMode ? 'border-purple-500/30 bg-purple-500/10' :
                                isExperimental ? 'border-yellow-400/30 bg-yellow-400/10' :
                                'border-gray-200 bg-gray-50'
                              }`}>
                                <div className="text-xs font-medium mb-1">Overlay {overlayIndex + 1}</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">Camera:</span>
                                  <input
                                    type="text"
                                    value={overlay.camera}
                                    onChange={(e) => {
                                      const sections = localScript.sections.map(s => {
                                        if (s.id === section.id) {
                                          const updatedOverlays = [...(s.overlay_shots || [])];
                                          updatedOverlays[overlayIndex] = { ...overlay, camera: e.target.value };
                                          return { ...s, overlay_shots: updatedOverlays };
                                        }
                                        return s;
                                      });
                                      saveScript({ ...localScript, sections });
                                    }}
                                    className={`flex-1 px-1 py-0.5 text-xs border rounded ${
                                      isDarkMode ? 'bg-black border-purple-500/20 text-purple-100' :
                                      isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100' :
                                      'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    placeholder="Overlay camera instruction..."
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Split Screen Layout Display */}
                    {section.video_type === 'SPLIT_SCREEN' && section.layout && (
                      <div>
                        <div className={`text-xs ${
                          isDarkMode ? 'text-purple-400/70' :
                          isExperimental ? 'text-yellow-400/70' :
                          'text-gray-500'
                        }`}>
                          <strong>Layout:</strong> {section.layout.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip.show && (
        <div 
          className="fixed z-50 px-2 py-1 text-xs bg-black text-white rounded shadow-lg pointer-events-none"
          style={{
            left: showTooltip.x + 10,
            top: showTooltip.y - 30,
            transform: showTooltip.x > window.innerWidth - 200 ? 'translateX(-100%)' : 'none'
          }}
        >
          {showTooltip.message}
        </div>
      )}

      {/* Chat Panel */}
      {chatExpanded && (
        <div 
          className={`border-l flex flex-col relative ${
            isDarkMode ? 'bg-black border-purple-500/20' : 
            isExperimental ? 'bg-black border-yellow-400/30' : 
            'bg-gray-50 border-gray-200'
          }`}
          style={{ width: chatWidth }}
        >
          {/* Resize Handle */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:w-2 transition-all ${
              isDarkMode ? 'hover:bg-purple-500/50' : 
              isExperimental ? 'hover:bg-yellow-400/50' : 
              'hover:bg-blue-500/50'
            } ${isResizing ? 'w-2 ' + (isDarkMode ? 'bg-purple-500/50' : isExperimental ? 'bg-yellow-400/50' : 'bg-blue-500/50') : ''}`}
            onMouseDown={handleResizeStart}
          />
          
          <ChatAssistant
            disabled={!localScript || localScript.sections.length === 0}
            script={localScript}
            onPropose={setPendingActions}
            onApply={() => {
              applyActions(pendingActions);
              setPendingActions([]);
            }}
            proposed={pendingActions}
            colorScheme={colorScheme}
            context={{
              selectedNodes: nodes.filter(node => selectedSources.has(node.id)),
              productSpecs: nodes.filter(node => selectedSources.has(node.id) && node.type === 'productSpec')
                .map(node => node.data?.content || '').join('\n\n'),
              extraInstructions: nodes.filter(node => selectedSources.has(node.id) && node.type === 'instructions')
                .map(node => node.data?.content || '').join('\n\n'),
              selectedAds: nodes.filter(node => selectedSources.has(node.id) && node.type === 'ad')
                .map(node => node.data?.url || '').filter(Boolean),
              selectedAdAnalyses: Object.fromEntries(
                nodes.filter(node => selectedSources.has(node.id) && node.type === 'ad' && adAnalyses[node.id])
                  .map(node => [node.id, adAnalyses[node.id]])
              )
            }}
          />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && contextMenu.show && (
        <div
          className={`fixed z-50 py-1 rounded-lg shadow-lg border ${
            isDarkMode 
              ? 'bg-gray-800 border-purple-500/30' 
              : isExperimental 
              ? 'bg-gray-900 border-yellow-400/30'
              : 'bg-white border-gray-200'
          }`}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
              isDarkMode 
                ? 'text-red-400 hover:bg-red-500/20' 
                : isExperimental
                ? 'text-red-400 hover:bg-red-500/20'
                : 'text-red-600 hover:bg-red-50'
            }`}
            onClick={() => handleDeleteNode(contextMenu.nodeId)}
          >
            <Trash2 size={14} />
            Delete {contextMenu.nodeType === 'productSpec' ? 'Product Spec' : 
                    contextMenu.nodeType === 'ad' ? 'Ad' : 'Instructions'}
          </button>
        </div>
      )}

      {/* File Preview Modal */}
      {filePreview && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeFilePreview}
        >
          <div 
            className={`max-w-4xl max-h-[80vh] w-full mx-4 rounded-lg shadow-xl overflow-hidden ${
              isDarkMode ? 'bg-gray-800 text-purple-100' :
              isExperimental ? 'bg-gray-900 text-yellow-100' :
              'bg-white text-gray-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? 'border-purple-500/20' :
              isExperimental ? 'border-yellow-400/30' :
              'border-gray-200'
            }`}>
              <div>
                <h3 className="font-semibold text-lg">{filePreview.file.name}</h3>
                <div className={`text-sm ${
                  isDarkMode ? 'text-purple-400/70' :
                  isExperimental ? 'text-yellow-400/70' :
                  'text-gray-500'
                }`}>
                  {(filePreview.file.size / 1024).toFixed(1)}KB
                  {filePreview.file.pageCount && ` • ${filePreview.file.pageCount} pages`}
                  • {new Date(filePreview.file.uploadedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={closeFilePreview}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' :
                  isExperimental ? 'hover:bg-yellow-400/20 text-yellow-400' :
                  'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <pre className={`whitespace-pre-wrap text-sm font-mono leading-relaxed ${
                isDarkMode ? 'text-purple-100' :
                isExperimental ? 'text-yellow-100' :
                'text-gray-800'
              }`}>
                {filePreview.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedStaticScriptView;