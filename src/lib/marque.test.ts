import { describe, it, expect } from 'vitest'
import { ACCENT_PAR_DEFAUT, dossierPersonnalise, marqueDuRapport } from './marque'

const BUREAU = {
  name: 'Berger & Fils SA',
  address: 'Rue de la Gare 10',
  postalCode: '1950',
  city: 'Sion',
  logo: 'data:image/png;base64,bureau',
  accentColor: '#0f172a',
}

describe('la marque d’un rapport', () => {
  it('prend celle du bureau quand le dossier ne dit rien', () => {
    const m = marqueDuRapport(BUREAU, null, 'Chloé Berger')
    expect(m).toMatchObject({
      name: 'Berger & Fils SA', logo: 'data:image/png;base64,bureau',
      accentColor: '#0f172a', auteur: 'Chloé Berger',
    })
  })

  it('laisse le dossier imposer sa couleur et son logo', () => {
    const m = marqueDuRapport(BUREAU, { accentColor: '#b91c1c', logo: 'data:image/png;base64,dossier' })
    expect(m.accentColor).toBe('#b91c1c')
    expect(m.logo).toBe('data:image/png;base64,dossier')
    // Le reste continue de venir du bureau.
    expect(m.name).toBe('Berger & Fils SA')
    expect(m.city).toBe('Sion')
  })

  it('respecte « sans logo », même si le dossier en porte un', () => {
    expect(marqueDuRapport(BUREAU, { sansLogo: true }).logo).toBeNull()
    expect(marqueDuRapport(BUREAU, { sansLogo: true, logo: 'data:image/png;base64,x' }).logo).toBeNull()
  })

  it('ne prend pas une chaîne vide pour un choix', () => {
    const m = marqueDuRapport(BUREAU, { name: '   ', accentColor: '' })
    expect(m.name).toBe('Berger & Fils SA')
    expect(m.accentColor).toBe('#0f172a')
  })

  it('retombe sur la couleur par défaut quand personne n’en a', () => {
    expect(marqueDuRapport({}, null).accentColor).toBe(ACCENT_PAR_DEFAUT)
  })

  it('laisse le dossier nommer un autre auteur', () => {
    expect(marqueDuRapport(BUREAU, { auteur: 'Yves Guisolan' }, 'Chloé Berger').auteur).toBe('Yves Guisolan')
    expect(marqueDuRapport(BUREAU, {}, 'Chloé Berger').auteur).toBe('Chloé Berger')
  })

  it('survit à l’absence de tout', () => {
    expect(marqueDuRapport(null, null)).toEqual({
      name: null, address: null, postalCode: null, city: null,
      logo: null, accentColor: ACCENT_PAR_DEFAUT, auteur: null,
    })
  })
})

describe('un dossier qui s’écarte', () => {
  it('se reconnaît à ce qu’il impose', () => {
    expect(dossierPersonnalise(null)).toBe(false)
    expect(dossierPersonnalise({})).toBe(false)
    expect(dossierPersonnalise({ name: '  ' })).toBe(false)
    expect(dossierPersonnalise({ accentColor: '#b91c1c' })).toBe(true)
    expect(dossierPersonnalise({ sansLogo: true })).toBe(true)
  })
})
