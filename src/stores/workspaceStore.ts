import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  WorkspaceNode, 
  NodeType 
} from '../types'

interface WorkspaceStore {
  // State
  nodes: WorkspaceNode[]
  selectedNodeId: string | null
  
  // Actions
  addNode: (
    type: NodeType,
    data?: any,
    id?: string
  ) => string | null
  updateNode: (id: string, updates: Partial<WorkspaceNode>) => void
  deleteNode: (id: string) => void
  selectNode: (id: string | null) => void
  
  // Utility actions
  resetWorkspace: () => void
}

const generateNodeId = (type: NodeType): string => {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const isGeneratorType = (type: NodeType): boolean => type === 'script' || type === 'scriptGenerator'

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      // Initial state
      nodes: [],
      selectedNodeId: null,

      // Actions
      addNode: (type: NodeType, data?: any, providedId?: string) => {
        const state = get()
        
        // Enforce limits
        if (type === 'productSpec') {
          const productSpecCount = state.nodes.filter(n => n.type === 'productSpec').length
          if (productSpecCount >= 1) {
            console.log('Maximum 1 product spec allowed')
            return null
          }
        } else if (type === 'ad') {
          const adCount = state.nodes.filter(n => n.type === 'ad').length
          if (adCount >= 6) {
            console.log('Maximum 6 ads allowed')
            return null
          }
        } else if (type === 'instructions') {
          const instructionCount = state.nodes.filter(n => n.type === 'instructions').length
          if (instructionCount >= 4) {
            console.log('Maximum 4 instructions allowed')
            return null
          }
        } else if (isGeneratorType(type)) {
          // Only allow ONE generator across both legacy/new types
          const generatorCount = state.nodes.filter(n => isGeneratorType(n.type)).length
          if (generatorCount >= 1) {
            console.log('Maximum 1 script generator allowed')
            return null
          }
        }

        // If restoring and id exists already, skip duplicate add
        if (providedId) {
          const existingById = state.nodes.find(n => n.id === providedId)
          if (existingById) {
            return existingById.id
          }
        }
        
        const id = providedId || generateNodeId(type)
        
        // Create node with default data based on type
        let newNode: WorkspaceNode
        
        switch (type) {
          case 'productSpec':
            newNode = {
              id,
              type: 'productSpec',
              isSelected: false,
              data: data ?? { documents: [] }
            } as WorkspaceNode
            break
            
          case 'ad':
            newNode = {
              id,
              type: 'ad',
              isSelected: false,
              data: data ?? {
                title: 'New Ad',
                url: '',
                status: 'draft'
              }
            } as WorkspaceNode
            break
            
          case 'instructions':
            newNode = {
              id,
              type: 'instructions',
              isSelected: false,
              data: data ?? { content: '' }
            } as WorkspaceNode
            break
            
          case 'script':
            newNode = {
              id,
              type: 'script',
              isSelected: false,
              data: data ?? {
                messages: [{role: 'assistant', content: 'Add your content and right-click to add more nodes!'}],
                isActive: false
              }
            } as WorkspaceNode
            break

          case 'scriptGenerator':
            newNode = {
              id,
              type: 'scriptGenerator',
              isSelected: false,
              data: data ?? {
                inputs: {
                  product_specs: '',
                  ad_refs: [],
                  extra_instructions: ''
                },
                expanded: true
              }
            } as WorkspaceNode
            break
            
          default:
            newNode = {
              id,
              type,
              isSelected: false,
              data: data ?? {}
            } as WorkspaceNode
        }

        set((state) => ({
          nodes: [...state.nodes, newNode],
          selectedNodeId: newNode.id
        }))
        
        return newNode.id
      },

      updateNode: (id: string, updates: Partial<WorkspaceNode>) => {
        set((state) => ({
          nodes: (state.nodes.map(node => 
            node.id === id ? { ...node, ...updates } : node
          ) as WorkspaceNode[])
        }))
      },

      deleteNode: (id: string) => {
        set((state) => ({
          nodes: state.nodes.filter(node => node.id !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId
        }))
      },

      selectNode: (id: string | null) => {
        set((state) => ({
          selectedNodeId: id,
          nodes: (state.nodes.map(node => ({
            ...node,
            isSelected: node.id === id
          })) as WorkspaceNode[])
        }))
      },


      resetWorkspace: () => {
        console.log('Resetting workspace...');
        set({
          nodes: [],
          selectedNodeId: null
        })
      }
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        nodes: state.nodes
      })
    }
  )
)