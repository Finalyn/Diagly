/**
 * Briques communes aux rapports.
 *
 * Ces éléments étaient définis dans ProjectRapports et servaient à ses quatre
 * variantes. Le rapport complet les réutilise tels quels : un en-tête de marque
 * ou une case d'état qui diverge d'un rapport à l'autre se remarque tout de suite
 * quand les deux documents partent chez le même client.
 */
import type { ReactNode } from 'react'
import { stateColors, stateLabels } from '@/data/mock'
import { cn } from '@/lib/utils'
import type { ElementState } from '@/lib/api-types'
import { useMarque } from './use-marque'

/**
 * Logo répété en haut de chaque feuille A4.
 *
 * Celui de l'entreprise s'il est renseigné dans Paramètres → Entreprise, sinon
 * celui de Diagly : un rapport sans logo n'a l'air de rien, et c'est la première
 * chose que le destinataire voit. Il était auparavant posé une seule fois, en
 * tête du document ; depuis que tous les rapports sont paginés, il revient sur
 * chaque page, comme sur un papier à en-tête.
 */
export function LogoEntete() {
  const marque = useMarque()
  return (
    <div className="flex items-center gap-2">
      {marque.name && <span className="text-[9pt] font-semibold text-muted-foreground">{marque.name}</span>}
      <img
        src={marque.logo || '/diagly-logo.svg'}
        alt={marque.name || 'Diagly'}
        className="max-h-[10mm] w-auto object-contain"
      />
    </div>
  )
}

/** Titre d'ouverture d'un rapport paginé : il occupe le premier bloc de la page 1. */
export function TitreRapport({ titre, projet, mention }: {
  titre: string
  projet: string
  mention?: ReactNode
}) {
  // Le trait porte la couleur du rapport : c'est le seul endroit du document
  // imprimé où elle se voit, et elle n'aurait aucun effet sans cela.
  const marque = useMarque()
  return (
    <div className="mb-4 border-b-2 pb-2" style={{ borderColor: marque.accentColor ?? undefined }}>
      <h1 className="text-2xl font-bold">{titre}</h1>
      <p className="text-muted-foreground">{projet}</p>
      {mention && <p className="text-muted-foreground">{mention}</p>}
    </div>
  )
}

/**
 * Intitulé de section à l'intérieur d'un rapport.
 *
 * Il porte lui-même son espace au-dessus : chaque section étant un bloc distinct
 * de la pagination, la marge d'un voisin ne se propage pas jusqu'à lui, et le
 * titre venait coller la dernière ligne de la section précédente.
 */
export function SectionTitre({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 border-b border-foreground/40 pb-1 font-bold uppercase tracking-wide">
      {children}
    </h2>
  )
}

/** Case à cocher du modèle papier : l'état constaté est coché et coloré. */
export function CaseEtat({ etat, actif }: { etat: ElementState; actif: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', actif ? 'font-semibold' : 'text-muted-foreground')}>
      <span className={cn('inline-flex h-3 w-3 items-center justify-center border text-[9px] leading-none',
        actif ? `${stateColors[etat]} border-transparent text-white` : 'border-current')}
      >{actif ? '×' : ''}</span>
      {stateLabels[etat]}
    </span>
  )
}

/** Paragraphe du modèle : intitulé souligné, puis le texte à la suite. */
export function Ligne({ titre, texte }: { titre: string; texte: string }) {
  return (
    <p className="mt-1 text-sm">
      <span className="underline">{titre}</span> : <span className="text-muted-foreground">{texte}</span>
    </p>
  )
}

export function Info({ l, v }: { l: string; v: string }) {
  return <p><span className="text-muted-foreground">{l} :</span> {v}</p>
}

export function Row({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className={strong ? 'font-semibold' : ''}>{v}</span></div>
}
