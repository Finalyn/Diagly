import { useState } from 'react'
import { BoutonFleche, GrandTitre, Chapo, Surtitre } from './elements'

/**
 * Les sections qui expliquent le produit plutôt que de le montrer.
 *
 * Le reste de la page repose sur des captures : on voit l'application travailler.
 * Ici il faut dire comment elle travaille, ce qu'elle fait gagner, tout ce qu'elle
 * couvre, et sur quoi elle calcule. Quatre registres différents, donc quatre
 * traitements, mais la même règle : rien qui ne soit vérifiable dans le produit.
 */

/* ------------------------------------------------------- comment ça marche */

/**
 * Le parcours, en quatre temps. La numérotation n'est pas décorative : c'est
 * un ordre réel, et le troisième temps n'existe pas sans le deuxième.
 */
const ETAPES = [
  {
    titre: "Vous entrez l'adresse",
    texte: "Diagly interroge le registre fédéral des bâtiments et en tire l'année de construction, le nombre d'étages, de logements et l'emprise au sol. Les métrés partent de là.",
    marque: 'Avant de partir',
  },
  {
    titre: 'Vous photographiez pendant la visite',
    texte: "Le catalogue est rangé par étape de visite, pas par nomenclature. Vous choisissez l'ouvrage, vous photographiez, vous retenez un état. L'application suit votre parcours dans le bâtiment.",
    marque: 'Sur place',
  },
  {
    titre: 'Les métrés et les prix tombent',
    texte: "Chaque poste applique sa formule de métré et le prix de votre catalogue. Les totaux se répartissent par priorité I, II et III, honoraires et réserve compris.",
    marque: 'Au fil de la visite',
  },
  {
    titre: 'Le rapport est déjà écrit',
    texte: "Rapport de l'existant, chiffrage par code CFC, export tableur, lien de partage en lecture seule pour la gérance. Rien à ressaisir au bureau.",
    marque: 'En sortant',
  },
]

