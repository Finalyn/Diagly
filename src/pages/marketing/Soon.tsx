/**
 * Page publique « bientôt disponible » affichée sur la racine.
 * L'accès à l'application se fait directement via /login (puis /app/dashboard).
 */
export function Soon() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white px-6 text-center">
      <div className="flex items-center gap-1.5 mb-8">
        <span className="text-3xl font-bold tracking-tight">Diagly</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider bg-primary text-white px-2 py-0.5 rounded">Pro</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Bientôt disponible</h1>
      <p className="mt-4 text-muted-foreground max-w-md leading-relaxed">
        La plateforme de diagnostic de bâtiments pour les professionnels arrive très prochainement.
      </p>

      <div className="mt-10 text-xs text-muted-foreground">
        Une question ? <a href="mailto:contact@finalyn.com" className="text-primary hover:underline">contact@finalyn.com</a>
      </div>
    </div>
  )
}
