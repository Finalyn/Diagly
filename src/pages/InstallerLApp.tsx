import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Download, Loader2, MoreVertical, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { appareilMobile, installer, useInstallation, type AppareilMobile } from '@/lib/appareil-web'
import { LIEN_APP_STORE } from '@/pages/marketing/accueil/contenu'
import { BadgeAppStore } from '@/pages/marketing/accueil/BadgeAppStore'
import { FOCUS } from '@/pages/marketing/accueil/ui'
import { typo } from '@/pages/marketing/accueil/typo'

/**
 * Ce que voit un téléphone ou une tablette qui ouvre l'app dans le navigateur
 * (components/GardeAppareil.tsx) : Diagly s'y utilise dans son app.
 *
 * iPhone et iPad : le badge de l'App Store. Android : le bouton qui ouvre la
 * fenêtre d'installation de Chrome quand il la propose ; sinon, les trois gestes
 * pour installer depuis le menu du navigateur. Une fois installée, la PWA
 * s'ouvre depuis l'écran d'accueil et passe la garde.
 */

const TEXTES: Record<AppareilMobile, { appareil: string; titre: string; texte: string; atouts: string[] }> = {
  ios: {
    appareil: 'iPhone et iPad',
    titre: 'Diagly s’utilise dans son app',
    texte: 'Sur iPhone et iPad, Diagly s’ouvre dans son app : plus rapide, plein écran, et prête pour le chantier.',
    atouts: [
      'Le relevé guidé, même sans réseau',
      'L’appareil photo et le scanner d’iOS pour les plans papier',
      'Les notifications de vos dossiers',
    ],
  },
  android: {
    appareil: 'Android',
    titre: 'Installez l’app Diagly',
    texte: 'Sur Android, Diagly s’installe sur l’écran d’accueil en un geste et s’ouvre comme une app, en plein écran.',
    atouts: [
      'Plein écran, sans la barre du navigateur',
      'Le relevé guidé, même sans réseau',
      'Les notifications de vos dossiers',
    ],
  },
}

export function InstallerLApp({ appareil }: { appareil: AppareilMobile }) {
  const t = TEXTES[appareil]
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-white text-[#0b1220] antialiased">
      {/* Le petit quadrillage bleu du site, et une lueur sous l'icône. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(1,103,234,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(1,103,234,0.08)_1px,transparent_1px)] [background-position:center_top] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_90%_55%_at_50%_20%,#000_30%,transparent_100%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(1,103,234,0.16),transparent)]" />

      <header className="relative px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Link to="/" className={cn('inline-flex rounded-lg', FOCUS)} aria-label="Diagly, retour au site">
          <img src="/diagly-logo.svg" alt="Diagly" width={101} height={32} className="h-8 w-auto" />
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-10 pt-12 text-center">
        <img src="/icon-512.png" alt="" aria-hidden="true" width={96} height={96} className="h-24 w-24 rounded-[22px] bg-white shadow-[0_24px_48px_-20px_rgba(1,103,234,0.6)] ring-1 ring-black/[0.06]" />
        <p className="mt-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#0167EA]">{t.appareil}</p>
        <h1 className="mt-2 text-balance text-[clamp(1.85rem,7vw,2.4rem)] font-semibold leading-[1.08] tracking-[-0.04em]">{typo(t.titre)}</h1>
        <p className="mt-4 text-pretty text-[16px] leading-[1.6] text-[#6b7280]">{typo(t.texte)}</p>

        <div className="mt-8 w-full">
          {appareil === 'ios' ? <AppStore /> : <Android />}
        </div>

        <ul className="mt-10 w-full space-y-3 rounded-2xl bg-white/80 p-5 text-left ring-1 ring-black/[0.06] backdrop-blur-sm">
          {t.atouts.map((a) => (
            <li key={a} className="flex items-start gap-3 text-[15px] leading-snug text-[#0b1220]">
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0167EA] text-white">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              </span>
              {typo(a)}
            </li>
          ))}
        </ul>
      </div>

      <footer className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[13px] leading-relaxed text-[#8a8f98]">
        {typo('Sur ordinateur, Diagly s’ouvre aussi dans le navigateur.')}
        <br />
        <Link to="/" className={cn('font-medium text-[#0167EA] hover:underline', FOCUS)}>Retour au site</Link>
      </footer>
    </main>
  )
}

/** iPhone et iPad : le badge de l'App Store, ou « bientôt » tant que l'app n'y est pas. */
function AppStore() {
  return (
    <div className="flex flex-col items-center gap-4">
      <BadgeAppStore className="min-h-14 rounded-[14px] px-6 [&_svg]:h-[30px] [&_svg]:w-[30px]" />
      <p className="text-[13.5px] text-[#6b7280]">
        {LIEN_APP_STORE ? typo('Déjà installée ? Ouvrez l’app Diagly sur votre écran d’accueil.') : typo('Bientôt disponible sur l’App Store.')}
      </p>
    </div>
  )
}

/** Android : le bouton d'installation, ou les gestes à faire dans le menu du navigateur. */
function Android() {
  const { possible, installee } = useInstallation()
  const [attente, setAttente] = useState(false)

  if (installee) {
    return (
      <div role="status" className="rounded-2xl bg-[#0167EA]/[0.06] px-5 py-4 text-[15px] leading-snug ring-1 ring-[#0167EA]/15">
        <p className="font-semibold">{typo('Diagly est installée.')}</p>
        <p className="mt-1 text-[#4b5563]">{typo('Ouvrez-la depuis votre écran d’accueil.')}</p>
      </div>
    )
  }

  if (possible) {
    return (
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          disabled={attente}
          onClick={() => { setAttente(true); void installer().finally(() => setAttente(false)) }}
          className={cn('inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0167EA] px-6 text-[17px] font-medium text-white shadow-[0_14px_30px_-12px_rgba(1,103,234,0.7)] transition-colors hover:bg-[#0154c4] disabled:opacity-70', FOCUS)}
        >
          {attente ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}
          Installer Diagly
        </button>
        <p className="text-[13.5px] text-[#6b7280]">{typo('Déjà installée ? Ouvrez-la depuis votre écran d’accueil.')}</p>
      </div>
    )
  }

  // Le navigateur ne propose pas l'installation (autre navigateur que Chrome,
  // ou app déjà installée) : les gestes, depuis son menu.
  const etapes = [
    { icone: MoreVertical, texte: 'Touchez le menu ⋮ du navigateur, en haut à droite.' },
    { icone: Download, texte: 'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».' },
    { icone: Smartphone, texte: 'Ouvrez Diagly depuis votre écran d’accueil.' },
  ]
  return (
    <ol className="space-y-2.5 text-left">
      {etapes.map(({ icone: Icone, texte }, i) => (
        <li key={texte} className="flex items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 text-[15px] leading-snug ring-1 ring-black/[0.08]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0167EA]/[0.08] text-[#0167EA]">
            <Icone className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span><span className="font-semibold text-[#0167EA]">{i + 1}.</span> {typo(texte)}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * /installer : la même page, pour la montrer sans l'appareil. ?appareil=ios ou
 * android choisit la variante ; sinon, celle de l'appareil, iPhone par défaut.
 */
export function PageInstallation() {
  const [params] = useSearchParams()
  const demande = params.get('appareil')
  const appareil: AppareilMobile = demande === 'ios' || demande === 'android' ? demande : appareilMobile() ?? 'ios'
  return <InstallerLApp appareil={appareil} />
}
