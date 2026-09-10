import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import visite from '@/assets/vitrine/app-visite.png'
import couts from '@/assets/vitrine/app-couts.png'
import rapport from '@/assets/vitrine/app-rapport.png'
import catalogue from '@/assets/vitrine/app-catalogue.png'
import { CarteAdresse } from './CarteAdresse'
import { BoutonFleche, Pilule, LienFleche, GrandTitre, Chapo, Capture } from './elements'
import { CommentCaMarche, TempsGagne, Modules, Technique, IntelligenceArtificielle } from './SectionsProduit'
import { releverBatiment, EXEMPLES } from './registre'
import type { Lieu } from './registre'

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
  { href: '#methode', label: 'Comment ça marche' },
  { href: '#ia', label: "L'IA" },
  { href: '#modules', label: 'Les modules' },
  { href: '#technique', label: 'La méthode' },
  { href: '#tarifs', label: 'Tarifs' },
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
    <div className="relative min-h-screen bg-white text-[#1d1d1f] antialiased">
      {/* Nuance du haut : elle part du premier pixel, passe derriere la barre
          flottante et s'eteint vers le blanc. Posee ici plutot que sur le heros,
          sinon une couture nette apparait a la jonction des deux. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[820px] bg-[linear-gradient(180deg,#e9f1fd_0%,#f2f7fd_35%,#fafcfe_70%,#ffffff_100%)]"
      />
      <Entete />
      <main>
        <Hero />
        <CommentCaMarche />
        <Visite />
        <Adresse />
        <IntelligenceArtificielle />
        <Rapport />
        <Precision />
        <TempsGagne />
        <Modules />
        <Technique />
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

/* ----------------------------------------------------------------- entête */

/**
 * Barre du haut.
 *
 * Elle n'est pas là seulement pour naviguer : c'est le seul élément visible en
 * permanence, donc le seul qui convertit à n'importe quel moment de la lecture.
 * D'où un bandeau d'offre au-dessus, la marque à gauche, et un bouton plein qui
 * ne disparaît jamais, même sur téléphone.
 */
function Entete() {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="sticky top-3 z-50 px-3 pt-3 sm:top-4 sm:px-5 sm:pt-4">
      <header className="mx-auto flex w-full max-w-[1160px] items-center gap-6 rounded-full border border-black/[0.06] bg-white/85 px-3 py-2 shadow-[0_10px_30px_-14px_rgba(20,45,90,0.35)] backdrop-blur-xl backdrop-saturate-150 sm:px-4">
        <a href="#haut" className="flex shrink-0 items-center gap-2 pl-1">
          <img src="/diagly-mark.svg" alt="" aria-hidden="true" className="h-6 w-6" />
          <span className="text-[17px] font-semibold tracking-[-0.015em]">Diagly</span>
        </a>

        <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex" aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[14px] text-[#1d1d1f]/70 transition-colors hover:text-[#1d1d1f]">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 lg:ml-0 lg:gap-3">
          <Link to="/login" className="hidden text-[14px] text-[#1d1d1f]/70 transition-colors hover:text-[#1d1d1f] sm:block">
            Se connecter
          </Link>
          {/* Le bouton ne disparait jamais : c'est lui qui transforme la lecture en essai. */}
          <BoutonFleche to="/login" className="px-4 py-2 text-[14px]">
            <span className="sm:hidden">Essayer</span>
            <span className="hidden sm:inline">Essayer gratuitement</span>
          </BoutonFleche>
          <button
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-label="Ouvrir le menu"
            className="pr-1 lg:hidden"
          >
            <Minus className={cn('h-5 w-5 transition-transform', ouvert && 'rotate-90')} />
          </button>
        </div>
      </header>

      {ouvert && (
        <nav className="mx-auto mt-2 w-full max-w-[1160px] rounded-3xl border border-black/[0.06] bg-white/95 px-4 py-2 shadow-lg backdrop-blur-xl lg:hidden" aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOuvert(false)} className="block py-2.5 text-[15px] text-[#1d1d1f]/85">
              {n.label}
            </a>
          ))}
          <Link to="/login" onClick={() => setOuvert(false)} className="block py-2.5 text-[15px] text-[#1d1d1f]/85 sm:hidden">
            Se connecter
          </Link>
        </nav>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section id="haut" className="relative scroll-mt-28 overflow-hidden px-5 pb-2 pt-24 text-center md:pt-28">
      {/* Badge : ce qui vient d'arriver, avant même le titre. */}
      <a href="#visite" className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white py-1 pl-1 pr-3.5 text-[13px] shadow-sm transition-colors hover:border-black/15">
        <span className="rounded-full bg-[#0167EA] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">Nouveau</span>
        <span className="text-[#1d1d1f]/75">Le parcours de visite guidé</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#1d1d1f]/40" aria-hidden="true" />
      </a>

      <h1 className="mx-auto mt-7 max-w-4xl text-balance text-[clamp(2.4rem,6.6vw,4.6rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
        Un immeuble relevé et chiffré{' '}
        <span className="font-serif italic font-normal tracking-[-0.01em]">avant de repartir</span>
      </h1>

      <p className="mx-auto mt-6 max-w-2xl text-balance text-[clamp(1.05rem,2vw,1.35rem)] leading-[1.45] text-[#5b6572]">
        Vous photographiez les ouvrages pendant la visite. Diagly propose leur état,
        calcule les métrés et sort un rapport structuré par codes CFC, chiffré en francs.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
        <BoutonFleche to="/login">Essayer gratuitement</BoutonFleche>
        <LienFleche href="#rapport">Voir un rapport</LienFleche>
      </div>

      {/* Preuve : des faits verifiables, pas des etoiles ni des avatars inventes. */}
      <div className="mx-auto mt-9 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-[#5b6572]">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0167EA]" aria-hidden="true" />
          En test dans un bureau d'architectes romand
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0167EA]" aria-hidden="true" />
          111 postes au catalogue CFC
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0167EA]" aria-hidden="true" />
          Hébergé en Suisse
        </span>
      </div>

      {/* La capture deborde en bas : on montre l'ecran, pas sa bordure. Et c'est
          l'ecran d'ordinateur, celui qui dit d'un coup d'oeil ce que le produit rend. */}
      <div className="mx-auto mt-16 max-h-[300px] max-w-[1120px] overflow-hidden px-2 sm:max-h-[420px] md:mt-20 md:max-h-[520px]">
        <img
          src={couts}
          alt="La page des coûts : les postes groupés par priorité, chacun avec son état et son montant, et la synthèse avec honoraires, réserve et TVA."
          className="w-full rounded-t-[20px] border border-black/[0.07] shadow-[0_-4px_80px_-24px_rgba(20,45,90,0.5)]"
        />
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- visite */

