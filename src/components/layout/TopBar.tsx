import { Bell, Search } from 'lucide-react'
import { Avatar, Button, Input } from '@/components/ui'
import { mockUser } from '@/data/mock'

export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un projet, batiment, CFC..." className="pl-10" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">3</span>
        </Button>
        <div className="flex items-center gap-3">
          <Avatar name={`${mockUser.firstName} ${mockUser.lastName}`} size="sm" />
          <div className="text-sm">
            <p className="font-medium">{mockUser.firstName} {mockUser.lastName}</p>
            <p className="text-xs text-muted-foreground">{mockUser.companyName}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
