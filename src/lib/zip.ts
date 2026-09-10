/**
 * Écriture d'une archive ZIP, sans dépendance.
 *
 * Le besoin : sortir d'un coup les photos d'un diagnostic. Déclencher cent
 * téléchargements à la suite est pénible et le navigateur en bloque une partie.
 *
 * Les photos sont des JPEG, donc déjà compressés : les repasser dans un algorithme
 * de compression ne gagnerait presque rien et coûterait une bibliothèque de plus.
 * On écrit donc une archive « stockée », sans compression, ce qui est un mode
 * parfaitement standard du format et se réduit à assembler des en-têtes.
 *
 * Structure produite, dans l'ordre :
 *   pour chaque fichier   en-tête local + données brutes
 *   puis                  répertoire central, un enregistrement par fichier
 *   puis                  fin du répertoire central
 */

/** Table de contrôle CRC-32, calculée une fois. */
const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

/** Somme de contrôle exigée par le format pour chaque fichier. */
export function crc32(donnees: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < donnees.length; i++) c = TABLE[(c ^ donnees[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Date et heure au format MS-DOS, seul format que porte le ZIP. */
function dateDos(d: Date): { heure: number; date: number } {
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2)),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

export interface FichierZip {
  nom: string
  donnees: Uint8Array
}

/**
 * Assemble les fichiers en une archive prête à être enregistrée.
 * Les noms sont écrits en UTF-8, avec le drapeau qui l'annonce : sans lui, un
 * accent dans un nom de fichier ressort en charabia à l'ouverture.
 */
export function creerZip(fichiers: FichierZip[], date = new Date()): Blob {
  const { heure, date: jour } = dateDos(date)
  const encodeur = new TextEncoder()
  const morceaux: Uint8Array[] = []
  const central: Uint8Array[] = []
  let decalage = 0

  for (const f of fichiers) {
    const nom = encodeur.encode(f.nom)
    const somme = crc32(f.donnees)
    const taille = f.donnees.length

    const local = new Uint8Array(30 + nom.length)
    const vl = new DataView(local.buffer)
    vl.setUint32(0, 0x04034b50, true) // signature d'en-tête local
    vl.setUint16(4, 20, true) // version minimale
    vl.setUint16(6, 0x0800, true) // nom de fichier en UTF-8
    vl.setUint16(8, 0, true) // méthode : stocké, sans compression
    vl.setUint16(10, heure, true)
    vl.setUint16(12, jour, true)
    vl.setUint32(14, somme, true)
    vl.setUint32(18, taille, true) // taille compressée
    vl.setUint32(22, taille, true) // taille réelle
    vl.setUint16(26, nom.length, true)
    vl.setUint16(28, 0, true) // pas de champ supplémentaire
    local.set(nom, 30)

    morceaux.push(local, f.donnees)

    const entree = new Uint8Array(46 + nom.length)
    const vc = new DataView(entree.buffer)
    vc.setUint32(0, 0x02014b50, true) // signature du répertoire central
    vc.setUint16(4, 20, true) // version d'écriture
    vc.setUint16(6, 20, true) // version minimale
    vc.setUint16(8, 0x0800, true)
    vc.setUint16(10, 0, true)
    vc.setUint16(12, heure, true)
    vc.setUint16(14, jour, true)
    vc.setUint32(16, somme, true)
    vc.setUint32(20, taille, true)
    vc.setUint32(24, taille, true)
    vc.setUint16(28, nom.length, true)
    vc.setUint16(30, 0, true) // champ supplémentaire
    vc.setUint16(32, 0, true) // commentaire
    vc.setUint16(34, 0, true) // disque
    vc.setUint16(36, 0, true) // attributs internes
    vc.setUint32(38, 0, true) // attributs externes
    vc.setUint32(42, decalage, true) // position de l'en-tête local
    entree.set(nom, 46)
    central.push(entree)

    decalage += local.length + taille
  }

  const tailleCentral = central.reduce((n, c) => n + c.length, 0)
  const fin = new Uint8Array(22)
  const vf = new DataView(fin.buffer)
  vf.setUint32(0, 0x06054b50, true) // signature de fin
  vf.setUint16(4, 0, true) // disque courant
  vf.setUint16(6, 0, true) // disque du répertoire
  vf.setUint16(8, fichiers.length, true) // entrées sur ce disque
  vf.setUint16(10, fichiers.length, true) // entrées au total
  vf.setUint32(12, tailleCentral, true)
  vf.setUint32(16, decalage, true) // position du répertoire central
  vf.setUint16(20, 0, true) // pas de commentaire

  // Un seul tampon contigu plutôt qu'une liste de fragments : le Blob n'a plus qu'à
  // l'envelopper, et le type attendu ne prête plus à discussion.
  const parties = [...morceaux, ...central, fin]
  const sortie = new Uint8Array(parties.reduce((n, m) => n + m.length, 0))
  let position = 0
  for (const m of parties) {
    sortie.set(m, position)
    position += m.length
  }
  return new Blob([sortie.buffer], { type: 'application/zip' })
}

/**
 * Octets d'une image stockée en data URL. Les photos du diagnostic sont conservées
 * ainsi, en JPEG réduit, directement avec l'ouvrage.
 */
export function octetsDeDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binaire = atob(base64)
  const out = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i++) out[i] = binaire.charCodeAt(i)
  return out
}
