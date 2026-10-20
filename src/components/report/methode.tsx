/**
 * Chapitre 1 du rapport : comment il est réalisé.
 *
 * L'explication, la méthode détaillée et le cadre normatif étaient trois
 * morceaux (un préambule en tête, deux annexes en fin) qui se répétaient : les
 * quatre états et les priorités s'y lisaient deux fois. Ils sont fusionnés en
 * un chapitre d'environ quatre pages, qui répond seul à « d'où sort ce
 * chiffre ? ».
 *
 * Les taux sont lus sur le dossier, jamais écrits dans le texte : un rapport
 * qui annonce 12 % d'honoraires alors que le dossier en applique 15 se
 * contredit tout seul, et c'est le texte qu'on croit.
 */
import type { ReactNode } from 'react'
import { priorityDescriptions, priorityTextColors } from '@/data/mock'
import { inciseIndexation, priceBasisNote } from '@/lib/diagnostic-auto'
import { HORIZON, PRIORITES, TVA, type Devis } from '@/lib/devis'
import { cn } from '@/lib/utils'
import type { ApiProject, ElementState } from '@/lib/api-types'
import { CaseEtat } from './shared'
import { SousTitre } from './devis-tableaux'

const nombreFr = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')
const pct = (v: number | null | undefined) => `${nombreFr(v ?? 0)} %`

