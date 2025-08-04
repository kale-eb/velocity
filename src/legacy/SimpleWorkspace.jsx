import React, { useState, useCallback } from 'react';

const SimpleWorkspace = () => {
  const [colorScheme, setColorScheme] = useState('light');
  const [nodePosition, setNodePosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const handleMouseDown = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - nodePosition.x,
      y: e.clientY - nodePosition.y
    });
    setIsDragging(true);
    e.preventDefault();
  }, [nodePosition]);
  
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    setNodePosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  }, [isDragging, dragOffset]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">AdCraft Studio</h1>
          <button 
            onClick={() => setColorScheme(prev => prev === 'light' ? 'dark' : 'light')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3B82F6',
              color: 'white',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Theme: {colorScheme}
          </button>
        </div>
      </div>
      
      {/* Workspace */}
      <div className="relative w-full h-[calc(100vh-73px)] overflow-auto bg-gray-50">
        {/* Draggable Node */}
        <div 
          className="absolute bg-white border-2 border-blue-500 rounded-xl shadow-lg p-4 w-64 cursor-move hover:shadow-xl transition-all duration-200"
          style={{
            left: nodePosition.x + 'px',
            top: nodePosition.y + 'px',
            zIndex: isDragging ? 50 : 1
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="border-b border-gray-200 pb-2 mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Product Spec</h3>
          </div>
          <p className="text-sm text-gray-600">Drag me around!</p>
          <div className="mt-3 text-xs text-gray-400">
            Position: ({Math.round(nodePosition.x)}, {Math.round(nodePosition.y)})
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleWorkspace;