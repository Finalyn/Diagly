import { cn } from '@/lib/utils'
import type { ApiProject } from '@/lib/api-types'
import { comparer, libelleAgent, libelleElement, type Classe } from '@/lib/energie/calcul'
import { assembler, ELEMENTS, type SaisieEnergie } from '@/lib/energie/entree'
import type { OuvrageReleve } from '@/lib/energie/depuis-diagnostic'

/**
 * L'estimation énergétique, telle qu'elle part dans le rapport remis au client.
 *
 * Le chapitre reprend exactement ce que montre l'onglet : même assemblage, même
 * calcul. Un rapport qui annoncerait une autre classe que l'écran serait pire
 * qu'un rapport sans chapitre énergétique.
 *
 * L'avertissement y est répété. À l'écran il est permanent ; sur un document
 * imprimé qui circule sans son contexte, il doit tenir sur la même page que la
 * lettre, sinon c'est la lettre seule qu'on retiendra.
 */

const LETTRES: Classe[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const FOND: Record<Classe, string> = {
  A: 'bg-[#0b8a3e]', B: 'bg-[#3aa23a]', C: 'bg-[#8bbf1e]', D: 'bg-[#e8c000]',
  E: 'bg-[#f08a1d]', F: 'bg-[#e35b11]', G: 'bg-[#d32020]',
}

const MOT_ETAT = ['', 'Très bon', 'Bon', 'Moyen', 'Mauvais']

/** L'échelle A à G en une bande, la classe atteinte en évidence. */
function Bande({ classe }: { classe: Classe }) {
  return (
    <span className="inline-flex overflow-hidden rounded-[3px]">
      {LETTRES.map((l) => (
        <span
          key={l}
          className={cn(
            'px-[7px] py-[1px] text-[9px] font-bold text-white',
            FOND[l],
            l === classe ? '' : 'opacity-30',
          )}
        >
          {l}
        </span>
      ))}
    </span>
  )
}


/** L'avertissement, séparé pour pouvoir le placer en tête du chapitre. */
export function AvertissementEnergie() {
  return (
    <div className="mb-3 border-l-[3px] border-orange-500 bg-orange-50 px-3 py-2">
      <p className="font-semibold">
        Estimation énergétique indicative, méthode simplifiée inspirée du CECB.
      </p>
      <p className="text-muted-foreground">
        Ce document n'est pas un certificat. Seul un expert CECB certifié peut délivrer un
        certificat officiel.
      </p>
    </div>
  )
}

export function CorpsEnergie({ project, ouvrages }: {
  project: ApiProject
  ouvrages: OuvrageReleve[]
}) {
  const saisie = (project.energyData?.estimation as SaisieEnergie | undefined) ?? {}
  const { entree, reprise, mesuresPossibles, cochees, avant, apres } = assembler(project, ouvrages, saisie)
  const gain = comparer(avant, apres, entree.sre)
  const retenues = mesuresPossibles.filter((m) => cochees.includes(m.cle))

  return (
    <div className="space-y-3">
      <SousTitreEnergie>Données retenues</SousTitreEnergie>
      <table className="w-full">
        <tbody>
          <LigneDonnee libelle="Année de construction" valeur={String(entree.anneeConstruction)} />
          <LigneDonnee libelle="Catégorie" valeur={
            { INDIVIDUEL: 'Habitat individuel', COLLECTIF: 'Habitat collectif', ADMINISTRATIF: 'Administratif' }[entree.categorie]
          } />
          <LigneDonnee libelle="Surface de référence énergétique" valeur={`${Math.round(entree.sre)} m²`} />
          <LigneDonnee libelle="Agent énergétique" valeur={libelleAgent(entree.agentChauffage)} />
          <LigneDonnee
            libelle="Eau chaude sanitaire"
            valeur={entree.agentEcs ? `Séparée, ${libelleAgent(entree.agentEcs).toLowerCase()}` : 'Combinée au chauffage'}
          />
          {entree.photovoltaiqueKwc ? (
            <LigneDonnee libelle="Photovoltaïque" valeur={`${entree.photovoltaiqueKwc} kWc installés`} />
          ) : null}
        </tbody>
      </table>

      <SousTitreEnergie>État des éléments</SousTitreEnergie>
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1 font-semibold">Élément</th>
            <th className="py-1 font-semibold">État constaté</th>
            <th className="py-1 font-semibold">Déjà rénové</th>
          </tr>
        </thead>
        <tbody>
          {ELEMENTS.map((e) => (
            <tr key={e} className="border-b border-dotted">
              <td className="py-1">
                {libelleElement(e)}
                {reprise.manquants.includes(e) && (
                  <span className="text-muted-foreground"> (aucun ouvrage relevé, valeur par défaut)</span>
                )}
              </td>
              <td className="py-1">{entree.elements[e].etat} · {MOT_ETAT[entree.elements[e].etat]}</td>
              <td className="py-1">{entree.elements[e].anneeRenovation ?? '—'}</td>
            </tr>
          ))}
          <tr className="border-b border-dotted">
            <td className="py-1">
              Production de chaleur
              {reprise.manquants.includes('production') && (
                <span className="text-muted-foreground"> (aucun ouvrage relevé, valeur par défaut)</span>
              )}
            </td>
            <td className="py-1">{entree.etatProduction} · {MOT_ETAT[entree.etatProduction]}</td>
            <td className="py-1">—</td>
          </tr>
        </tbody>
      </table>

      <SousTitreEnergie>Résultat</SousTitreEnergie>
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1 font-semibold">&nbsp;</th>
            <th className="py-1 font-semibold">Aujourd'hui</th>
            <th className="py-1 font-semibold">Après les mesures retenues</th>
          </tr>
        </thead>
        <tbody>
          <LigneResultat
            libelle="Enveloppe"
            classeA={avant.enveloppe.classe} valeurA={avant.enveloppe.qh}
            classeB={apres.enveloppe.classe} valeurB={apres.enveloppe.qh}
          />
          <LigneResultat
            libelle="Global"
            classeA={avant.global.classe} valeurA={avant.global.energiePonderee}
            classeB={apres.global.classe} valeurB={apres.global.energiePonderee}
          />
        </tbody>
      </table>

      <p>
        Gain estimé <strong>{gain.gainPourcent} %</strong>, soit {gain.economieParM2} kWh/m²·an,
        ou environ <strong>{gain.economieParAn.toLocaleString('fr-CH').replace(/\s/g, "'")} kWh par an</strong> pour
        ce bâtiment.
      </p>

      <SousTitreEnergie>Mesures retenues dans ce scénario</SousTitreEnergie>
      {retenues.length === 0 ? (
        <p className="text-muted-foreground">Aucune mesure retenue : le scénario reprend l'état actuel.</p>
      ) : (
        <ul className="list-disc pl-5">
          {retenues.map((m) => <li key={m.cle}>{m.libelle}</li>)}
        </ul>
      )}

      {avant.provisoire.length > 0 && (
        <p className="border-t pt-2 text-muted-foreground">
          Tables de calcul encore provisoires : {avant.provisoire.join(', ')}. La classe globale est à
          lire comme un ordre de grandeur tant que les valeurs officielles ne sont pas renseignées.
        </p>
      )}
    </div>
  )
}

function SousTitreEnergie({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 font-semibold italic">{children}</p>
}

function LigneDonnee({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <tr className="border-b border-dotted">
      <td className="w-1/2 py-1 text-muted-foreground">{libelle}</td>
      <td className="py-1">{valeur}</td>
    </tr>
  )
}

function LigneResultat({ libelle, classeA, valeurA, classeB, valeurB }: {
  libelle: string
  classeA: Classe; valeurA: number
  classeB: Classe; valeurB: number
}) {
  return (
    <tr className="border-b border-dotted">
      <td className="py-1.5 font-semibold">{libelle}</td>
      <td className="py-1.5">
        <Bande classe={classeA} />
        <span className="ml-2 tabular-nums">{Math.round(valeurA)} kWh/m²·an</span>
      </td>
      <td className="py-1.5">
        <Bande classe={classeB} />
        <span className="ml-2 tabular-nums">{Math.round(valeurB)} kWh/m²·an</span>
      </td>
    </tr>
  )
}
