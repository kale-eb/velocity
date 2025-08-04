import React from 'react';

const TailwindTest = () => {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">Tailwind CSS Test</h1>
      <div className="bg-red-500 text-white p-4 rounded mb-4">
        This should have a red background
      </div>
      <div className="bg-blue-500 text-white p-4 rounded mb-4">
        This should have a blue background
      </div>
      <div className="bg-green-500 text-white p-4 rounded mb-4">
        This should have a green background
      </div>
      <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
        Purple Button
      </button>
    </div>
  );
};

export default TailwindTest;