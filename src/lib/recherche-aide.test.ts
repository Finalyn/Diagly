import { describe, it, expect } from 'vitest'
import {
  normaliser, texteDeLArticle, texteDuTutoriel, minutesDeLecture,
  extraitAutour, chercherDansLAide, type SourcesAide,
} from './recherche-aide'
import { ARTICLES, TUTORIELS, type Article, type Tutoriel } from '@/data/documentation'
import { FAQ, type FaqCategory } from '@/data/support'

const article = (slug: string, titre: string, resume: string, corps: string): Article => ({
  slug, titre, resume, categorie: 'essai',
  sections: [{ id: 's', titre: 'Section', blocs: [{ type: 'texte', texte: corps }] }],
})

const tutoriel = (slug: string, titre: string, objectif: string): Tutoriel => ({
  slug, titre, objectif, duree: '10 min', niveau: 'Débutant',
  etapes: [{ titre: 'Première étape', detail: 'Ouvrir le plan et le poser à plat.' }],
})

const faq = (label: string, q: string, a: string): FaqCategory => ({
  id: 'cat', label, description: 'Essai', icone: 'depart', items: [{ q, a }],
})

const sources = (s: Partial<SourcesAide>): SourcesAide => ({ articles: [], tutoriels: [], faq: [], ...s })

describe('normaliser', () => {
  it('enlève les accents et les majuscules', () => {
    expect(normaliser('Étalonnage')).toBe('etalonnage')
    expect(normaliser('Coûts & Variantes')).toBe('couts & variantes')
  })
})

describe('texteDeLArticle', () => {
  it('ramasse les titres de sections et les items de listes', () => {
    const a: Article = {
      slug: 'a', titre: 'Titre', resume: 'Résumé', categorie: 'c',
      sections: [{
        id: 's', titre: 'Les outils',
        blocs: [{ type: 'liste', items: ['Zone', 'Référence'] }, { type: 'astuce', texte: 'Ctrl+Z annule.' }],
      }],
    }
    const t = texteDeLArticle(a)
    expect(t).toContain('Les outils')
    expect(t).toContain('Référence')
    expect(t).toContain('Ctrl+Z annule.')
  })
})

describe('texteDuTutoriel', () => {
  it('ramasse les étapes et les prérequis', () => {
    const t = texteDuTutoriel({ ...tutoriel('t', 'Titre', 'Objectif'), prerequis: ['Un plan en PDF'] })
    expect(t).toContain('Un plan en PDF')
    expect(t).toContain('poser à plat')
  })
})

describe('minutesDeLecture', () => {
  it('vaut au moins une minute, même pour un article très court', () => {
    expect(minutesDeLecture(article('a', 'T', 'R', 'Trois mots ici'))).toBe(1)
  })

  it('compte environ deux cents mots par minute', () => {
    const corps = Array.from({ length: 600 }, () => 'mot').join(' ')
    expect(minutesDeLecture(article('a', 'T', 'R', corps))).toBe(3)
  })
})

describe('extraitAutour', () => {
  it('centre le passage sur le terme trouvé', () => {
    const texte = `${'a'.repeat(300)} etalonnage ${'b'.repeat(300)}`
    const e = extraitAutour(texte, 'etalonnage')
    expect(e).toContain('etalonnage')
    expect(e.startsWith('…')).toBe(true)
    expect(e.endsWith('…')).toBe(true)
  })

  it('trouve le passage malgré les accents', () => {
    expect(extraitAutour('Il faut étalonner la page avant de mesurer.', 'etalonner')).toContain('étalonner')
  })

  it('rend le texte entier quand il est plus court que la fenêtre', () => {
    expect(extraitAutour('Texte court.', 'absent')).toBe('Texte court.')
  })
})

