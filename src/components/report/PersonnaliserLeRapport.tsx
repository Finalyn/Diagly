/**
 * Personnaliser un rapport, pour ce dossier seulement.
 *
 * Les réglages portent la marque du bureau, celle de tous les rapports. Il
 * arrive qu'un dossier demande autre chose : une régie qui impose ses
 * couleurs, un rapport sous-traité qui part au nom du mandant, une pièce à
 * joindre sans logo. Changer les réglages pour un seul client reviendrait à
 * les changer pour tous, et à les oublier ensuite.
 *
 * Ce qui n'est pas dit ici vient des réglages. Le bouton « Revenir à mes
 * réglages » efface tout d'un coup : on doit pouvoir défaire sans savoir ce
 * qu'on avait touché.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Palette, RotateCcw } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { marqueDuRapport, type MarqueDuDossier } from '@/lib/marque'

/** Les mêmes couleurs qu'aux réglages : on choisit dans un jeu connu. */
const COULEURS = ['#3b82f6', '#0f172a', '#0e7490', '#15803d', '#b45309', '#b91c1c', '#7c3aed']

/** Réduit une image à 320 px et rend un data URL léger. */
async function lireLogo(fichier: File): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(fichier)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl
  })
  const echelle = Math.min(1, 320 / Math.max(img.width, img.height))
  const toile = document.createElement('canvas')
  toile.width = Math.round(img.width * echelle)
  toile.height = Math.round(img.height * echelle)
  toile.getContext('2d')!.drawImage(img, 0, 0, toile.width, toile.height)
  return toile.toDataURL('image/png')
}

export function PersonnaliserLeRapport({ projectId, dossier, auteurParDefaut }: {
  projectId: string
  dossier: MarqueDuDossier | null | undefined
  auteurParDefaut: string
}) {
  const qc = useQueryClient()
  const bureau = useAuth((s) => s.user?.preferences?.company)
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const depart = useMemo(() => ({
    name: dossier?.name ?? '',
    auteur: dossier?.auteur ?? '',
    accentColor: dossier?.accentColor ?? '',
    logo: dossier?.logo ?? '',
    sansLogo: dossier?.sansLogo ?? false,
  }), [dossier])
  const [f, setF] = useState(depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const effective = marqueDuRapport(bureau, f, auteurParDefaut)
  const modifie = JSON.stringify(f) !== JSON.stringify(depart)

  const enregistrer = useMutation({
    mutationFn: (valeur: MarqueDuDossier | null) =>
      api.projects.update(projectId, { reportBranding: valeur }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      setErreur(null)
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.'),
  })

  const appliquer = () => enregistrer.mutate({
    name: f.name.trim() || null,
    auteur: f.auteur.trim() || null,
    accentColor: f.accentColor || null,
    logo: f.sansLogo ? null : f.logo || null,
    sansLogo: f.sansLogo || null,
  })

  const revenir = () => {
    setF({ name: '', auteur: '', accentColor: '', logo: '', sansLogo: false })
    enregistrer.mutate(null)
  }

  const choisirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setErreur(null)
    try { poser({ logo: await lireLogo(fichier), sansLogo: false }) }
    catch { setErreur("Cette image n'a pas pu être lue.") }
  }

  const ecarte = Boolean(depart.name || depart.auteur || depart.accentColor || depart.logo || depart.sansLogo)

  return (
    <div className="border-t pt-4 print:hidden">
      <button
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Palette className="h-4 w-4 shrink-0" />
        <span className="flex-1">Personnaliser</span>
        {ecarte && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
      </button>

      {ouvert && (
        <div className="mt-2 space-y-3 rounded-xl border bg-muted/30 p-3">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Pour ce dossier seulement. Ce que vous ne remplissez pas vient de vos réglages.
          </p>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Raison sociale</span>
            <Input
              className="h-8 text-xs" value={f.name} placeholder={bureau?.name || 'Votre entreprise'}
              onChange={(e) => poser({ name: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Auteur</span>
            <Input
              className="h-8 text-xs" value={f.auteur} placeholder={auteurParDefaut || 'Vous'}
              onChange={(e) => poser({ auteur: e.target.value })}
            />
          </label>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Couleur</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => poser({ accentColor: '' })}
                title="Celle de mes réglages"
                className={cn('h-6 rounded-full border px-2 text-[11px]',
                  f.accentColor === '' ? 'border-neutral-900 font-medium' : 'text-muted-foreground')}
              >Mes réglages</button>
              {COULEURS.map((couleur) => (
                <button
                  key={couleur}
                  onClick={() => poser({ accentColor: couleur })}
                  aria-label={`Couleur ${couleur}`}
                  className={cn('h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                    f.accentColor === couleur ? 'border-neutral-900' : 'border-white')}
                  style={{ backgroundColor: couleur }}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Logo</span>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
                {effective.logo
                  ? <img src={effective.logo} alt="" className="max-h-full max-w-full object-contain p-1" />
                  : <span className="text-[9px] text-muted-foreground">aucun</span>}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <label className="block cursor-pointer text-xs font-medium text-blue-700 hover:underline">
                  <input type="file" accept="image/*" onChange={choisirLogo} className="hidden" />
                  Un autre logo
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox" checked={f.sansLogo}
                    onChange={(e) => poser({ sansLogo: e.target.checked })}
                  />
                  Sans logo
                </label>
              </div>
            </div>
          </div>

          {erreur && <p className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-800">{erreur}</p>}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={appliquer} disabled={!modifie || enregistrer.isPending}>
              {enregistrer.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Check className="mr-1.5 h-3.5 w-3.5" />Appliquer</>}
            </Button>
            {ecarte && (
              <Button size="sm" variant="outline" onClick={revenir} disabled={enregistrer.isPending}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Mes réglages
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
