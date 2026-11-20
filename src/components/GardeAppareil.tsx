import { lazy, type ReactNode } from 'react'
import { accesWebRefuse } from '@/lib/appareil-web'
import { rechargerUneFois } from '@/lib/rechargement'

const InstallerLApp = lazy(() =>
  import('@/pages/InstallerLApp').then((m) => ({ default: m.InstallerLApp })).catch((err) => rechargerUneFois(err)))

/**
 * La porte de l'app sur téléphone et tablette : dans le navigateur, elle
 * montre la page d'installation à la place de l'app (lib/appareil-web.ts).
 * Elle entoure l'app et ses entrées (connexion, inscription), pas le site
 * public ni les liens des e-mails (rapport partagé, mot de passe oublié).
 */
export function GardeAppareil({ children }: { children: ReactNode }) {
  const refuse = accesWebRefuse()
  if (refuse) return <InstallerLApp appareil={refuse} />
  return <>{children}</>
}