describe('chercherDansLAide', () => {
  const jeu = sources({
    articles: [article('plans', 'Étalonner un plan', 'Donner son échelle à un plan.', 'Le geste se fait une fois par page.')],
    tutoriels: [tutoriel('tuto-plan', 'Mesurer sur un plan', 'Passer du PDF aux surfaces.')],
    faq: [faq('Plans', 'Puis-je changer l’échelle d’un plan ?', 'Oui, en réétalonnant la page.')],
  })

  it('ne cherche pas sur une requête trop courte', () => {
    expect(chercherDansLAide('p', jeu)).toEqual([])
    expect(chercherDansLAide('  ', jeu)).toEqual([])
  })

  it('trouve dans les trois sources à la fois', () => {
    const r = chercherDansLAide('plan', jeu)
    expect(r.map((x) => x.type).sort()).toEqual(['article', 'faq', 'tutoriel'])
  })

  it('ignore les accents de la requête', () => {
    expect(chercherDansLAide('etalonner', jeu)).toHaveLength(1)
    expect(chercherDansLAide('échelle', jeu).length).toBeGreaterThan(0)
  })

  it('classe un titre avant un corps de texte', () => {
    const r = chercherDansLAide('mesurer', sources({
      articles: [article('a', 'Les quantités', 'Résumé', 'On peut mesurer sur un plan.')],
      tutoriels: [tutoriel('t', 'Mesurer sur un plan', 'Objectif')],
    }))
    expect(r[0].type).toBe('tutoriel')
  })

  it('donne un lien aux articles et aux tutoriels, la réponse aux questions', () => {
    const r = chercherDansLAide('plan', jeu)
    expect(r.find((x) => x.type === 'article')?.lien).toBe('/app/support/doc/plans')
    expect(r.find((x) => x.type === 'tutoriel')?.lien).toBe('/app/support/tuto/tuto-plan')
    expect(r.find((x) => x.type === 'faq')?.reponse).toContain('réétalonnant')
  })

  it('ne rend rien quand le terme est absent', () => {
    expect(chercherDansLAide('chaudière à pellets', jeu)).toEqual([])
  })

  it('respecte le maximum demandé', () => {
    const beaucoup = sources({ articles: Array.from({ length: 30 }, (_, i) => article(`a${i}`, `Plan ${i}`, 'R', 'corps')) })
    expect(chercherDansLAide('plan', beaucoup, 5)).toHaveLength(5)
  })
})

describe('le contenu livré', () => {
  const vraies: SourcesAide = { articles: ARTICLES, tutoriels: TUTORIELS, faq: FAQ }

  it('n’a pas deux articles ni deux tutoriels sous la même adresse', () => {
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length)
    expect(new Set(TUTORIELS.map((t) => t.slug)).size).toBe(TUTORIELS.length)
  })

  it('ne renvoie nulle part : chaque lien « voir aussi » existe', () => {
    const slugs = new Set(ARTICLES.map((a) => a.slug))
    for (const a of ARTICLES) for (const v of a.voirAussi ?? []) expect(slugs.has(v), `${a.slug} → ${v}`).toBe(true)
    for (const t of TUTORIELS) for (const v of t.pourAllerPlusLoin ?? []) expect(slugs.has(v), `${t.slug} → ${v}`).toBe(true)
  })

  it('met l’article du sujet devant celui qui ne fait que le mentionner', () => {
    expect(chercherDansLAide('etalonnage', vraies)[0].titre).toBe('Étalonner un plan')
    expect(chercherDansLAide('webhook', vraies)[0].titre).toBe('Exports, API et webhooks')
  })

  it('trouve ce qu’un utilisateur taperait', () => {
    for (const terme of ['etalonner', 'TVA', 'EGID', 'photo', 'webhook', 'priorité', 'export', 'logo']) {
      expect(chercherDansLAide(terme, vraies).length, terme).toBeGreaterThan(0)
    }
  })

  it('n’emploie pas de tiret cadratin dans les textes livrés', () => {
    const tout = [...ARTICLES.map(texteDeLArticle), ...TUTORIELS.map(texteDuTutoriel)].join(' ')
    expect(tout).not.toContain('—')
  })
})
