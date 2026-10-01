import { useNavigate } from 'react-router-dom'
import { AssistantConversation } from '@/components/AssistantWidget'

/**
 * L'assistant sur mobile : une page, pas une fenêtre.
 *
 * Posé en panneau flottant, il n'occupait que 74 % de la hauteur, laissait
 * l'application visible derrière lui et recouvrait le bouton « Suivant » de
 * l'éditeur de diagnostic, au point qu'il fallait le désactiver sur cet écran.
 * Une conversation qu'on lit et à laquelle on répond mérite l'écran entier :
 * elle se quitte par la flèche de retour, comme l'éditeur.
 *
 * `100dvh` et non `100vh` : sur iOS, `vh` ignore la barre d'adresse et le champ
 * de saisie tombait sous le bord de l'écran.
 */
export function AssistantPage() {
  const navigate = useNavigate()
  return (
    <div className="h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <AssistantConversation onDismiss={() => navigate(-1)} dismissIcon="back" />
    </div>
  )
}
