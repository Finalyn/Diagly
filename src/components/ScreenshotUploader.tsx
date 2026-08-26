import { useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { api } from '@/lib/api'

/** Sélecteur de captures d'écran : upload immédiat, miniatures, retrait. Max 6 images. */
export function ScreenshotUploader({ urls, onChange, max = 6 }: { urls: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true); setError(null)
    try {
      const added: string[] = []
      for (const f of Array.from(files).slice(0, max - urls.length)) {
        const r = await api.support.uploadAttachment(f)
        added.push(r.url)
      }
      onChange([...urls, ...added].slice(0, max))
    } catch { setError("Échec de l'envoi de l'image (PNG/JPG/WEBP, 10 Mo max).") } finally { setUploading(false) }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative">
            <img src={api.support.attachmentUrl(u)} alt="" className="h-16 w-16 object-cover rounded border" />
            <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 shadow-sm hover:bg-muted">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {urls.length < max && (
          <label className="h-16 w-16 rounded border border-dashed flex items-center justify-center cursor-pointer hover:bg-muted text-muted-foreground" title="Ajouter une capture">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
