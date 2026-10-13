import { useEffect, useState } from 'react'
import { api, BASE_URL } from '@/lib/api'

/** Les connexions que le site propose, d'après la configuration du serveur. */
interface Fournisseurs {
  google: boolean
  apple: boolean
}

// Lue une fois par visite : la configuration du serveur ne change pas d'un écran à l'autre.
let lecture: Promise<Fournisseurs> | null = null
function lireFournisseurs(): Promise<Fournisseurs> {
  lecture ??= api.auth.fournisseurs().catch(() => {
    lecture = null // nouvel essai au prochain affichage
    // Serveur injoignable, ou d'avant cette route : Google comme avant, sans Apple.
    return { google: true, apple: false }
  })
  return lecture
}

/** null tant que la réponse du serveur n'est pas arrivée. */
function useFournisseurs(): Fournisseurs | null {
  const [fournisseurs, setFournisseurs] = useState<Fournisseurs | null>(null)
  useEffect(() => {
    let actif = true
    void lireFournisseurs().then((f) => { if (actif) setFournisseurs(f) })
    return () => { actif = false }
  }, [])
  return fournisseurs
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

export function LogoApple() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  )
}

// Ces boutons NAVIGUENT vers le serveur, qui redirige vers Apple ou Google. Pas
// de formulaire : dans Chrome, la directive form-action 'self' de la CSP
// s'applique aussi aux redirections qui suivent l'envoi d'un formulaire, et
// bloquerait le passage vers appleid.apple.com ou accounts.google.com.
const partirVers = (chemin: string) => { window.location.href = `${BASE_URL}${chemin}` }

/** Bouton « Continuer avec Google » (flux OAuth par redirection). */
export function GoogleButton({ label = 'Continuer avec Google' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => partirVers('/api/auth/google')}
      className="w-full h-11 flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] text-sm font-medium text-slate-700 transition-all"
    >
      <GoogleIcon />{label}
    </button>
  )
}

/**
 * Bouton « Continuer avec Apple » du site, selon la charte d'Apple : fond noir,
 * logo et texte blancs, même hauteur que celui de Google.
 */
export function AppleButton({ label = 'Continuer avec Apple' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => partirVers('/api/auth/apple/web')}
      className="w-full h-11 flex items-center justify-center gap-2.5 rounded-lg bg-black hover:bg-neutral-800 active:scale-[0.99] text-sm font-medium text-white transition-all"
    >
      <LogoApple />{label}
    </button>
  )
}

/**
 * Apple et Google sur le site, par redirection, selon ce que le serveur
 * propose. Apple vient en premier, comme dans l'app. Rien, pas même le
 * séparateur, quand aucun des deux n'est configuré.
 */
export function ConnexionWeb({ libelleGoogle }: { libelleGoogle?: string }) {
  const fournisseurs = useFournisseurs()
  if (!fournisseurs || (!fournisseurs.apple && !fournisseurs.google)) return null
  return (
    <>
      <OrDivider label="ou continuer avec" />
      <div className="space-y-3">
        {fournisseurs.apple && <AppleButton />}
        {fournisseurs.google && <GoogleButton label={libelleGoogle} />}
      </div>
    </>
  )
}

/** Séparateur « ou … ». */
export function OrDivider({ label = 'ou avec votre email' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  )
}
