import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownOption {
  value: string
  label: string
  /** Classe de fond pour une pastille de couleur (optionnel, ex. statut). */
  color?: string
}

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Alignement du menu. */
  align?: 'left' | 'right'
  className?: string
}

export function Dropdown({ value, options, onChange, disabled, placeholder, align = 'left', className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border bg-background px-3 h-9 text-sm font-medium transition-colors',
          'hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {current?.color && <span className={cn('h-2 w-2 rounded-full shrink-0', current.color)} />}
        <span className="truncate">{current?.label ?? placeholder ?? '—'}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn(
          'absolute z-30 mt-1 min-w-[12rem] max-h-72 overflow-y-auto rounded-lg border bg-white shadow-lg p-1',
          align === 'right' ? 'right-0' : 'left-0',
        )}>
          {options.map(o => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left transition-colors',
                  selected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                )}
              >
                {o.color && <span className={cn('h-2 w-2 rounded-full shrink-0', o.color)} />}
                <span className="flex-1 truncate">{o.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
