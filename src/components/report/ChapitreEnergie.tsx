import { cn, formatCHF } from '@/lib/utils'
import type { ApiProject } from '@/lib/api-types'
import type { Devis, DevisLigne } from '@/lib/devis'
import { comparer, libelleAgent, libelleElement, type Classe, type ElementEnveloppe } from '@/lib/energie/calcul'
import { assembler, ELEMENTS, type MesurePossible, type SaisieEnergie } from '@/lib/energie/entree'
import { elementDuCfc, type OuvrageReleve } from '@/lib/energie/depuis-diagnostic'

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
        Estimation énergétique indicative, méthode simplifiée inspirée de celle du CECB®.
      </p>
      <p className="text-muted-foreground">
        Ce document n'est pas un certificat. Seul un expert CECB certifié peut délivrer un
        certificat officiel.
      </p>
    </div>
  )
}

/**
 * Les lignes du devis qui chiffrent une mesure du scénario : les améliorations
 * des ouvrages rattachés au même élément (toiture, façades, fenêtres, sol), ou
 * à la production de chaleur.
 */
function lignesDeLaMesure(m: MesurePossible, devis: Devis | undefined): DevisLigne[] {
  if (!devis) return []
  const cible: ElementEnveloppe | 'production' | null =
    m.mesure.type === 'ISOLER' ? m.mesure.element : m.mesure.type === 'PRODUCTION' ? 'production' : null
  if (!cible) return []
  return devis.lignes.filter((l) => l.enveloppe === 'Amélioration' && !l.automatique && elementDuCfc(l.cfcCode) === cible)
}

const SOURCE_AGENT = {
  saisie: "corrigé dans l'onglet Étiquette énergétique",
  releve: 'relevé sur place',
  dossier: 'certificat ou registre du dossier',
  defaut: 'valeur par défaut, à confirmer',
} as const

export function CorpsEnergie({ project, ouvrages, devis, client = false, partie }: {
  project: ApiProject
  ouvrages: OuvrageReleve[]
  /** Le devis du dossier : chaque mesure retenue renvoie à son option chiffrée. */
  devis?: Devis
  /** Version remise au client : sans les mentions de mise au point du calcul. */
  client?: boolean
  /**
   * Une moitié du chapitre : les données et l'état des éléments, ou le
   * résultat et les mesures. Le rapport en fait deux blocs, qui se répartissent
   * sur les pages ; d'un seul tenant, il laissait son titre seul en bas d'une page.
   */
  partie?: 'donnees' | 'resultat'
}) {
  const saisie = (project.energyData?.estimation as SaisieEnergie | undefined) ?? {}
  const { entree, reprise, mesuresPossibles, cochees, avant, apres, sourceAgent } = assembler(project, ouvrages, saisie)
  const gain = comparer(avant, apres, entree.sre)
  const retenues = mesuresPossibles.filter((m) => cochees.includes(m.cle))
  const chiffrage = retenues.map((m) => ({ m, lignes: lignesDeLaMesure(m, devis) }))
  const coutScenario = chiffrage.reduce((s, c) => s + c.lignes.reduce((t, l) => t + l.montant, 0), 0)
  const nonChiffrees = chiffrage.filter((c) => c.lignes.length === 0 || c.lignes.some((l) => l.aChiffrer))

  const donnees = partie !== 'resultat'
  const resultat = partie !== 'donnees'
  return (
    <div className="space-y-3">
      {donnees && <>
      <SousTitreEnergie>Données retenues</SousTitreEnergie>
      <table className="w-full">
        <tbody>
          <LigneDonnee libelle="Année de construction" valeur={String(entree.anneeConstruction)} />
          <LigneDonnee libelle="Catégorie" valeur={
            { INDIVIDUEL: 'Habitat individuel', COLLECTIF: 'Habitat collectif', ADMINISTRATIF: 'Administratif' }[entree.categorie]
          } />
          <LigneDonnee libelle="Surface de référence énergétique" valeur={`${Math.round(entree.sre)} m²`} />
          <LigneDonnee libelle="Agent énergétique" valeur={`${libelleAgent(entree.agentChauffage)} (${SOURCE_AGENT[sourceAgent]})`} />
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
                {reprise.origines[e]?.length > 0 && !saisie.etats?.[e] && (
                  <span className="block text-muted-foreground">d'après {reprise.origines[e].slice(0, 2).join(', ')}</span>
                )}
              </td>
              <td className="py-1">{entree.elements[e].etat} · {MOT_ETAT[entree.elements[e].etat]}</td>
              <td className="py-1">{entree.elements[e].anneeRenovation ?? 'n.c.'}</td>
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
            <td className="py-1">n.c.</td>
          </tr>
        </tbody>
      </table>

      </>}

      {resultat && <>
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
        Gain estimé <strong>{String(gain.gainPourcent).replace('.', ',')} %</strong>, soit {String(gain.economieParM2).replace('.', ',')} kWh/m²·an,
        ou environ <strong>{gain.economieParAn.toLocaleString('fr-CH').replace(/\s/g, "'")} kWh par an</strong> pour
        ce bâtiment.
      </p>

      <SousTitreEnergie>Mesures retenues dans ce scénario, et leur coût</SousTitreEnergie>
      {retenues.length === 0 ? (
        <p className="text-muted-foreground">Aucune mesure retenue : le scénario reprend l'état actuel.</p>
      ) : (
        <table className="w-full">
          <tbody>
            {chiffrage.map(({ m, lignes }) => (
              <tr key={m.cle} className="border-b border-dotted align-top">
                <td className="py-1">
                  {m.libelle}
                  {lignes.length > 0 && (
                    <span className="block text-muted-foreground">
                      Au devis : {lignes.map((l) => l.libelle).join(', ')}
                    </span>
                  )}
                </td>
                <td className="w-36 py-1 text-right tabular-nums">
                  {lignes.length === 0 || lignes.some((l) => l.aChiffrer)
                    ? <span className="font-medium text-amber-700">à chiffrer</span>
                    : formatCHF(lignes.reduce((s, l) => s + l.montant, 0))}
                </td>
              </tr>
            ))}
            {devis && (
              <tr className="font-semibold">
                <td className="py-1.5">Coût du scénario (HT, améliorations chiffrées)</td>
                <td className="py-1.5 text-right tabular-nums">{formatCHF(coutScenario)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {devis && nonChiffrees.length > 0 && (
        <p className="text-muted-foreground">
          Le gain annoncé suppose toutes les mesures ci-dessus. {nonChiffrees.length === 1 ? 'Une mesure n’a' : `${nonChiffrees.length} mesures n’ont`} pas
          encore d'option chiffrée au devis : le coût du scénario ne {nonChiffrees.length === 1 ? 'la' : 'les'} comprend pas.
        </p>
      )}

      {!client && avant.provisoire.length > 0 && (
        <p className="border-t pt-2 text-muted-foreground">
          Tables de calcul encore provisoires : {avant.provisoire.join(', ')}. La classe globale est à
          lire comme un ordre de grandeur tant que les valeurs officielles ne sont pas renseignées.
        </p>
      )}
      </>}
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
