import { describe, it, expect } from 'vitest'
import { segments, analyser } from './texte-riche'

describe('segments', () => {
  it('laisse le texte simple intact', () => {
    expect(segments('Trois fenêtres à remplacer.')).toEqual([{ type: 'texte', texte: 'Trois fenêtres à remplacer.' }])
  })

  it('reconnaît le gras au milieu d’une phrase', () => {
    expect(segments('Le diagnostic est **ouvert mais incomplet**.')).toEqual([
      { type: 'texte', texte: 'Le diagnostic est ' },
      { type: 'gras', texte: 'ouvert mais incomplet' },
      { type: 'texte', texte: '.' },
    ])
  })

  it('ne confond pas le gras avec l’italique', () => {
    expect(segments('**gras** et *italique*')).toEqual([
      { type: 'gras', texte: 'gras' },
      { type: 'texte', texte: ' et ' },
      { type: 'italique', texte: 'italique' },
    ])
  })

  it('reconnaît le code entre accents graves', () => {
    expect(segments('Le code `CFC 221` couvre les fenêtres.')[1]).toEqual({ type: 'code', texte: 'CFC 221' })
  })

  it('reconnaît l’italique souligné', () => {
    expect(segments('à _vérifier_ sur place')[1]).toEqual({ type: 'italique', texte: 'vérifier' })
  })

  it('laisse une étoile isolée tranquille', () => {
    expect(segments('2 * 3 = 6')).toEqual([{ type: 'texte', texte: '2 * 3 = 6' }])
  })

  it('n’avale pas une multiplication entre deux nombres', () => {
    const s = segments('surface 10 m * 4 m')
    expect(s.every((x) => x.type === 'texte')).toBe(true)
  })
})

describe('analyser', () => {
  it('fait un paragraphe d’un texte simple', () => {
    expect(analyser('Une phrase.')).toEqual([{ type: 'paragraphe', lignes: [[{ type: 'texte', texte: 'Une phrase.' }]] }])
  })

  it('sépare les paragraphes sur une ligne vide', () => {
    const b = analyser('Premier.\n\nSecond.')
    expect(b).toHaveLength(2)
    expect(b.every((x) => x.type === 'paragraphe')).toBe(true)
  })

  it('garde les retours à la ligne d’un même paragraphe', () => {
    const b = analyser('Ligne un\nLigne deux')
    expect(b).toHaveLength(1)
    expect(b[0].type === 'paragraphe' && b[0].lignes).toHaveLength(2)
  })

  it('reconnaît une liste à puces, quel que soit le signe', () => {
    for (const signe of ['-', '*', '•']) {
      const b = analyser(`${signe} Façades\n${signe} Toiture`)
      expect(b[0].type).toBe('liste')
      expect(b[0].type === 'liste' && b[0].items).toHaveLength(2)
    }
  })

  it('reconnaît une liste numérotée', () => {
    const b = analyser('1. Relever\n2. Chiffrer')
    expect(b[0].type).toBe('numerotee')
    expect(b[0].type === 'numerotee' && b[0].items).toHaveLength(2)
  })

  it('ferme le paragraphe quand une liste commence', () => {
    const b = analyser('Travaux prioritaires :\n- Toiture\n- Façade')
    expect(b.map((x) => x.type)).toEqual(['paragraphe', 'liste'])
  })

  it('reprend un paragraphe après une liste', () => {
    const b = analyser('- Toiture\nÀ vérifier sur place.')
    expect(b.map((x) => x.type)).toEqual(['liste', 'paragraphe'])
  })

  it('reconnaît un titre', () => {
    const b = analyser('## Priorités\nTexte')
    expect(b[0].type).toBe('titre')
    expect(b[0].type === 'titre' && b[0].segments[0]).toEqual({ type: 'texte', texte: 'Priorités' })
  })

  it('applique la mise en forme dans les items de liste', () => {
    const b = analyser('- **Toiture** : à refaire')
    expect(b[0].type === 'liste' && b[0].items[0][0]).toEqual({ type: 'gras', texte: 'Toiture' })
  })

  it('ne rend rien d’un texte vide', () => {
    expect(analyser('')).toEqual([])
    expect(analyser('\n\n  \n')).toEqual([])
  })

  it('reconstitue le texte exact quand il n’y a aucune marque', () => {
    const texte = 'Première ligne\nDeuxième ligne'
    const b = analyser(texte)
    const rendu = b.flatMap((x) => (x.type === 'paragraphe' ? x.lignes : [])).map((l) => l.map((s) => s.texte).join('')).join('\n')
    expect(rendu).toBe(texte)
  })
})
