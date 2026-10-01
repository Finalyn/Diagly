/**
 * Blocs du reportage photo.
 *
 * Séparés du composant : le rapport photo les enveloppe dans son propre document,
 * le rapport documenté les annexe au sien. Un fichier qui exporterait à la fois le
 * composant et ces fonctions casserait le rafraîchissement à chaud de Vite.
 *
 * Les photos étaient posées dans une carte qui défilait : à l'impression, le
 * navigateur coupait une vignette en deux au hasard d'un saut de page. Elles sont
 * maintenant réparties par rangées de trois, et chaque rangée est un bloc
 * insécable : une photo n'est plus jamais coupée entre deux feuilles.
 */
import type { BlocDocument } from './PagesA4'
import { SectionTitre } from './shared'
import { stateLabels } from '@/data/mock'
import type { ElementState } from '@/lib/api-types'

export interface ItemPhoto {
  id: string
  cfcCode: string
  cfcLabel: string
  state: ElementState | null
  priority: string | null
  photos: string[]
  notes: string | null
  works: string[]
}

export interface GroupePhoto {
  code: string
  label: string
  items: ItemPhoto[]
}

/** Rangées de trois : la largeur utile d'une page en tient trois de front. */
const PAR_RANGEE = 3

function rangees<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

/** Ne garde que les groupes dont au moins un ouvrage porte une photo. */
export function groupesAvecPhotos(groups: GroupePhoto[]): GroupePhoto[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.photos.length > 0) }))
    .filter((g) => g.items.length > 0)
}

export function compterPhotos(groups: GroupePhoto[]): number {
  return groups.reduce((s, g) => s + g.items.reduce((n, i) => n + i.photos.length, 0), 0)
}

/**
 * Blocs du reportage photo, sans titre de document ni mentions : le rapport
 * photo les enveloppe, le rapport documenté les annexe.
 */
export function blocsPhotos(groups: GroupePhoto[], prefixe = 'photo'): BlocDocument[] {
  const avecPhotos = groupesAvecPhotos(groups)
  const out: BlocDocument[] = []

  if (avecPhotos.length === 0) {
    out.push({
      type: 'bloc',
      cle: `${prefixe}-vide`,
      noeud: (
        <p className="text-muted-foreground">
          Aucune photo n'a encore été prise dans le diagnostic. Ajoutez des photos sur les
          éléments depuis l'éditeur.
        </p>
      ),
    })
    return out
  }

  for (const g of avecPhotos) {
    out.push({
      type: 'bloc',
      cle: `${prefixe}-g-${g.code || 'nc'}`,
      noeud: <SectionTitre>{g.code ? `${g.code} · ${g.label}` : g.label}</SectionTitre>,
      avecSuivant: true,
    })

    for (const it of g.items) {
      out.push({
        type: 'bloc',
        cle: `${prefixe}-i-${it.id}`,
        avecSuivant: true,
        noeud: (
          <div className="mt-2">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-mono text-muted-foreground">{it.cfcCode}</span>
              <span className="font-semibold">{it.cfcLabel}</span>
              <span className="text-muted-foreground">
                {it.state ? stateLabels[it.state] : 'À évaluer'}
                {it.priority ? ` · Priorité ${it.priority}` : ''}
              </span>
            </p>
            {(it.notes || it.works.length > 0) && (
              <p className="text-muted-foreground">{it.notes || it.works.join(' · ')}</p>
            )}
          </div>
        ),
      })

      rangees(it.photos, PAR_RANGEE).forEach((rangee, n) => {
        out.push({
          type: 'bloc',
          cle: `${prefixe}-i-${it.id}-r${n}`,
          noeud: (
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {rangee.map((src, i) => (
                <img key={i} src={src} alt="" className="aspect-[4/3] w-full rounded border object-cover" />
              ))}
            </div>
          ),
        })
      })
    }
  }

  return out
}
