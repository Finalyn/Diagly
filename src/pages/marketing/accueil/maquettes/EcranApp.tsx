import {
  Calculator, CalendarCheck, ChevronRight, ClipboardCheck, FileText, Image, LayoutGrid, MapPin, Zap, type LucideIcon,
} from 'lucide-react'
import { BarreVerre } from './EcranMobile'

/**
 * Les écrans de la section App : le sommaire d'un dossier, avec la barre du
 * dossier en verre, et la connexion par Apple ou Google.
 */

const GROUPES: { titre: string; entrees: { icone: LucideIcon; libelle: string; detail: string }[] }[] = [
  { titre: 'Bâtiment', entrees: [
    { icone: CalendarCheck, libelle: 'Visite', detail: 'Rendez-vous le 4 novembre à 9 h' },
    { icone: MapPin, libelle: 'Fiche du bâtiment', detail: '1968 · 5 étages · 1 020 m²' },
    { icone: Zap, libelle: 'Étiquette énergétique', detail: 'Estimation indicative' },
  ] },
  { titre: 'Analyse', entrees: [
    { icone: Calculator, libelle: 'Coûts', detail: '412 300 CHF HT, 42 éléments' },
  ] },
  { titre: 'Documents', entrees: [
    { icone: Image, libelle: 'Photos', detail: '64 photos' },
    { icone: FileText, libelle: 'Rapports', detail: 'Consulter, partager au client' },
  ] },
]

/** Le sommaire d'un dossier sur iPhone, et la barre du dossier. */
export function EcranDossier() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <div className="px-4 pt-[64px]">
        <p className="text-[24px] font-bold tracking-[-0.02em]">Les Tilleuls</p>
        <p className="text-[13px] text-[#6e6e73]">Rue des Alpes 12, 1003 Lausanne</p>
        <div className="mt-3 rounded-2xl bg-white p-3.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold">Relevé</span>
            <span className="tabular-nums text-[#6e6e73]">18 sur 42</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f0f0f3]"><div className="h-full w-[43%] rounded-full bg-[#0167EA]" /></div>
          <p className="mt-2 text-[12px] text-[#6e6e73]">3 urgents · prochaine étape : Cage d’escalier</p>
        </div>
        <div className="mt-4 space-y-4">
          {GROUPES.map((g) => (
            <section key={g.titre}>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">{g.titre}</p>
              <div className="divide-y divide-[#f0f0f3] overflow-hidden rounded-2xl bg-white">
                {g.entrees.map((e) => (
                  <div key={e.libelle} className="flex items-center gap-3 px-3.5 py-3">
                    <e.icone className="h-[18px] w-[18px] text-[#48484a]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium">{e.libelle}</p>
                      <p className="truncate text-[12px] text-[#6e6e73]">{e.detail}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#aeaeb2]" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <BarreVerre retour entrees={[{ icone: ClipboardCheck }, { icone: LayoutGrid, actif: true }]} />
    </div>
  )
}

/** La connexion dans l'app (pages/auth/Login.tsx) : e-mail, ou Apple et Google par les fenêtres d'iOS. */
export function EcranConnexion() {
  const champ = 'flex h-11 w-full items-center rounded-xl border border-neutral-200 bg-white/70 px-3.5 text-[15px] text-[#8e8e93]'
  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-white to-[#eef0f3] px-6 pt-[92px] text-[#1d1d1f]">
      <div className="flex items-center justify-center gap-2.5">
        <img src="/diagly-mark.svg" alt="" className="h-10 w-auto" />
        <span className="text-[27px] font-semibold leading-none tracking-tight">Diagly</span>
      </div>
      <p className="mt-10 text-center text-[28px] font-semibold tracking-tight">Bienvenue</p>
      <p className="mt-2 text-center text-[14px] text-neutral-500">Connectez-vous à votre espace Diagly</p>
      <div className="mt-8 space-y-4">
        <div>
          <p className="mb-1.5 text-[14px] font-medium text-neutral-700">Email</p>
          <span className={champ}>vous@exemple.ch</span>
        </div>
        <div>
          <p className="mb-1.5 text-[14px] font-medium text-neutral-700">Mot de passe</p>
          <span className={champ}>Votre mot de passe</span>
        </div>
        <span className="flex h-11 w-full items-center justify-center rounded-xl border border-black/[0.12] bg-white text-[15px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)]">Se connecter</span>
      </div>
      <div className="my-6 flex items-center gap-3 text-[12px] text-[#8e8e93]"><span className="h-px flex-1 bg-[#dcdce1]" />ou continuer avec<span className="h-px flex-1 bg-[#dcdce1]" /></div>
      <div className="space-y-3">
        <span className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-black text-[16px] font-semibold text-white">
          <svg viewBox="0 0 384 512" className="h-[18px] w-[18px] fill-current" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
          Continuer avec Apple
        </span>
        <span className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#dcdce1] text-[16px] font-semibold">
          <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          Continuer avec Google
        </span>
      </div>
    </div>
  )
}
