import React from 'react';

const StaticTailwindTest = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white p-8">
        <h1 className="text-2xl font-bold mb-4">Static Tailwind Test</h1>
        
        {/* Test basic colors */}
        <div className="space-y-2 mb-6">
          <div className="bg-red-500 text-white p-4 rounded">Red background</div>
          <div className="bg-blue-500 text-white p-4 rounded">Blue background</div>
          <div className="bg-green-500 text-white p-4 rounded">Green background</div>
        </div>
        
        {/* Test gradients */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded mb-6">
          Gradient background
        </div>
        
        {/* Test borders and shadows */}
        <div className="border-2 border-blue-500 p-4 rounded shadow-lg mb-6">
          Blue border with shadow
        </div>
        
        {/* Test flexbox */}
        <div className="flex items-center justify-between bg-gray-200 p-4 rounded">
          <span>Left aligned</span>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Button
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaticTailwindTest;