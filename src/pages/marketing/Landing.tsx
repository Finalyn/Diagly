import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import visite from '@/assets/vitrine/app-visite.png'
import couts from '@/assets/vitrine/app-couts.png'
import rapport from '@/assets/vitrine/app-rapport.png'
import catalogue from '@/assets/vitrine/app-catalogue.png'

/**
 * Page publique de Diagly.
 *
 * Parti pris : pas d'illustration, pas de palette de marque. Le produit est
 * l'image. Fond blanc ou noir plein cadre, typographie très grande et resserrée,
 * un seul accent bleu, et de vraies captures de l'application. Ce qu'il y a à
 * montrer, c'est un écran qui chiffre un immeuble, pas un dessin de personnage.
 *
 * Deux écarts assumés par rapport au brief commercial :
 *
 * L'analyse ne devine pas le code CFC. Le diagnostiqueur choisit l'ouvrage dans le
 * catalogue, puis elle propose un état, une priorité et une note. Annoncer une
 * reconnaissance automatique de l'ouvrage serait vendre autre chose.
 *
 * Aucun témoignage inventé. Un faux avis signé d'un nom et d'un canton est un faux
 * document. La page porte des faits vérifiables en attendant un vrai témoignage.
 */

const NAV = [
  { href: '#visite', label: 'La visite' },
  { href: '#analyse', label: "L'analyse" },
  { href: '#rapport', label: 'Le rapport' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#questions', label: 'Questions' },
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
      "Relevez l'état d'un immeuble pendant la visite. Diagly propose l'état de chaque ouvrage, calcule les métrés et sort un rapport structuré par codes CFC, chiffré en francs. Conçu et hébergé en Suisse.")
  }, [])

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] antialiased">
      <Entete />
      <main>
        <Hero />
        <Visite />
        <Analyse />
        <Rapport />
        <Chiffres />
        <PourQui />
        <Tarifs />
        <Questions />
        <AppelFinal />
      </main>
      <PiedDePage />
    </div>
  )
}

/* --------------------------------------------------------------- éléments */

function Pilule({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-[#0066cc] px-6 py-3 text-[15px] text-white',
        'transition-colors hover:bg-[#0055b3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0066cc]',
        className,
      )}
    >
      {children}
    </Link>
  )
}

function LienFleche({ children, href, to }: { children: React.ReactNode; href?: string; to?: string }) {
  const contenu = <>{children}<ChevronRight className="h-4 w-4" aria-hidden="true" /></>
  const styles = 'inline-flex items-center gap-0.5 text-[15px] text-[#0066cc] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0066cc]'
  return to ? <Link to={to} className={styles}>{contenu}</Link> : <a href={href} className={styles}>{contenu}</a>
}

/** Titre de section : très grand, très serré, centré. La règle de la maison. */
function GrandTitre({ children, sombre, className }: { children: React.ReactNode; sombre?: boolean; className?: string }) {
  return (
    <h2 className={cn(
      'text-balance text-center text-[clamp(2rem,5.2vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.028em]',
      sombre ? 'text-white' : 'text-[#1d1d1f]',
      className,
    )}>
      {children}
    </h2>
  )
}

function Chapo({ children, sombre }: { children: React.ReactNode; sombre?: boolean }) {
  return (
    <p className={cn('mx-auto mt-5 max-w-2xl text-balance text-center text-[clamp(1.05rem,1.9vw,1.35rem)] leading-[1.4]',
      sombre ? 'text-white/65' : 'text-[#6e6e73]')}>
      {children}
    </p>
  )
}

/** Capture de l'application, présentée comme un objet posé sur la page. */
function Capture({ src, alt, className, sombre }: {
  src: string; alt: string; className?: string; sombre?: boolean
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('mx-auto block w-full rounded-[22px]',
        sombre ? 'shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9)]' : 'shadow-[0_24px_70px_-30px_rgba(0,0,0,0.35)]',
        className)}
    />
  )
}

/* ----------------------------------------------------------------- entête */

