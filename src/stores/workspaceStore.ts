import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  WorkspaceState, 
  WorkspaceNode, 
  Connection, 
  Point, 
  Bounds,
  NodeType 
} from '../types'

interface WorkspaceStore extends WorkspaceState {
  // Actions
  addNode: (type: NodeType, position: Point) => string | null
  updateNode: (id: string, updates: Partial<WorkspaceNode>) => void
  deleteNode: (id: string) => void
  selectNode: (id: string | null) => void
  moveNode: (id: string, position: Point) => void
  
  addConnection: (sourceId: string, targetId: string) => void
  removeConnection: (id: string) => void
  
  setZoomLevel: (level: number) => void
  setPanOffset: (offset: Point) => void
  setCanvasBounds: (bounds: Bounds) => void
  
  startDrag: (nodeId: string, startPosition: Point, offset: Point) => void
  updateDrag: (position: Point) => void
  endDrag: () => void
  
  // History management
  pushToHistory: () => void
  undo: () => void
  redo: () => void
  
  // Utility actions
  reorganizeNodes: () => void
  resetWorkspace: () => void
}

const INITIAL_CANVAS_BOUNDS: Bounds = {
  minX: 0,
  maxX: 2474,
  minY: 0,
  maxY: 800
}

const generateNodeId = (type: NodeType): string => {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const generateConnectionId = (sourceId: string, targetId: string): string => {
  return `connection_${sourceId}_${targetId}`
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      // Initial state
      nodes: [],
      connections: [],
      selectedNodeId: null,
      zoomLevel: 100,
      panOffset: { x: 0, y: 0 },
      canvasBounds: INITIAL_CANVAS_BOUNDS,
      dragState: {
        isDragging: false,
        draggedNodeId: null,
        startPosition: null,
        offset: null
      },
      history: {
        past: [],
        present: {
          nodes: [],
          connections: [],
          selectedNodeId: null,
          zoomLevel: 100,
          panOffset: { x: 0, y: 0 },
          canvasBounds: INITIAL_CANVAS_BOUNDS,
          dragState: {
            isDragging: false,
            draggedNodeId: null,
            startPosition: null,
            offset: null
          },
          history: { past: [], present: {} as WorkspaceState, future: [] }
        },
        future: []
      },

      // Actions
      addNode: (type: NodeType, position: Point) => {
        const state = get()
        
        // Check node limits
        if (type === 'productSpec') {
          const productSpecCount = state.nodes.filter(n => n.type === 'productSpec').length
          if (productSpecCount >= 1) {
            console.log('Maximum 1 product spec allowed')
            return null // Only allow 1 product spec
          }
        } else if (type === 'ad') {
          const adCount = state.nodes.filter(n => n.type === 'ad').length
          if (adCount >= 6) {
            console.log('Maximum 6 ads allowed')
            return null // Max 6 ads
          }
        } else if (type === 'instructions') {
          const instructionCount = state.nodes.filter(n => n.type === 'instructions').length
          if (instructionCount >= 4) {
            console.log('Maximum 4 instructions allowed')
            return null // Max 4 instructions
          }
        } else if (type === 'script') {
          const scriptGenCount = state.nodes.filter(n => n.type === 'script').length
          if (scriptGenCount >= 1) {
            console.log('Maximum 1 script generator allowed')
            return null // Only allow 1 script generator
          }
        }
        
        const id = generateNodeId(type)
        
        // Create node with default data based on type
        let newNode: WorkspaceNode
        
        switch (type) {
          case 'productSpec':
            newNode = {
              id,
              type: 'productSpec',
              position,
              isSelected: false,
              isDragging: false,
              data: {
                documents: []
              }
            } as WorkspaceNode
            break
            
          case 'ad':
            newNode = {
              id,
              type: 'ad',
              position,
              isSelected: false,
              isDragging: false,
              data: {
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
              position,
              isSelected: false,
              isDragging: false,
              data: {
                content: ''
              }
            } as WorkspaceNode
            break
            
          case 'script':
            newNode = {
              id,
              type: 'script',
              position,
              isSelected: false,
              isDragging: false,
              data: {
                messages: [{role: 'assistant', content: 'Add your content and right-click to add more nodes!'}],
                isActive: false
              }
            } as WorkspaceNode
            break
            
          default:
            newNode = {
              id,
              type,
              position,
              isSelected: false,
              isDragging: false,
              data: {}
            } as WorkspaceNode
        }

        set((state) => ({
          nodes: [...state.nodes, newNode],
          selectedNodeId: newNode.id
        }))
        
        // Auto-create connection to script generator if it exists and this isn't a script node
        if (type !== 'script') {
          const scriptGen = get().nodes.find(n => n.type === 'script')
          console.log('Looking for script generator to connect to:', { scriptGen: !!scriptGen, newNodeId: newNode.id })
          if (scriptGen) {
            console.log('Creating connection from', newNode.id, 'to', scriptGen.id)
            get().addConnection(newNode.id, scriptGen.id)
          } else {
            console.log('No script generator found to connect to')
          }
        } else {
          console.log('Not creating connection - node is a script generator itself')
        }
        
        get().pushToHistory()
        return newNode.id
      },

      updateNode: (id: string, updates: Partial<WorkspaceNode>) => {
        set((state) => ({
          nodes: state.nodes.map(node => 
            node.id === id ? { ...node, ...updates } : node
          )
        }))
      },

      deleteNode: (id: string) => {
        set((state) => ({
          nodes: state.nodes.filter(node => node.id !== id),
          connections: state.connections.filter(conn => 
            conn.fromNodeId !== id && conn.toNodeId !== id
          ),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId
        }))
        get().pushToHistory()
      },

      selectNode: (id: string | null) => {
        set((state) => ({
          selectedNodeId: id,
          nodes: state.nodes.map(node => ({
            ...node,
            isSelected: node.id === id
          }))
        }))
      },

      moveNode: (id: string, position: Point) => {
        set((state) => ({
          nodes: state.nodes.map(node => 
            node.id === id ? { ...node, position } : node
          )
        }))
      },

      addConnection: (sourceId: string, targetId: string) => {
        console.log('=== ADD CONNECTION CALLED ===')
        console.log('Source ID:', sourceId)
        console.log('Target ID:', targetId)
        
        const state = get()
        const sourceNode = state.nodes.find(n => n.id === sourceId)
        const targetNode = state.nodes.find(n => n.id === targetId)
        
        console.log('Source node found:', !!sourceNode, sourceNode?.type)
        console.log('Target node found:', !!targetNode, targetNode?.type)
        
        if (!sourceNode || !targetNode) {
          console.log('ERROR: One or both nodes not found!')
          return
        }

        const connectionId = generateConnectionId(sourceId, targetId)
        const existingConnection = state.connections.find(c => c.id === connectionId)
        
        if (existingConnection) {
          console.log('Connection already exists:', connectionId)
          return
        }

        const newConnection: Connection = {
          id: connectionId,
          fromNodeId: sourceId,
          toNodeId: targetId,
          sourceType: sourceNode.type,
          targetType: targetNode.type
        }
        
        console.log('Creating new connection:', newConnection)

        set((state) => ({
          connections: [...state.connections, newConnection]
        }))
        
        console.log('Connection added successfully!')
        console.log('Total connections:', get().connections.length)
        get().pushToHistory()
      },

      removeConnection: (id: string) => {
        set((state) => ({
          connections: state.connections.filter(conn => conn.id !== id)
        }))
        get().pushToHistory()
      },

      setZoomLevel: (level: number) => {
        set({ zoomLevel: Math.max(25, Math.min(200, level)) })
      },

      setPanOffset: (offset: Point) => {
        set({ panOffset: offset })
      },

      setCanvasBounds: (bounds: Bounds) => {
        set({ canvasBounds: bounds })
      },

      startDrag: (nodeId: string, startPosition: Point, offset: Point) => {
        set((state) => ({
          dragState: {
            isDragging: true,
            draggedNodeId: nodeId,
            startPosition,
            offset
          },
          nodes: state.nodes.map(node => ({
            ...node,
            isDragging: node.id === nodeId
          }))
        }))
      },

      updateDrag: (position: Point) => {
        const state = get()
        if (!state.dragState.isDragging || !state.dragState.draggedNodeId) return

        get().moveNode(state.dragState.draggedNodeId, position)
      },

      endDrag: () => {
        set((state) => ({
          dragState: {
            isDragging: false,
            draggedNodeId: null,
            startPosition: null,
            offset: null
          },
          nodes: state.nodes.map(node => ({
            ...node,
            isDragging: false
          }))
        }))
        get().pushToHistory()
      },

      pushToHistory: () => {
        const state = get()
        const currentState = {
          nodes: state.nodes,
          connections: state.connections,
          selectedNodeId: state.selectedNodeId,
          zoomLevel: state.zoomLevel,
          panOffset: state.panOffset,
          canvasBounds: state.canvasBounds,
          dragState: state.dragState,
          history: state.history
        }

        set((state) => ({
          history: {
            past: [...state.history.past, state.history.present].slice(-20), // Keep last 20 states
            present: currentState,
            future: []
          }
        }))
      },

      undo: () => {
        const state = get()
        if (state.history.past.length === 0) return

        const previous = state.history.past[state.history.past.length - 1]
        const newPast = state.history.past.slice(0, -1)

        set({
          ...previous,
          history: {
            past: newPast,
            present: state.history.present,
            future: [state.history.present, ...state.history.future]
          }
        })
      },

      redo: () => {
        const state = get()
        if (state.history.future.length === 0) return

        const next = state.history.future[0]
        const newFuture = state.history.future.slice(1)

        set({
          ...next,
          history: {
            past: [...state.history.past, state.history.present],
            present: next,
            future: newFuture
          }
        })
      },

      reorganizeNodes: () => {
        const state = get()
        const CENTER_X = 0
        const SPACING_X = 300
        const SPACING_Y = 200

        // Find different node types
        const ads = state.nodes.filter(n => n.type === 'ad')
        const instructions = state.nodes.filter(n => n.type === 'instructions')
        const scriptGen = state.nodes.find(n => n.type === 'script')
        const productSpecs = state.nodes.filter(n => n.type === 'productSpec')

        const updatedNodes = [...state.nodes]

        // Position script generator at center
        if (scriptGen) {
          const nodeIndex = updatedNodes.findIndex(n => n.id === scriptGen.id)
          if (nodeIndex !== -1) {
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: {
                x: CENTER_X,
                y: 0
              }
            }
          }
        }

        // Position ads vertically on the left, centered around y=0
        ads.forEach((node, index) => {
          const nodeIndex = updatedNodes.findIndex(n => n.id === node.id)
          if (nodeIndex !== -1) {
            // Center ads vertically around y=0
            const adsCenterY = ads.length > 1 ? -((ads.length - 1) * 120) / 2 : 0
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: {
                x: -300,
                y: adsCenterY + (index * 120)
              }
            }
          }
        })

        // Position product specs centered ABOVE script generator
        productSpecs.forEach((node, index) => {
          const nodeIndex = updatedNodes.findIndex(n => n.id === node.id)
          if (nodeIndex !== -1) {
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: {
                x: CENTER_X + (index * 200) - ((productSpecs.length - 1) * 100), // Center horizontally
                y: -180 // Above script generator
              }
            }
          }
        })

        // Position instructions in 2x2 grid centered BELOW script generator
        instructions.forEach((node, index) => {
          const nodeIndex = updatedNodes.findIndex(n => n.id === node.id)
          if (nodeIndex !== -1) {
            const row = Math.floor(index / 2)
            const col = index % 2
            
            // Center the 2x2 grid horizontally
            const gridWidth = 240 // 2 columns * 120px spacing
            const startX = CENTER_X - (gridWidth / 2) + (col * 240)
            
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: {
                x: startX,
                y: 370 + (row * 130) // Below script generator (320px height + 50px gap)
              }
            }
          }
        })

        set({ 
          nodes: updatedNodes,
          zoomLevel: 100
        })
        get().pushToHistory()
      },

      resetWorkspace: () => {
        console.log('Resetting workspace...');
        set({
          nodes: [],
          connections: [],
          selectedNodeId: null,
          zoomLevel: 100,
          panOffset: { x: 0, y: 0 },
          canvasBounds: INITIAL_CANVAS_BOUNDS,
          dragState: {
            isDragging: false,
            draggedNodeId: null,
            startPosition: null,
            offset: null
          },
          history: {
            past: [],
            present: {} as WorkspaceState,
            future: []
          }
        })
      }
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        connections: state.connections,
        zoomLevel: state.zoomLevel,
        panOffset: state.panOffset,
        canvasBounds: state.canvasBounds
      })
    }
  )
)