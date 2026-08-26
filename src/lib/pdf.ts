/**
 * Chargement à la demande de pdf.js (~380 Ko avec son worker).
 *
 * Il n'est utile que pour un plan au format PDF : une image ne doit pas payer ce poids,
 * ni l'ouverture d'un diagnostic qui ne contient aucun plan. Le module est mis en cache
 * après le premier appel, les plans suivants s'ouvrent sans nouvel aller-retour.
 */
let loading: Promise<typeof import('pdfjs-dist')> | null = null

export function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!loading) {
    loading = (async () => {
      const [lib, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ])
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    })()
  }
  return loading
}
