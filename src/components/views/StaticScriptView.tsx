import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  MessageSquare, 
  Image, 
  Send,
  X,
  Copy,
  Download,
  Save,
  ChevronLeft,
  Plus
} from 'lucide-react';
import type { Theme } from '../../types';

interface StaticScriptViewProps {
  nodes?: any[];
  colorScheme: Theme;
  onAddNode?: (type: string, data?: any) => void;
  onUpdateNode?: (id: string, updates: any) => void;
  onDeleteNode?: (id: string) => void;
  chatExpanded: boolean;
  onToggleChat: () => void;
}

const StaticScriptView: React.FC<StaticScriptViewProps> = ({ 
  nodes = [], 
  colorScheme = 'light',
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  chatExpanded,
  onToggleChat
}) => {
  console.log('StaticScriptView rendering with:', { nodes, colorScheme });
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [scriptContent, setScriptContent] = useState<string>('// Start writing your script here...\n\n');
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string}>>([
    { role: 'assistant', content: 'Hello! I can help you write and edit scripts based on your content sources. What would you like to work on?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatWidth, setChatWidth] = useState(384); // Default 384px (w-96)
  const [isResizing, setIsResizing] = useState(false);

  const isDarkMode = colorScheme === 'dark';
  const isExperimental = colorScheme === 'experimental';

  // Filter nodes by type
  const productSpecs = nodes.filter(node => node.type === 'productSpec');
  const ads = nodes.filter(node => node.type === 'ad');
  const instructions = nodes.filter(node => node.type === 'instructions');

  const handleAddProductSpec = () => {
    if (onAddNode) {
      const nodeId = onAddNode('productSpec', {
        documents: []
      });
      console.log('Added product spec:', nodeId);
    }
  };

  const handleAddAd = () => {
    if (onAddNode) {
      const nodeId = onAddNode('ad', {
        title: 'Video Reference',
        url: '',
        status: 'draft'
      });
      console.log('Added ad:', nodeId);
    }
  };

  const handleAddInstructions = () => {
    if (onAddNode) {
      const nodeId = onAddNode('instructions', {
        content: 'Add your instructions here...'
      });
      console.log('Added instructions:', nodeId);
    }
  };

  const mockResponses = [
    "I'd be happy to help you with that! Let me analyze your content sources and suggest some improvements.",
    "That's a great idea! Based on your product specs and ads, I can help you create a compelling script.",
    "I see you have some interesting content sources. Would you like me to help you structure a script around them?",
    "Let me help you with that. I can generate script content based on the nodes you've added to your workspace.",
    "That sounds like a perfect use case! I can help you create engaging copy that aligns with your marketing goals.",
    "Great question! I can assist you in developing content that resonates with your target audience.",
    "I understand what you're looking for. Let me help you craft something that will work well for your campaign."
  ];

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    // Add user message
    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    
    // Clear input
    setChatInput('');
    
    // Add mock response after a short delay
    setTimeout(() => {
      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      const assistantMessage = { role: 'assistant', content: randomResponse };
      setChatMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResizeStart = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  React.useEffect(() => {
    const handleMouseMove = (e) => {
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

  const getWorkspaceClasses = () => {
    if (isExperimental) {
      return 'h-full bg-gradient-to-br from-black via-gray-900 to-yellow-900/20 text-yellow-100';
    } else if (isDarkMode) {
      return 'h-full bg-gradient-to-br from-black via-gray-900 to-black text-purple-100';
    } else {
      return 'h-full bg-gradient-to-br from-gray-100 via-white to-gray-50 text-gray-900';
    }
  };

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
      {/* Left Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} transition-all duration-300 border-r flex-shrink-0 ${
        isDarkMode ? 'bg-black border-purple-500/20' : 
        isExperimental ? 'bg-black border-yellow-400/30' : 
        'bg-gray-50 border-gray-200'
      }`}>
        <div className="p-4">
          <h2 className={`font-semibold mb-4 ${
            isDarkMode ? 'text-purple-100' : 
            isExperimental ? 'text-yellow-100' : 
            'text-gray-900'
          }`}>
            Content Sources
          </h2>
          
          {/* Simple sections */}
          <div className="space-y-4">
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
                  <div key={spec.id} className={`p-2 mb-2 rounded border ${
                    isDarkMode ? 'bg-purple-500/10 border-purple-500/20' : 
                    isExperimental ? 'bg-yellow-400/10 border-yellow-400/20' : 
                    'bg-gray-100 border-gray-200'
                  }`}>
                    <div className="text-sm">Product Spec</div>
                    <div className="text-xs opacity-75">
                      {spec.data?.documents?.length || 0} documents
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${
                  isDarkMode ? 'text-purple-300' : 
                  isExperimental ? 'text-yellow-300' : 
                  'text-gray-700'
                }`}>
                  Ads ({ads.length})
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
                ads.map(ad => (
                  <div key={ad.id} className={`p-2 mb-2 rounded border ${
                    isDarkMode ? 'bg-purple-500/10 border-purple-500/20' : 
                    isExperimental ? 'bg-yellow-400/10 border-yellow-400/20' : 
                    'bg-gray-100 border-gray-200'
                  }`}>
                    <div className="text-sm">{ad.data?.title || 'Untitled Ad'}</div>
                    <div className="text-xs opacity-75">{ad.data?.status || 'Draft'}</div>
                  </div>
                ))
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${
                  isDarkMode ? 'text-purple-300' : 
                  isExperimental ? 'text-yellow-300' : 
                  'text-gray-700'
                }`}>
                  Instructions ({instructions.length})
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
                  <div key={instruction.id} className={`p-2 mb-2 rounded border ${
                    isDarkMode ? 'bg-purple-500/10 border-purple-500/20' : 
                    isExperimental ? 'bg-yellow-400/10 border-yellow-400/20' : 
                    'bg-gray-100 border-gray-200'
                  }`}>
                    <div className="text-sm">Instructions</div>
                    <div className="text-xs opacity-75 truncate">
                      {instruction.data?.content || 'Click to add content...'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`px-6 py-3 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-black border-purple-500/20' : 
          isExperimental ? 'bg-black border-yellow-400/30' : 
          'bg-gray-50 border-gray-200'
        }`}>
          <h1 className={`text-lg font-semibold ${
            isDarkMode ? 'text-purple-100' : 
            isExperimental ? 'text-yellow-100' : 
            'text-gray-900'
          }`}>
            Script Editor
          </h1>
          <button
            onClick={onToggleChat}
            className={`px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
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

        {/* Script Editor */}
        <div className="flex-1 p-6">
          <textarea
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
            className={`w-full h-full p-4 font-mono text-sm resize-none border rounded-lg ${
              isDarkMode ? 'bg-black border-purple-500/20 text-purple-100 placeholder-purple-400/50' : 
              isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100 placeholder-yellow-400/50' : 
              'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
            placeholder="Start writing your script here..."
          />
        </div>
      </div>

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
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            isDarkMode ? 'border-purple-500/20' : 
            isExperimental ? 'border-yellow-400/30' : 
            'border-gray-200'
          }`}>
            <h3 className={`font-semibold ${
              isDarkMode ? 'text-purple-100' : 
              isExperimental ? 'text-yellow-100' : 
              'text-gray-900'
            }`}>
              AI Assistant
            </h3>
            <button
              onClick={onToggleChat}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-purple-500/20 text-purple-400' : 
                isExperimental ? 'hover:bg-yellow-400/20 text-yellow-400' : 
                'hover:bg-gray-200 text-gray-600'
              }`}
            >
              <X size={16} />
            </button>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {chatMessages.map((message, index) => (
                <div key={index} className={`${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block max-w-[80%] p-3 rounded-lg text-sm ${
                    message.role === 'user'
                      ? isDarkMode ? 'bg-purple-500/20 text-purple-100' : 
                        isExperimental ? 'bg-yellow-400/20 text-yellow-100' : 
                        'bg-blue-500 text-white'
                      : isDarkMode ? 'bg-purple-500/10 border border-purple-500/20 text-purple-100' : 
                        isExperimental ? 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-100' : 
                        'bg-gray-100 border border-gray-200 text-gray-900'
                  }`}>
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className={`p-4 border-t ${
            isDarkMode ? 'border-purple-500/20' : 
            isExperimental ? 'border-yellow-400/30' : 
            'border-gray-200'
          }`}>
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your script..."
                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode ? 'bg-black border-purple-500/20 text-purple-100 placeholder-purple-400/50' : 
                  isExperimental ? 'bg-black border-yellow-400/30 text-yellow-100 placeholder-yellow-400/50' : 
                  'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className={`px-3 py-2 rounded-lg transition-all disabled:opacity-50 ${
                  isDarkMode ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400' : 
                  isExperimental ? 'bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400' : 
                  'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaticScriptView;