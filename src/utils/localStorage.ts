/**
 * Local Storage Utilities for Marketing App
 * Handles persistent storage of workspace data, processed ads, and user settings
 */

interface StorageKeys {
  WORKSPACE_NODES: 'marketing_app_workspace_nodes';
  PROCESSED_ADS: 'marketing_app_processed_ads';
  WORKSPACE_CONNECTIONS: 'marketing_app_workspace_connections';
  WORKSPACE_VIEWPORT: 'marketing_app_workspace_viewport';
  WORKSPACE_UI_STATE: 'marketing_app_workspace_ui_state';
  GENERATED_SCRIPTS: 'marketing_app_generated_scripts';
  USER_SETTINGS: 'marketing_app_user_settings';
}

const STORAGE_KEYS: StorageKeys = {
  WORKSPACE_NODES: 'marketing_app_workspace_nodes',
  PROCESSED_ADS: 'marketing_app_processed_ads',
  WORKSPACE_CONNECTIONS: 'marketing_app_workspace_connections',
  WORKSPACE_VIEWPORT: 'marketing_app_workspace_viewport',
  WORKSPACE_UI_STATE: 'marketing_app_workspace_ui_state',
  GENERATED_SCRIPTS: 'marketing_app_generated_scripts',
  USER_SETTINGS: 'marketing_app_user_settings'
} as const;

// Storage versioning for data migration
const STORAGE_VERSION = '1.0';
const VERSION_KEY = 'marketing_app_storage_version';

/**
 * Generic localStorage wrapper with error handling and JSON serialization
 */
