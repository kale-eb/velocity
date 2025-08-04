import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Project } from '../types'

interface ProjectStore {
  // State
  projects: Project[]
  currentProjectId: string | null
  
  // Actions
  createProject: (name: string, description?: string) => string
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  setCurrentProject: (id: string | null) => void
  duplicateProject: (id: string) => string
  
  // Utilities
  getCurrentProject: () => Project | null
  getProjectById: (id: string) => Project | null
  searchProjects: (query: string) => Project[]
}

const generateProjectId = (): string => {
  return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProjectId: null,

      // Actions
      createProject: (name: string, description?: string) => {
        const id = generateProjectId()
        const newProject: Project = {
          id,
          name,
          description,
          workspace: {
            nodes: [],
            connections: [],
            selectedNodeId: null,
            zoomLevel: 100,
            panOffset: { x: 0, y: 0 },
            canvasBounds: {
              minX: 0,
              maxX: 2474,
              minY: 0,
              maxY: 800
            },
            dragState: {
              isDragging: false,
              draggedNodeId: null,
              startPosition: null,
              offset: null
            },
            history: {
              past: [],
              present: {} as any, // Will be properly initialized when workspace is loaded
              future: []
            }
          },
          scripts: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }

        set((state) => ({
          projects: [...state.projects, newProject],
          currentProjectId: id
        }))

        return id
      },

      updateProject: (id: string, updates: Partial<Project>) => {
        set((state) => ({
          projects: state.projects.map(project =>
            project.id === id
              ? { ...project, ...updates, updatedAt: new Date() }
              : project
          )
        }))
      },

      deleteProject: (id: string) => {
        set((state) => ({
          projects: state.projects.filter(project => project.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
        }))
      },

      setCurrentProject: (id: string | null) => {
        set({ currentProjectId: id })
      },

      duplicateProject: (id: string) => {
        const state = get()
        const originalProject = state.projects.find(p => p.id === id)
        
        if (!originalProject) return ''

        const newId = generateProjectId()
        const duplicatedProject: Project = {
          ...originalProject,
          id: newId,
          name: `${originalProject.name} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Deep clone workspace and scripts
          workspace: JSON.parse(JSON.stringify(originalProject.workspace)),
          scripts: JSON.parse(JSON.stringify(originalProject.scripts))
        }

        set((state) => ({
          projects: [...state.projects, duplicatedProject],
          currentProjectId: newId
        }))

        return newId
      },

      // Utilities
      getCurrentProject: () => {
        const state = get()
        return state.projects.find(project => project.id === state.currentProjectId) || null
      },

      getProjectById: (id: string) => {
        return get().projects.find(project => project.id === id) || null
      },

      searchProjects: (query: string) => {
        const state = get()
        const lowercaseQuery = query.toLowerCase()
        
        return state.projects.filter(project =>
          project.name.toLowerCase().includes(lowercaseQuery) ||
          (project.description && project.description.toLowerCase().includes(lowercaseQuery))
        )
      }
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId
      })
    }
  )
)