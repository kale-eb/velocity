import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Script, ScriptChunk, ScriptVersion, AdAnalysis } from '../types'

interface ScriptStore {
  // State
  scripts: Script[]
  currentScriptId: string | null
  isGenerating: boolean
  error: string | null
  
  // Actions
  createScript: (projectId: string) => string
  updateScript: (id: string, updates: Partial<Script>) => void
  deleteScript: (id: string) => void
  setCurrentScript: (id: string | null) => void
  
  // Chunk operations
  addChunk: (scriptId: string, chunk: Omit<ScriptChunk, 'id'>) => void
  updateChunk: (scriptId: string, chunkId: string, updates: Partial<ScriptChunk>) => void
  deleteChunk: (scriptId: string, chunkId: string) => void
  reorderChunks: (scriptId: string, chunkIds: string[]) => void
  
  // Version operations
  addVersion: (scriptId: string, chunkId: string, content: string) => void
  selectVersion: (scriptId: string, chunkId: string, versionIndex: number) => void
  updateVersion: (scriptId: string, chunkId: string, versionIndex: number, content: string) => void
  
  // Generation
  generateScript: (analysisData: AdAnalysis[], connectedNodes: string[]) => Promise<void>
  setGenerating: (generating: boolean) => void
  setError: (error: string | null) => void
  
  // Utilities
  getCurrentScript: () => Script | null
  getScriptsByProject: (projectId: string) => Script[]
  exportScript: (scriptId: string) => string
}

const generateScriptId = (): string => {
  return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const generateChunkId = (): string => {
  return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const generateVersionId = (): string => {
  return `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Mock script generation function
const mockGenerateScript = async (analysisData: AdAnalysis[]): Promise<ScriptChunk[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const chunks: ScriptChunk[] = []
  
  // Generate chunks based on analysis data
  analysisData.forEach((analysis) => {
    analysis.chunks.forEach((chunk) => {
      const scriptChunk: ScriptChunk = {
        id: generateChunkId(),
        type: chunk.type,
        selectedVersion: 0,
        versions: [
          {
            id: generateVersionId(),
            content: `Based on the ${chunk.type} section: ${chunk.audio.transcript}`,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: generateVersionId(),
            content: `Alternative version: A more engaging take on "${chunk.audio.transcript.slice(0, 50)}..."`,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: generateVersionId(),
            content: `Creative variation: ${chunk.audio.transcript.split(' ').reverse().join(' ')}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        metadata: {
          cameraDirection: chunk.visual.cameraAngle,
          visualNotes: chunk.visual.description,
          duration: chunk.endTime - chunk.startTime
        }
      }
      chunks.push(scriptChunk)
    })
  })
  
  return chunks
}

