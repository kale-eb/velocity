import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Theme, UIState } from '../types'

interface UIStore extends UIState {
  // Actions
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Utility actions
  resetUI: () => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'light',
      sidebarOpen: true,
      chatOpen: false,
      loading: false,
      error: null,

      // Actions

      setTheme: (theme: Theme) => {
        set({ theme })
        
        // Apply theme to document
        const root = document.documentElement
        root.className = theme
        
        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')
        if (metaThemeColor) {
          const colors = {
            light: '#ffffff',
            dark: '#1a1a1a',
            experimental: '#0f0f23'
          }
          metaThemeColor.setAttribute('content', colors[theme])
        }
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }))
      },

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open })
      },

      toggleChat: () => {
        set((state) => ({ chatOpen: !state.chatOpen }))
      },

      setChatOpen: (open: boolean) => {
        set({ chatOpen: open })
      },

      setLoading: (loading: boolean) => {
        set({ loading })
      },

      setError: (error: string | null) => {
        set({ error })
      },

      resetUI: () => {
        set({
          theme: 'light',
          sidebarOpen: true,
          chatOpen: false,
          loading: false,
          error: null
        })
      }
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen
      })
    }
  )
)

// Initialize theme on store creation
const initialTheme = useUIStore.getState().theme
useUIStore.getState().setTheme(initialTheme)