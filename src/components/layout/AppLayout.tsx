import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'

export function AppLayout() {
  const location = useLocation()
  const mainRef = useRef<HTMLDivElement>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 h-full">
            <Sidebar />
            <button onClick={() => setMobileMenuOpen(false)} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
