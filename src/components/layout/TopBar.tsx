import { Bell, Search, Menu } from 'lucide-react'
import { Avatar, Button, Input } from '@/components/ui'
import { mockUser } from '@/data/mock'
import { Link } from 'react-router-dom'

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b bg-background px-4 md:px-6 gap-3">
      {/* Mobile menu button */}
      <button onClick={onMenuClick} className="lg:hidden shrink-0">
        <Menu className="h-5 w-5" />
      </button>

      {/* Search - hidden on small mobile */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="relative flex-1 max-w-md hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un diagnostic, batiment, CFC..." className="pl-10" />
        </div>
        {/* Mobile: small search icon */}
        <button className="sm:hidden shrink-0">
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <Link to="/app/settings?tab=notifications">
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">3</span>
          </Button>
        </Link>
        <Link to="/app/settings" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
          <Avatar name={`${mockUser.firstName} ${mockUser.lastName}`} size="sm" />
          <div className="text-sm hidden md:block">
            <p className="font-medium">{mockUser.firstName} {mockUser.lastName}</p>
            <p className="text-xs text-muted-foreground">{mockUser.companyName}</p>
          </div>
        </Link>
      </div>
    </header>
  )
}
