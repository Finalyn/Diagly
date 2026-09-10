import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera, ScanSearch, FileText, ShieldCheck, MapPin, Clock, Wallet, Layers,
  Building2, Compass, Home, Check, Minus, ArrowRight, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { VisiteEnPhoto, FacadeAnnotee, FeuilleRapport, ApercuProduit, Blob } from './illustrations'

/**
 * Page publique de Diagly.
 *
 * Elle décrit ce que le produit fait réellement aujourd'hui. Deux points sur
 * lesquels je me suis écarté du brief, volontairement :
 *
 * L'IA ne devine pas le code CFC. Le diagnostiqueur choisit l'ouvrage dans le
 * catalogue, puis l'analyse propose un état, une priorité et une note. Promettre
 * une reconnaissance automatique de l'ouvrage serait vendre autre chose.
 *
 * Aucun témoignage inventé. Un faux avis signé d'un nom et d'un canton est un faux
 * document. La section porte des faits verifiables tant qu'un vrai temoignage n'a
 * pas ete recueilli.
 */

const NAV = [
  { href: '#fonctionnement', label: 'Fonctionnement' },
  { href: '#analyse', label: "L'analyse" },
  { href: '#pour-qui', label: "Cas d'usage" },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'Questions' },
]

export function Landing() {
  useEffect(() => {
    document.title = 'Diagly, le diagnostic de bâtiment en une visite'
    const meta = document.querySelector('meta[name="description"]') ?? (() => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'description')
      document.head.appendChild(m)
      return m
    })()
    meta.setAttribute('content',
      "Relevez l'état d'un immeuble en photo, obtenez un rapport structuré par codes CFC et une estimation des coûts de rénovation. Conçu et hébergé en Suisse.")
  }, [])

  return (
    <div className="min-h-screen bg-creme text-marine">
      <Entete />
      <main>
        <Hero />
        <BandeauConfiance />
        <Fonctionnement />
        <Analyse />
        <Produit />
        <PourQui />
        <Benefices />
        <Tarifs />
        <Preuves />
        <Faq />
        <AppelFinal />
      </main>
      <PiedDePage />
    </div>
  )
}

/* ---------------------------------------------------------------- éléments */

function Bouton({ children, to, href, variante = 'plein', className }: {
  children: React.ReactNode
  to?: string
  href?: string
  variante?: 'plein' | 'contour' | 'clair'
  className?: string
}) {
  const styles = cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-corail',
    variante === 'plein' && 'bg-corail text-white hover:bg-corail-fonce',
    variante === 'contour' && 'border-2 border-marine/20 text-marine hover:border-marine/40 hover:bg-white',
    variante === 'clair' && 'bg-white text-marine hover:bg-creme',
    className,
  )
  if (to) return <Link to={to} className={styles}>{children}</Link>
  return <a href={href} className={styles}>{children}</a>
}

function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-20 px-5 py-20 sm:px-8 md:py-28', className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  )
}

