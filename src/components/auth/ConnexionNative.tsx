import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ApiError } from '@/lib/api'
import type { EtapeDoubleAuth } from '@/lib/api'
import type { AuthResponse } from '@/lib/api-types'
import { ConnexionAnnulee, connexionApple, connexionGoogle, type IssueConnexion } from '@/lib/connexion-native'
import { GoogleIcon, LogoApple } from './Social'

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
