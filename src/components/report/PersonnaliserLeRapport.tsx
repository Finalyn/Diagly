/**
 * Personnaliser un rapport, pour ce dossier seulement.
 *
 * Les réglages portent la marque du bureau, celle de tous les rapports. Il
 * arrive qu'un dossier demande autre chose : une régie qui impose ses
 * couleurs, un mandat qui part au nom du mandant, une pièce à joindre sans
 * logo. Changer les réglages pour un seul client reviendrait à les changer
 * pour tous, et à l'oublier ensuite.
 *
 * Tout se voit avant d'être enregistré : le document à côté suit la saisie,
 * couleur comme logo. « Appliquer » ne fait que garder ce qu'on voit déjà, et
 * « Annuler » rend le dossier à son dernier état enregistré. On choisit une
 * couleur en la regardant sur la page, pas en imaginant ce qu'elle donnera.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ImagePlus, Loader2, Palette, Settings2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { ACCENT_PAR_DEFAUT, marqueDuRapport, type MarqueDuDossier } from '@/lib/marque'

/** Quelques couleurs sobres, pour ne pas partir d'un sélecteur vide. */
const COULEURS = [
  '#3b82f6', '#1d4ed8', '#0e7490', '#0f766e', '#15803d', '#4d7c0f',
  '#b45309', '#c2410c', '#b91c1c', '#9f1239', '#7c3aed', '#0f172a',
]

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

/** Les trois façons de traiter le logo, dites en toutes lettres. */
type ChoixLogo = 'reglages' | 'autre' | 'aucun'