function TitreSection({ surtitre, titre, chapo, clair }: {
  surtitre: string; titre: string; chapo?: string; clair?: boolean
}) {
  return (
    <div className="mb-12 max-w-2xl">
      <p className={cn('mb-3 text-xs font-bold uppercase tracking-[0.16em]', clair ? 'text-corail' : 'text-corail')}>
        {surtitre}
      </p>
      <h2 className={cn('text-balance text-3xl font-extrabold leading-[1.1] sm:text-4xl md:text-5xl', clair && 'text-white')}>
        {titre}
      </h2>
      {chapo && (
        <p className={cn('mt-5 text-lg leading-relaxed', clair ? 'text-white/75' : 'text-marine/70')}>{chapo}</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ entête */

function Entete() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-marine/10 bg-creme/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-4 sm:px-8">
        <a href="#top" className="flex shrink-0 items-baseline gap-1.5 text-xl font-extrabold tracking-tight">
          Diagly
          <span className="rounded bg-marine px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Suisse</span>
        </a>
        <nav className="hidden flex-1 items-center gap-7 md:flex" aria-label="Sections de la page">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-sm font-semibold text-marine/70 transition-colors hover:text-marine">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <Link to="/login" className="hidden text-sm font-semibold text-marine/70 transition-colors hover:text-marine sm:block">
            Se connecter
          </Link>
          {/* Sur telephone le libelle complet passait sur deux lignes et ecrasait la barre. */}
          <Bouton to="/login" className="whitespace-nowrap px-4 py-2.5 text-sm">
            <span className="sm:hidden">Essayer</span>
            <span className="hidden sm:inline">Essayer gratuitement</span>
          </Bouton>
          <button
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-label="Ouvrir le menu"
            className="rounded-xl border border-marine/15 p-2 md:hidden"
          >
            <Minus className={cn('h-5 w-5 transition-transform', ouvert && 'rotate-90')} />
          </button>
        </div>
      </div>
      {ouvert && (
        <nav className="border-t border-marine/10 bg-creme px-5 py-3 md:hidden" aria-label="Sections de la page">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOuvert(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-marine/80 hover:bg-white">
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section id="top" className="relative scroll-mt-20 overflow-hidden px-5 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-20">
      <Blob className="pointer-events-none absolute -right-24 -top-32 h-[520px] w-[520px] opacity-70" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-marine-pale px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-marine">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />Conçu en Suisse romande
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Diagnostiquez un immeuble en une visite, pas en trois semaines.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-marine/70">
            Vous photographiez les ouvrages pendant la visite. Diagly propose leur état,
            calcule les métrés depuis la géométrie du bâtiment et sort un rapport structuré
            par codes CFC, chiffré en francs.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Bouton to="/login">Essayer gratuitement<ArrowRight className="h-4 w-4" aria-hidden="true" /></Bouton>
            <Bouton href="#produit" variante="contour">Voir un rapport exemple</Bouton>
          </div>
          <p className="mt-5 text-sm text-marine/55">
            Sans carte bancaire. Premier diagnostic offert. Données hébergées en Suisse.
          </p>
        </div>
        <VisiteEnPhoto className="w-full" />
      </div>
    </section>
  )
}

/* -------------------------------------------------------- bandeau confiance */

const CHIFFRES = [
  { valeur: '111', libelle: 'postes au catalogue CFC' },
  { valeur: '25', libelle: 'formules de métré automatiques' },
  { valeur: '11', libelle: 'étapes de visite guidées' },
  { valeur: '100 %', libelle: 'hébergé en Suisse' },
]

function BandeauConfiance() {
  return (
    <div className="border-y border-marine/10 bg-white/60 px-5 py-8 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 md:grid-cols-4">
        {CHIFFRES.map((c) => (
          <div key={c.libelle} className="text-center md:text-left">
            <p className="text-3xl font-extrabold tabular-nums">{c.valeur}</p>
            <p className="mt-1 text-sm leading-snug text-marine/60">{c.libelle}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- fonctionnement */

const ETAPES = [
  {
    icone: Camera,
    titre: 'Vous suivez la visite',
    texte: "Le catalogue est rangé dans l'ordre du terrain : la façade, la porte d'entrée, les communs, les techniques, la toiture. Vous photographiez chaque ouvrage au passage.",
  },
  {
    icone: ScanSearch,
    titre: "L'analyse vous propose un état",
    texte: "Sur la photo, Diagly propose un état parmi très bon, bon, moyen ou mauvais, une priorité, et une note écrite. Vous corrigez d'un geste si vous n'êtes pas d'accord.",
  },
  {
    icone: FileText,
    titre: 'Le rapport se remplit tout seul',
    texte: "Les métrés se déduisent du bâtiment, les prix du catalogue de votre bureau. Vous repartez avec un rapport chiffré, exportable en PDF et partageable au client.",
  },
]

function Fonctionnement() {
  return (
    <Section id="fonctionnement">
      <TitreSection
        surtitre="Comment ça marche"
        titre="Trois gestes pendant la visite, le rapport en sortant"
        chapo="Rien à ressaisir le soir au bureau. Ce qui est relevé sur place est déjà chiffré."
      />
      <ol className="grid gap-6 md:grid-cols-3">
        {ETAPES.map((e, i) => (
          <li key={e.titre} className="rounded-3xl bg-white p-7 shadow-[0_2px_14px_rgba(27,58,92,0.06)]">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-marine-pale">
                <e.icone className="h-5 w-5 text-marine" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold text-corail">Étape {i + 1}</span>
            </div>
            <h3 className="text-xl font-bold leading-snug">{e.titre}</h3>
            <p className="mt-3 leading-relaxed text-marine/70">{e.texte}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/* ------------------------------------------------------------------ analyse */

const NIVEAUX = [
  { titre: "L'adresse seule", detail: "Géométrie tirée du registre des bâtiments et de swisstopo. Ordre de grandeur.", part: 30 },
  { titre: '+ vos photos', detail: "L'état de chaque ouvrage est relevé et non plus présumé.", part: 55 },
  { titre: '+ le relevé sur place', detail: 'Périmètre, étages, hauteur, nombre de logements : les métrés deviennent les vôtres.', part: 80 },
  { titre: '+ les devis reçus', detail: 'Les prix du catalogue laissent la place aux montants réellement adjugés.', part: 100 },
]

function Analyse() {
  return (
    <Section id="analyse" className="bg-white">
      <TitreSection
        surtitre="L'analyse"
        titre="Une aide au relevé, entraînée sur le vocabulaire du bâti suisse"
        chapo="Elle ne remplace pas votre jugement. Elle vous évite de tout écrire, et elle ne vous laisse jamais deviner d'où vient un chiffre."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl bg-creme p-8">
          <h3 className="text-xl font-bold">Ce qu'elle regarde sur la photo</h3>
          <p className="mt-3 leading-relaxed text-marine/70">
            Fissures, décollements, salissures, corrosion, état des menuiseries et des
            revêtements. Elle en déduit un état, une priorité d'intervention et une note
            rédigée, qui part telle quelle dans le rapport si elle vous convient.
          </p>
          <FacadeAnnotee className="mt-7 w-full max-w-[260px]" />
        </article>

        <article className="rounded-3xl bg-creme p-8">
          <h3 className="text-xl font-bold">Ce que vous gardez la main dessus</h3>
          <p className="mt-3 leading-relaxed text-marine/70">
            Le choix de l'ouvrage reste le vôtre : vous le prenez dans le catalogue de
            votre bureau, avec son code CFC, son unité et ses prix. L'analyse n'invente pas
            un poste, elle qualifie celui que vous lui montrez.
          </p>
          <FeuilleRapport className="mt-7 w-full max-w-[260px]" />
        </article>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <article className="rounded-3xl bg-creme p-8">
          <h3 className="text-xl font-bold">Les métrés se calculent</h3>
          <p className="mt-3 leading-relaxed text-marine/70">
            Vingt-cinq formules traduisent la géométrie du bâtiment en quantités : la façade
            hors vitrage depuis le périmètre et les étages, la toiture selon sa pente, les
            descentes d'eaux pluviales selon l'emprise au sol. Chaque quantité affiche d'où
            elle vient, et se reprend à la main quand le terrain dit autre chose.
          </p>
        </article>
        <article className="rounded-3xl bg-creme p-8">
          <h3 className="text-xl font-bold">Les prix sont les vôtres</h3>
          <p className="mt-3 leading-relaxed text-marine/70">
            Le catalogue porte vos montants, par ouvrage et par état, dans vos unités. Aucune
            majoration cachée : le coût affiché est le prix du catalogue multiplié par la
            quantité, et la page vous dit lequel des deux manque quand un montant reste vide.
          </p>
        </article>
      </div>

      {/* La jauge : l'argument le plus honnête de la page, donc le plus visible. */}
      <div className="mt-6 rounded-3xl bg-marine p-8 text-white md:p-10">
        <h3 className="text-2xl font-bold">La précision se gagne, elle ne se promet pas</h3>
        <p className="mt-3 max-w-2xl leading-relaxed text-white/70">
          Diagly affiche toujours une fourchette et vous dit sur quoi elle repose. Plus vous
          donnez de matière, plus elle se resserre. Un chiffre exact sorti d'une seule photo
          serait une invention, et vous le sauriez au premier devis reçu.
        </p>
        <ol className="mt-8 space-y-5">
          {NIVEAUX.map((n) => (
            <li key={n.titre}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold">{n.titre}</p>
                <p className="text-sm text-white/60">{n.detail}</p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-corail" style={{ width: `${n.part}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ produit */

function Produit() {
  return (
    <Section id="produit">
      <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <TitreSection
            surtitre="Dans l'application"
            titre="La photo à gauche, le chiffrage à droite"
            chapo="Chaque ouvrage porte son état, sa priorité, sa quantité et son montant. Le total se met à jour pendant que vous marchez."
          />
          <ul className="space-y-3">
            {[
              'Le catalogue suit l\'ordre de la visite, pas celui de la nomenclature.',
              'Une quantité relevée sur place se verrouille et ne se recalcule plus.',
              'Le rapport de l\'existant reprend les états et les travaux, ouvrage par ouvrage.',
              'Export PDF et Excel, et un lien de partage en lecture seule pour la gérance.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-corail" aria-hidden="true" />
                <span className="leading-relaxed text-marine/75">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <ApercuProduit className="w-full" />
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------------- pour qui */

const PERSONAS = [
  {
    icone: Building2,
    titre: 'Régies et gérances',
    texte: "Un état du parc bâtiment par bâtiment, avec les priorités à trois ans et le budget associé. De quoi arbitrer en assemblée sans attendre un mandat d'expertise.",
    gain: 'Un immeuble relevé et chiffré dans la journée',
  },
  {
    icone: Compass,
    titre: 'Architectes et entreprises générales',
    texte: "Le relevé de l'existant en amont d'un projet de rénovation, avec les métrés déjà posés et les postes CFC prêts à passer en appel d'offres.",
    gain: 'Les métrés déduits, plus à ressaisir',
  },
  {
    icone: Home,
    titre: 'Propriétaires',
    texte: "Savoir ce que coûtera l'entretien de votre bien dans les dix ans, avant de vendre, d'acheter ou d'engager des travaux. Sans jargon.",
    gain: 'Une fourchette, et ce qui la fait bouger',
  },
]

function PourQui() {
  return (
    <Section id="pour-qui" className="bg-white">
      <TitreSection surtitre="Pour qui" titre="Trois métiers, le même relevé" />
      <div className="grid gap-6 md:grid-cols-3">
        {PERSONAS.map((p) => (
          <article key={p.titre} className="flex flex-col rounded-3xl bg-creme p-7">
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-marine text-white">
              <p.icone className="h-5.5 w-5.5" aria-hidden="true" />
            </span>
            <h3 className="text-xl font-bold leading-snug">{p.titre}</h3>
            <p className="mt-3 flex-1 leading-relaxed text-marine/70">{p.texte}</p>
            <p className="mt-5 border-t border-marine/10 pt-4 text-sm font-bold text-corail">{p.gain}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}

/* ---------------------------------------------------------------- bénéfices */

const BENEFICES = [
  { icone: Clock, titre: 'Le rapport en sortant', texte: "Le chiffrage se fait pendant la visite, pas le lendemain au bureau." },
  { icone: Wallet, titre: 'Vos prix, sans majoration', texte: "Le catalogue porte vos montants. Rien n'est indexé dans votre dos." },
  { icone: Layers, titre: 'Structuré par CFC', texte: "Chaque poste porte son code, son unité et sa quantité. Prêt pour l'appel d'offres." },
  { icone: ScanSearch, titre: 'Aucune expertise requise', texte: "L'analyse propose, vous décidez. Le vocabulaire du métier est déjà écrit." },
  { icone: FileText, titre: 'Historique conservé', texte: 'Les diagnostics restent consultables et comparables dans le temps.' },
  { icone: ShieldCheck, titre: 'Hébergé en Suisse', texte: 'Serveurs et base de données en Suisse. Partage par lien révocable.' },
]

function Benefices() {
  return (
    <Section>
      <TitreSection surtitre="Ce que ça change" titre="Six choses qui ne se font plus le soir" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {BENEFICES.map((b) => (
          <div key={b.titre} className="rounded-3xl bg-white p-6 shadow-[0_2px_14px_rgba(27,58,92,0.06)]">
            <b.icone className="mb-4 h-6 w-6 text-corail" aria-hidden="true" />
            <h3 className="font-bold leading-snug">{b.titre}</h3>
            <p className="mt-2 text-sm leading-relaxed text-marine/70">{b.texte}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------- tarifs */

interface Plan {
  nom: string
  prix: { mensuel: number | null; annuel: number | null }
  surDevis?: boolean
  gratuit?: boolean
  accroche: string
  points: string[]
  cta: string
  phare?: boolean
}

const PLANS: Plan[] = [
  {
    nom: 'Découverte', prix: { mensuel: 0, annuel: 0 }, gratuit: true,
    accroche: 'Pour voir ce que donne un rapport sur votre propre immeuble.',
    points: ['1 diagnostic offert', 'Rapport PDF avec filigrane', '1 utilisateur', 'Support par email'],
    cta: 'Commencer',
  },
  {
    nom: 'Starter', prix: { mensuel: 49, annuel: 490 },
    accroche: 'Pour un indépendant qui relève quelques immeubles par mois.',
    points: ['5 diagnostics par mois', 'Rapports PDF sans filigrane', '1 utilisateur', 'Historique sur 12 mois'],
    cta: 'Choisir Starter',
  },
  {
    nom: 'Pro', prix: { mensuel: 149, annuel: 1490 }, phare: true,
    accroche: 'Pour un bureau qui en fait son outil de relevé quotidien.',
    points: [
      '20 diagnostics par mois', '3 utilisateurs', 'Estimation détaillée poste par poste',
      'Export Excel', 'Rapports à votre logo', 'Support prioritaire',
    ],
    cta: 'Choisir Pro',
  },
  {
    nom: 'Entreprise', prix: { mensuel: null, annuel: null }, surDevis: true,
    accroche: 'Pour une régie ou un groupe qui gère un parc entier.',
    points: ['Diagnostics illimités', 'Utilisateurs illimités', 'API et connecteurs métier', 'Engagement de service', 'Accompagnement dédié'],
    cta: 'Nous écrire',
  },
]

const COMPARATIF: { ligne: string; valeurs: (string | boolean)[] }[] = [
  { ligne: 'Diagnostics par mois', valeurs: ['1 au total', '5', '20', 'Illimités'] },
  { ligne: 'Utilisateurs', valeurs: ['1', '1', '3', 'Illimités'] },
  { ligne: 'Rapport PDF', valeurs: ['Avec filigrane', true, true, true] },
  { ligne: 'Rapport de l\'existant', valeurs: [true, true, true, true] },
  { ligne: 'Chiffrage par poste CFC', valeurs: [false, true, true, true] },
  { ligne: 'Estimation détaillée par poste', valeurs: [false, false, true, true] },
  { ligne: 'Export Excel et CSV', valeurs: [false, false, true, true] },
  { ligne: 'Rapports à votre logo', valeurs: [false, false, true, true] },
  { ligne: 'Lien de partage au client', valeurs: [false, true, true, true] },
  { ligne: 'Historique des diagnostics', valeurs: ['30 jours', '12 mois', 'Illimité', 'Illimité'] },
  { ligne: 'Plans annotables', valeurs: [false, true, true, true] },
  { ligne: 'API et connecteurs', valeurs: [false, false, false, true] },
  { ligne: 'Support', valeurs: ['Email', 'Email', 'Prioritaire', 'Dédié'] },
]

function Tarifs() {
  const [annuel, setAnnuel] = useState(false)

  return (
    <Section id="tarifs" className="bg-white">
      <TitreSection
        surtitre="Tarifs"
        titre="Un prix par usage, pas par surprise"
        chapo="Tous les plans donnent accès au catalogue CFC, au calcul des métrés et au rapport. Ce qui change, c'est le volume et ce que vous en sortez."
      />

      {/* Bascule mensuel / annuel, au clavier comme à la souris. */}
      <div className="mb-10 inline-flex rounded-2xl bg-creme p-1.5" role="group" aria-label="Période de facturation">
        {([['Mensuel', false], ['Annuel', true]] as const).map(([libelle, valeur]) => (
          <button
            key={libelle}
            onClick={() => setAnnuel(valeur)}
            aria-pressed={annuel === valeur}
            className={cn('rounded-xl px-5 py-2.5 text-sm font-bold transition-colors',
              annuel === valeur ? 'bg-white text-marine shadow-sm' : 'text-marine/60 hover:text-marine')}
          >
            {libelle}
            {valeur && <span className="ml-2 rounded-full bg-corail px-2 py-0.5 text-[11px] text-white">2 mois offerts</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <article
            key={p.nom}
            className={cn('relative flex flex-col rounded-3xl border-2 p-7',
              p.phare ? 'border-corail bg-marine text-white' : 'border-marine/10 bg-creme')}
          >
            {p.phare && (
              <span className="absolute -top-3 left-7 rounded-full bg-corail px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                Le plus choisi
              </span>
            )}
            <h3 className="text-lg font-extrabold">{p.nom}</h3>
            <p className={cn('mt-1.5 text-sm leading-snug', p.phare ? 'text-white/65' : 'text-marine/60')}>{p.accroche}</p>

            <p className="mt-6 flex items-baseline gap-1.5">
              {p.surDevis ? (
                <span className="text-3xl font-extrabold">Sur devis</span>
              ) : p.gratuit ? (
                <span className="text-4xl font-extrabold">Gratuit</span>
              ) : (
                <>
                  <span className="text-4xl font-extrabold tabular-nums">
                    {annuel ? Math.round((p.prix.annuel ?? 0) / 12) : p.prix.mensuel}
                  </span>
                  <span className="text-lg font-bold">CHF</span>
                  <span className={cn('text-sm', p.phare ? 'text-white/60' : 'text-marine/55')}>par mois</span>
                </>
              )}
            </p>
            {!p.surDevis && !p.gratuit && annuel && (
              <p className={cn('mt-1 text-xs', p.phare ? 'text-white/55' : 'text-marine/50')}>
                Soit {p.prix.annuel} CHF par an, facturés en une fois
              </p>
            )}

            <ul className="mt-6 flex-1 space-y-2.5">
              {p.points.map((pt) => (
                <li key={pt} className="flex gap-2.5 text-sm leading-snug">
                  <Check className={cn('mt-0.5 h-4 w-4 shrink-0', p.phare ? 'text-corail' : 'text-corail')} aria-hidden="true" />
                  <span className={p.phare ? 'text-white/85' : 'text-marine/75'}>{pt}</span>
                </li>
              ))}
            </ul>

            <Bouton
              to={p.surDevis ? '/login' : '/login'}
              variante={p.phare ? 'plein' : 'contour'}
              className="mt-7 w-full py-3 text-sm"
            >
              {p.cta}
            </Bouton>
          </article>
        ))}
      </div>

      {/* Besoin ponctuel */}
      <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-3xl bg-creme p-7 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold">Un besoin ponctuel ?</h3>
          <p className="mt-1.5 leading-relaxed text-marine/70">
            Le diagnostic à l'unité coûte 39 CHF, et le pack de dix 290 CHF, sans abonnement
            ni date d'expiration.
          </p>
        </div>
        <Bouton to="/login" variante="contour" className="shrink-0 py-3 text-sm">Prendre un diagnostic</Bouton>
      </div>

      <TableauComparatif />

      <p className="mt-6 text-sm leading-relaxed text-marine/55">
        Prix hors taxes, TVA suisse en sus. Résiliable à tout moment, sans préavis.
        Paiement par carte ou sur facture pour les plans Pro et Entreprise.
      </p>
    </Section>
  )
}

function Case({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-5 w-5 text-corail" aria-label="Inclus" />
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-marine/25" aria-label="Non inclus" />
  return <span className="text-sm text-marine/75">{v}</span>
}

function TableauComparatif() {
  return (
    <details className="group mt-8 rounded-3xl border border-marine/10 bg-creme" open>
      <summary className="cursor-pointer list-none rounded-3xl px-7 py-5 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-corail">
        <span className="flex items-center justify-between gap-3">
          Comparer les plans en détail
          <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        </span>
      </summary>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">Comparaison des fonctionnalités par plan</caption>
          <thead>
            <tr>
              <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-marine/50">Fonctionnalité</th>
              {PLANS.map((p) => (
                <th key={p.nom} scope="col" className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-marine/50">
                  {p.nom}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARATIF.map((l) => (
              <tr key={l.ligne} className="border-t border-marine/10">
                <th scope="row" className="px-4 py-3 text-sm font-medium">{l.ligne}</th>
                {l.valeurs.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center"><Case v={v} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/* ----------------------------------------------------------------- preuves */

function Preuves() {
  return (
    <Section>
      <TitreSection
        surtitre="Où en est le produit"
        titre="En test dans un bureau, sur de vrais immeubles"
        chapo="Diagly est utilisé en version bêta par un bureau d'architectes romand, sur des dossiers réels. Voici ce qui en est sorti, sans arrondi."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {[
          { fait: '111 postes', detail: "Le catalogue du bureau, avec ses prix, ses unités et ses formules, repris tel quel." },
          { fait: '24 ouvrages', detail: "Relevés et chiffrés en une visite sur un immeuble de Lausanne, rapport compris." },
          { fait: '0 majoration', detail: "Les montants affichés sont ceux du catalogue. Une indexation automatique a été retirée après contrôle." },
        ].map((p) => (
          <div key={p.fait} className="rounded-3xl bg-white p-7 shadow-[0_2px_14px_rgba(27,58,92,0.06)]">
            <p className="text-3xl font-extrabold text-corail">{p.fait}</p>
            <p className="mt-3 leading-relaxed text-marine/70">{p.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------------- faq */

const QUESTIONS = [
  {
    q: "Peut-on se fier à ce que propose l'analyse ?",
    r: "Elle propose, elle ne décide pas. Chaque état suggéré s'affiche avec la description des travaux correspondants, et se corrige d'un geste. Sur un ouvrage qu'elle n'a pas su qualifier, elle le dit plutôt que d'inventer.",
  },
  {
    q: "Que valent les estimations face à un expert ?",
    r: "Ce sont des estimations indicatives, calculées à partir des prix de votre propre catalogue et des métrés déduits du bâtiment. Elles servent à arbitrer et à budgéter, pas à signer un contrat d'entreprise. Un devis reste un devis.",
  },
  {
    q: "Les codes CFC sont-ils respectés ?",
    r: "Oui. Chaque ouvrage porte son code CFC, son unité et sa quantité, et le rapport est structuré selon cette nomenclature. Les exports reprennent la même structure, prête pour un appel d'offres.",
  },
  {
    q: "Où vont les photos que je prends ?",
    r: "Sur nos serveurs en Suisse, rattachées à votre diagnostic, accessibles à vous seul et aux membres de votre équipe. Elles peuvent être analysées par un service tiers pour la proposition d'état, et vous pouvez désactiver cette aide dossier par dossier.",
  },
  {
    q: 'Quels formats sont acceptés ?',
    r: "Les photos prises depuis l'application ou choisies dans la galerie du téléphone. Les plans s'importent en PDF ou en image, et s'annotent directement dans l'application.",
  },
  {
    q: 'Combien de temps pour obtenir le rapport ?',
    r: "Il se construit pendant la visite. À la fin du relevé, le rapport est déjà là, avec ses totaux par priorité. L'export PDF prend quelques secondes.",
  },
  {
    q: 'Quelle différence entre les plans ?',
    r: "Le volume de diagnostics, le nombre d'utilisateurs, et ce que vous pouvez sortir. Le chiffrage détaillé par poste, l'export Excel et les rapports à votre logo commencent au plan Pro. Le tableau ci-dessus liste tout, ligne par ligne.",
  },
  {
    q: 'Puis-je arrêter quand je veux ?',
    r: "Oui, sans préavis ni justification. Vos diagnostics restent consultables et exportables jusqu'à la fin de la période déjà payée.",
  },
]

function Faq() {
  return (
    <Section id="faq" className="bg-white">
      <TitreSection surtitre="Questions" titre="Ce qu'on nous demande le plus souvent" />
      <div className="mx-auto max-w-3xl divide-y divide-marine/10 border-y border-marine/10">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-5 font-bold leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-corail">
              {item.q}
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-marine/25 transition-transform group-open:rotate-45" aria-hidden="true">
                <span className="text-sm leading-none">+</span>
              </span>
            </summary>
            <p className="mt-3 max-w-2xl leading-relaxed text-marine/70">{item.r}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------- appel final */

function AppelFinal() {
  return (
    <section className="px-5 pb-20 sm:px-8">
      <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[32px] bg-marine px-8 py-16 text-white md:px-14 md:py-20">
        <Blob className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 opacity-10" couleur="#ffffff" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="text-balance text-3xl font-extrabold leading-[1.1] sm:text-4xl md:text-5xl">
              Votre prochain immeuble, relevé et chiffré avant de repartir.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              Le premier diagnostic est offert, sans carte bancaire. Prenez un immeuble que
              vous connaissez et comparez avec ce que vous auriez fait à la main.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Bouton to="/login">Essayer gratuitement<ArrowRight className="h-4 w-4" aria-hidden="true" /></Bouton>
              <Bouton href="mailto:contact@finalyn.com" variante="clair">Parler à quelqu'un</Bouton>
            </div>
          </div>
          <FeuilleRapport className="mx-auto w-full max-w-[240px]" />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ pied de page */

const COLONNES = [
  { titre: 'Produit', liens: [['Fonctionnement', '#fonctionnement'], ["L'analyse", '#analyse'], ['Tarifs', '#tarifs'], ['Questions', '#faq']] },
  { titre: 'Ressources', liens: [['Aide et support', '/login'], ['Nous écrire', 'mailto:contact@finalyn.com']] },
  { titre: 'Légal', liens: [['Mentions légales', '/mentions-legales'], ['Confidentialité', '/confidentialite'], ['Conditions générales', '/cgu']] },
]

function PiedDePage() {
  return (
    <footer className="border-t border-marine/10 bg-white px-5 py-14 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <p className="text-xl font-extrabold tracking-tight">Diagly</p>
          <p className="mt-3 max-w-xs leading-relaxed text-marine/60">
            Le diagnostic de bâtiment et la planification de rénovation, pensés pour la
            pratique suisse.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-creme px-3 py-1.5 text-xs font-bold text-marine">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />Conçu et hébergé en Suisse
          </p>
        </div>
        {COLONNES.map((c) => (
          <nav key={c.titre} aria-label={c.titre}>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-marine/45">{c.titre}</p>
            <ul className="space-y-2.5">
              {c.liens.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('/') && !href.startsWith('//')
                    ? <Link to={href} className="text-sm text-marine/70 transition-colors hover:text-marine">{label}</Link>
                    : <a href={href} className="text-sm text-marine/70 transition-colors hover:text-marine">{label}</a>}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-12 flex w-full max-w-6xl flex-col gap-3 border-t border-marine/10 pt-6 text-sm text-marine/50 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Diagly. Tous droits réservés.</p>
        <p className="inline-flex items-center gap-1.5">
          <Download className="h-4 w-4" aria-hidden="true" />
          Installable sur téléphone, fonctionne hors ligne pendant la visite.
        </p>
      </div>
    </footer>
  )
}