export function CommentCaMarche() {
  return (
    <section id="methode" className="scroll-mt-28 px-5 py-24 md:py-32">
      <Surtitre>Comment ça marche</Surtitre>
      <GrandTitre>Quatre temps,<br className="hidden sm:block" /> une seule visite.</GrandTitre>
      <Chapo>
        Le travail de bureau qui suivait la visite n'est pas accéléré&nbsp;: il est fait pendant
        la visite. C'est toute la différence.
      </Chapo>

      <ol className="mx-auto mt-16 grid max-w-[1060px] gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
        {ETAPES.map((e, i) => (
          <li key={e.titre} className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0167EA] text-[14px] font-semibold tabular-nums text-white">
                {i + 1}
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">{e.marque}</span>
            </div>
            <h3 className="mt-4 text-[19px] font-semibold leading-snug tracking-[-0.015em]">{e.titre}</h3>
            <p className="mt-2.5 text-[16px] leading-relaxed text-[#6e6e73]">{e.texte}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------ temps gagné */

const heures = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10)

/** Un curseur avec sa valeur, unique commande de l'estimation. */
function Curseur({ libelle, valeur, min, max, pas, suffixe, onChange }: {
  libelle: string; valeur: number; min: number; max: number; pas: number
  suffixe: string; onChange: (n: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] text-[#1d1d1f]/80">{libelle}</span>
        <span className="text-[17px] font-semibold tabular-nums text-[#0167EA]">
          {valeur} <span className="text-[13px] font-normal text-[#86868b]">{suffixe}</span>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-black/[0.09] accent-[#0167EA]"
      />
    </label>
  )
}

/**
 * L'estimation du temps gagné.
 *
 * Annoncer « soixante pour cent de temps en moins » serait un chiffre sorti de
 * nulle part, et le premier bureau à le vérifier saurait que c'est faux. Ici,
 * les hypothèses appartiennent au visiteur : il pose ses volumes et sa durée de
 * ressaisie, nous ne faisons que l'arithmétique. Ce qui est affirmé, en
 * revanche, est vrai du produit : le rapport existe à la fin de la visite.
 */
export function TempsGagne() {
  const [immeubles, setImmeubles] = useState(20)
  const [postes, setPostes] = useState(35)
  const [minutes, setMinutes] = useState(3)

  const parImmeuble = (postes * minutes) / 60
  const parAn = parImmeuble * immeubles
  const jours = parAn / 8

  return (
    <section className="px-5 py-24 md:py-32">
      <Surtitre>Le temps</Surtitre>
      <GrandTitre>La visite reste.<br className="hidden sm:block" /> La soirée qui suit disparaît.</GrandTitre>
      <Chapo>
        Relever un immeuble prend le temps qu'il faut. Ce qui coûte, c'est ce qui vient
        après : ressaisir les postes, refaire les métrés, chercher les prix, mettre en page.
      </Chapo>

      <div className="mx-auto mt-16 grid max-w-[980px] items-center gap-8 md:grid-cols-[1fr_1fr] md:gap-12">
        <div className="rounded-[20px] border border-black/[0.07] bg-white p-6 shadow-[0_20px_60px_-34px_rgba(20,45,90,0.4)] sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Vos hypothèses</p>
          <div className="mt-6 space-y-7">
            <Curseur libelle="Immeubles relevés par an" valeur={immeubles} min={2} max={120} pas={1} suffixe="par an" onChange={setImmeubles} />
            <Curseur libelle="Postes relevés par immeuble" valeur={postes} min={10} max={120} pas={5} suffixe="postes" onChange={setPostes} />
            <Curseur libelle="Ressaisie au bureau, par poste" valeur={minutes} min={1} max={10} pas={1} suffixe="minutes" onChange={setMinutes} />
          </div>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Ce que cela représente</p>
          <p className="mt-3 text-[clamp(3rem,8vw,4.6rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
            {heures(parAn)}<span className="ml-2 text-[clamp(1.1rem,2.4vw,1.6rem)] font-normal tracking-normal text-[#6e6e73]">heures par an</span>
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-[#6e6e73]">
            Soit {heures(parImmeuble)} heure{parImmeuble >= 2 ? 's' : ''} par immeuble, et
            l'équivalent de {Math.round(jours)} journée{jours >= 2 ? 's' : ''} de bureau
            sur l'année.
          </p>
          <p className="mt-6 text-[14px] leading-relaxed text-[#86868b]">
            Ces trois nombres sont les vôtres, pas une mesure de notre part. Ce que nous
            affirmons est plus simple et se vérifie en une visite&nbsp;: à la sortie du bâtiment,
            le rapport et le chiffrage existent déjà.
          </p>
          <div className="mt-8">
            <BoutonFleche to="/login" className="py-2.5 text-[14px]">Essayer sur un immeuble</BoutonFleche>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- modules */

/**
 * Tous les modules, d'un coup d'oeil.
 *
 * Chaque tuile correspond à un écran réel de l'application. Le dessin est
 * géométrique et sans texte : à cette taille, une icône descriptive devient
 * illisible, alors qu'une forme colorée se retient et se retrouve.
 */
interface Module {
  nom: string
  glyphe: React.ReactNode
}

const B = '#0167EA'   // le bleu de la marque
const C = '#4d9bff'   // son éclairci
const V = '#24b47e'   // le vert des états sains
const O = '#f5a623'   // l'ambre des priorités II
const P = '#7c5cff'   // le violet, pour ce qui relève de l'outillage
const T = '#17b3a3'   // le turquoise, pour la donnée
const G = '#64748b'   // l'ardoise, pour l'administratif

/** Un dessin de 40 sur 40, deux ou trois formes, jamais plus. */
const g = (contenu: React.ReactNode) => (
  <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">{contenu}</svg>
)

const MODULES: Module[] = [
  { nom: 'Diagnostic', glyphe: g(<><rect x="6" y="6" width="17" height="28" rx="4" fill={B} /><path d="M20 20h14v14H20z" fill={C} opacity=".85" /></>) },
  { nom: 'Coûts', glyphe: g(<><rect x="6" y="20" width="7" height="14" rx="2" fill={C} /><rect x="16.5" y="13" width="7" height="21" rx="2" fill={B} /><rect x="27" y="6" width="7" height="28" rx="2" fill={V} /></>) },
  { nom: 'Photos', glyphe: g(<><rect x="5" y="10" width="22" height="18" rx="4" fill={T} /><circle cx="26" cy="24" r="9" fill={B} /></>) },
  { nom: 'Rapports', glyphe: g(<><path d="M8 6h15l9 9v19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill={G} /><path d="M23 6l9 9h-9z" fill={C} /><rect x="12" y="21" width="14" height="3" rx="1.5" fill="#fff" /><rect x="12" y="27" width="9" height="3" rx="1.5" fill="#fff" opacity=".7" /></>) },
  { nom: 'Variantes', glyphe: g(<><path d="M8 8v10a6 6 0 0 0 6 6h18" stroke={B} strokeWidth="4" fill="none" strokeLinecap="round" /><circle cx="32" cy="24" r="5" fill={P} /><circle cx="8" cy="8" r="4" fill={C} /></>) },
  { nom: 'Plans', glyphe: g(<><path d="M5 12l10-5 10 5 10-5v21l-10 5-10-5-10 5z" fill={T} /><path d="M15 7v21" stroke="#fff" strokeWidth="2.5" /></>) },
  { nom: 'Parc immobilier', glyphe: g(<><rect x="5" y="14" width="13" height="20" rx="2" fill={C} /><rect x="21" y="6" width="14" height="28" rx="2" fill={B} /><rect x="25" y="12" width="6" height="5" rx="1" fill="#fff" /></>) },
  { nom: 'Appartements', glyphe: g(<><rect x="6" y="6" width="12" height="12" rx="2" fill={B} /><rect x="22" y="6" width="12" height="12" rx="2" fill={C} /><rect x="6" y="22" width="12" height="12" rx="2" fill={T} /><rect x="22" y="22" width="12" height="12" rx="2" fill={V} /></>) },
  { nom: 'Catalogue CFC', glyphe: g(<><rect x="6" y="7" width="9" height="26" rx="2" fill={B} /><rect x="17" y="7" width="9" height="26" rx="2" fill={O} /><rect x="28" y="7" width="6" height="26" rx="2" fill={C} /></>) },
  { nom: 'Appels d’offres', glyphe: g(<><path d="M20 5l4.6 9.7 10.4 1.6-7.6 7.6 1.8 10.8L20 29.6 10.8 34.7l1.8-10.8L5 16.3l10.4-1.6z" fill={O} /></>) },
  { nom: 'Planification', glyphe: g(<><rect x="5" y="9" width="30" height="25" rx="4" fill={C} /><rect x="5" y="9" width="30" height="7" rx="4" fill={B} /><rect x="11" y="22" width="12" height="4" rx="2" fill="#fff" /></>) },
  { nom: 'Étiquette énergétique', glyphe: g(<><path d="M22 4L9 22h8l-3 14 16-19h-9z" fill={V} /></>) },
  { nom: 'Carte', glyphe: g(<><circle cx="20" cy="17" r="12" fill={T} /><path d="M20 34c5-8 8-12 8-16a8 8 0 1 0-16 0c0 4 3 8 8 16z" fill={B} /><circle cx="20" cy="17" r="3.5" fill="#fff" /></>) },
  { nom: 'Assistant IA', glyphe: g(<><circle cx="20" cy="20" r="14" fill="none" stroke={P} strokeWidth="4" strokeDasharray="52 20" strokeLinecap="round" /><circle cx="20" cy="20" r="5" fill={B} /></>) },
  { nom: 'Équipe', glyphe: g(<><circle cx="14" cy="14" r="6" fill={B} /><circle cx="27" cy="17" r="5" fill={C} /><path d="M4 33c0-6 4.5-10 10-10s10 4 10 10z" fill={B} opacity=".55" /><path d="M22 33c0-5 3-8 7-8s7 3 7 8z" fill={C} opacity=".7" /></>) },
  { nom: 'Intégrations', glyphe: g(<><rect x="5" y="15" width="12" height="10" rx="3" fill={G} /><rect x="23" y="15" width="12" height="10" rx="3" fill={B} /><path d="M17 20h6" stroke={G} strokeWidth="4" strokeLinecap="round" /></>) },
  { nom: 'Export', glyphe: g(<><path d="M20 5v18m0-18l-6.5 7M20 5l6.5 7" stroke={V} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 25v6a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3v-6" stroke={C} strokeWidth="4" fill="none" strokeLinecap="round" /></>) },
  { nom: 'Partage', glyphe: g(<><circle cx="29" cy="9" r="6" fill={B} /><circle cx="11" cy="20" r="6" fill={T} /><circle cx="29" cy="31" r="6" fill={C} /><path d="M24 12L16 17m0 6l8 5" stroke={G} strokeWidth="3" strokeLinecap="round" /></>) },
]

export function Modules() {
  return (
    <section id="modules" className="scroll-mt-28 bg-[#f5f7fa] px-5 py-24 md:py-32">
      <Surtitre>Tout le bâtiment</Surtitre>
      <GrandTitre>Un outil par métier.<br className="hidden sm:block" /> Un seul relevé.</GrandTitre>
      <Chapo>
        Le diagnostic n'est qu'une porte d'entrée. Le même bâtiment porte ensuite son parc,
        ses variantes, son planning, ses appels d'offres et ses exports.
      </Chapo>

      <ul className="mx-auto mt-16 grid max-w-[980px] grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:gap-x-6 lg:grid-cols-6">
        {MODULES.map((m) => (
          <li key={m.nom} className="flex flex-col items-center text-center">
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-[20px] bg-white shadow-[0_8px_22px_-12px_rgba(20,45,90,0.4)]">
              {m.glyphe}
            </span>
            <span className="mt-3 text-[13px] leading-snug text-[#1d1d1f]/80">{m.nom}</span>
          </li>
        ))}
      </ul>

      <p className="mx-auto mt-14 max-w-2xl text-center text-[15px] leading-relaxed text-[#6e6e73]">
        Tous ces modules lisent le même bâtiment. Un poste corrigé dans le diagnostic change
        le chiffrage, la variante et le rapport, sans que rien ne soit reporté à la main.
      </p>
    </section>
  )
}

/* --------------------------------------------------------------- technique */

/** Le calcul, écrit en toutes lettres. C'est la question que pose tout bureau. */
const CASCADE = [
  { ligne: 'Prix du catalogue × quantité', detail: 'par poste, la quantité venant de sa formule de métré' },
  { ligne: '+ honoraires', detail: 'en pourcentage du hors taxes, le vôtre' },
  { ligne: '+ réserve', detail: 'en pourcentage du hors taxes majoré des honoraires' },
  { ligne: '+ TVA 8.1 %', detail: 'sur le sous-total, au taux suisse en vigueur' },
]

const OUVERTURE = [
  {
    titre: 'Votre catalogue, pas le nôtre',
    texte: "Les postes, les codes CFC, les unités, les prix et les quatre textes d'état se modifient un par un. Diagly est livré avec le catalogue d'un bureau romand ; le vôtre le remplace.",
  },
  {
    titre: 'Une API REST et son OpenAPI',
    texte: "Bâtiments, diagnostics, éléments, coûts et plan de travaux se lisent par clé d'API. Le document OpenAPI est servi par l'application elle-même.",
  },
  {
    titre: 'Webhooks et serveur MCP',
    texte: "Vos outils sont prévenus quand un diagnostic est finalisé. Et votre propre assistant se branche sur vos diagnostics par le protocole MCP.",
  },
  {
    titre: 'Vos données ressortent',
    texte: 'Export tableur, CSV ou JSON, avec un modèle de colonnes que vous définissez. Ce que vous avez saisi vous appartient et ne reste pas enfermé ici.',
  },
  {
    titre: 'Le code est public',
    texte: "Le dépôt est ouvert sur GitHub : la méthode de calcul, les formules de métré et le traitement des données se lisent ligne par ligne, plutôt que sur parole.",
  },
  {
    titre: 'Des variantes, pas une vérité',
    texte: "Un même bâtiment porte plusieurs scénarios de travaux, chiffrés séparément, à comparer avant l'arbitrage en assemblée.",
  },
]

export function Technique() {
  return (
    <section id="technique" className="scroll-mt-28 bg-[#0b1220] px-5 py-24 text-white md:py-32">
      <Surtitre sombre>Sous le capot</Surtitre>
      <GrandTitre sombre>Aucun chiffre<br className="hidden sm:block" /> sans son origine.</GrandTitre>
      <Chapo sombre>
        Un montant qu'on ne peut pas expliquer ne vaut rien en séance. Voici exactement d'où
        vient chacun, et ce que vous pouvez changer.
      </Chapo>

      <div className="mx-auto mt-16 grid max-w-[1000px] gap-6 md:grid-cols-2">
        {/* Le calcul */}
        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-7 sm:p-8">
          <h3 className="text-[21px] font-semibold tracking-[-0.015em]">La cascade de calcul</h3>
          <ol className="mt-6 space-y-4">
            {CASCADE.map((c) => (
              <li key={c.ligne} className="border-l-2 border-[#4d9bff]/40 pl-4">
                <p className="text-[16px] font-medium">{c.ligne}</p>
                <p className="mt-0.5 text-[14px] leading-snug text-white/50">{c.detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-xl bg-black/30 px-4 py-3 font-mono text-[13px] leading-relaxed text-[#8fc0ff]">
            Total = HT × (1 + honoraires) × (1 + réserve) × 1.081
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-white/50">
            La formule est affichée sous le total dans l'application. Chaque quantité montre
            la sienne, et se reprend à la main quand le terrain dit autre chose.
          </p>
        </div>

        {/* Les sources suisses */}
        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-7 sm:p-8">
          <h3 className="text-[21px] font-semibold tracking-[-0.015em]">Des sources suisses</h3>
          <dl className="mt-6 space-y-4">
            {[
              ['Codes CFC', "La nomenclature du bâtiment, celle de vos appels d'offres et de vos devis."],
              ['Registre fédéral des bâtiments', 'Année de construction, étages, logements et emprise au sol, par le service geo.admin.ch.'],
              ['Cadastre RDPPF', "Affectation et degré de sensibilité au bruit, canton par canton."],
              ['TVA 8.1 %', 'Le taux suisse, appliqué sur le sous-total et affiché séparément.'],
              ['Hébergement en Suisse', 'Les données du bureau et les photos des visites restent sur des serveurs suisses.'],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="text-[16px] font-medium">{t}</dt>
                <dd className="mt-0.5 text-[14px] leading-snug text-white/50">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* L'ouverture */}
      <div className="mx-auto mt-20 max-w-[1000px]">
        <h3 className="text-balance text-center text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-tight tracking-[-0.024em]">
          Ouvert, et vérifiable.
        </h3>
        <p className="mx-auto mt-5 max-w-xl text-center text-[17px] leading-relaxed text-white/60">
          Un outil de diagnostic qui ne laisserait ni modifier ses prix ni ressortir ses
          données serait une boîte noire de plus. Celui-ci s'ouvre par les deux bouts.
        </p>
        <div className="mt-14 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {OUVERTURE.map((o) => (
            <article key={o.titre}>
              <h4 className="text-[17px] font-semibold leading-snug">{o.titre}</h4>
              <p className="mt-2 text-[15px] leading-relaxed text-white/55">{o.texte}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------- IA */

const IA_QUAND = [
  {
    titre: "Sur la photo d'un ouvrage",
    texte: "Vous la lui montrez, elle propose un état parmi quatre, une priorité et une note écrite. Vous gardez, vous corrigez, ou vous l'ignorez.",
  },
  {
    titre: "Pendant l'analyse",
    texte: "Une conversation sur le diagnostic en cours : ce qui pèse le plus, ce qui peut attendre, ce qui manque encore au relevé.",
  },
  {
    titre: "À l'import d'un CECB",
    texte: "Un certificat énergétique en PDF est lu et ses valeurs reprises, plutôt que retapées à la main.",
  },
]

export function IntelligenceArtificielle() {
  return (
    <section id="ia" className="scroll-mt-28 px-5 py-24 md:py-32">
      <Surtitre>L'assistance</Surtitre>
      <GrandTitre>L'IA quand vous<br className="hidden sm:block" /> la voulez. Jamais avant.</GrandTitre>
      <Chapo>
        Aucun état n'est rempli dans votre dos. L'assistant ne travaille que si vous le
        sollicitez, et un diagnostic entier peut se faire sans jamais l'ouvrir.
      </Chapo>

      <div className="mx-auto mt-16 grid max-w-[1000px] gap-10 md:grid-cols-3">
        {IA_QUAND.map((q) => (
          <article key={q.titre} className="rounded-[20px] border border-black/[0.07] bg-white p-7 shadow-[0_18px_50px_-34px_rgba(20,45,90,0.45)]">
            <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.015em]">{q.titre}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-[#6e6e73]">{q.texte}</p>
          </article>
        ))}
      </div>

      <div className="mx-auto mt-14 max-w-[760px] rounded-[20px] bg-[#f5f7fa] p-7 sm:p-8">
        <h3 className="text-[18px] font-semibold tracking-[-0.015em]">Ce qu'elle ne fait pas</h3>
        <p className="mt-3 text-[16px] leading-relaxed text-[#6e6e73]">
          Elle n'invente pas un poste et ne devine pas un code CFC : elle qualifie l'ouvrage
          que vous lui montrez, celui que vous avez choisi au catalogue. Sur un cas qu'elle ne
          sait pas trancher, elle le dit plutôt que de remplir la case. Et elle ne décide
          jamais d'un montant.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-[#86868b]">
          Une photo n'est envoyée au modèle qu'au moment où vous demandez son avis dessus.
          Le reste du diagnostic ne sort pas de l'application.
        </p>
      </div>
    </section>
  )
}