class LocalStorageManager {
  private isStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  save<T>(key: keyof StorageKeys, data: T): boolean {
    if (!this.isStorageAvailable()) {
      console.warn('localStorage is not available');
      return false;
    }

    try {
      const serializedData = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: STORAGE_VERSION
      });
      localStorage.setItem(STORAGE_KEYS[key], serializedData);
      console.log(`💾 Saved ${key} to localStorage (${serializedData.length} chars)`);
      return true;
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
      return false;
    }
  }

  load<T>(key: keyof StorageKeys, defaultValue: T): T {
    if (!this.isStorageAvailable()) {
      console.warn('localStorage is not available, using default value');
      return defaultValue;
    }

    try {
      const item = localStorage.getItem(STORAGE_KEYS[key]);
      if (!item) {
        console.log(`📂 No saved data found for ${key}, using default`);
        return defaultValue;
      }

      const parsed = JSON.parse(item);
      
      // Check version compatibility
      if (parsed.version !== STORAGE_VERSION) {
        console.warn(`⚠️ Version mismatch for ${key} (${parsed.version} vs ${STORAGE_VERSION}), using default`);
        return defaultValue;
      }

      console.log(`📂 Loaded ${key} from localStorage (saved ${new Date(parsed.timestamp).toLocaleString()})`);
      return parsed.data;
    } catch (error) {
      console.error(`Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  remove(key: keyof StorageKeys): boolean {
    if (!this.isStorageAvailable()) {
      return false;
    }

    try {
      localStorage.removeItem(STORAGE_KEYS[key]);
      console.log(`🗑️ Removed ${key} from localStorage`);
      return true;
    } catch (error) {
      console.error(`Failed to remove ${key} from localStorage:`, error);
      return false;
    }
  }

  clear(): boolean {
    if (!this.isStorageAvailable()) {
      return false;
    }

    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('🗑️ Cleared all marketing app data from localStorage');
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }

  getStorageInfo(): { totalSize: number; itemCount: number; items: Record<string, number> } {
    const items: Record<string, number> = {};
    let totalSize = 0;
    let itemCount = 0;

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const item = localStorage.getItem(key);
      if (item) {
        const size = item.length * 2; // Rough estimate (2 bytes per char in UTF-16)
        items[name] = size;
        totalSize += size;
        itemCount++;
      }
    });

    return { totalSize, itemCount, items };
  }
}

// Create singleton instance
export const storage = new LocalStorageManager();

// Specific data managers for different types of content
export class WorkspaceStorage {
  static saveNodes(nodes: any[]): boolean {
    return storage.save('WORKSPACE_NODES', nodes);
  }

  static loadNodes(): any[] {
    return storage.load('WORKSPACE_NODES', []);
  }

  static saveConnections(connections: any[]): boolean {
    return storage.save('WORKSPACE_CONNECTIONS', connections);
  }

  static loadConnections(): any[] {
    return storage.load('WORKSPACE_CONNECTIONS', []);
  }

  static clearConnections(): boolean {
    return storage.remove('WORKSPACE_CONNECTIONS');
  }

  static saveViewport(viewport: any): boolean {
    return storage.save('WORKSPACE_VIEWPORT', viewport);
  }

  static loadViewport(): any {
    return storage.load('WORKSPACE_VIEWPORT', {
      panOffset: { x: 0, y: 0 },
      zoomLevel: 100
    });
  }

  static saveUIState(uiState: any): boolean {
    return storage.save('WORKSPACE_UI_STATE', uiState);
  }

  static loadUIState(): any {
    return storage.load('WORKSPACE_UI_STATE', {
      currentView: 'static',
      sidebarCollapsed: false,
      chatExpanded: false
    });
  }

  // Save complete workspace state
  static saveWorkspace(nodes: any[], connections: any[], viewport: any, uiState: any): boolean {
    // For MVP static view, skip saving connections to avoid quota errors
    const success = [
      this.saveNodes(nodes),
      // this.saveConnections(connections), // skipped for MVP
      this.saveViewport(viewport),
      this.saveUIState(uiState)
    ].every(Boolean);

    if (success) {
      console.log('💾 Complete workspace saved to localStorage');
    } else {
      console.error('⚠️ Failed to save complete workspace');
    }

    return success;
  }

  // Load complete workspace state
  static loadWorkspace(): {
    nodes: any[];
    connections: any[];
    viewport: any;
    uiState: any;
  } {
    return {
      nodes: this.loadNodes(),
      connections: this.loadConnections(),
      viewport: this.loadViewport(),
      uiState: this.loadUIState()
    };
  }
}

export class AdStorage {
  static saveProcessedAds(adAnalyses: Record<string, any>): boolean {
    return storage.save('PROCESSED_ADS', adAnalyses);
  }

  static loadProcessedAds(): Record<string, any> {
    return storage.load('PROCESSED_ADS', {});
  }

  static addProcessedAd(nodeId: string, analysis: any): boolean {
    const existing = this.loadProcessedAds();
    const updated = { ...existing, [nodeId]: analysis };
    return this.saveProcessedAds(updated);
  }

  static removeProcessedAd(nodeId: string): boolean {
    const existing = this.loadProcessedAds();
    const { [nodeId]: removed, ...remaining } = existing;
    return this.saveProcessedAds(remaining);
  }
}

export class ScriptStorage {
  static saveGeneratedScripts(scripts: Record<string, any>): boolean {
    return storage.save('GENERATED_SCRIPTS', scripts);
  }

  static loadGeneratedScripts(): Record<string, any> {
    const scripts = storage.load('GENERATED_SCRIPTS', {});
    console.log('📂 ScriptStorage.loadGeneratedScripts result:', {
      scriptCount: Object.keys(scripts).length,
      scriptKeys: Object.keys(scripts),
      currentScript: scripts.current_script ? {
        chunks: scripts.current_script.chunks?.length || 0,
        title: scripts.current_script.title
      } : null
    });
    return scripts;
  }

  static saveScript(scriptId: string, script: any): boolean {
    console.log('💾 ScriptStorage.saveScript called:', {
      scriptId,
      hasScript: !!script,
      chunks: script?.chunks?.length || 0
    });
    
    const existing = this.loadGeneratedScripts();
    const updated = { ...existing, [scriptId]: script };
    const success = this.saveGeneratedScripts(updated);
    
    console.log('💾 ScriptStorage.saveScript result:', success);
    return success;
  }
}

export class SettingsStorage {
  static saveUserSettings(settings: any): boolean {
    return storage.save('USER_SETTINGS', settings);
  }

  static loadUserSettings(): any {
    return storage.load('USER_SETTINGS', {
      theme: 'light',
      autoSave: true,
      debugMode: false
    });
  }
}

// Auto-save functionality
export class AutoSave {
  private static saveTimer: NodeJS.Timeout | null = null;
  private static readonly DEBOUNCE_DELAY = 2000; // 2 seconds

  static enable(): void {
    console.log('🔄 Auto-save enabled');
  }

  static disable(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    console.log('⏸️ Auto-save disabled');
  }

  static scheduleWorkspaceSave(
    nodes: any[], 
    connections: any[], 
    viewport: any, 
    uiState: any
  ): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      WorkspaceStorage.saveWorkspace(nodes, connections, viewport, uiState);
    }, this.DEBOUNCE_DELAY);
  }
}

// Export/Import functionality for data portability
export class DataPortability {
  static exportAllData(): string {
    const data = {
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      workspace: WorkspaceStorage.loadWorkspace(),
      processedAds: AdStorage.loadProcessedAds(),
      generatedScripts: ScriptStorage.loadGeneratedScripts(),
      userSettings: SettingsStorage.loadUserSettings()
    };

    return JSON.stringify(data, null, 2);
  }

  static importAllData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.version !== STORAGE_VERSION) {
        console.warn(`⚠️ Import version mismatch: ${data.version} vs ${STORAGE_VERSION}`);
        return false;
      }

      // Import all data
      WorkspaceStorage.saveWorkspace(
        data.workspace.nodes,
        data.workspace.connections,
        data.workspace.viewport,
        data.workspace.uiState
      );
      AdStorage.saveProcessedAds(data.processedAds);
      ScriptStorage.saveGeneratedScripts(data.generatedScripts);
      SettingsStorage.saveUserSettings(data.userSettings);

      console.log('📥 Successfully imported all data');
      return true;
    } catch (error) {
      console.error('❌ Failed to import data:', error);
      return false;
    }
  }

  static downloadBackup(): void {
    const data = this.exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `marketing_app_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('💾 Downloaded backup file');
  }
}

console.log('💾 localStorage utilities initialized');