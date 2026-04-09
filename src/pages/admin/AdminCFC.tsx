import { Shield } from 'lucide-react'
import { CFCManager } from '@/pages/app/CFCManager'

export function AdminCFC() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="h-6 w-6 text-primary" />
        <span className="text-sm text-muted-foreground">Administration</span>
      </div>
      <CFCManager />
    </div>
  )
}
