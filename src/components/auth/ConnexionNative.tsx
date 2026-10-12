import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ApiError } from '@/lib/api'
import type { EtapeDoubleAuth } from '@/lib/api'
import type { AuthResponse } from '@/lib/api-types'
import { ConnexionAnnulee, connexionApple, connexionGoogle, type IssueConnexion } from '@/lib/connexion-native'
import { GoogleIcon } from './Social'

function LogoApple() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  )
}

/**
 * « Continuer avec Apple » et « Continuer avec Google », dans l'app iPhone/iPad.
 *
 * Apple exige de proposer sa connexion dès qu'une autre (Google) l'est, avec un
 * bouton au moins aussi visible : il vient en premier, en noir, comme le veut
 * sa charte. Le compte se crée au besoin : la même porte sert à l'inscription.
 */
export function ConnexionNative({ onCompte, onDoubleAuth, onErreur }: {
  onCompte: (r: AuthResponse) => void
  onDoubleAuth: (etape: EtapeDoubleAuth) => void
  onErreur: (message: string | null) => void
}) {
  const [enCours, setEnCours] = useState<'apple' | 'google' | null>(null)

  const lancer = async (fournisseur: 'apple' | 'google') => {
    if (enCours) return
    setEnCours(fournisseur)
    onErreur(null)
    try {
      const issue: IssueConnexion = fournisseur === 'apple' ? await connexionApple() : await connexionGoogle()
      if ('twoFactorRequired' in issue) onDoubleAuth(issue)
      else onCompte(issue)
    } catch (e) {
      if (!(e instanceof ConnexionAnnulee)) {
        onErreur(e instanceof ApiError || e instanceof Error ? e.message : 'Connexion impossible, réessayez.')
      }
    } finally {
      setEnCours(null)
    }
  }

  const bouton = 'flex h-12 w-full items-center justify-center gap-2.5 rounded-[0.875rem] text-[15px] font-medium transition-all active:scale-[0.99] disabled:opacity-60'
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => lancer('apple')} disabled={!!enCours} className={`${bouton} bg-black text-white`}>
        {enCours === 'apple' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogoApple />}
        Continuer avec Apple
      </button>
      <button
        type="button"
        onClick={() => lancer('google')}
        disabled={!!enCours}
        className={`${bouton} border border-slate-200 bg-white text-slate-700`}
      >
        {enCours === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continuer avec Google
      </button>
    </div>
  )
}
