import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Build de l'app iPhone/iPad (`npm run build:app`) : le front est embarqué
  // dans l'app et parle à l'API de production, sauf si VITE_API_URL est fourni
  // dans l'environnement (pour viser un serveur de test). Une variable du
  // processus passe avant les fichiers .env, .env.local compris.
  if (mode === 'app') process.env.VITE_API_URL ??= 'https://diagly.ch'

  return {
    // Racine par défaut (prod sur domaine). Pour un sous-chemin : VITE_BASE=/Diagly/ npm run build
    base: process.env.VITE_BASE ?? '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