function Entete() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.08] bg-white/72 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-12 w-full max-w-[1024px] items-center gap-8 px-5">
        <a href="#haut" className="text-[17px] font-semibold tracking-[-0.01em]">Diagly</a>
        <nav className="hidden flex-1 items-center gap-8 md:flex" aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[12px] text-[#1d1d1f]/80 transition-opacity hover:opacity-60">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5 md:ml-0">
          <Link to="/login" className="text-[12px] text-[#1d1d1f]/80 transition-opacity hover:opacity-60">Se connecter</Link>
          <button onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} aria-label="Ouvrir le menu" className="md:hidden">
            <Minus className={cn('h-4 w-4 transition-transform', ouvert && 'rotate-90')} />
          </button>
        </div>
      </div>
      {ouvert && (
        <nav className="border-t border-black/[0.06] bg-white px-5 py-2 md:hidden" aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOuvert(false)} className="block py-2.5 text-[15px] text-[#1d1d1f]/85">
              {n.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}

/* ------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section id="haut" className="scroll-mt-16 overflow-hidden px-5 pt-16 text-center md:pt-24">
      <p className="text-[15px] font-semibold text-[#0066cc]">Diagly</p>
      <h1 className="mx-auto mt-3 max-w-4xl text-balance text-[clamp(2.4rem,7vw,5rem)] font-semibold leading-[1.03] tracking-[-0.035em]">
        Un immeuble relevé et chiffré avant de repartir.
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-balance text-[clamp(1.1rem,2.1vw,1.5rem)] leading-[1.35] text-[#6e6e73]">
        Vous photographiez les ouvrages pendant la visite. Diagly propose leur état,
        calcule les métrés et sort un rapport structuré par codes CFC, chiffré en francs.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Pilule to="/login">Essayer gratuitement</Pilule>
        <LienFleche href="#rapport">Voir un rapport</LienFleche>
      </div>
      <p className="mt-5 text-[13px] text-[#86868b]">
        Sans carte bancaire. Premier diagnostic offert. Hébergé en Suisse.
      </p>
      <div className="mx-auto mt-14 max-w-[340px] md:mt-20 md:max-w-[380px]">
        <Capture src={visite} alt="L'écran de relevé sur téléphone : les quatre états d'un ouvrage, chacun avec son constat et les travaux qu'il engage." />
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- visite */

function Visite() {
  return (
    <section id="visite" className="scroll-mt-16 bg-[#f5f5f7] px-5 py-24 md:py-32">
      <GrandTitre>Le catalogue suit la visite,<br className="hidden sm:block" /> pas la nomenclature.</GrandTitre>
      <Chapo>
        Façade, porte d'entrée, boîte aux lettres, communs, techniques, toiture. Onze étapes
        dans l'ordre où l'on marche. Une étape terminée, on passe à la suivante.
      </Chapo>
      <div className="mx-auto mt-16 max-w-[340px] md:max-w-[380px]">
        <Capture src={catalogue} alt="Le catalogue rangé par étape de visite, chaque ouvrage avec son code CFC." />
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- analyse */

const PRECISION = [
  { titre: "L'adresse seule", detail: 'Géométrie du registre des bâtiments. Un ordre de grandeur.', part: 30 },
  { titre: 'Avec vos photos', detail: "L'état de chaque ouvrage est relevé, plus présumé.", part: 55 },
  { titre: 'Avec le relevé sur place', detail: 'Périmètre, étages, hauteur, logements. Les métrés deviennent les vôtres.', part: 80 },
  { titre: 'Avec les devis reçus', detail: 'Les prix du catalogue cèdent la place aux montants adjugés.', part: 100 },
]

function Analyse() {
  return (
    <section id="analyse" className="scroll-mt-16 bg-black px-5 py-24 text-white md:py-32">
      <GrandTitre sombre>Elle propose.<br />Vous décidez.</GrandTitre>
      <Chapo sombre>
        Sur la photo d'un ouvrage, Diagly propose un état, une priorité et une note écrite.
        Le choix de l'ouvrage reste le vôtre, avec son code CFC, son unité et vos prix.
      </Chapo>

      <div className="mx-auto mt-20 grid max-w-[900px] gap-14 md:grid-cols-2 md:gap-16">
        <div>
          <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Ce qu'elle regarde</h3>
          <p className="mt-4 text-[17px] leading-relaxed text-white/60">
            Fissures, décollements, salissures, corrosion, état des menuiseries et des
            revêtements. Elle en déduit un état parmi quatre, une priorité d'intervention,
            et une note qui part telle quelle dans le rapport si elle vous convient.
          </p>
        </div>
        <div>
          <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Ce qu'elle ne fait pas</h3>
          <p className="mt-4 text-[17px] leading-relaxed text-white/60">
            Elle n'invente pas un poste et ne devine pas un code CFC. Elle qualifie l'ouvrage
            que vous lui montrez. Sur un cas qu'elle ne sait pas trancher, elle le dit plutôt
            que de remplir la case.
          </p>
        </div>
      </div>

      {/* La jauge : l'argument le plus honnête de la page, donc le plus visible. */}
      <div className="mx-auto mt-24 max-w-[760px]">
        <h3 className="text-balance text-center text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-tight tracking-[-0.024em]">
          La précision se gagne. Elle ne se promet pas.
        </h3>
        <p className="mx-auto mt-5 max-w-xl text-center text-[17px] leading-relaxed text-white/60">
          Diagly affiche une fourchette et dit sur quoi elle repose. Un chiffre exact tiré
          d'une seule photo serait une invention, et vous le sauriez au premier devis reçu.
        </p>
        <ol className="mt-14 space-y-7">
          {PRECISION.map((n) => (
            <li key={n.titre}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[17px] font-semibold">{n.titre}</p>
                <p className="text-[15px] text-white/50">{n.detail}</p>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-[#0a84ff]" style={{ width: `${n.part}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- rapport */

function Rapport() {
  return (
    <section id="rapport" className="scroll-mt-16 px-5 py-24 md:py-32">
      <GrandTitre>Le rapport est déjà écrit<br className="hidden sm:block" /> quand vous sortez.</GrandTitre>
      <Chapo>
        Un rapport de l'existant, ouvrage par ouvrage, avec l'état constaté et les travaux à
        prévoir. Un chiffrage par poste CFC. Un lien de partage en lecture seule pour la gérance.
      </Chapo>
      <div className="mx-auto mt-16 max-w-[960px]">
        <Capture src={rapport} alt="Le rapport de l'existant : chaque ouvrage avec son état et les travaux à prévoir." />
      </div>

      <div className="mx-auto mt-28 max-w-[960px]">
        <h3 className="text-balance text-center text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-tight tracking-[-0.024em]">
          Chaque montant dit d'où il vient.
        </h3>
        <p className="mx-auto mt-5 max-w-xl text-center text-[17px] leading-relaxed text-[#6e6e73]">
          Prix du catalogue multiplié par la quantité. La quantité affiche sa formule et se
          reprend à la main quand le terrain dit autre chose. Aucune majoration cachée.
        </p>
        <Capture className="mt-14" src={couts} alt="La page des coûts : les totaux par priorité et le détail poste par poste." />
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- chiffres */

const CHIFFRES = [
  { valeur: '111', libelle: 'postes au catalogue CFC' },
  { valeur: '25', libelle: 'formules de métré' },
  { valeur: '11', libelle: 'étapes de visite' },
  { valeur: '8.1 %', libelle: 'TVA suisse appliquée' },
]

function Chiffres() {
  return (
    <section className="bg-[#f5f5f7] px-5 py-20">
      <div className="mx-auto grid w-full max-w-[900px] grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {CHIFFRES.map((c) => (
          <div key={c.libelle} className="text-center">
            <p className="text-[clamp(2.2rem,5vw,3.2rem)] font-semibold tracking-[-0.03em] tabular-nums">{c.valeur}</p>
            <p className="mt-1 text-[15px] leading-snug text-[#6e6e73]">{c.libelle}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- pour qui */

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
    <section className="px-5 py-24 md:py-32">
      <GrandTitre>Trois métiers.<br />Le même relevé.</GrandTitre>
      <div className="mx-auto mt-16 grid max-w-[900px] gap-12 md:grid-cols-3">
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

/* ----------------------------------------------------------------- tarifs */

interface Plan {
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
    points: ['1 diagnostic offert', 'Rapport PDF avec filigrane', '1 utilisateur', 'Support par email'],
    cta: 'Commencer',
  },
  {
    nom: 'Starter', mensuel: 49, annuel: 490,
    accroche: 'Pour un indépendant, quelques immeubles par mois.',
    points: ['5 diagnostics par mois', 'Rapports PDF sans filigrane', '1 utilisateur', 'Historique sur 12 mois'],
    cta: 'Choisir Starter',
  },
  {
    nom: 'Pro', mensuel: 149, annuel: 1490, phare: true,
    accroche: 'Pour un bureau qui en fait son outil de relevé.',
    points: ['20 diagnostics par mois', '3 utilisateurs', 'Chiffrage détaillé par poste', 'Export Excel', 'Rapports à votre logo', 'Support prioritaire'],
    cta: 'Choisir Pro',
  },
  {
    nom: 'Entreprise', mensuel: null, annuel: null, surDevis: true,
    accroche: 'Pour une régie ou un groupe qui gère un parc.',
    points: ['Diagnostics illimités', 'Utilisateurs illimités', 'API et connecteurs', 'Engagement de service', 'Accompagnement dédié'],
    cta: 'Nous écrire',
  },
]

const COMPARATIF: { ligne: string; valeurs: (string | boolean)[] }[] = [
  { ligne: 'Diagnostics par mois', valeurs: ['1 au total', '5', '20', 'Illimités'] },
  { ligne: 'Utilisateurs', valeurs: ['1', '1', '3', 'Illimités'] },
  { ligne: 'Rapport PDF', valeurs: ['Avec filigrane', true, true, true] },
  { ligne: "Rapport de l'existant", valeurs: [true, true, true, true] },
  { ligne: 'Chiffrage par poste CFC', valeurs: [false, true, true, true] },
  { ligne: 'Chiffrage détaillé par poste', valeurs: [false, false, true, true] },
  { ligne: 'Export Excel et CSV', valeurs: [false, false, true, true] },
  { ligne: 'Rapports à votre logo', valeurs: [false, false, true, true] },
  { ligne: 'Lien de partage au client', valeurs: [false, true, true, true] },
  { ligne: 'Galerie photos et export', valeurs: [true, true, true, true] },
  { ligne: 'Plans annotables', valeurs: [false, true, true, true] },
  { ligne: 'Historique', valeurs: ['30 jours', '12 mois', 'Illimité', 'Illimité'] },
  { ligne: 'API et connecteurs', valeurs: [false, false, false, true] },
  { ligne: 'Support', valeurs: ['Email', 'Email', 'Prioritaire', 'Dédié'] },
]

function Tarifs() {
  const [annuel, setAnnuel] = useState(false)
  return (
    <section id="tarifs" className="scroll-mt-16 bg-[#f5f5f7] px-5 py-24 md:py-32">
      <GrandTitre>Un prix par usage.</GrandTitre>
      <Chapo>
        Tous les plans donnent le catalogue CFC, le calcul des métrés et le rapport. Ce qui
        change, c'est le volume et ce que vous en sortez.
      </Chapo>

      <div className="mt-12 flex justify-center">
        <div className="inline-flex rounded-full bg-black/[0.06] p-1" role="group" aria-label="Période de facturation">
          {([['Mensuel', false], ['Annuel', true]] as const).map(([libelle, valeur]) => (
            <button
              key={libelle}
              onClick={() => setAnnuel(valeur)}
              aria-pressed={annuel === valeur}
              className={cn('rounded-full px-5 py-2 text-[14px] transition-colors',
                annuel === valeur ? 'bg-white font-medium shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]')}
            >
              {libelle}{valeur && <span className="ml-1.5 text-[#0066cc]">2 mois offerts</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-[1000px] gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <article key={p.nom} className="flex flex-col">
            <h3 className="text-[21px] font-semibold tracking-[-0.015em]">
              {p.nom}
              {p.phare && <span className="ml-2 align-middle text-[12px] font-normal text-[#0066cc]">Le plus choisi</span>}
            </h3>
            <p className="mt-1.5 text-[14px] leading-snug text-[#6e6e73]">{p.accroche}</p>

            <p className="mt-6 flex items-baseline gap-1.5">
              {p.surDevis ? <span className="text-[32px] font-semibold tracking-[-0.02em]">Sur devis</span>
                : p.gratuit ? <span className="text-[32px] font-semibold tracking-[-0.02em]">Gratuit</span>
                  : (
                    <>
                      <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                        {annuel ? Math.round((p.annuel ?? 0) / 12) : p.mensuel}
                      </span>
                      <span className="text-[15px] text-[#6e6e73]">CHF par mois</span>
                    </>
                  )}
            </p>
            {!p.surDevis && !p.gratuit && annuel && (
              <p className="mt-1 text-[13px] text-[#86868b]">{p.annuel} CHF par an, en une fois</p>
            )}

            <ul className="mt-7 flex-1 space-y-2.5">
              {p.points.map((pt) => (
                <li key={pt} className="flex gap-2 text-[15px] leading-snug text-[#1d1d1f]/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0066cc]" aria-hidden="true" />
                  {pt}
                </li>
              ))}
            </ul>

            <Pilule to="/login" className="mt-8 w-full py-2.5 text-[14px]">{p.cta}</Pilule>
          </article>
        ))}
      </div>

      <p className="mx-auto mt-16 max-w-[1000px] text-center text-[15px] leading-relaxed text-[#6e6e73]">
        Besoin ponctuel : le diagnostic à l'unité coûte 39 CHF, le pack de dix 290 CHF, sans
        abonnement ni date d'expiration.
      </p>

      <TableauComparatif />

      <p className="mx-auto mt-8 max-w-[1000px] text-center text-[13px] leading-relaxed text-[#86868b]">
        Prix hors taxes, TVA suisse en sus. Résiliable à tout moment, sans préavis. Paiement
        par carte, ou sur facture pour les plans Pro et Entreprise.
      </p>
    </section>
  )
}

function Case({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-[#0066cc]" aria-label="Inclus" />
  if (v === false) return <Minus className="mx-auto h-3.5 w-3.5 text-black/20" aria-label="Non inclus" />
  return <span className="text-[14px] text-[#6e6e73]">{v}</span>
}

function TableauComparatif() {
  return (
    <details className="group mx-auto mt-14 max-w-[1000px]" open>
      <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-[15px] text-[#0066cc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0066cc]">
        Comparer les plans en détail
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <caption className="sr-only">Comparaison des fonctionnalités par plan</caption>
          <thead>
            <tr className="border-b border-black/10">
              <th scope="col" className="py-3 pr-4 text-[12px] font-normal uppercase tracking-wider text-[#86868b]">Fonctionnalité</th>
              {PLANS.map((p) => (
                <th key={p.nom} scope="col" className="px-3 py-3 text-center text-[12px] font-normal uppercase tracking-wider text-[#86868b]">{p.nom}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARATIF.map((l) => (
              <tr key={l.ligne} className="border-b border-black/[0.06]">
                <th scope="row" className="py-3 pr-4 text-[15px] font-normal">{l.ligne}</th>
                {l.valeurs.map((v, i) => <td key={i} className="px-3 py-3 text-center"><Case v={v} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/* -------------------------------------------------------------- questions */

const QUESTIONS = [
  { q: "Peut-on se fier à ce que propose l'analyse ?", r: "Elle propose, elle ne décide pas. Chaque état suggéré s'affiche avec les travaux qu'il engage, et se corrige d'un geste. Sur un ouvrage qu'elle ne sait pas qualifier, elle le dit plutôt que de remplir la case." },
  { q: 'Que valent les estimations face à un expert ?', r: "Ce sont des estimations indicatives, calculées depuis les prix de votre propre catalogue et les métrés déduits du bâtiment. Elles servent à arbitrer et à budgéter. Un devis reste un devis." },
  { q: 'Les codes CFC sont-ils respectés ?', r: "Oui. Chaque ouvrage porte son code, son unité et sa quantité, et le rapport suit cette structure. Les exports la reprennent, prêts pour un appel d'offres." },
  { q: 'Où vont les photos que je prends ?', r: "Sur nos serveurs en Suisse, rattachées à votre diagnostic, accessibles à vous et à votre équipe. Elles peuvent être analysées par un service tiers pour la proposition d'état, et cette aide se désactive dossier par dossier." },
  { q: 'Quels formats sont acceptés ?', r: "Les photos prises depuis l'application ou choisies dans la galerie du téléphone. Les plans s'importent en PDF ou en image, et s'annotent directement." },
  { q: 'Combien de temps pour obtenir le rapport ?', r: "Il se construit pendant la visite. À la fin du relevé il est déjà là, avec ses totaux par priorité. L'export PDF prend quelques secondes." },
  { q: 'Quelle différence entre les plans ?', r: "Le volume, le nombre d'utilisateurs, et ce que vous pouvez sortir. Le chiffrage détaillé, l'export Excel et les rapports à votre logo commencent au plan Pro." },
  { q: 'Puis-je arrêter quand je veux ?', r: "Oui, sans préavis. Vos diagnostics restent consultables et exportables jusqu'à la fin de la période déjà payée." },
]

function Questions() {
  return (
    <section id="questions" className="scroll-mt-16 px-5 py-24 md:py-32">
      <GrandTitre>Questions fréquentes</GrandTitre>
      <div className="mx-auto mt-14 max-w-[760px]">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group border-b border-black/[0.09]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0066cc]">
              {item.q}
              <Plus className="h-4 w-4 shrink-0 text-[#0066cc] transition-transform group-open:rotate-45" aria-hidden="true" />
            </summary>
            <p className="pb-6 pr-10 text-[17px] leading-relaxed text-[#6e6e73]">{item.r}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ appel final */

function AppelFinal() {
  return (
    <section className="bg-black px-5 py-28 text-center text-white md:py-36">
      <GrandTitre sombre>Prenez un immeuble<br className="hidden sm:block" /> que vous connaissez.</GrandTitre>
      <Chapo sombre>
        Le premier diagnostic est offert, sans carte bancaire. Comparez avec ce que vous
        auriez fait à la main.
      </Chapo>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Pilule to="/login">Essayer gratuitement</Pilule>
        <a href="mailto:contact@finalyn.com" className="inline-flex items-center gap-0.5 text-[15px] text-[#0a84ff] hover:underline">
          Parler à quelqu'un<ChevronRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- pied de page */

const COLONNES = [
  { titre: 'Produit', liens: [['La visite', '#visite'], ["L'analyse", '#analyse'], ['Le rapport', '#rapport'], ['Tarifs', '#tarifs']] },
  { titre: 'Ressources', liens: [['Questions', '#questions'], ['Aide et support', '/login'], ['Nous écrire', 'mailto:contact@finalyn.com']] },
  { titre: 'Légal', liens: [['Mentions légales', '/mentions-legales'], ['Confidentialité', '/confidentialite'], ['Conditions générales', '/cgu']] },
]

function PiedDePage() {
  return (
    <footer className="bg-[#f5f5f7] px-5 py-12 text-[12px] text-[#6e6e73]">
      <div className="mx-auto w-full max-w-[900px]">
        <p className="border-b border-black/[0.09] pb-6 leading-relaxed">
          Les estimations produites par Diagly sont indicatives et ne remplacent ni un devis
          d'entreprise ni une expertise. Les prix affichés proviennent du catalogue de votre
          bureau. Diagly est conçu et hébergé en Suisse.
        </p>
        <div className="grid gap-8 py-8 sm:grid-cols-3">
          {COLONNES.map((c) => (
            <nav key={c.titre} aria-label={c.titre}>
              <p className="mb-3 font-semibold text-[#1d1d1f]">{c.titre}</p>
              <ul className="space-y-2">
                {c.liens.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('/') && !href.startsWith('//')
                      ? <Link to={href} className="hover:underline">{label}</Link>
                      : <a href={href} className="hover:underline">{label}</a>}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-black/[0.09] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Diagly. Tous droits réservés.</p>
          <p>Conçu en Suisse. Installable sur téléphone, utilisable hors ligne pendant la visite.</p>
        </div>
      </div>
    </footer>
  )
}