function Visite() {
  return (
    <section id="visite" className="scroll-mt-28 bg-[#f5f7fa] px-5 py-24 md:py-32">
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

/* ---------------------------------------------------------------- adresse */

/**
 * Ce qu'une adresse donne, avant meme la visite.
 *
 * C'est le premier niveau de la jauge de precision, rendu concret. Les valeurs
 * qui ont de la valeur sont floutees : on montre qu'elles existent et d'ou elles
 * viennent, on ne les donne pas. Elles restent marquees comme decoratives pour
 * un lecteur d'ecran, qui n'a rien a faire d'un chiffre illisible.
 */
/**
 * Ce que le registre porte. Une seule de ces lignes est demandee au serveur et
 * s'affiche en clair : l'annee de construction. Les autres valeurs ne sont jamais
 * interrogees, elles ne servent qu'a donner une forme au flou, et restent
 * marquees comme decoratives pour un lecteur d'ecran.
 */
const REGISTRE = [
  { libelle: 'Identifiant fédéral du bâtiment', exemple: '1’927’043' },
  { libelle: 'Année de construction', exemple: '1972', reel: true },
  { libelle: 'Nombre d’étages', exemple: '6' },
  { libelle: 'Nombre de logements', exemple: '18' },
  { libelle: 'Emprise au sol', exemple: '420 m²' },
]

/** Les metres que Diagly deduit de la geometrie : c'est notre travail, il reste couvert. */
const DEDUIT = [
  { libelle: 'Surface de façade', exemple: '1’188 m²' },
  { libelle: 'Surface vitrée', exemple: '475 m²' },
  { libelle: 'Échafaudage', exemple: '1’307 m²' },
]

/** Une ligne dont la valeur existe mais ne se lit pas. */
function LigneMasquee({ libelle, exemple }: { libelle: string; exemple: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[15px] text-[#1d1d1f]/75">{libelle}</dt>
      <dd className="shrink-0 select-none text-[15px] font-semibold tabular-nums blur-[5px]" aria-hidden="true">{exemple}</dd>
    </div>
  )
}

function Adresse() {
  const [lieu, setLieu] = useState<Lieu>(EXEMPLES[0])
  // On retient le lieu avec sa reponse : tant que les deux ne correspondent pas,
  // c'est que le releve du lieu courant est encore en route.
  const [releve, setReleve] = useState<{ lieu: Lieu; annee: string | null } | null>(null)

  // La reponse d'une adresse abandonnee en chemin ne doit pas ecraser la bonne.
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
    <section className="px-5 py-24 md:py-32">
      <GrandTitre>Tout commence par une adresse.</GrandTitre>
      <Chapo>
        Avant la première photo, Diagly interroge les registres publics suisses et en tire la
        géométrie du bâtiment. Cherchez le vôtre : la carte et l’année sont les vraies.
      </Chapo>

      <div className="mx-auto mt-14 grid max-w-[1060px] items-start gap-6 md:grid-cols-[1.05fr_0.95fr]">
        <CarteAdresse onLieu={setLieu} />

        <div className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-[0_20px_60px_-30px_rgba(20,45,90,0.35)] sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Relevé sans se déplacer</p>
          <p className="mt-1.5 truncate text-[15px] font-semibold" title={lieu.label}>{lieu.label}</p>

          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Registre fédéral des bâtiments</p>
          <dl className="mt-1 divide-y divide-black/[0.06]">
            {REGISTRE.map((d) => d.reel ? (
              // La seule valeur qui se lit : elle vient du registre, pour cette adresse.
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
    </section>
  )
}

/* -------------------------------------------------------------- precision */

const PRECISION = [
  { titre: "L'adresse seule", detail: 'GÃ©omÃ©trie du registre des bÃ¢timents. Un ordre de grandeur.', part: 30 },
  { titre: 'Avec vos photos', detail: "L'Ã©tat de chaque ouvrage est relevÃ©, plus prÃ©sumÃ©.", part: 55 },
  { titre: 'Avec le relevÃ© sur place', detail: 'PÃ©rimÃ¨tre, Ã©tages, hauteur, logements. Les mÃ©trÃ©s deviennent les vÃ´tres.', part: 80 },
  { titre: 'Avec les devis reÃ§us', detail: 'Les prix du catalogue cÃ¨dent la place aux montants adjugÃ©s.', part: 100 },
]

/**
 * La jauge de precision : l'argument le plus honnete de la page, donc le plus
 * visible. Elle dit ce que vaut un chiffre a chaque etape, au lieu de laisser
 * croire qu'une photo suffit a fixer un budget.
 */
function Precision() {
  return (
    <section className="bg-[#0b1220] px-5 py-24 text-white md:py-32">
      <GrandTitre sombre>La prÃ©cision se gagne.<br className="hidden sm:block" /> Elle ne se promet pas.</GrandTitre>
      <Chapo sombre>
        Diagly affiche une fourchette et dit sur quoi elle repose. Un chiffre exact tirÃ©
        d'une seule photo serait une invention, et vous le sauriez au premier devis reÃ§u.
      </Chapo>

      <div className="mx-auto max-w-[760px]">
        <div className="mx-auto mb-16 mt-16 max-w-[300px]">
          <img
            src={visite}
            alt="Sur tÃ©lÃ©phone, les quatre Ã©tats proposÃ©s pour un ouvrage, chacun avec son constat et les travaux qu'il engage."
            className="w-full rounded-[20px] border border-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
          />
        </div>
        <ol className="space-y-7">
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
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- rapport */

function Rapport() {
  return (
    <section id="rapport" className="scroll-mt-28 px-5 py-24 md:py-32">
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
    <section className="px-5 py-20">
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
    <section id="tarifs" className="scroll-mt-28 bg-[#f5f7fa] px-5 py-24 md:py-32">
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
              {libelle}{valeur && <span className="ml-1.5 text-[#0167EA]">2 mois offerts</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-[1000px] gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <article key={p.nom} className="flex flex-col">
            <h3 className="text-[21px] font-semibold tracking-[-0.015em]">
              {p.nom}
              {p.phare && <span className="ml-2 align-middle text-[12px] font-normal text-[#0167EA]">Le plus choisi</span>}
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
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />
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
  if (v === true) return <Check className="mx-auto h-4 w-4 text-[#0167EA]" aria-label="Inclus" />
  if (v === false) return <Minus className="mx-auto h-3.5 w-3.5 text-black/20" aria-label="Non inclus" />
  return <span className="text-[14px] text-[#6e6e73]">{v}</span>
}

function TableauComparatif() {
  return (
    <details className="group mx-auto mt-14 max-w-[1000px]" open>
      <summary className="flex cursor-pointer list-none items-center justify-center gap-1 text-[15px] text-[#0167EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0167EA]">
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
    </section>
  )
}

/* ------------------------------------------------------------ appel final */

function AppelFinal() {
  return (
    <section className="bg-[#0b1220] px-5 py-28 text-center text-white md:py-36">
      <GrandTitre sombre>Prenez un immeuble<br className="hidden sm:block" /> que vous connaissez.</GrandTitre>
      <Chapo sombre>
        Le premier diagnostic est offert, sans carte bancaire. Comparez avec ce que vous
        auriez fait à la main.
      </Chapo>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <Pilule to="/login">Essayer gratuitement</Pilule>
        <a href="mailto:contact@finalyn.com" className="inline-flex items-center gap-0.5 text-[15px] text-[#4d9bff] hover:underline">
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
    <footer className="border-t border-black/[0.07] bg-[#f5f7fa] px-5 py-12 text-[12px] text-[#6e6e73]">
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
          <p className="flex items-center gap-2">
            <img src="/diagly-mark.svg" alt="" aria-hidden="true" className="h-4 w-4" />
            © {new Date().getFullYear()} Diagly, un produit Finalyn. Tous droits réservés.
          </p>
          <p>Conçu en Suisse. Installable sur téléphone, utilisable hors ligne pendant la visite.</p>
        </div>
      </div>
    </footer>
  )
}
