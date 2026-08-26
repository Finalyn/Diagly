import { useState, type CSSProperties } from 'react'
import {
  Home, FolderKanban, Stethoscope, Wrench, Calendar, Users, Search, Bell,
  ArrowRight, ChevronRight, ChevronDown, Menu, X,
  FolderPlus, ClipboardCheck, CalendarPlus, FileText,
  FileCheck2, CalendarClock, Euro, CheckCircle2,
  TrendingUp, TrendingDown, AlertTriangle, Send,
} from 'lucide-react'

/* Diagly — dashboard vitrine (liquid glass, fond photo villa, données mockées). */

const NAV = [
  { icon: Home, label: 'Accueil', active: true },
  { icon: FolderKanban, label: 'Dossiers' },
  { icon: Stethoscope, label: 'Diagnostics' },
  { icon: Wrench, label: 'Interventions' },
  { icon: Calendar, label: 'Calendrier' },
  { icon: Users, label: 'Clients' },
]

const QUICK = [
  { icon: FolderPlus, title: 'Nouveau dossier', desc: 'Créer un dossier de diagnostic' },
  { icon: ClipboardCheck, title: 'Nouveau diagnostic', desc: 'Lancer un diagnostic depuis un dossier' },
  { icon: CalendarPlus, title: 'Planifier une intervention', desc: 'Organiser une intervention' },
  { icon: FileText, title: 'Modèles de rapports', desc: 'Gagner du temps avec nos modèles' },
]

const ACTIVITY = [
  { icon: FolderKanban, tint: 'bg-violet-100/80 text-violet-600', title: 'Dossier #D-2024-0587', sub: '12 rue des Acacias, Nantes', time: 'Il y a 2h' },
  { icon: FileCheck2, tint: 'bg-emerald-100/80 text-emerald-600', title: 'Diagnostic DPE', sub: 'Dossier #D-2024-0587', time: 'Il y a 4h' },
  { icon: CalendarClock, tint: 'bg-sky-100/80 text-sky-600', title: 'Intervention planifiée', sub: '8 bd de la Liberté, Nantes', time: 'Hier' },
  { icon: FileText, tint: 'bg-amber-100/80 text-amber-600', title: 'Rapport finalisé', sub: 'Dossier #D-2024-0578', time: 'Hier' },
  { icon: FolderPlus, tint: 'bg-neutral-200/80 text-neutral-600', title: 'Nouveau dossier créé', sub: 'Dossier #D-2024-0591', time: 'Il y a 1j' },
]

const KPIS = [
  { icon: FolderKanban, tint: 'bg-violet-100/80 text-violet-600', value: '24', label: 'Dossiers en cours', delta: '+12%', up: true },
  { icon: CheckCircle2, tint: 'bg-emerald-100/80 text-emerald-600', value: '68', label: 'Diagnostics réalisés', delta: '+18%', up: true },
  { icon: Calendar, tint: 'bg-sky-100/80 text-sky-600', value: '12', label: 'Interventions à venir', delta: '−8%', up: false },
  { icon: Euro, tint: 'bg-neutral-200/80 text-neutral-700', value: '18 450 €', label: "Chiffre d’affaires (mois)", delta: '+22%', up: true },
]

function ProgressRing({ pct }: { pct: number }) {
  const r = 46
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-[138px] w-[138px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#a1a1a6" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-medium leading-none tracking-tight text-neutral-900">12</span>
        <span className="mt-1.5 text-[12px] leading-tight text-neutral-500">dossiers</span>
        <span className="text-[12px] leading-tight text-neutral-400">à suivre</span>
      </div>
    </div>
  )
}

type Cfg = {
  zoom: number; posX: number; posY: number; bright: number; sat: number; fade: number; colorIcons: boolean
  logoMark: number; logoText: number; navText: number; navIcon: number; greeting: number; cardTitle: number
  sidebarW: number; navH: number; contentPad: number; gridSplit: number; gap: number
  sidebarGlass: number; sidebarAlpha: number
  enCoursW: number; enCoursH: number; enCoursGlass: number; enCoursAlpha: number
  quickW: number; quickH: number; quickGlass: number; quickAlpha: number
  briefW: number; briefH: number; briefGlass: number; briefAlpha: number
  activityW: number; activityH: number; activityGlass: number; activityAlpha: number
}
const DEFAULT_CFG: Cfg = {
  zoom: 59, posX: 100, posY: 0, bright: 100, sat: 100, fade: 0, colorIcons: false,
  logoMark: 29, logoText: 24, navText: 15, navIcon: 21, greeting: 38, cardTitle: 16,
  sidebarW: 266, navH: 12, contentPad: 40, gridSplit: 160, gap: 20,
  sidebarGlass: 24, sidebarAlpha: 70,
  enCoursW: 47, enCoursH: 0, enCoursGlass: 26, enCoursAlpha: 14,
  quickW: 100, quickH: 0, quickGlass: 24, quickAlpha: 100,
  briefW: 100, briefH: 0, briefGlass: 24, briefAlpha: 55,
  activityW: 100, activityH: 0, activityGlass: 24, activityAlpha: 100,
}

