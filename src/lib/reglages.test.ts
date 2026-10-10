import { describe, it, expect } from 'vitest'
import {
  aChange, apercuDesValeurs, champsManquantsDuBureau, etatDeLaSecurite, etatDuBureau,
  etatDuProfil, initiales, nomAffiche,
} from './reglages'

const BUREAU = {
  name: 'Berger & Fils SA', address: 'Rue de la Gare 10', postalCode: '1950', city: 'Sion',
  canton: 'VS', logo: 'data:image/png;base64,xxx',
}

describe('l’état de l’entreprise', () => {
  it('ne réclame rien quand tout est là', () => {
    expect(etatDuBureau(BUREAU)).toEqual({ etat: 'complet', mention: null })
  })

  it('signale le logo manquant sans crier au manque', () => {
    expect(etatDuBureau({ ...BUREAU, logo: null })).toEqual({ etat: 'attention', mention: 'sans logo' })
  })

  it('compte les champs à remplir, parce qu’un rapport sans adresse ne dit pas qui l’a écrit', () => {
    expect(etatDuBureau({ ...BUREAU, address: '', city: '  ' }))
      .toEqual({ etat: 'incomplet', mention: '2 champs à remplir' })
    expect(etatDuBureau(undefined).mention).toBe('4 champs à remplir')
  })

  it('nomme les champs manquants comme le formulaire les nomme', () => {
    expect(champsManquantsDuBureau({ name: 'X' })).toEqual(['adresse', 'NPA', 'ville'])
  })
})

describe('l’état de la sécurité', () => {
  it('dit ce qui protège le compte, pas seulement un drapeau', () => {
    expect(etatDeLaSecurite(true)).toEqual({ etat: 'complet', mention: 'double authentification active' })
    expect(etatDeLaSecurite(false)).toEqual({ etat: 'attention', mention: 'mot de passe seul' })
  })
})

describe('l’état du profil', () => {
  it('réclame le nom, qui signe les rapports', () => {
    expect(etatDuProfil({ firstName: null, lastName: null })).toMatchObject({ etat: 'incomplet', mention: 'sans nom' })
  })

  it('se contente d’un prénom', () => {
    expect(etatDuProfil({ firstName: 'Chloé', phone: '+41 27 000 00 00' }).etat).toBe('complet')
  })

  it('signale le téléphone absent sans en faire un manque', () => {
    expect(etatDuProfil({ firstName: 'Chloé', lastName: 'Berger' }))
      .toEqual({ etat: 'attention', mention: 'sans téléphone' })
  })
})

describe('l’effet des valeurs par défaut', () => {
  const v = { honoraryPct: 12, reservePct: 10, vatPct: 8.1 }

  it('montre la cascade sur cent mille francs', () => {
    const e = apercuDesValeurs(v)
    expect(e.map((x) => x.libelle)).toEqual([
      'Travaux', 'Honoraires 12 %', 'Réserve 10 %', 'TVA 8.1 %', 'Total TTC',
    ])
    expect(e[0].montant).toBe(100_000)
    expect(e[1].montant).toBe(12_000)
    expect(e[2].montant).toBeCloseTo(11_200, 2)
    expect(e[4].montant).toBeCloseTo(133_179.2, 1)
  })

  it('applique la réserve après les honoraires, comme le devis', () => {
    // 10 % de 112 000, et non de 100 000 : c'est la règle du devis.
    expect(apercuDesValeurs({ ...v, reservePct: 10 })[2].montant).toBeCloseTo(11_200, 2)
  })

  it('suit un montant de référence choisi', () => {
    expect(apercuDesValeurs(v, 50_000)[0].montant).toBe(50_000)
  })

  it('ne majore rien quand les pourcentages sont à zéro, hors TVA', () => {
    const e = apercuDesValeurs({ honoraryPct: 0, reservePct: 0, vatPct: 8.1 })
    expect(e[1].montant).toBe(0)
    expect(e[4].montant).toBeCloseTo(108_100, 2)
  })
})

describe('le brouillon', () => {
  it('ne se croit modifié que s’il l’est', () => {
    expect(aChange({ a: 1 }, { a: 1 })).toBe(false)
    expect(aChange({ a: 1 }, { a: 2 })).toBe(true)
    expect(aChange({ a: '  ' }, { a: '' })).toBe(true)
  })
})

describe('l’identité affichée', () => {
  it('prend les initiales du nom, ou la première lettre de l’adresse', () => {
    expect(initiales({ firstName: 'Chloé', lastName: 'Berger' })).toBe('CB')
    expect(initiales({ firstName: 'Chloé' })).toBe('C')
    expect(initiales({ email: 'contact@finalyn.com' })).toBe('C')
  })

  it('affiche le nom, ou l’adresse à défaut', () => {
    expect(nomAffiche({ firstName: 'Chloé', lastName: 'Berger' })).toBe('Chloé Berger')
    expect(nomAffiche({ email: 'contact@finalyn.com' })).toBe('contact@finalyn.com')
    expect(nomAffiche({})).toBe('Mon compte')
  })
})
