import { describe, it, expect } from 'vitest'
import { crc32, creerZip } from './zip'

const octets = (s: string) => new TextEncoder().encode(s)
const lire = async (b: Blob) => new Uint8Array(await b.arrayBuffer())
const u32 = (a: Uint8Array, i: number) => new DataView(a.buffer).getUint32(i, true)
const u16 = (a: Uint8Array, i: number) => new DataView(a.buffer).getUint16(i, true)

describe('somme de contrôle', () => {
  it('donne la valeur de référence du format', () => {
    // Valeur canonique, celle que toute implémentation de CRC-32 doit produire.
    expect(crc32(octets('123456789'))).toBe(0xcbf43926)
  })
  it('vaut zéro sur une entrée vide', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
  it("change dès qu'un octet change", () => {
    expect(crc32(octets('facade'))).not.toBe(crc32(octets('facada')))
  })
})

describe('archive', () => {
  it('commence par la signature d\'en-tête local', async () => {
    const a = await lire(creerZip([{ nom: 'a.txt', donnees: octets('bonjour') }]))
    expect(u32(a, 0)).toBe(0x04034b50)
  })

  it('déclare autant d\'entrées que de fichiers', async () => {
    const a = await lire(creerZip([
      { nom: 'un.jpg', donnees: octets('aaa') },
      { nom: 'deux.jpg', donnees: octets('bbbb') },
      { nom: 'trois.jpg', donnees: octets('ccccc') },
    ]))
    const fin = a.length - 22
    expect(u32(a, fin)).toBe(0x06054b50)
    expect(u16(a, fin + 8)).toBe(3)
    expect(u16(a, fin + 10)).toBe(3)
  })

  it('place le répertoire central là où la fin l\'annonce', async () => {
    const a = await lire(creerZip([{ nom: 'a.txt', donnees: octets('bonjour') }]))
    const fin = a.length - 22
    const position = u32(a, fin + 16)
    expect(u32(a, position)).toBe(0x02014b50)
    expect(u32(a, fin + 12)).toBe(fin - position)
  })

  it('stocke les données telles quelles, sans compression', async () => {
    const contenu = octets('des octets qui ne doivent pas bouger')
    const a = await lire(creerZip([{ nom: 'x.bin', donnees: contenu }]))
    const debut = 30 + 'x.bin'.length
    expect(u16(a, 8)).toBe(0) // méthode 0 = stocké
    expect(u32(a, 18)).toBe(contenu.length) // taille compressée = taille réelle
    expect([...a.slice(debut, debut + contenu.length)]).toEqual([...contenu])
  })

  it('inscrit la somme de contrôle du fichier dans son en-tête', async () => {
    const contenu = octets('photo')
    const a = await lire(creerZip([{ nom: 'p.jpg', donnees: contenu }]))
    expect(u32(a, 14)).toBe(crc32(contenu))
  })

  it('annonce des noms en UTF-8, pour que les accents survivent', async () => {
    const a = await lire(creerZip([{ nom: 'façade-métallique.jpg', donnees: octets('x') }]))
    expect(u16(a, 6) & 0x0800).toBe(0x0800)
  })

  it('produit une archive vide mais valide sans fichier', async () => {
    const a = await lire(creerZip([]))
    expect(a.length).toBe(22)
    expect(u32(a, 0)).toBe(0x06054b50)
  })
})
