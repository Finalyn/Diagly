import { useNavigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'

/**
 * L'édition d'un item se fait directement dans l'éditeur principal
 * (DiagnosticDetail) en sélectionnant l'item dans la colonne de gauche.
 * On redirige donc l'ancienne route /app/diagnostic/:id/item/:itemId vers
 * /app/diagnostic/:id.
 */
export function DiagnosticItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useEffect(() => {
    navigate(`/app/diagnostic/${id}`, { replace: true })
  }, [id, navigate])
  return null
}
