import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApiUser } from '@/lib/api-types'

interface AuthState {
  user: ApiUser | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: ApiUser, accessToken: string, refreshToken: string) => void
  setAccessToken: (accessToken: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: 'diagly-auth' }
  )
)
