import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { ApiUser } from '@/lib/api-types'

/**
 * Retour de connexion Google : le serveur redirige ici avec les tokens dans le
 * fragment d'URL (#accessToken=...&refreshToken=...). On les stocke, on récupère
 * le profil, puis on entre dans l'app.
 */
export function OAuthCallback() {
  const navigate = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')
    if (!accessToken || !refreshToken) {
      setError('Connexion Google échouée.')
      return
    }

    // On met les tokens dans le store (profil provisoire) pour pouvoir appeler /me,
    // puis on remplace par le vrai profil.
    setAuth({ id: '', email: '' } as ApiUser, accessToken, refreshToken)
    api.auth
      .me()
      .then((r) => {
        setAuth(r.user, accessToken, refreshToken)
        navigate('/app/dashboard', { replace: true })
      })
      .catch(() => setError('Session invalide, réessayez.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
      {error ? (
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <Link to="/login" className="text-primary text-sm font-medium hover:underline">Retour à la connexion</Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />Connexion en cours…
        </div>
      )}
    </div>
  )
}
