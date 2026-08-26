import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  /** Lien « retour à la connexion » (pages secondaires : mot de passe oublié, etc.). */
  backTo?: string
  children: ReactNode
}

/**
 * Mise en page des écrans d'authentification :
 *  - Desktop : deux colonnes (formulaire à gauche, panneau de marque + aperçu app à droite).
 *  - Mobile : une seule colonne (le panneau est masqué).
 */
export function AuthLayout({ title, subtitle, backTo, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex">
      {/* Colonne formulaire */}
      <div className="flex-1 flex flex-col px-6 sm:px-10 lg:px-16 py-8 min-w-0">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <span className="text-xl font-bold tracking-tight text-slate-900">Diagly</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Pro</span>
        </Link>

        <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-8">
          {backTo && (
            <Link to={backTo} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 w-fit">
              <ChevronLeft className="h-4 w-4" />Retour à la connexion
            </Link>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-2 mb-7 leading-relaxed">{subtitle}</p>}
          {!subtitle && <div className="mb-7" />}
          {children}
        </div>
      </div>

      {/* Colonne marque + aperçu (desktop) */}
      <div className="hidden lg:block flex-1 p-4">
        <div className="relative h-full w-full rounded-[2rem] overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800">
          {/* Motif pointillé discret */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          />
          <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

          <div className="relative h-full flex flex-col p-10 xl:p-12">
            <div className="text-white">
              <h2 className="text-3xl xl:text-[2.6rem] font-bold leading-[1.1] tracking-tight">
                Le diagnostic de bâtiment,<br />simplifié.
              </h2>
              <p className="text-indigo-100/90 mt-4 text-sm max-w-sm leading-relaxed">
                Relevés terrain, calcul des coûts et rapports — dans une seule app, même hors-ligne au fond d'un sous-sol.
              </p>
            </div>

            {/* Vraie capture du tableau de bord (s'adapte à la largeur du panneau) */}
            <div className="flex-1 min-h-0 mt-8 flex items-center">
              <img
                src="/dashboard-shot.png"
                alt="Aperçu du tableau de bord Diagly"
                className="w-full rounded-2xl shadow-2xl shadow-indigo-950/50 ring-1 ring-black/10"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
