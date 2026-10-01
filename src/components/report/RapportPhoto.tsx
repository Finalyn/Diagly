/**
 * Rapport photo, paginé en A4.
 *
 * Le document n'est que l'enveloppe : son contenu vient de `blocsPhotos`, que le
 * rapport documenté réutilise en annexe.
 */
import { DocumentA4, type BlocDocument } from './PagesA4'
import { LogoEntete, TitreRapport } from './shared'
import { blocsPhotos, compterPhotos, groupesAvecPhotos, type GroupePhoto } from './photos'
import { formatDate } from '@/lib/utils'

export function RapportPhoto({ projectName, groups, auteur }: {
  projectName: string
  groups: GroupePhoto[]
  auteur: string
}) {
  const total = compterPhotos(groupesAvecPhotos(groups))
  const aujourdhui = formatDate(new Date())

  const blocs: BlocDocument[] = [
    {
      type: 'bloc',
      cle: 'titre',
      avecSuivant: true,
      noeud: (
        <TitreRapport
          titre="Rapport photo"
          projet={projectName}
          mention={`Édité le ${aujourdhui}${auteur ? ` par ${auteur}` : ''}`}
        />
      ),
    },
    ...blocsPhotos(groups),
    {
      type: 'bloc',
      cle: 'mentions',
      noeud: (
        <p className="mt-6 border-t pt-3 text-muted-foreground">
          Rapport photo généré par Diagly · {total} photo{total !== 1 ? 's' : ''}.
        </p>
      ),
    },
  ]

  return (
    <DocumentA4
      blocs={blocs}
      entete={<LogoEntete />}
      mentionPied={`${projectName} · ${aujourdhui}`}
    />
  )
}
