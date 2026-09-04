import { useState } from 'react'
import { Copy, Check, Mail, X } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ApiProject } from '@/lib/api-types'

/**
 * Message pré-écrit pour convenir de la visite avec la gérance ou le propriétaire.
 *
 * Le texte énumère les locaux dont l'accès conditionne le relevé : sans la
 * chaufferie ni les combles, il faut revenir. Il demande aussi les documents à
 * préparer, qui évitent des hypothèses au moment du chiffrage.
 */
function courrielVisite(project: ApiProject): { objet: string; corps: string } {
  const adresse = [project.address, [project.postalCode, project.city].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ')
  const objet = `Visite technique ${adresse || project.name}`
  const corps = [
    'Madame, Monsieur,',
    '',
    `Dans le cadre du diagnostic technique de l'immeuble sis ${adresse || project.name}, nous souhaitons convenir d'une date de visite.`,
    '',
    "La visite dure environ deux heures. Elle demande l'accès aux parties communes et à la cage d'escalier, aux combles et à la toiture si elle est praticable, aux caves, à la buanderie et aux locaux techniques : chaufferie, local électrique, ventilation.",
    '',
    "L'accès à un ou deux appartements représentatifs nous serait précieux pour apprécier l'état des installations sanitaires et des menuiseries. Nous nous adaptons aux disponibilités des locataires.",
    '',
    'Si vous en disposez, merci de préparer les documents suivants : plans du bâtiment, année de construction, dates des dernières rénovations, contrats et rapports d\'entretien des installations techniques, et décomptes de chauffage des trois dernières années.',
    '',
    'Nous vous remercions de nous indiquer vos disponibilités ainsi que le nom de la personne qui nous ouvrira les locaux.',
    '',
    'Avec nos meilleures salutations,',
  ].join('\n')
  return { objet, corps }
}

export function VisitEmail({ project }: { project: ApiProject }) {
  const [ouvert, setOuvert] = useState(false)
  const [copie, setCopie] = useState(false)
  const { objet, corps } = courrielVisite(project)

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(`${objet}\n\n${corps}`)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch { /* presse-papiers indisponible : le texte reste sélectionnable */ }
  }

  if (!ouvert) {
    return (
      <Button variant="outline" onClick={() => setOuvert(true)} className="w-full sm:w-auto">
        <Mail className="mr-2 h-4 w-4" />Organiser la visite
      </Button>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Message à la gérance</p>
          <p className="text-xs text-muted-foreground">Objet : {objet}</p>
        </div>
        <button onClick={() => setOuvert(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <textarea
        readOnly
        value={corps}
        rows={12}
        className="w-full resize-y rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed"
        onFocus={(e) => e.target.select()}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={copier}>
          {copie ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copie ? 'Copié' : 'Copier'}
        </Button>
        <a href={`mailto:?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`}>
          <Button size="sm" variant="outline"><Mail className="mr-1.5 h-3.5 w-3.5" />Ouvrir dans le courrier</Button>
        </a>
      </div>
    </div>
  )
}