export const useScriptStore = create<ScriptStore>()(
  persist(
    (set, get) => ({
      // Initial state
      scripts: [],
      currentScriptId: null,
      isGenerating: false,
      error: null,

      // Actions
      createScript: (projectId: string) => {
        const id = generateScriptId()
        const newScript: Script = {
          id,
          projectId,
          chunks: [],
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        }

        set((state) => ({
          scripts: [...state.scripts, newScript],
          currentScriptId: id
        }))

        return id
      },

      updateScript: (id: string, updates: Partial<Script>) => {
        set((state) => ({
          scripts: state.scripts.map(script =>
            script.id === id 
              ? { ...script, ...updates, updatedAt: new Date() }
              : script
          )
        }))
      },

      deleteScript: (id: string) => {
        set((state) => ({
          scripts: state.scripts.filter(script => script.id !== id),
          currentScriptId: state.currentScriptId === id ? null : state.currentScriptId
        }))
      },

      setCurrentScript: (id: string | null) => {
        set({ currentScriptId: id })
      },

      // Chunk operations
      addChunk: (scriptId: string, chunk: Omit<ScriptChunk, 'id'>) => {
        const newChunk: ScriptChunk = {
          ...chunk,
          id: generateChunkId()
        }

        set((state) => ({
          scripts: state.scripts.map(script =>
            script.id === scriptId
              ? {
                  ...script,
                  chunks: [...script.chunks, newChunk],
                  updatedAt: new Date()
                }
              : script
          )
        }))
      },

      updateChunk: (scriptId: string, chunkId: string, updates: Partial<ScriptChunk>) => {
        set((state) => ({
          scripts: state.scripts.map(script =>
            script.id === scriptId
              ? {
                  ...script,
                  chunks: script.chunks.map(chunk =>
                    chunk.id === chunkId
                      ? { ...chunk, ...updates }
                      : chunk
                  ),
                  updatedAt: new Date()
                }
              : script
          )
        }))
      },

      deleteChunk: (scriptId: string, chunkId: string) => {
        set((state) => ({
          scripts: state.scripts.map(script =>
            script.id === scriptId
              ? {
                  ...script,
                  chunks: script.chunks.filter(chunk => chunk.id !== chunkId),
                  updatedAt: new Date()
                }
              : script
          )
        }))
      },

      reorderChunks: (scriptId: string, chunkIds: string[]) => {
        set((state) => ({
          scripts: state.scripts.map(script => {
            if (script.id !== scriptId) return script

            const reorderedChunks = chunkIds.map(id =>
              script.chunks.find(chunk => chunk.id === id)
            ).filter(Boolean) as ScriptChunk[]

            return {
              ...script,
              chunks: reorderedChunks,
              updatedAt: new Date()
            }
          })
        }))
      },

      // Version operations
      addVersion: (scriptId: string, chunkId: string, content: string) => {
        const newVersion: ScriptVersion = {
          id: generateVersionId(),
          content,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        set((state) => ({
          scripts: state.scripts.map(script =>
            script.id === scriptId
              ? {
                  ...script,
                  chunks: script.chunks.map(chunk =>
                    chunk.id === chunkId
                      ? {
                          ...chunk,
                          versions: [...chunk.versions, newVersion].slice(0, 3) // Max 3 versions
                        }
                      : chunk
                  ),
                  updatedAt: new Date()
                }
              : script
          )
        }))
      },

      selectVersion: (scriptId: string, chunkId: string, versionIndex: number) => {
        set((state) => ({
          scripts: state.scripts.map(script =>
            script.id === scriptId
              ? {
                  ...script,
                  chunks: script.chunks.map(chunk =>
                    chunk.id === chunkId
                      ? { ...chunk, selectedVersion: versionIndex }
                      : chunk
                  ),
                  updatedAt: new Date()
                }
              : script
          )
        }))
      },

      updateVersion: (scriptId: string, chunkId: string, versionIndex: number, content: string) => {
        set((state) => ({
          scripts: state.scripts.map(script =>
            script.id === scriptId
              ? {
                  ...script,
                  chunks: script.chunks.map(chunk =>
                    chunk.id === chunkId
                      ? {
                          ...chunk,
                          versions: chunk.versions.map((version, index) =>
                            index === versionIndex
                              ? { ...version, content, updatedAt: new Date() }
                              : version
                          )
                        }
                      : chunk
                  ),
                  updatedAt: new Date()
                }
              : script
          )
        }))
      },

      // Generation
      generateScript: async (analysisData: AdAnalysis[], connectedNodes: string[]) => {
        set({ isGenerating: true, error: null })

        try {
          const chunks = await mockGenerateScript(analysisData)
          const scriptId = get().currentScriptId

          if (scriptId) {
            set((state) => ({
              scripts: state.scripts.map(script =>
                script.id === scriptId
                  ? {
                      ...script,
                      chunks,
                      status: 'generated' as const,
                      updatedAt: new Date()
                    }
                  : script
              ),
              isGenerating: false
            }))
          }
        } catch (error) {
          set({
            isGenerating: false,
            error: error instanceof Error ? error.message : 'Generation failed'
          })
        }
      },

      setGenerating: (generating: boolean) => {
        set({ isGenerating: generating })
      },

      setError: (error: string | null) => {
        set({ error })
      },

      // Utilities
      getCurrentScript: () => {
        const state = get()
        return state.scripts.find(script => script.id === state.currentScriptId) || null
      },

      getScriptsByProject: (projectId: string) => {
        return get().scripts.filter(script => script.projectId === projectId)
      },

      exportScript: (scriptId: string) => {
        const state = get()
        const script = state.scripts.find(s => s.id === scriptId)
        
        if (!script) return ''

        return script.chunks
          .map(chunk => {
            const selectedVersion = chunk.versions[chunk.selectedVersion]
            return selectedVersion ? selectedVersion.content : ''
          })
          .join('\n\n')
      }
    }),
    {
      name: 'script-storage',
      partialize: (state) => ({
        scripts: state.scripts,
        currentScriptId: state.currentScriptId
      })
    }
  )
)