export function PersonnaliserLeRapport({ projectId, dossier, auteurParDefaut, onApercu }: {
  projectId: string
  dossier: MarqueDuDossier | null | undefined
  auteurParDefaut: string
  /** Remonte le brouillon pour que le document le montre avant l'enregistrement. */
  onApercu: (brouillon: MarqueDuDossier | null) => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const bureau = useAuth((s) => s.user?.preferences?.company)
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  /** Où l'on voulait aller : une adresse, ou null pour « refermer le panneau ». */
  const [sortie, setSortie] = useState<{ vers: string | null } | null>(null)

  const depart = useMemo(() => ({
    name: dossier?.name ?? '',
    auteur: dossier?.auteur ?? '',
    accentColor: dossier?.accentColor ?? '',
    logo: dossier?.logo ?? '',
    choixLogo: (dossier?.sansLogo ? 'aucun' : dossier?.logo ? 'autre' : 'reglages') as ChoixLogo,
  }), [dossier])
  const [f, setF] = useState(depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const brouillon: MarqueDuDossier = useMemo(() => ({
    name: f.name.trim() || null,
    auteur: f.auteur.trim() || null,
    accentColor: f.accentColor || null,
    logo: f.choixLogo === 'autre' ? f.logo || null : null,
    sansLogo: f.choixLogo === 'aucun' || null,
  }), [f])

  // Le document suit la saisie. Fermer le panneau ou quitter la page rend la
  // vue au dernier état enregistré : un aperçu n'est pas un enregistrement.
  useEffect(() => {
    onApercu(ouvert ? brouillon : null)
    return () => onApercu(null)
  }, [ouvert, brouillon, onApercu])

  const effective = marqueDuRapport(bureau, brouillon, auteurParDefaut)
  const modifie = JSON.stringify(f) !== JSON.stringify(depart)
  const ecarte = Boolean(depart.name || depart.auteur || depart.accentColor || depart.choixLogo !== 'reglages')
  const couleurDesReglages = bureau?.accentColor || ACCENT_PAR_DEFAUT

  /**
   * Personne ne quitte la page sur un aperçu.
   *
   * Ce qu'on voit à l'écran n'est pas encore sur le rapport : tant qu'on n'a
   * pas appliqué, le dossier garde son ancienne marque. Partir sans le savoir,
   * c'est croire avoir changé le logo d'un rapport qui sortira comme avant.
   *
   * On retient les trois façons de s'en aller : un lien de l'application (les
   * onglets du dossier, le menu de gauche, le lien vers les réglages), la
   * fermeture ou le rechargement de l'onglet, et le repli du panneau. Le
   * bouton « Précédent » du navigateur n'est pas couvert : l'application n'a
   * pas de routeur de données, et détourner l'historique à la main casserait
   * la navigation plus souvent qu'il ne sauverait une couleur.
   */
  useEffect(() => {
    if (!ouvert || !modifie) return
    const avantFermeture = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const surClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const lien = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!lien || lien.target === '_blank' || lien.hasAttribute('download')) return
      const url = new URL(lien.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const ici = window.location.pathname + window.location.search
      if (url.pathname + url.search === ici) return
      e.preventDefault()
      e.stopPropagation()
      setSortie({ vers: url.pathname + url.search })
    }
    window.addEventListener('beforeunload', avantFermeture)
    document.addEventListener('click', surClic, true)
    return () => {
      window.removeEventListener('beforeunload', avantFermeture)
      document.removeEventListener('click', surClic, true)
    }
  }, [ouvert, modifie])

  const enregistrer = useMutation({
    mutationFn: (valeur: MarqueDuDossier | null) => api.projects.update(projectId, { reportBranding: valeur }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      setErreur(null)
    },
    onError: (e) => setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.'),
  })

  /** On part en laissant le dossier tel qu'il était enregistré. */
  const partir = (vers: string | null) => {
    setSortie(null)
    setF(depart)
    setOuvert(false)
    if (vers) navigate(vers)
  }

  /** On applique d'abord, et l'on ne part que si l'enregistrement a tenu. */
  const appliquerPuisPartir = async (vers: string | null) => {
    try { await enregistrer.mutateAsync(brouillon) }
    catch { setSortie(null); return }
    setSortie(null)
    setOuvert(false)
    if (vers) navigate(vers)
  }

  const revenir = () => {
    setF({ name: '', auteur: '', accentColor: '', logo: '', choixLogo: 'reglages' })
    enregistrer.mutate(null)
  }

  const choisirLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setErreur(null)
    try { poser({ logo: await lireLogo(fichier), choixLogo: 'autre' }) }
    catch { setErreur("Cette image n'a pas pu être lue.") }
  }

  return (
    <div className="border-t pt-4 print:hidden">
      <button
        onClick={() => { if (ouvert && modifie) setSortie({ vers: null }); else setOuvert((v) => !v) }}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Palette className="h-4 w-4 shrink-0" />
        <span className="flex-1">Personnaliser</span>
        {ecarte && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
      </button>

      <Dialog open={sortie !== null} onOpenChange={(o) => { if (!o) setSortie(null) }}>
        <DialogContent className="max-w-md space-y-4">
          <div>
            <h2 className="text-base font-semibold">Vos changements ne sont pas appliqués</h2>
            <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
              Le logo, la couleur, la raison sociale et l’auteur que vous voyez ne sont qu’un aperçu.
              {sortie?.vers
                ? ' Si vous quittez la page maintenant, le rapport repartira avec vos réglages habituels.'
                : ' Si vous refermez le panneau maintenant, le rapport repartira avec vos réglages habituels.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => appliquerPuisPartir(sortie?.vers ?? null)}
              disabled={enregistrer.isPending}
            >
              {enregistrer.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Check className="mr-1.5 h-3.5 w-3.5" />Appliquer et continuer</>}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => partir(sortie?.vers ?? null)}
              disabled={enregistrer.isPending}
            >
              {sortie?.vers ? 'Quitter sans appliquer' : 'Fermer sans appliquer'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSortie(null)} disabled={enregistrer.isPending}>
              Rester
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {ouvert && (
        <div className="mt-2 space-y-4 rounded-xl border bg-muted/30 p-3">
          <p className="text-[11px] leading-snug text-muted-foreground">
            Pour ce dossier seulement, et visible aussitôt sur le document. Ce que vous ne
            choisissez pas vient de vos réglages.
          </p>

          {/* L'en-tête tel qu'il sortira, logo et raison sociale ensemble : c'est
              dans cet ordre qu'ils seront imprimés, et le premier bloc que le
              destinataire lit. Le logo de Diagly y figure quand on n'en a pas
              enregistré, comme sur le document, pour qu'aucune surprise ne
              reste pour l'impression. */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              En-tête du rapport
            </p>
            <div className="flex h-20 flex-col items-center justify-center gap-1 rounded-lg border bg-white px-2">
              {effective.sansLogo
                ? <span className="text-[11px] italic text-muted-foreground">sans logo</span>
                : <img src={effective.logo || '/diagly-logo.svg'} alt="" className="max-h-9 max-w-[60%] object-contain" />}
              {effective.name
                ? <span className="truncate text-[10px] font-semibold text-muted-foreground">{effective.name}</span>
                : <span className="text-[10px] italic text-muted-foreground">sans raison sociale</span>}
            </div>
          </div>

          {/* ---------------- Logo ---------------- */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Logo</p>
            <div className="space-y-1">
              <ChoixRadio
                nom="logo" actif={f.choixLogo === 'reglages'}
                onChoisir={() => poser({ choixLogo: 'reglages' })}
                titre="Celui de mes réglages"
                aide={bureau?.logo ? 'Votre logo habituel' : "Vous n'en avez pas enregistré : le rapport portera celui de Diagly"}
              />
              <ChoixRadio
                nom="logo" actif={f.choixLogo === 'autre'}
                onChoisir={() => poser({ choixLogo: 'autre' })}
                titre="Un autre logo"
                aide={f.logo ? 'Image importée pour ce dossier' : 'À importer ci-dessous'}
              />
              {f.choixLogo === 'autre' && (
                <label className="ml-6 flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-white">
                  <input type="file" accept="image/*" onChange={choisirLogo} className="hidden" />
                  <ImagePlus className="h-3.5 w-3.5" />
                  {f.logo ? 'Remplacer l’image' : 'Choisir une image'}
                </label>
              )}
              <ChoixRadio
                nom="logo" actif={f.choixLogo === 'aucun'}
                onChoisir={() => poser({ choixLogo: 'aucun' })}
                titre="Aucun logo"
                aide="Le rapport part sans aucune image"
              />
            </div>
          </div>

          {/* La raison sociale suit le logo : sur le document, elle est juste
              dessous, et c'est dans cet ordre qu'on la règle. */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Raison sociale</span>
            <Input
              className="h-8 text-xs" value={f.name} placeholder={bureau?.name || 'Celle de vos réglages'}
              onChange={(e) => poser({ name: e.target.value })}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              S’imprime sous le logo, en haut de chaque page.
            </span>
          </label>

          {/* ---------------- Couleur ---------------- */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Couleur</p>
            <div className="grid grid-cols-6 gap-1.5">
              {COULEURS.map((couleur) => (
                <button
                  key={couleur}
                  onClick={() => poser({ accentColor: couleur })}
                  aria-label={`Couleur ${couleur}`}
                  className={cn('h-6 w-full rounded-md border-2 transition-transform hover:scale-105',
                    f.accentColor.toLowerCase() === couleur ? 'border-neutral-900' : 'border-white')}
                  style={{ backgroundColor: couleur }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={f.accentColor || couleurDesReglages}
                onChange={(e) => poser({ accentColor: e.target.value })}
                aria-label="Choisir une couleur libre"
                className="h-8 w-10 shrink-0 cursor-pointer rounded border bg-white"
              />
              <Input
                className="h-8 flex-1 font-mono text-xs"
                value={(f.accentColor || couleurDesReglages).toUpperCase()}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) poser({ accentColor: v.startsWith('#') ? v.toLowerCase() : `#${v.toLowerCase()}` })
                }}
              />
            </div>
            {f.accentColor ? (
              <button
                onClick={() => poser({ accentColor: '' })}
                className="mt-1.5 flex items-center gap-1.5 text-[11px] text-blue-700 hover:underline"
              >
                <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: couleurDesReglages }} />
                Reprendre la couleur de mes réglages
              </button>
            ) : (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: couleurDesReglages }} />
                Couleur de vos réglages
              </p>
            )}
          </div>

          {/* ---------------- Auteur ---------------- */}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Auteur</span>
            <Input
              className="h-8 text-xs" value={f.auteur} placeholder={auteurParDefaut || 'Vous'}
              onChange={(e) => poser({ auteur: e.target.value })}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Signe le rapport, en page de garde et en pied de document.
            </span>
          </label>

          {erreur && <p className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-800">{erreur}</p>}

          <Link
            to="/app/settings?s=personnalisation"
            className="flex items-center gap-1.5 text-[11px] text-blue-700 hover:underline"
          >
            <Settings2 className="h-3 w-3 shrink-0" />
            Changer le logo et la couleur de tous mes rapports
          </Link>

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button
              size="sm"
              onClick={() => enregistrer.mutate(brouillon)}
              disabled={!modifie || enregistrer.isPending}
            >
              {enregistrer.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Check className="mr-1.5 h-3.5 w-3.5" />Appliquer</>}
            </Button>
            {modifie && (
              <Button size="sm" variant="ghost" onClick={() => setF(depart)} disabled={enregistrer.isPending}>
                Annuler
              </Button>
            )}
            {ecarte && !modifie && (
              <Button size="sm" variant="outline" onClick={revenir} disabled={enregistrer.isPending}>
                Tout remettre comme mes réglages
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Un choix parmi trois, avec ce qu'il implique écrit dessous. */
function ChoixRadio({ nom, actif, onChoisir, titre, aide }: {
  nom: string
  actif: boolean
  onChoisir: () => void
  titre: string
  aide?: string
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition-colors',
      actif ? 'bg-white' : 'hover:bg-white/60')}>
      <input type="radio" name={nom} checked={actif} onChange={onChoisir} className="mt-0.5 shrink-0" />
      <span className="min-w-0">
        <span className="block text-xs font-medium leading-tight">{titre}</span>
        {aide && <span className="block text-[11px] leading-snug text-muted-foreground">{aide}</span>}
      </span>
    </label>
  )
}
