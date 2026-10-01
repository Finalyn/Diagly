import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import couts from '@/assets/vitrine/app-couts.png'
import rapport from '@/assets/vitrine/app-rapport.png'
import catalogue from '@/assets/vitrine/app-catalogue.png'
import visite from '@/assets/vitrine/app-visite.png'
import { CarteAdresse } from './CarteAdresse'
import { Entete, Hero, Tarifs, PiedDePage } from './Landing'
import { BoutonFleche, Pilule, LienFleche, GrandTitre, Chapo, Surtitre, Capture } from './elements'
import { Modules, Technique, IntelligenceArtificielle } from './SectionsProduit'
import { DemoGeometrie, DemoEtat, DemoChiffrage } from './Etapes'
import { releverBatiment, EXEMPLES } from './registre'
import type { Lieu } from './registre'

/**
 * Deuxième version de la page publique.
 *
 * Le hero de la première version est repris tel quel, il est validé. Ce qui
 * change, c'est tout ce qui vient après.
 *
 * Le reproche que l'on peut faire à la première version n'est pas son contenu,
 * qui est juste, mais son débit : dix-sept sections pleine hauteur, six étapes
 * numérotées séparées par des titres de la même taille, et quatre démonstrations
 * interactives réparties sur toute la page. Le visiteur qui descend ne sait pas
 * où il en est, et celui qui vient pour les tarifs traverse quatre bacs à sable.
 *
 * Trois partis pris ici :
 *
 * Le parcours se raconte une fois, court, avec des captures. Les six sections
 * numérotées deviennent trois temps sur une seule page d'écran.
 *
 * Les démonstrations interactives sont regroupées en un seul banc d'essai à
 * onglets. Elles restent entières, elles arrêtent d'interrompre la lecture. Qui
 * veut vérifier le calcul le vérifie, qui veut lire descend.
 *
 * Une contradiction est posée tôt, avant la preuve. La première version montre
 * longuement le produit avant de dire ce qu'il remplace.
 */

export function LandingV2() {
  useEffect(() => {
    document.title = 'Diagly, le diagnostic de bâtiment en une visite'
    const meta = document.querySelector('meta[name="description"]') ?? (() => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'description')
      document.head.appendChild(m)
      return m
    })()
    meta.setAttribute('content',
      "Relevez l'état d'un immeuble pendant la visite. Diagly propose l'état de chaque ouvrage, calcule les métrés et sort un rapport structuré par codes CFC, chiffré en francs. Conçu et hébergé en Suisse.")
  }, [])

  return (
    <div className="relative min-h-screen bg-white text-[#1d1d1f] antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[820px] bg-[linear-gradient(180deg,#e9f1fd_0%,#f2f7fd_35%,#fafcfe_70%,#ffffff_100%)]"
      />
      <Entete />
      <main>
        <Hero />
        <Contraste />
        <EnUneVisite />
        <BancEssai />
        <Precision />
        <LeRapport />
        <IntelligenceArtificielle />
        <Modules />
        <Technique />
        <PourQui />
        <Tarifs />
        <Questions />
        <AppelFinal />
      </main>
      <PiedDePage />
    </div>
  )
}

/* -------------------------------------------------------------- contraste */

/**
 * Ce que la visite coûte aujourd'hui, et ce qu'il en reste avec Diagly.
 *
 * Posé juste sous le hero, avant toute capture : un outil se comprend par ce
 * qu'il supprime. Deux colonnes, la même visite, deux soirées différentes. Pas
 * de chiffre de gain inventé, seulement des gestes que le lecteur reconnaît.
 */
const AVANT = [
  'Le carnet, les photos sur le téléphone, les cotes sur un plan papier',
  'Le soir, ressaisir chaque poste dans un tableur',
  'Chercher le prix, refaire le métré, recompter la façade',
  'Mettre en page le rapport, recoller les photos une par une',
  'Envoyer trois jours plus tard, quand la question a déjà été tranchée',
]

const APRES = [
  "L'adresse donne la géométrie avant même d'être sur place",
  'Chaque ouvrage est relevé debout devant lui, photo comprise',
  'Les métrés se calculent seuls, la formule reste affichée',
  'Le rapport et le chiffrage existent à la sortie du bâtiment',
  'Le lien de partage part depuis le trottoir',
]