/** Un tableau à deux colonnes : l'intitulé, et ce qu'il veut dire. */
function tableau(lignes: [ReactNode, ReactNode][], largeur = 'w-40') {
  return (
    <table className="w-full">
      <tbody>
        {lignes.map(([l, note], i) => (
          <tr key={i} className="border-t align-top">
            <td className={cn(largeur, 'py-1.5 font-medium')}>{l}</td>
            <td className="py-1.5 text-muted-foreground">{note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Les blocs du chapitre, à la suite de son titre. */
export function blocsMethode(project: ApiProject, devis: Devis): [string, ReactNode][] {
  const s: [string, ReactNode][] = []

  s.push(['m-intro', (
    <>
      <p className="mb-2">
        Le bâtiment est parcouru ouvrage par ouvrage, sur place et à vue : structure, façades,
        fenêtres, toiture, installations techniques, aménagements intérieurs et extérieurs. Chaque
        ouvrage est lu avec le référentiel du bureau, une liste fermée d'ouvrages types. Pour
        chacun, le diagnostiqueur note l'état qu'il constate, prend des photos et rédige ses
        observations ; les travaux, leur priorité, leur quantité et leur prix découlent du
        référentiel, puis sont ajustés si la visite l'exige.
      </p>
      <p>
        Le rapport est donc la somme d'observations individuelles, chacune traçable de la photo
        prise sur place jusqu'au prix appliqué au devis. Deux bâtiments diagnostiqués par deux
        personnes différentes se comparent, parce qu'ils sont lus avec la même grille.
      </p>
    </>
  )])

  s.push(['m-etats', (
    <div className="mt-5">
      <SousTitre>Quatre états</SousTitre>
      <p className="mb-2">
        L'état décrit ce qui a été vu, jamais ce qu'il faut faire : il sépare le constat, qui
        engage le diagnostiqueur, de la décision de travaux, qui appartient au propriétaire.
      </p>
      <table className="w-full">
        <tbody>
          {([
            ['TRES_BON', "Aucune dégradation. L'ouvrage remplit sa fonction et n'appelle aucune dépense."],
            ['BON', "Usure normale, sans conséquence sur la fonction. L'entretien courant suffit."],
            ['MOYEN', 'Dégradation visible et qui progresse. Une réparation maintenant évite un remplacement complet ensuite.'],
            ['MAUVAIS', 'Fin de vie, fonction compromise ou sécurité en jeu. Dépose et remplacement complet.'],
          ] as [ElementState, string][]).map(([e, texte]) => (
            <tr key={e} className="border-t align-top">
              <td className="w-32 py-1.5"><CaseEtat etat={e} actif /></td>
              <td className="py-1.5 text-muted-foreground">{texte}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        Un ouvrage en état moyen ou mauvais porte toujours une observation rédigée : elle dit ce
        qui a été vu, et pourquoi l'état a été retenu.
      </p>
    </div>
  )])

  s.push(['m-enveloppes', (
    <div className="mt-5">
      <SousTitre>Quatre enveloppes de dépenses</SousTitre>
      <p className="mb-2">
        Le devis range chaque ligne dans une enveloppe. Elles ne se mélangent pas : les
        additionner sans les distinguer masquerait ce qui est subi et ce qui est choisi.
      </p>
      {tableau([
        ['Postes de chantier', "Ce qui accompagne tout chantier sans venir d'une observation : installation de chantier, protection des ouvrages existants, échafaudages, nettoyage. Ils sont comptés d'office, selon les règles énoncées plus bas."],
        ['Réparation', "Remettre l'ouvrage dans l'état où il devrait être. C'est la seule enveloppe imposée par la dégradation constatée."],
        ['Mise aux normes', "Rattraper un écart avec une norme en vigueur : hauteur de garde-corps, résistance au feu d'une porte palière, sécurité électrique. Elle ne dépend pas de l'état : un ouvrage en bon état peut être non conforme."],
        ['Amélioration', "Aller au-delà de l'état d'origine : performance énergétique, confort, valeur. Facultative, elle se décide séparément. Quand elle rend une réparation inutile (une isolation périphérique remplace la réfection du crépi), la réparation est déduite et l'amélioration se lit à son montant net."],
      ])}
    </div>
  )])

  s.push(['m-priorites', (
    <div className="mt-5">
      <SousTitre>Trois priorités</SousTitre>
      <p className="mb-2">
        La priorité est proposée d'après l'état, puis arbitrée par le diagnostiqueur, qui seul voit
        le contexte : un ouvrage en état moyen devient urgent s'il en met un autre en péril, et une
        réfection sans enjeu peut attendre le prochain chantier pour mutualiser l'échafaudage.
      </p>
      <table className="w-full">
        <tbody>
          {PRIORITES.map((p) => (
            <tr key={p} className="border-t align-top">
              <td className={cn('w-44 py-1.5 font-semibold', priorityTextColors[p])}>
                Priorité {p} <span className="font-normal text-muted-foreground">({HORIZON[p]})</span>
              </td>
              <td className="py-1.5 text-muted-foreground">{priorityDescriptions[p]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )])

  s.push(['m-dureevie', (
    <div className="mt-5">
      <SousTitre>Durée de vie restante</SousTitre>
      <p>
        L'état dit ce que vaut un ouvrage aujourd'hui ; la durée de vie restante dit combien de temps
        il lui reste : année de pose + durée de vie de référence − année actuelle. Les durées de
        référence dépendent du type d'ouvrage et suivent la SIA 469. Lorsque l'année de pose n'a pas
        pu être relevée, la durée restante n'est pas calculée et l'ouvrage porte la mention « année
        de pose non relevée » : reprendre l'année de construction ferait passer pour d'origine des
        ouvrages remplacés depuis.
      </p>
    </div>
  )])

  s.push(['m-quantites', (
    <div className="mt-5">
      <SousTitre>Les quantités</SousTitre>
      <p className="mb-2">
        Chaque ouvrage porte son unité de métré (m² de façade, m² de toiture, mètre linéaire, pièce,
        forfait) et la règle qui donne sa quantité à partir des dimensions du bâtiment. Ces
        dimensions sont listées au chapitre « Données du projet » avec leur source : les métrés
        calculés sur les plans du bâtiment quand ils ont été analysés, sinon les données du
        registre fédéral des bâtiments et les ratios qui s'en déduisent.
      </p>
      <p>
        Une quantité mesurée sur place remplace le calcul ; elle est alors figée et ne suit plus les
        corrections du dossier, parce qu'une mesure au mètre vaut mieux qu'une déduction. Seules les
        quantités qui diffèrent du calcul sont dites « relevées sur place ».
      </p>
    </div>
  )])

  s.push(['m-prix', (
    <div className="mt-5">
      <SousTitre>Les prix et les majorations</SousTitre>
      <p className="mb-2">
        Les prix viennent du catalogue Diagly, qui fixe pour chaque ouvrage un prix unitaire par état
        ainsi qu'un prix pour l'amélioration et la mise aux normes. Ils sont {inciseIndexation()},
        puis majorés dans cet ordre :
      </p>
      {tableau([
        ['Travaux (HT)', 'somme des lignes du devis, toutes enveloppes comprises'],
        [`Honoraires (${pct(project.honoraryPct)})`, 'calculés sur le montant des travaux'],
        [`Réserve pour imprévus (${pct(project.reservePct)})`, "calculée sur les travaux majorés des honoraires"],
        ...(devis.cascade.detailFrais.length > 0
          ? [['Frais secondaires', devis.cascade.detailFrais.map((f) => f.libelle).join(', ')] as [ReactNode, ReactNode]]
          : []),
        [`TVA (${nombreFr(TVA * 100)} %)`, 'appliquée au sous-total'],
      ], 'w-56')}
      <p className="mt-2 text-muted-foreground">{priceBasisNote()}</p>
    </div>
  )])

  if (devis.reglesAppliquees.length > 0) {
    s.push(['m-postes', (
      <div className="mt-5">
        <SousTitre>Les postes comptés d'office</SousTitre>
        <ul className="space-y-1 text-muted-foreground">
          {devis.reglesAppliquees.map((r) => (
            <li key={r} className="flex gap-2"><span aria-hidden>·</span><span>{r}</span></li>
          ))}
        </ul>
      </div>
    )])
  }

  s.push(['m-precision', (
    <div className="mt-5">
      <SousTitre>La précision</SousTitre>
      <p>
        L'estimation est donnée à <b>±15 %</b>. Cette fourchette recouvre l'écart normal entre un
        métré déduit et un métré d'exécution, la dispersion des offres d'entreprises, et ce qu'une
        visite sans sondage ne peut pas voir. Le total est une enveloppe de décision, pas un prix
        d'adjudication : un devis d'entreprise reste nécessaire avant d'engager les travaux.
      </p>
    </div>
  )])

  s.push(['m-perimetre', (
    <div className="mt-5">
      <SousTitre>Ce que le rapport couvre, et ce qu'il ne couvre pas</SousTitre>
      <table className="w-full">
        <tbody>
          {([
            ['État physique et fonctionnel des ouvrages visibles', true],
            ['Travaux de remise en état, mises aux normes et améliorations, et leur estimation', true],
            ['Installations techniques accessibles à la visite', true],
            ['Sondages destructifs et ouvertures de parois', false],
            ['Calcul de structure et vérification portante', false],
            ["Repérage de l'amiante et des polluants du bâtiment", false],
            ['Mise en conformité incendie et sécurité', false],
            ['Planification, appels d’offres et direction des travaux', false],
          ] as [string, boolean][]).map(([l, inclus]) => (
            <tr key={l} className="border-t align-top">
              <td className="py-1.5">{l}</td>
              <td className={cn('w-20 py-1.5 text-right font-medium', inclus ? 'text-emerald-700' : 'text-muted-foreground')}>
                {inclus ? 'Oui' : 'Non'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        Le diagnostic est établi à vue, sans sondage. Les points marqués « non » ne sont pas des
        oublis : ils relèvent de spécialistes et de mandats distincts, que le rapport signale
        quand il y a lieu.
      </p>
    </div>
  )])

  s.push(['m-normes', (
    <div className="mt-5">
      <SousTitre>Le cadre normatif</SousTitre>
      <p className="mb-2">
        Le diagnostic ne certifie aucune conformité : il constate, et il chiffre. Les normes suivantes
        fixent son vocabulaire, la structure de ses coûts et les seuils auxquels un ouvrage est comparé.
      </p>
      {tableau([
        ['SN 506 500 · CFC', "Code des frais de construction : l'arborescence du devis, du chapitre à la position à 3 chiffres."],
        ['SIA 416', 'Surfaces et volumes des bâtiments : surface de plancher, surface nette, surface de construction.'],
        ['SIA 469', "Conservation des ouvrages : la notion de durée d'utilisation, sur laquelle repose la durée de vie restante."],
        ['SIA 269', "Maintenance des structures porteuses. Le diagnostic en reste au constat visuel ; la capacité portante relève d'un ingénieur."],
        ['SIA 380/1', "Énergie thermique dans le bâtiment : les repères pour juger l'isolation d'une paroi, d'une toiture, d'une fenêtre."],
        ['SIA 358', 'Garde-corps et allèges : hauteurs et écartements, référence des mises aux normes de garde-corps.'],
        ['CECB® / CECB®Plus', "Certificat énergétique cantonal. Lorsqu'il existe, ses étiquettes sont reprises et non recalculées."],
      ], 'w-52')}
    </div>
  )])

  return s
}
