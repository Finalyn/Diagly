import { useEffect, useState } from 'react'
import { Plus, Check, Minus, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import rapport from '@/assets/vitrine/app-rapport.webp'
import catalogue from '@/assets/vitrine/app-catalogue.webp'
import visite from '@/assets/vitrine/app-visite.webp'
import { Entete, Hero, PiedDePage } from './Landing'
import { BoutonFleche, LienFleche, GrandTitre, Chapo, Surtitre, Etape } from './elements'

/**
 * La page publique, troisième version.
 *
 * Le hero est repris tel quel, il est validé. Tout ce qui suit est réécrit, et
 * le parti pris tient en une phrase : moins de sections, plus de réponses.
 *
 * Les deux versions précédentes racontaient bien le produit mais le racontaient
 * longuement, dix-sept sections pour l'une, treize pour l'autre, avec quatre
 * bacs à sable interactifs semés en chemin. Un visiteur qui descend une page de
 * vitrine ne vient pas manipuler un simulateur, il vient savoir trois choses :
 * ce que ça remplace, ce que ça produit, ce que ça coûte. Chacune a désormais
 * sa section et une seule.
 *
 * Ce qui a été retiré n'est pas perdu : les démonstrations interactives vivent
 * dans l'application, derrière l'essai gratuit, là où elles portent vraiment.
 */

const NAV = [
  { href: '#parcours', label: 'Le parcours' },
  { href: '#rapport', label: 'Le rapport' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#questions', label: 'Questions' },
]

export function LandingV3() {
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
      <Entete liens={NAV} />
      <main>
        <Hero />
        <CeQuiChange />
        <Parcours />
        <CeQueVousRecuperez />
        <PourQui />
        <Tarifs />
        <Questions />
        <AppelFinal />
      </main>
      <PiedDePage />
    </div>
  )
}

/* ------------------------------------------------------------ ce qui change */

/**
 * Ce que l'outil supprime, avant ce qu'il ajoute.
 *
 * Trois lignes par colonne, pas cinq : au-delà, la liste se lit comme un
 * argumentaire et on cesse de la croire. Aucun gain chiffré inventé, seulement
 * des gestes qu'un diagnostiqueur reconnaît le soir même.
 */
const AVANT = [
  'Le soir, ressaisir chaque poste dans un tableur',
  'Chercher le prix, refaire le métré, recompter la façade',
  'Envoyer le rapport trois jours plus tard, quand la question est déjà tranchée',
]

const APRES = [
  "L'adresse donne la géométrie avant même d'être sur place",
  'Chaque ouvrage se relève debout devant lui, photo comprise',
  'Le rapport et son chiffrage existent à la sortie du bâtiment',
]

function CeQuiChange() {
  return (
    <section className="px-5 py-24 md:py-28">
      <GrandTitre>La même visite,<br className="hidden sm:block" /> deux soirées différentes</GrandTitre>
      <div className="mx-auto mt-14 grid max-w-[980px] gap-5 sm:grid-cols-2">
        <Colonne titre="Sans Diagly" items={AVANT} />
        <Colonne titre="Avec Diagly" items={APRES} positif />
      </div>
    </section>
  )
}

function Colonne({ titre, items, positif }: { titre: string; items: string[]; positif?: boolean }) {
  const Icone = positif ? Check : Minus
  return (
    <div className={cn(
      'rounded-[22px] p-7 sm:p-8',
      positif
        ? 'border border-[#0167EA]/20 bg-[#f4f8ff]'
        : 'border border-black/[0.07] bg-white',
    )}>
      <p className={cn('text-[13px] font-semibold uppercase tracking-[0.14em]',
        positif ? 'text-[#0167EA]' : 'text-[#86868b]')}>
        {titre}
      </p>
      <ul className="mt-6 space-y-4">
        {items.map((t) => (
          <li key={t} className="flex gap-3.5">
            <Icone
              className={cn('mt-[3px] h-[18px] w-[18px] shrink-0',
                positif ? 'text-[#0167EA]' : 'text-[#b4b4bb]')}
              aria-hidden="true"
            />
            <span className={cn('text-[17px] leading-relaxed',
              positif ? 'text-[#1d1d1f]' : 'text-[#6e6e73]')}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ----------------------------------------------------------------- parcours */

/**
 * Le déroulé d'un dossier, en trois temps.
 *
 * Trois temps et non six étapes : le lecteur retient une suite de trois, pas
 * une nomenclature. Le premier temps n'a pas de capture parce qu'il n'a pas
 * d'écran à montrer, seulement un champ d'adresse et ce qui en tombe. Le
 * reproduire en balisage dit la même chose sans inventer une image.
 */
const FICHE = ['1972', '5 niveaux', '2 100 m² de plancher', 'Administratif']

function Parcours() {
  return (
    <section id="parcours" className="scroll-mt-28 bg-[#f5f7fa] px-5 py-24 md:py-32">
      <Surtitre>Le parcours</Surtitre>
      <GrandTitre>De l'adresse au dossier,<br className="hidden sm:block" /> en trois temps</GrandTitre>

      <div className="mx-auto mt-16 flex max-w-[1080px] flex-col gap-20 md:gap-28">

        {/* Temps 1 : l'adresse */}
        <Temps
          rang="un"
          titre="Vous tapez l'adresse"
          texte="Le registre fédéral des bâtiments rend la parcelle, l'année de construction, la surface et le nombre de niveaux. Périmètre et étages font le reste : façade, fenêtres, toiture, échafaudage, les métrés se déduisent avant la visite."
        >
          <div className="rounded-[22px] border border-black/[0.07] bg-white p-6 shadow-[0_20px_50px_-30px_rgba(20,45,90,0.45)] sm:p-7">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">
              Relevé sans se déplacer
            </p>
            <p className="mt-3 text-[19px] font-medium tracking-[-0.01em]">
              Avenue de la Gare 12, 1700 Fribourg
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {FICHE.map((f) => (
                <span key={f} className="rounded-full border border-black/[0.08] px-4 py-2 text-[14px] text-[#1d1d1f]">
                  {f}
                </span>
              ))}
              <span className="rounded-full bg-[#0167EA] px-4 py-2 text-[14px] text-white">
                Métrés calculés
              </span>
            </div>
          </div>
        </Temps>

        {/* Temps 2 : la visite */}
        <Temps
          rang="deux"
          titre="Vous relevez sur place"
          texte="Le catalogue suit le bâtiment et non la nomenclature. Devant un ouvrage, vous le photographiez : l'analyse propose son code CFC, son état et la priorité, avec la phrase qui les justifie. Vous validez ou vous corrigez. Chaque état porte le descriptif exact des travaux qu'il engage."
          inverse
        >
          <div className="flex items-end justify-center gap-5 sm:gap-7">
            <img
              src={catalogue}
              alt="Le catalogue CFC sur téléphone, les ouvrages groupés par étape de visite."
              loading="lazy"
              className="w-1/2 max-w-[230px] rounded-[20px] border border-black/[0.07] shadow-[0_24px_60px_-28px_rgba(20,45,90,0.5)]"
            />
            <img
              src={visite}
              alt="L'évaluation d'un ouvrage : quatre états, chacun avec le descriptif des travaux qu'il entraîne."
              loading="lazy"
              className="w-1/2 max-w-[260px] rounded-[20px] border border-black/[0.07] shadow-[0_24px_60px_-28px_rgba(20,45,90,0.5)]"
            />
          </div>
        </Temps>

        {/* Temps 3 : le rapport */}
        <Temps
          rang="trois"
          titre="Vous repartez avec le dossier"
          texte="Il s'est construit pendant la visite. Page de garde, état de l'existant poste par poste, devis estimatif à plus ou moins 15 % rangé par priorité, honoraires, réserve et TVA comprises. À votre en-tête, prêt à remettre."
        >
          <img
            src={rapport}
            alt="Le rapport de l'existant : chaque ouvrage avec son code CFC, son état coché et les travaux à prévoir."
            loading="lazy"
            className="w-full rounded-[22px] border border-black/[0.07] shadow-[0_24px_70px_-30px_rgba(20,45,90,0.5)]"
          />
        </Temps>

      </div>
    </section>
  )
}

function Temps({ rang, titre, texte, children, inverse }: {
  rang: 'un' | 'deux' | 'trois'
  titre: string
  texte: string
  children: React.ReactNode
  inverse?: boolean
}) {
  return (
    <div className={cn(
      'grid items-center gap-10 md:grid-cols-2 md:gap-14',
      inverse && 'md:[&>*:first-child]:order-2',
    )}>
      <div>
        <div className="[&_p]:justify-start [&_p]:text-left">
          <Etape rang={rang} />
        </div>
        <h3 className="text-balance text-[clamp(1.6rem,3.2vw,2.3rem)] font-semibold leading-[1.12] tracking-[-0.022em]">
          {titre}
        </h3>
        <p className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-[#6e6e73]">{texte}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

/* -------------------------------------------------------- ce que vous sortez */

/**
 * Les sorties du dossier.
 *
 * Une vitrine qui montre des écrans laisse une question en suspens : qu'est-ce
 * qui sort de là, concrètement, et sous quelle forme. Quatre réponses, sans
 * capture, parce qu'un format de fichier se lit mieux qu'il ne se montre.
 */
const SORTIES = [
  {
    titre: 'Le rapport, en PDF',
    texte: "Mis en pages en A4 à l'en-tête de votre bureau. Page de garde, état de l'existant, devis par priorité.",
  },
  {
    titre: 'Le chiffrage, par code CFC',
    texte: 'Chaque poste avec son unité, sa quantité et son montant. La cascade honoraires, réserve et TVA à 8,1 % est détaillée.',
  },
  {
    titre: "L'export, en Excel et CSV",
    texte: "Les postes repris tels quels, prêts à passer en appel d'offres ou à entrer dans votre outil de gestion.",
  },
  {
    titre: 'Le lien de partage',
    texte: 'Une adresse à envoyer au propriétaire ou à la régie. Il lit le rapport sans compte et sans rien installer.',
  },
]

function CeQueVousRecuperez() {
  return (
    <section id="rapport" className="scroll-mt-28 px-5 py-24 md:py-32">
      <Surtitre>Ce qui sort</Surtitre>
      <GrandTitre>Quatre sorties,<br className="hidden sm:block" /> aucune reprise sur Word</GrandTitre>
      <Chapo>
        Le test du produit tient là : si le dossier doit être repris à la main, la promesse tombe.
      </Chapo>

      <div className="mx-auto mt-14 grid max-w-[1080px] gap-4 sm:grid-cols-2">
        {SORTIES.map((s) => (
          <div key={s.titre} className="rounded-[20px] border border-black/[0.07] bg-white p-7">
            <h3 className="text-[19px] font-semibold tracking-[-0.015em]">{s.titre}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-[#6e6e73]">{s.texte}</p>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-[640px] text-center text-[15px] leading-relaxed text-[#86868b]">
        Les estimations sont indicatives, annoncées à plus ou moins 15 %, et calculées depuis les prix
        de votre propre catalogue. Elles ne remplacent pas le devis d'une entreprise.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ pour qui */

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

function PourQui() {
  return (
    <section className="bg-[#f5f7fa] px-5 py-24 md:py-32">
      <GrandTitre>Pour qui</GrandTitre>
      <div className="mx-auto mt-14 grid max-w-[1080px] gap-10 md:grid-cols-3 md:gap-8">
        {PERSONAS.map((p) => (
          <article key={p.titre}>
            <h3 className="text-[21px] font-semibold leading-snug tracking-[-0.015em]">{p.titre}</h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[#6e6e73]">{p.texte}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- tarifs */

/**
 * Les plans.
 *
 * Le tableau comparatif de quatorze lignes est tombé. Il répondait à des
 * questions que personne ne se pose avant d'avoir essayé, et il doublait la
 * hauteur de la section. Ce qui sépare réellement les plans tient en une
 * phrase, elle est sous les cartes.
 */
type Plan = {
  nom: string
  mensuel: number | null
  annuel: number | null
  gratuit?: boolean
  surDevis?: boolean
  accroche: string
  points: string[]
  cta: string
  phare?: boolean
}

const PLANS: Plan[] = [
  {
    nom: 'Découverte', mensuel: 0, annuel: 0, gratuit: true,
    accroche: 'Pour voir ce que donne un rapport sur votre propre immeuble.',
    points: ['1 diagnostic offert', 'Rapport PDF avec filigrane', '1 utilisateur'],
    cta: 'Commencer',
  },
  {
    nom: 'Starter', mensuel: 49, annuel: 490,
    accroche: 'Pour un indépendant, quelques immeubles par mois.',
    points: ['5 diagnostics par mois', 'Rapports PDF sans filigrane', 'Lien de partage au client'],
    cta: 'Choisir Starter',
  },
  {
    nom: 'Pro', mensuel: 149, annuel: 1490, phare: true,
    accroche: 'Pour un bureau qui en fait son outil de relevé.',
    points: ['20 diagnostics par mois', '3 utilisateurs', 'Export Excel et rapports à votre logo'],
    cta: 'Choisir Pro',
  },
  {
    nom: 'Entreprise', mensuel: null, annuel: null, surDevis: true,
    accroche: 'Pour une régie ou un groupe qui gère un parc.',
    points: ['Diagnostics illimités', 'Utilisateurs illimités', 'API et connecteurs'],
    cta: 'Nous écrire',
  },
]

function Tarifs() {
  const [annuel, setAnnuel] = useState(false)
  return (
    <section id="tarifs" className="scroll-mt-28 px-5 py-24 md:py-32">
      <Surtitre>Tarifs</Surtitre>
      <GrandTitre>Le premier diagnostic<br className="hidden sm:block" /> est offert</GrandTitre>
      <Chapo>Sans carte bancaire. Vous jugez sur le rapport, pas sur la démonstration.</Chapo>

      {/* Bascule mensuel / annuel */}
      <div className="mt-10 flex items-center justify-center">
        <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-1">
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setAnnuel(v)}
              aria-pressed={annuel === v}
              className={cn(
                'rounded-full px-5 py-2 text-[14px] transition-colors',
                annuel === v ? 'bg-[#1d1d1f] text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f]',
              )}
            >
              {v ? 'Annuel' : 'Mensuel'}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-[13px] text-[#86868b]">
        {annuel ? 'Deux mois offerts sur l’année.' : 'Sans engagement, résiliable sans préavis.'}
      </p>

      <div className="mx-auto mt-12 grid max-w-[1120px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <CartePlan key={p.nom} plan={p} annuel={annuel} />
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-[680px] text-center text-[15px] leading-relaxed text-[#6e6e73]">
        Ce qui sépare les plans : le nombre de diagnostics, le nombre d'utilisateurs, et les
        sorties. Le chiffrage détaillé par poste, l'export Excel et les rapports à votre logo
        commencent au plan Pro.
      </p>
    </section>
  )
}

function CartePlan({ plan, annuel }: { plan: Plan; annuel: boolean }) {
  const montant = annuel ? plan.annuel : plan.mensuel
  return (
    <div className={cn(
      'flex flex-col rounded-[22px] p-7',
      plan.phare
        ? 'border-2 border-[#0167EA] bg-white shadow-[0_24px_60px_-34px_rgba(1,103,234,0.6)]'
        : 'border border-black/[0.08] bg-white',
    )}>
      <div className="flex items-center gap-2.5">
        <h3 className="text-[19px] font-semibold tracking-[-0.015em]">{plan.nom}</h3>
        {plan.phare && (
          <span className="rounded-full bg-[#0167EA] px-2.5 py-[3px] text-[11px] font-semibold uppercase tracking-wider text-white">
            Le plus pris
          </span>
        )}
      </div>
      <p className="mt-1.5 min-h-[2.6rem] text-[14px] leading-snug text-[#6e6e73]">{plan.accroche}</p>

      <p className="mt-6 flex items-baseline gap-1.5">
        {plan.surDevis ? (
          <span className="text-[30px] font-semibold tracking-[-0.03em]">Sur devis</span>
        ) : plan.gratuit ? (
          <span className="text-[30px] font-semibold tracking-[-0.03em]">Gratuit</span>
        ) : (
          <>
            <span className="text-[40px] font-semibold tracking-[-0.035em] tabular-nums">{montant}</span>
            <span className="text-[15px] text-[#6e6e73]">CHF {annuel ? 'par an' : 'par mois'}</span>
          </>
        )}
      </p>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.points.map((pt) => (
          <li key={pt} className="flex gap-3">
            <Check className="mt-[3px] h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />
            <span className="text-[15px] leading-snug text-[#1d1d1f]">{pt}</span>
          </li>
        ))}
      </ul>

      {/* Les quatre cartes finissent sur la même ligne : un simple lien sous la
          dernière cassait l'alignement et faisait lire « Entreprise » comme une
          note de bas de page plutôt que comme un plan. */}
      <div className="mt-8">
        {plan.surDevis ? (
          <a
            href="mailto:contact@finalyn.com"
            className="flex w-full items-center justify-between gap-2.5 rounded-full border border-[#0167EA] py-3 pl-6 pr-2 text-[15px] text-[#0167EA] transition-colors hover:bg-[#0167EA]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0167EA]"
          >
            {plan.cta}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0167EA]/10">
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </a>
        ) : (
          <BoutonFleche to="/login" className="w-full justify-between">{plan.cta}</BoutonFleche>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- questions */

/**
 * Cinq questions, pas huit.
 *
 * Les trois retirées portaient sur les formats acceptés, le délai d'obtention
 * du rapport et le détail des plans : la page y répond désormais dans son
 * corps. Restent celles où un visiteur hésite vraiment.
 */
const QUESTIONS = [
  {
    q: "Peut-on se fier à ce que propose l'analyse ?",
    r: "Elle propose, elle ne décide pas. Chaque état suggéré s'affiche avec les travaux qu'il engage, et se corrige d'un geste. Sur un ouvrage qu'elle ne sait pas qualifier, elle le dit plutôt que de remplir la case.",
  },
  {
    q: 'Que valent les estimations face à un expert ?',
    r: "Ce sont des estimations indicatives, calculées depuis les prix de votre propre catalogue et les métrés déduits du bâtiment. Elles servent à arbitrer et à budgéter. Un devis reste un devis.",
  },
  {
    q: 'Les codes CFC sont-ils respectés ?',
    r: "Oui. Chaque ouvrage porte son code, son unité et sa quantité, et le rapport suit cette structure. Les exports la reprennent, prêts pour un appel d'offres.",
  },
  {
    q: 'Où vont les photos que je prends ?',
    r: "Sur nos serveurs en Suisse, rattachées à votre diagnostic, accessibles à vous et à votre équipe. Elles peuvent être analysées par un service tiers pour la proposition d'état, et cette aide se désactive dossier par dossier.",
  },
  {
    q: 'Puis-je arrêter quand je veux ?',
    r: "Oui, sans préavis. Vos diagnostics restent consultables et exportables jusqu'à la fin de la période déjà payée.",
  },
]

function Questions() {
  return (
    <section id="questions" className="scroll-mt-28 bg-[#f5f7fa] px-5 py-24 md:py-32">
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
    </section>
  )
}

/* --------------------------------------------------------------- appel final */

function AppelFinal() {
  return (
    <section className="bg-[#0b1220] px-5 py-28 text-center text-white md:py-36">
      <GrandTitre sombre>Prenez un immeuble<br className="hidden sm:block" /> que vous connaissez.</GrandTitre>
      <Chapo sombre>
        Le premier diagnostic est offert, sans carte bancaire. Comparez le rapport qui en sort
        avec celui que vous auriez rendu.
      </Chapo>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
        <BoutonFleche to="/login">Essayer gratuitement</BoutonFleche>
        <LienFleche href="#parcours">Revoir le parcours</LienFleche>
      </div>
    </section>
  )
}
