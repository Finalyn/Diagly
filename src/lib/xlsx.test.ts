import { describe, it, expect } from 'vitest'
import { classeurXlsx, colonneExcel, echapperXml, nomDOnglet } from './xlsx'

const lire = async (b: Blob) => new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()))

describe('les références de colonnes', () => {
  it('suit l’alphabet, puis le double', () => {
    expect(colonneExcel(1)).toBe('A')
    expect(colonneExcel(26)).toBe('Z')
    expect(colonneExcel(27)).toBe('AA')
    expect(colonneExcel(32)).toBe('AF')
  })
})

describe('l’échappement XML', () => {
  it('protège les signes qui casseraient le document', () => {
    expect(echapperXml('Crépi & enduit <extérieur>')).toBe('Crépi &amp; enduit &lt;extérieur&gt;')
  })

  it('retire les caractères de contrôle, qui font refuser le fichier entier', () => {
    expect(echapperXml('note\u0001 interne')).toBe('note interne')
  })

  it('garde les accents et les apostrophes, qui sont du texte ordinaire', () => {
    expect(echapperXml("Façade d’immeuble")).toBe("Façade d’immeuble")
  })
})

describe('les noms d’onglet', () => {
  it('retire ce qu’Excel refuse et coupe à trente et un caractères', () => {
    expect(nomDOnglet('Ordre de visite')).toBe('Ordre de visite')
    expect(nomDOnglet('Articles [2026]')).toBe('Articles  2026')
    expect(nomDOnglet('x'.repeat(40))).toHaveLength(31)
  })
})

describe('le classeur', () => {
  const feuilles = [
    {
      nom: 'Articles',
      entetes: ['ID', 'Article', 'Prix'],
      lignes: [
        { ID: 'A015', Article: 'Façade crépie <non isolée>', Prix: 180 },
        { ID: 'A057', Article: 'Lustrerie', Prix: null },
      ],
    },
    { nom: 'Ordre de visite', entetes: ['N° étape', 'ID'], lignes: [{ 'N° étape': 1, ID: 'A015' }] },
  ]

  it('porte les quatre documents qu’Excel attend, plus une feuille par onglet', async () => {
    const texte = await lire(classeurXlsx(feuilles))
    for (const nom of [
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
    ]) {
      expect(texte).toContain(nom)
    }
  })

  it('nomme les onglets dans l’ordre', async () => {
    const texte = await lire(classeurXlsx(feuilles))
    expect(texte).toContain('<sheet name="Articles" sheetId="1"')
    expect(texte).toContain('<sheet name="Ordre de visite" sheetId="2"')
  })

  it('écrit les nombres en nombres et les textes en texte', async () => {
    const texte = await lire(classeurXlsx(feuilles))
    expect(texte).toContain('<c r="C2"><v>180</v></c>')
    expect(texte).toContain('t="inlineStr"')
    expect(texte).toContain('Façade crépie &lt;non isolée&gt;')
  })

  it('laisse la case vide quand la valeur manque', async () => {
    const texte = await lire(classeurXlsx(feuilles))
    // La ligne 3 porte A057 et son article, mais aucune cellule C3.
    expect(texte).toContain('<row r="3">')
    expect(texte).not.toContain('r="C3"')
  })

  it('fige la première ligne, la seule mise en forme qui compte', async () => {
    expect(await lire(classeurXlsx(feuilles))).toContain('state="frozen"')
  })

  it('porte le type MIME d’un classeur', () => {
    expect(classeurXlsx(feuilles).type).toContain('spreadsheetml.sheet')
  })
})