export function DashboardPreview() {
  const [open, setOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Config figée
  const cfg = DEFAULT_CFG
  // Masque des bords : la photo se fond elle-même (gauche + bas) -> aucune ligne de coupure
  const edgeMask = 'linear-gradient(to right, transparent 44%, #000 68%), linear-gradient(to bottom, #000 40%, transparent 52%)'
  const iconTint = (tint: string) => (cfg.colorIcons ? tint : 'bg-black/[0.05] text-neutral-600')
  // Style « verre » d'une carte : opacité du fond + flou (+ largeur/hauteur éventuelles)
  const glassStyle = (alpha: number, blur: number, extra?: CSSProperties): CSSProperties => ({
    background: `rgba(255,255,255,${alpha / 100})`,
    ['--lg-blur' as string]: `${blur}px`,
    ...(extra || {}),
  } as CSSProperties)
  const rootVars = {
    '--sidebar-w': `${cfg.sidebarW}px`,
    '--pad': `${cfg.contentPad}px`,
    '--encours-w': `${cfg.enCoursW}%`,
    '--grid-split': `${cfg.gridSplit / 100}fr`,
    '--gap': `${cfg.gap}px`,
  } as CSSProperties

  const sidebar = (
    <aside className="dp-anim liquid-glass flex h-[calc(100dvh-2rem)] w-[var(--sidebar-w)] flex-col rounded-[26px] p-3.5" style={glassStyle(cfg.sidebarAlpha, cfg.sidebarGlass)}>
      {/* Logo : picto noir + "Diagly" en Inter (tailles réglables via l'éditeur) */}
      <div className="flex items-center gap-2 px-2 py-2.5">
        <img src="/diagly-mark.svg" alt="" className="w-auto" style={{ height: cfg.logoMark }} />
        <span className="relative top-[2px] font-medium tracking-tight text-neutral-900" style={{ fontSize: cfg.logoText }}>Diagly</span>
      </div>

      {/* Nav */}
      <nav className="mt-5 space-y-1.5">
        {NAV.map((n) => (
          <button
            key={n.label}
            style={{ fontSize: cfg.navText, paddingTop: cfg.navH, paddingBottom: cfg.navH }}
            className={`flex w-full items-center gap-3 rounded-2xl px-3.5 transition-colors ${
              n.active
                ? 'border border-black/[0.05] bg-neutral-100 font-semibold text-neutral-900'
                : 'font-medium text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900'
            }`}
          >
            <n.icon style={{ width: cfg.navIcon, height: cfg.navIcon }} strokeWidth={1.7} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Espace compte (bas de sidebar) */}
      <div className="mt-4">
        {/* Carte compte */}
        <button className="flex w-full items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/70 px-2.5 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[13px] font-semibold text-white">MP</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-neutral-900">Martin Parmentier</p>
            <p className="truncate text-[11.5px] text-neutral-500">Administrateur</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.7} />
        </button>

        {/* Promo */}
        <div className="mt-4 px-1">
          <p className="text-[13.5px] font-semibold text-neutral-900">Gagnez du temps</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-500">Créez vos rapports plus vite avec nos modèles intelligents.</p>
          <button className="mt-3 flex w-full items-center justify-between rounded-xl border border-black/10 bg-white/50 px-3.5 py-2.5 text-[12.5px] font-semibold text-neutral-900 transition-colors hover:bg-white/80">
            Découvrir Diagly <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="relative min-h-dvh w-full font-sans text-neutral-900" style={rootVars}>
      {/* Fond : villa — réglé via l'éditeur no-code (panneau en bas à droite) */}
      <div
        className="fixed inset-0 -z-30 bg-no-repeat"
        style={{
          backgroundImage: 'url(/preview-bg.jpg)',
          backgroundSize: `${cfg.zoom}%`,
          backgroundPosition: `${cfg.posX}% ${cfg.posY}%`,
          filter: `saturate(${cfg.sat}%) brightness(${cfg.bright}%)`,
          WebkitMaskImage: edgeMask,
          WebkitMaskComposite: 'source-in',
          maskImage: edgeMask,
          maskComposite: 'intersect',
        }}
      />

      <div className="flex min-h-dvh">
        {/* Sidebar desktop (flottante) */}
        <div className="hidden shrink-0 p-4 lg:block">
          <div className="sticky top-4">{sidebar}</div>
        </div>

        {/* Overlay mobile */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="relative p-4">
              {sidebar}
              <button onClick={() => setOpen(false)} className="absolute right-7 top-7 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Contenu principal */}
        <div className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-[var(--pad)] lg:pb-8 lg:pt-7">
          {/* Barre du haut : recherche + notifications, remontées tout en haut */}
          <div className="dp-anim flex items-center gap-3 sm:justify-end">
            <button onClick={() => setOpen(true)} className="liquid-glass lg-55 flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl lg:hidden"><Menu className="h-5 w-5" strokeWidth={1.6} /></button>
            <div className="liquid-glass lg-55 flex h-[56px] w-full items-center gap-3 rounded-2xl px-5 sm:w-[380px] sm:flex-none">
              <Search className="h-[19px] w-[19px] text-neutral-400" strokeWidth={1.6} />
              <input placeholder="Rechercher un dossier, un client..." className="h-full flex-1 bg-transparent text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none" />
            </div>
            <button className="liquid-glass lg-55 flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-2xl text-neutral-600 transition-colors hover:text-neutral-900">
              <span className="relative"><Bell className="h-[21px] w-[21px]" strokeWidth={1.6} /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" /></span>
            </button>
          </div>
          {/* Salutation (descendue, entre le logo et Accueil) */}
          <div className="dp-anim dp-d1 mt-8 lg:mt-9">
            <h1 style={{ fontSize: cfg.greeting }} className="font-normal leading-none tracking-tight text-neutral-900">Bonjour Martin</h1>
            <p className="mt-2.5 text-[15px] text-neutral-500">Prêt à piloter vos diagnostics du jour ?</p>
          </div>

          {/* Rangée du haut : carte En cours (texte + anneau rapprochés) + petite carte à droite */}
          <div className="dp-anim dp-d2 mt-7 flex flex-col gap-[var(--gap)] lg:flex-row lg:items-stretch">
            {/* Carte EN COURS */}
            <div className="liquid-glass relative overflow-hidden rounded-[26px] lg:w-fit" style={glassStyle(cfg.enCoursAlpha, cfg.enCoursGlass, cfg.enCoursH ? { minHeight: cfg.enCoursH } : undefined)}>
              <div className="pointer-events-none absolute inset-0 z-0" style={{ background: 'linear-gradient(128deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0) 40%)' }} />
              <div className="relative z-10 flex h-full flex-col gap-7 p-7 sm:flex-row sm:items-center sm:gap-9 sm:p-8">
                <div className="max-w-[240px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">En cours</span>
                  <p className="mt-3 text-[27px] font-medium leading-[1.15] tracking-tight">
                    <span className="text-neutral-900">12 dossiers</span><br />
                    <span className="text-neutral-400">à suivre aujourd’hui</span>
                  </p>
                  <button className="mt-7 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-[14px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-95">
                    Voir mes dossiers <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
                <ProgressRing pct={66} />
              </div>
            </div>
            {/* Petite carte : dossiers urgents */}
            <div className="liquid-glass relative overflow-hidden rounded-[26px] p-6 sm:p-7 lg:w-[320px]" style={glassStyle(72, cfg.enCoursGlass)}>
              <div className="pointer-events-none absolute inset-0 z-0" style={{ background: 'linear-gradient(128deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.03) 22%, rgba(255,255,255,0) 42%)' }} />
              <div className="relative z-10 flex h-full flex-col justify-between gap-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100/80 text-orange-600"><AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">À traiter</span>
                </div>
                <div>
                  <p className="text-[32px] font-medium leading-none tracking-tight text-neutral-900">3</p>
                  <p className="mt-2 text-[13.5px] text-neutral-500">dossiers urgents en priorité</p>
                </div>
                <button className="inline-flex w-fit items-center gap-1.5 text-[13.5px] font-semibold text-neutral-900 transition-all hover:gap-2.5">
                  Traiter maintenant <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          {/* Grille : (Accès rapides + En bref) | Activité récente */}
          <div className="mt-6 grid gap-[var(--gap)] lg:grid-cols-[var(--grid-split)_1fr]">
            {/* Colonne gauche */}
            <div className="space-y-[var(--gap)]">
              {/* Accès rapides */}
              <section className="dp-anim dp-d3 liquid-glass rounded-[24px] p-6" style={glassStyle(cfg.quickAlpha, cfg.quickGlass, { width: `${cfg.quickW}%`, ...(cfg.quickH ? { minHeight: cfg.quickH } : {}) })}>
                <h2 style={{ fontSize: cfg.cardTitle }} className="mb-5 font-semibold text-neutral-800">Accès rapides</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {QUICK.map((q) => (
                    <button key={q.title} className="group flex flex-col items-center gap-3.5 rounded-2xl border border-black/[0.05] bg-white/45 px-4 py-10 text-center transition-all hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.22)]">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900/[0.05] text-neutral-700 transition-colors group-hover:bg-neutral-900/[0.09]">
                        <q.icon className="h-[19px] w-[19px]" strokeWidth={1.5} />
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold leading-tight text-neutral-900">{q.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{q.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* En bref */}
              <section className="dp-anim dp-d4 liquid-glass rounded-[24px] p-5" style={glassStyle(cfg.briefAlpha, cfg.briefGlass, { width: `${cfg.briefW}%`, ...(cfg.briefH ? { minHeight: cfg.briefH } : {}) })}>
                <h2 style={{ fontSize: cfg.cardTitle }} className="mb-4 font-semibold text-neutral-800">En bref</h2>
                <div className="grid grid-cols-2 divide-black/[0.06] sm:grid-cols-4 sm:divide-x">
                  {KPIS.map((k) => (
                    <div key={k.label} className="px-1 sm:px-4 first:sm:pl-0 last:sm:pr-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTint(k.tint)}`}><k.icon className="h-[17px] w-[17px]" strokeWidth={1.7} /></span>
                        <p className="text-[22px] font-bold tracking-tight text-neutral-900">{k.value}</p>
                      </div>
                      <p className="mt-2 text-[12px] text-neutral-500">{k.label}</p>
                      <p className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold ${k.up ? 'text-emerald-600' : 'text-red-500'}`}>
                        {k.up ? <TrendingUp className="h-3 w-3" strokeWidth={2} /> : <TrendingDown className="h-3 w-3" strokeWidth={2} />}
                        {k.delta} ce mois-ci
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Colonne droite : Activité récente */}
            <section className="dp-anim dp-d3 liquid-glass flex flex-col rounded-[24px] p-5" style={glassStyle(cfg.activityAlpha, cfg.activityGlass, { width: `${cfg.activityW}%`, ...(cfg.activityH ? { minHeight: cfg.activityH } : {}) })}>
              <div className="mb-2 flex items-center justify-between">
                <h2 style={{ fontSize: cfg.cardTitle }} className="font-semibold text-neutral-800">Activité récente</h2>
                <button className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800">Voir tout</button>
              </div>
              <div className="divide-y divide-black/[0.05]">
                {ACTIVITY.map((a) => (
                  <button key={a.title} className="flex w-full items-center gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-white/40">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTint(a.tint)}`}>
                      <a.icon className="h-[17px] w-[17px]" strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-neutral-900">{a.title}</p>
                      <p className="truncate text-[11.5px] text-neutral-500">{a.sub}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-neutral-400">{a.time}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" strokeWidth={1.6} />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="h-4" />
        </div>
      </div>

      {/* Assistant IA Diagly (maquette) — fenêtre de chat */}
      {chatOpen && (
        <div className="dp-pop fixed bottom-[104px] right-6 z-50 flex h-[560px] max-h-[calc(100dvh-140px)] w-[calc(100vw-3rem)] max-w-[380px] flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-3 border-b border-black/[0.06] bg-white px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
              <img src="/diagly-mark.svg" alt="" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight text-neutral-900">Diagly Assistant</p>
              <p className="flex items-center gap-1.5 text-[12px] text-neutral-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />En ligne</p>
            </div>
            <button onClick={() => setChatOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"><X className="h-[18px] w-[18px]" /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto bg-neutral-50 p-5">
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100"><img src="/diagly-mark.svg" alt="" className="h-4 w-4" /></span>
              <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-[13.5px] leading-relaxed text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                Bonjour Martin 👋 Je suis votre assistant Diagly. Je peux vous aider à créer un diagnostic, générer un rapport ou analyser une photo de terrain.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-[38px]">
              {['Créer un diagnostic', 'Générer un rapport CECB', 'Analyser une photo'].map((q) => (
                <button key={q} className="rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-[12.5px] font-medium text-neutral-700 transition-colors hover:border-black/[0.15] hover:bg-white">{q}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-black/[0.06] bg-white p-3">
            <input placeholder="Écrivez votre message…" className="h-11 flex-1 rounded-full bg-neutral-100 px-4 text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10" />
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-transform hover:scale-105 active:scale-95"><Send className="h-[18px] w-[18px]" strokeWidth={1.8} /></button>
          </div>
        </div>
      )}
      <button
        onClick={() => setChatOpen((v) => !v)}
        aria-label="Diagly Assistant"
        className="dp-anim fixed bottom-6 right-6 z-50 flex h-[64px] w-[64px] items-center justify-center rounded-2xl bg-neutral-900 text-white shadow-[0_18px_46px_-10px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.06] active:scale-95"
      >
        {chatOpen ? (
          <X className="h-7 w-7" strokeWidth={1.8} />
        ) : (
          <>
            <img src="/diagly-mark.svg" alt="" className="h-8 w-8" style={{ filter: 'brightness(0) invert(1)' }} />
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </>
        )}
      </button>
    </div>
  )
}
