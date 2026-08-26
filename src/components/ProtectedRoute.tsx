import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/stores/auth'

interface Props {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: Props) {
  const isAuth = useAuth((s) => !!s.accessToken)
  const location = useLocation()
  if (!isAuth) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
