import React, { useState, useEffect } from 'react';
import EnhancedStaticScriptView from '../views/EnhancedStaticScriptView';
import { useProjectStore } from '../../stores';
import { storage, AdStorage, ScriptStorage, AutoSave } from '../../utils/localStorage';

export default function WorkspaceContainerSimple() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentScript, setCurrentScript] = useState(null);
  const [adAnalyses, setAdAnalyses] = useState({});
  
  const { createProject } = useProjectStore();

  useEffect(() => {
    console.log('🚀 Simple workspace loading...');
    
    const loadData = async () => {
      try {
        // Just load saved script and ads
        const savedAds = AdStorage.loadProcessedAds();
        const savedScripts = ScriptStorage.loadGeneratedScripts();
        const savedCurrentScript = savedScripts['current_script'] || null;
        
        setAdAnalyses(savedAds);
        setCurrentScript(savedCurrentScript);
        
        console.log('📊 Loaded data:', {
          processedAds: Object.keys(savedAds).length,
          hasCurrentScript: !!savedCurrentScript,
          scriptChunks: savedCurrentScript?.chunks?.length || 0
        });
        
        if (savedCurrentScript) {
          console.log('📄 Script loaded with', savedCurrentScript.chunks?.length || 0, 'chunks');
        }
        
        // Create a simple default project
        createProject('My Script Project', 'Simple script editing project');
        
        // Enable auto-save
        AutoSave.enable();
        
      } catch (error) {
        console.error('❌ Failed to load data:', error);
        // Even if loading fails, create the project
        createProject('My Script Project', 'Simple script editing project');
      } finally {
        setIsLoading(false);
        console.log('✅ Simple initialization complete');
      }
    };

    loadData();
  }, [createProject]);

  const handleScriptUpdate = (script: any) => {
    setCurrentScript(script);
    if (script) {
      ScriptStorage.saveScript('current_script', script);
      console.log('💾 Saved current script to localStorage');
    }
  };

  const handleScriptClear = () => {
    setCurrentScript(null);
    ScriptStorage.saveScript('current_script', null);
    console.log('🗑️ Cleared current script from localStorage');
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <EnhancedStaticScriptView 
        script={currentScript}
        onScriptUpdate={handleScriptUpdate}
        onScriptClear={handleScriptClear}
        adAnalyses={adAnalyses}
      />
    </div>
  );
}