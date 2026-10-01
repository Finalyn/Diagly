/**
 * Rapport de l'existant, paginé en A4.
 *
 * Le livrable que le bureau remet à la gérance : pas un tableau de coûts, mais
 * une description ouvrage par ouvrage, avec l'état coché et ce qu'il faut prévoir.
 *
 * Chaque fiche d'ouvrage est un bloc insécable : une description ne se retrouve
 * plus coupée entre deux feuilles, et le titre de chapitre ne reste jamais seul
 * en bas de page.
 */
import { useMemo, type ReactNode } from 'react'
import { DocumentA4, type BlocDocument } from './PagesA4'
import { CaseEtat, Info, Ligne, LogoEntete, SectionTitre, TitreRapport } from './shared'
import { CHAPITRES, ETATS } from './constants'
import { buildingTypeLabels } from '@/data/mock'
import { cfcGroupCode } from '@/lib/cfc'
import { formatDate } from '@/lib/utils'
import type { ApiDiagnosticItem, ApiProject, ElementState } from '@/lib/api-types'

export function RapportExistant({ project, items, etatExistant, auteur }: {
  project: ApiProject
  items: ApiDiagnosticItem[]
  etatExistant: (it: { catalogItemId: number | null; state: ElementState | null }) => string | null
  auteur: string
}) {
  const chapitres = useMemo(() => {
    const reste = new Set(items.map((i) => i.id))
    const sortis = CHAPITRES.map((ch) => {
      const dedans = items
        .filter((i) => ch.groupes.includes(cfcGroupCode(i.cfcCode) ?? ''))
        .sort((a, b) => (a.cfcCode ?? '').localeCompare(b.cfcCode ?? '', undefined, { numeric: true }))
      for (const i of dedans) reste.delete(i.id)
      return { titre: ch.titre, items: dedans }
    })
    // Un ouvrage dont le CFC ne tombe dans aucun chapitre ne doit pas disparaître du rapport.
    const orphelins = items.filter((i) => reste.has(i.id))
    if (orphelins.length) sortis.push({ titre: 'Divers', items: orphelins })
    return sortis.filter((c) => c.items.length > 0)
  }, [items])

  const aujourdhui = formatDate(new Date())
  const niveaux = project.nbFloors ? `${project.nbFloors} niveau${project.nbFloors > 1 ? 'x' : ''}` : null
  const photo = items.find((i) => i.photos.length > 0)?.photos[0]

  const blocs = useMemo(() => {
    const out: BlocDocument[] = []
    const bloc = (cle: string, noeud: ReactNode, o: { nouvellePage?: boolean; avecSuivant?: boolean } = {}) =>
      out.push({ type: 'bloc', cle, noeud, ...o })

    bloc('titre', (
      <TitreRapport
        titre="Rapport de l'existant"
        projet={project.name}
        mention={`Édité le ${aujourdhui}${auteur ? ` par ${auteur}` : ''}`}
      />
    ), { avecSuivant: true })

    bloc('description', (
      <section>
        <SectionTitre>Description du bâtiment</SectionTitre>
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-1">
            <Info l="Adresse" v={[project.address, [project.postalCode, project.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')} />
            {project.yearBuilt && <Info l="Date de construction" v={String(project.yearBuilt)} />}
            {niveaux && <Info l="Nombre de niveaux" v={niveaux} />}
            {project.floorArea != null && <Info l="Surface de plancher" v={`${Math.round(project.floorArea)} m²`} />}
            {project.nbApartments != null && <Info l="Nombre d'appartements" v={String(project.nbApartments)} />}
            <Info l="Type" v={buildingTypeLabels[project.buildingType] ?? project.buildingType} />
          </div>
          {photo && <img src={photo} alt="" className="w-[55mm] shrink-0 rounded border object-cover" />}
        </div>
      </section>
    ))

    bloc('etat-titre', <SectionTitre>État de l'existant</SectionTitre>, { avecSuivant: true })

    if (chapitres.length === 0) {
      bloc('etat-vide', <p className="text-muted-foreground">Aucun ouvrage relevé pour l'instant.</p>)
    }

    for (const ch of chapitres) {
      bloc(`ch-${ch.titre}`, (
        <h3 className="mb-2 mt-3 border-b-2 border-foreground pb-1 font-bold uppercase italic">{ch.titre}</h3>
      ), { avecSuivant: true })

      for (const it of ch.items) {
        const constat = etatExistant(it)
        const travaux = it.works.filter((w) => w && w !== 'Néant')
        bloc(`ouvrage-${it.id}`, (
          <article className="border-t pt-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">
                {it.cfcLabel}
                <span className="ml-2 font-mono font-normal text-muted-foreground">{it.cfcCode}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                {ETATS.map((e) => <CaseEtat key={e} etat={e} actif={it.state === e} />)}
              </div>
            </div>
            {constat && <Ligne titre="État constaté" texte={constat} />}
            {it.notes && <Ligne titre="Observations" texte={it.notes} />}
            {travaux.length > 0 && <Ligne titre="Travaux à prévoir" texte={travaux.join(' ')} />}
            {it.improvement && <Ligne titre="Amélioration possible" texte={it.improvement} />}
            {it.norms && <Ligne titre="Remise aux normes" texte={it.norms} />}
            {!constat && !it.notes && travaux.length === 0 && !it.improvement && !it.norms && (
              <p className="mt-1 italic text-muted-foreground">
                {it.state ? 'Aucune observation saisie.' : 'Élément non encore évalué.'}
              </p>
            )}
          </article>
        ))
      }
    }

    bloc('mentions', (
      <p className="mt-6 border-t pt-3 text-muted-foreground">
        Date d'édition : {aujourdhui}{auteur ? ` · ${auteur}` : ''}.
        Rapport descriptif, établi sur la base d'une visite. Il ne comporte pas de sondage destructif.
      </p>
    ))

    return out
  }, [project, chapitres, etatExistant, niveaux, photo, aujourdhui, auteur])

  return (
    <DocumentA4
      blocs={blocs}
      entete={<LogoEntete />}
      mentionPied={`${project.name} · ${aujourdhui}`}
    />
  )
}