function Colonne({ titre, mention, items, positif }: {
  titre: string; mention: string; items: string[]; positif?: boolean
}) {
  return (
    <div className={cn('rounded-[20px] p-7 sm:p-8',
      positif
        ? 'border border-[#0167EA]/15 bg-white shadow-[0_24px_70px_-40px_rgba(20,45,90,0.5)]'
        : 'border border-black/[0.07] bg-[#f5f7fa]')}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">{mention}</p>
      <h3 className="mt-1.5 text-[21px] font-semibold tracking-[-0.015em]">{titre}</h3>
      <ul className="mt-6 space-y-3.5">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-[15px] leading-snug">
            {positif
              ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />
              : <X className="mt-0.5 h-4 w-4 shrink-0 text-black/25" aria-hidden="true" />}
            <span className={positif ? 'text-[#1d1d1f]/85' : 'text-[#6e6e73]'}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Contraste() {
  return (
    <section className="px-5 py-24 md:py-28">
      <Surtitre>Le problème</Surtitre>
      <GrandTitre>La visite n'a jamais été<br className="hidden sm:block" /> le plus long.</GrandTitre>
      <Chapo>
        Relever un immeuble prend le temps qu'il faut. Ce qui coûte vraiment, c'est la soirée
        d'après : ressaisir, recalculer, chercher les prix, mettre en page.
      </Chapo>

      <div className="mx-auto mt-14 grid max-w-[940px] items-start gap-6 md:grid-cols-2 md:gap-8">
        <Colonne mention="Aujourd'hui" titre="La visite, puis le bureau" items={AVANT} />
        <Colonne mention="Avec Diagly" titre="La visite, et c'est tout" items={APRES} positif />
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- en une visite */

/**
 * Le parcours, raconté une seule fois.
 *
 * La première version étale six étapes numérotées sur six sections pleine
 * hauteur reliées par un fil dessiné. C'est beau à descendre, mais il faut
 * traverser toute la page pour savoir ce que fait le produit. Ici, les trois
 * temps tiennent ensemble : on les embrasse d'un regard, captures comprises.
 */
const TEMPS = [
  {
    rang: 'Avant',
    titre: "L'adresse suffit à commencer",
    texte: "Diagly interroge les registres publics suisses et en tire la géométrie du bâtiment : année, étages, logements, emprise au sol. La façade, le vitrage et l'échafaudage s'en déduisent.",
    image: catalogue,
    alt: 'Le catalogue rangé par étape de visite, chaque ouvrage avec son code CFC.',
  },
  {
    rang: 'Pendant',
    titre: 'Onze étapes, dans l’ordre où l’on marche',
    texte: "Façade, entrée, boîtes aux lettres, communs, techniques, toiture. Vous photographiez l'ouvrage, l'analyse propose son état parmi quatre, sa priorité et sa note. Vous gardez ou vous corrigez.",
    image: visite,
    alt: "Sur téléphone, les quatre états proposés pour un ouvrage, chacun avec son constat et les travaux qu'il engage.",
  },
  {
    rang: 'À la sortie',
    titre: 'Le rapport est déjà écrit',
    texte: "Le rapport de l'existant ouvrage par ouvrage, le chiffrage par poste CFC en francs, et un lien de partage en lecture seule pour la gérance. Rien à ressaisir.",
    image: couts,
    alt: 'La page des coûts : les postes groupés par priorité, chacun avec son état et son montant.',
  },
]

function EnUneVisite() {
  return (
    <section id="visite" className="scroll-mt-28 bg-[#f5f7fa] px-5 py-24 md:py-32">
      <Surtitre>Le parcours</Surtitre>
      <GrandTitre>Trois temps.<br className="hidden sm:block" /> Une seule saisie.</GrandTitre>
      <Chapo>
        Rien n'est repris à la main d'un temps à l'autre. Ce que vous posez devant la façade
        est ce qui sort dans le rapport.
      </Chapo>

      <ol className="mx-auto mt-16 grid max-w-[1060px] gap-10 md:grid-cols-3 md:gap-8">
        {TEMPS.map((t) => (
          <li key={t.rang} className="flex flex-col">
            <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_-34px_rgba(20,45,90,0.5)]">
              <img src={t.image} alt={t.alt} loading="lazy" className="block h-[230px] w-full object-cover object-top" />
            </div>
            <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0167EA]">{t.rang}</p>
            <h3 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-[-0.015em]">{t.titre}</h3>
            <p className="mt-2.5 text-[16px] leading-relaxed text-[#6e6e73]">{t.texte}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ----------------------------------------------------------- banc d'essai */

/**
 * Le banc d'essai : les quatre démonstrations, au même endroit.
 *
 * Elles font tourner le calcul réel de l'application dans la page, et c'est le
 * meilleur argument de la vitrine. Mais réparties sur toute la longueur, elles
 * coupent quatre fois la lecture. Rassemblées derrière des onglets, elles
 * deviennent un outil : on y entre si l'on veut vérifier, on passe si l'on veut
 * lire. Le contenu de chaque onglet est exactement celui de la première version.
 */
const ONGLETS = [
  { cle: 'adresse', libelle: "L'adresse", phrase: 'Ce que les registres publics donnent avant la visite.' },
  { cle: 'metres', libelle: 'Les métrés', phrase: 'Vos ratios posés, les surfaces qui en sortent.' },
  { cle: 'etat', libelle: "L'état", phrase: "Le constat, les travaux et la priorité qu'un état déclenche." },
  { cle: 'chiffrage', libelle: 'Le chiffrage', phrase: 'La cascade, des honoraires à la TVA suisse.' },
] as const

type CleOnglet = (typeof ONGLETS)[number]['cle']

function BancEssai() {
  const [actif, setActif] = useState<CleOnglet>('adresse')
  const courant = ONGLETS.find((o) => o.cle === actif)!

  return (
    <section id="essai" className="scroll-mt-28 px-5 py-24 md:py-32">
      <Surtitre>La preuve</Surtitre>
      <GrandTitre>Le calcul tourne<br className="hidden sm:block" /> dans cette page.</GrandTitre>
      <Chapo>
        Ces quatre démonstrations appellent les fonctions de l'application, pas une imitation
        écrite pour la vitrine. Posez vos valeurs, comparez avec les vôtres.
      </Chapo>

      <div className="mx-auto mt-12 max-w-[980px]">
        <div className="flex justify-center">
          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-black/[0.05] p-1" role="tablist" aria-label="Démonstrations">
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                role="tab"
                id={`onglet-${o.cle}`}
                aria-selected={actif === o.cle}
                aria-controls={`volet-${o.cle}`}
                onClick={() => setActif(o.cle)}
                className={cn('shrink-0 rounded-full px-4 py-2 text-[14px] transition-colors sm:px-5',
                  actif === o.cle ? 'bg-white font-medium shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]')}
              >
                {o.libelle}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-[15px] text-[#6e6e73]">{courant.phrase}</p>

        <div role="tabpanel" id={`volet-${actif}`} aria-labelledby={`onglet-${actif}`} className="mt-10">
          {actif === 'adresse' && <DemoAdresse />}
          {actif === 'metres' && <DemoGeometrie />}
          {actif === 'etat' && <DemoEtat />}
          {actif === 'chiffrage' && <DemoChiffrage />}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------- volet « adresse » */

/**
 * Ce qu'une adresse donne, avant même la visite.
 *
 * Les valeurs qui ont de la valeur sont floutées : on montre qu'elles existent
 * et d'où elles viennent, on ne les donne pas. Seule l'année de construction est
 * demandée au serveur et s'affiche en clair, pour l'adresse cherchée.
 */
const REGISTRE = [
  { libelle: 'Identifiant fédéral du bâtiment', exemple: '1’927’043' },
  { libelle: 'Année de construction', exemple: '1972', reel: true },
  { libelle: 'Nombre d’étages', exemple: '6' },
  { libelle: 'Nombre de logements', exemple: '18' },
  { libelle: 'Emprise au sol', exemple: '420 m²' },
]

const DEDUIT = [
  { libelle: 'Surface de façade', exemple: '1’188 m²' },
  { libelle: 'Surface vitrée', exemple: '475 m²' },
  { libelle: 'Échafaudage', exemple: '1’307 m²' },
]

function LigneMasquee({ libelle, exemple }: { libelle: string; exemple: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[15px] text-[#1d1d1f]/75">{libelle}</dt>
      <dd className="shrink-0 select-none text-[15px] font-semibold tabular-nums blur-[5px]" aria-hidden="true">{exemple}</dd>
    </div>
  )
}

function DemoAdresse() {
  const [lieu, setLieu] = useState<Lieu>(EXEMPLES[0])
  const [releve, setReleve] = useState<{ lieu: Lieu; annee: string | null } | null>(null)

  // La réponse d'une adresse abandonnée en chemin ne doit pas écraser la bonne.
  useEffect(() => {
    let courant = true
    releverBatiment(lieu).then((r) => {
      if (courant) setReleve({ lieu, annee: r?.annee ?? null })
    })
    return () => { courant = false }
  }, [lieu])

  const charge = releve?.lieu !== lieu
  const annee = releve?.annee ?? null

  return (
    <div>
      <div className="grid items-start gap-6 md:grid-cols-[1.05fr_0.95fr]">
        <CarteAdresse onLieu={setLieu} />

        <div className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(20,45,90,0.35)] sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Relevé sans se déplacer</p>
          <p className="mt-1.5 truncate text-[15px] font-semibold" title={lieu.label}>{lieu.label}</p>

          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Registre fédéral des bâtiments</p>
          <dl className="mt-1 divide-y divide-black/[0.06]">
            {REGISTRE.map((d) => d.reel ? (
              <div key={d.libelle} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-[15px] text-[#1d1d1f]/75">{d.libelle}</dt>
                <dd className="shrink-0 text-[15px] font-semibold tabular-nums text-[#0167EA]">
                  {charge
                    ? <span className="inline-block h-[14px] w-12 animate-pulse rounded bg-[#0167EA]/20 align-middle" />
                    : annee ?? <span className="text-[14px] font-normal text-[#86868b]">non renseignée</span>}
                </dd>
              </div>
            ) : <LigneMasquee key={d.libelle} libelle={d.libelle} exemple={d.exemple} />)}
          </dl>

          <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Et ce qui s’en déduit</p>
          <dl className="mt-1 divide-y divide-black/[0.06]">
            {DEDUIT.map((d) => <LigneMasquee key={d.libelle} {...d} />)}
          </dl>

          <p className="sr-only">
            Seule l’année de construction est donnée ici. Les autres valeurs du relevé sont
            volontairement masquées sur la page publique : créez un dossier pour obtenir celles
            de votre bâtiment.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <BoutonFleche to="/login" className="py-2.5 text-[14px]">Voir tout le relevé</BoutonFleche>
            <span className="text-[13px] text-[#86868b]">Le reste s’ouvre dans l’application</span>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-[14px] leading-relaxed text-[#6e6e73]">
        Ces valeurs sont un point de départ, pas une vérité. Le registre confond parfois deux
        bâtiments contigus et ne porte pas toujours l’année exacte : Diagly le signale quand la
        forme obtenue est improbable, et vous la corrigez sur place.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------- precision */

const PRECISION = [
  { titre: "L'adresse seule", detail: 'Géométrie du registre. Un ordre de grandeur.', part: 30 },
  { titre: 'Avec vos photos', detail: "L'état de chaque ouvrage est relevé, plus présumé.", part: 55 },
  { titre: 'Avec le relevé sur place', detail: 'Périmètre, étages, hauteur, logements. Les métrés deviennent les vôtres.', part: 80 },
  { titre: 'Avec les devis reçus', detail: 'Les prix du catalogue cèdent la place aux montants adjugés.', part: 100 },
]

/**
 * La jauge de précision, resserrée.
 *
 * C'est l'argument le plus honnête de la page. La première version l'accompagne
 * d'une capture de téléphone qui répète ce que le parcours vient de montrer ;
 * ici la jauge reste seule, sur fond sombre, et l'argument porte mieux.
 */
function Precision() {
  return (
    <section className="bg-[#0b1220] px-5 py-24 text-white md:py-32">
      <Surtitre sombre>L'honnêteté</Surtitre>
      <GrandTitre sombre>La précision se gagne.<br className="hidden sm:block" /> Elle ne se promet pas.</GrandTitre>
      <Chapo sombre>
        Diagly affiche une fourchette et dit sur quoi elle repose. Un chiffre exact tiré
        d'une seule photo serait une invention, et vous le sauriez au premier devis reçu.
      </Chapo>

      <ol className="mx-auto mt-16 max-w-[760px] space-y-7">
        {PRECISION.map((n) => (
          <li key={n.titre}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[17px] font-semibold">{n.titre}</p>
              <p className="text-[15px] text-white/50">{n.detail}</p>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#4d9bff]" style={{ width: `${n.part}%` }} />
            </div>
          </li>
        ))}
      </ol>

      <p className="mx-auto mt-12 max-w-2xl text-center text-[15px] leading-relaxed text-white/50">
        L'estimation est annoncée à ±15 %, et la fourchette se resserre à mesure que le
        dossier se remplit. Elle ne remplace ni un devis d'entreprise ni une expertise.
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- rapport */

const SORTIES = [
  { titre: "Rapport de l'existant", texte: "Ouvrage par ouvrage, l'état constaté et les travaux à prévoir, dans l'ordre du catalogue." },
  { titre: 'Chiffrage par poste CFC', texte: 'Les totaux par priorité, le détail poste par poste, honoraires, réserve et TVA suisse séparés.' },
  { titre: 'Lien de partage', texte: 'Une page en lecture seule pour la gérance ou le propriétaire, sans compte à créer.' },
  { titre: 'Export tableur, CSV, JSON', texte: "Avec un modèle de colonnes que vous définissez. Prêt à passer en appel d'offres." },
]

function LeRapport() {
  return (
    <section id="rapport" className="scroll-mt-28 px-5 py-24 md:py-32">
      <Surtitre>Ce qui sort</Surtitre>
      <GrandTitre>Quatre sorties,<br className="hidden sm:block" /> une seule saisie.</GrandTitre>
      <Chapo>
        Un poste corrigé dans le diagnostic change le chiffrage, le rapport et l'export. Rien
        n'est reporté à la main d'un document à l'autre.
      </Chapo>

      <div className="mx-auto mt-16 max-w-[960px]">
        <Capture src={rapport} alt="Le rapport de l'existant : chaque ouvrage avec son état et les travaux à prévoir." />
      </div>

      <div className="mx-auto mt-16 grid max-w-[960px] gap-x-10 gap-y-10 sm:grid-cols-2">
        {SORTIES.map((s) => (
          <article key={s.titre}>
            <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.015em]">{s.titre}</h3>
            <p className="mt-2 text-[16px] leading-relaxed text-[#6e6e73]">{s.texte}</p>
          </article>
        ))}
      </div>

      <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <BoutonFleche to="/login">Sortir un rapport</BoutonFleche>
        <LienFleche href="#essai">Revoir le calcul</LienFleche>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- pour qui */

const CHIFFRES = [
  { valeur: '111', libelle: 'postes au catalogue CFC' },
  { valeur: '25', libelle: 'formules de métré' },
  { valeur: '11', libelle: 'étapes de visite' },
  { valeur: '8.1 %', libelle: 'TVA suisse appliquée' },
]

const PERSONAS = [
  {
    titre: 'Régies et gérances',
    texte: "Un état du parc, bâtiment par bâtiment, avec les priorités à trois ans et le budget associé. De quoi arbitrer en assemblée sans attendre un mandat d'expertise.",
  },
  {
    titre: 'Architectes et entreprises générales',
    texte: "Le relevé de l'existant en amont d'une rénovation, métrés posés et postes CFC prêts à passer en appel d'offres.",
  },
  {
    titre: 'Propriétaires',
    texte: "Ce que coûtera l'entretien de votre bien dans les dix ans, avant de vendre, d'acheter ou d'engager des travaux. Sans jargon.",
  },
]

/** Les métiers et les chiffres tiennent ensemble : deux bandes brèves valent mieux que deux sections. */
function PourQui() {
  return (
    <section className="bg-[#f5f7fa] px-5 py-24 md:py-32">
      <GrandTitre>Trois métiers.<br />Le même relevé.</GrandTitre>
      <div className="mx-auto mt-16 grid max-w-[900px] gap-12 md:grid-cols-3">
        {PERSONAS.map((p) => (
          <article key={p.titre}>
            <h3 className="text-[21px] font-semibold leading-snug tracking-[-0.015em]">{p.titre}</h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#6e6e73]">{p.texte}</p>
          </article>
        ))}
      </div>

      <div className="mx-auto mt-20 grid w-full max-w-[900px] grid-cols-2 gap-x-6 gap-y-10 border-t border-black/[0.08] pt-14 md:grid-cols-4">
        {CHIFFRES.map((c) => (
          <div key={c.libelle} className="text-center">
            <p className="text-[clamp(2rem,4.4vw,2.8rem)] font-semibold tracking-[-0.03em] tabular-nums">{c.valeur}</p>
            <p className="mt-1 text-[14px] leading-snug text-[#6e6e73]">{c.libelle}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- questions */

/**
 * Six questions au lieu de huit.
 *
 * Celles sur les formats acceptés et sur la différence entre les plans ont été
 * retirées : la première ne bloque personne, la seconde est déjà répondue par le
 * tableau comparatif situé juste au-dessus.
 */
const QUESTIONS = [
  { q: "Peut-on se fier à ce que propose l'analyse ?", r: "Elle propose, elle ne décide pas. Chaque état suggéré s'affiche avec les travaux qu'il engage, et se corrige d'un geste. Sur un ouvrage qu'elle ne sait pas qualifier, elle le dit plutôt que de remplir la case." },
  { q: 'Que valent les estimations face à un expert ?', r: "Ce sont des estimations indicatives, calculées depuis les prix de votre propre catalogue et les métrés déduits du bâtiment. Elles servent à arbitrer et à budgéter. Un devis reste un devis." },
  { q: 'Les codes CFC sont-ils respectés ?', r: "Oui. Chaque ouvrage porte son code, son unité et sa quantité, et le rapport suit cette structure. Les exports la reprennent, prêts pour un appel d'offres." },
  { q: 'Où vont les photos que je prends ?', r: "Sur nos serveurs en Suisse, rattachées à votre diagnostic, accessibles à vous et à votre équipe. Elles peuvent être analysées par un service tiers pour la proposition d'état, et cette aide se désactive dossier par dossier." },
  { q: 'Cela fonctionne-t-il au sous-sol, sans réseau ?', r: "Oui. L'application s'installe sur le téléphone et garde la saisie en local quand le réseau manque. Tout repart vers le dossier dès que la connexion revient." },
  { q: 'Puis-je arrêter quand je veux ?', r: "Oui, sans préavis. Vos diagnostics restent consultables et exportables jusqu'à la fin de la période déjà payée." },
]

function Questions() {
  return (
    <section id="questions" className="scroll-mt-28 px-5 py-24 md:py-32">
      <GrandTitre>Questions fréquentes</GrandTitre>
      <div className="mx-auto mt-14 max-w-[760px]">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group border-b border-black/[0.09]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0167EA]">
              {item.q}
              <Plus className="h-4 w-4 shrink-0 text-[#0167EA] transition-transform group-open:rotate-45" aria-hidden="true" />
            </summary>
            <p className="pb-6 pr-10 text-[17px] leading-relaxed text-[#6e6e73]">{item.r}</p>
          </details>
        ))}
      </div>
      <p className="mx-auto mt-10 text-center text-[15px] text-[#6e6e73]">
        Une question qui n'est pas là ?{' '}
        <a href="mailto:contact@finalyn.com" className="text-[#0167EA] hover:underline">Écrivez-nous</a>, une personne répond.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------ appel final */

function AppelFinal() {
  return (
    <section className="bg-[#0b1220] px-5 py-28 text-center text-white md:py-36">
      <GrandTitre sombre>Prenez un immeuble<br className="hidden sm:block" /> que vous connaissez.</GrandTitre>
      <Chapo sombre>
        Le premier diagnostic est offert, sans carte bancaire. Comparez le résultat avec ce
        que vous auriez sorti à la main.
      </Chapo>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Pilule to="/login">Essayer gratuitement</Pilule>
        <a href="mailto:contact@finalyn.com" className="inline-flex items-center gap-0.5 text-[15px] text-[#4d9bff] hover:underline">
          Parler à quelqu'un<ChevronRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      <p className="mt-10 text-[13px] text-white/40">
        Conçu et hébergé en Suisse. Installable sur téléphone, utilisable hors ligne pendant la visite.
      </p>
    </section>
  )
}
