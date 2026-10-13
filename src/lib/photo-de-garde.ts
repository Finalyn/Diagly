/**
 * La photo de la page de garde des rapports.
 *
 * Choisie dans la page Photos du dossier. Les photos vivent dans les relevés,
 * en entier : le dossier n'en garde pas une copie, seulement une référence
 * courte, l'identifiant du relevé et une empreinte de la photo. Si la photo
 * disparaît (retirée du relevé, relevé supprimé), la règle d'avant reprend : la
 * première photo du premier élément qui en a une.
 */

interface AvecPhotos {
  id: string
  photos: string[]
}

/** Une empreinte courte et stable : la longueur et un extrait du milieu du fichier. */
export function empreintePhoto(photo: string): string {
  const milieu = Math.floor(photo.length / 2)
  return `${photo.length}.${photo.slice(milieu, milieu + 32)}`
}

/** La référence enregistrée dans le dossier pour cette photo de ce relevé. */
export function referencePhoto(releveId: string, photo: string): string {
  return `${releveId}:${empreintePhoto(photo)}`
}

/** La photo de garde : celle choisie si elle existe encore, sinon la première venue. */
export function photoDeGarde(items: AvecPhotos[], reference: string | null | undefined): string | undefined {
  if (reference) {
    const coupure = reference.indexOf(':')
    const releveId = reference.slice(0, coupure)
    const empreinte = reference.slice(coupure + 1)
    const choisie = items.find((i) => i.id === releveId)?.photos.find((p) => empreintePhoto(p) === empreinte)
    if (choisie) return choisie
  }
  return items.find((i) => i.photos.length > 0)?.photos[0]
}
