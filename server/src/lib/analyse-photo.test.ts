import { describe, it, expect } from 'vitest'
import { normaliserAnalysePhoto } from './analyse-photo.js'

// Ce que le modèle renvoie sur une capture d'écran de logiciel, quand il a mal
// suivi la consigne et propose tout de même un état.
const captureEvaluee = () => ({
  element: "Capture d'écran d'un logiciel de gestion",
  matchesSelected: false,
  state: 'BON',
  priority: 'III',
  stateReason: 'Aucun défaut visible',
  note: 'Façade en bon état.',
  photoInutilisable: true,
  raisonInutilisable: "  C'est une capture d'écran, pas une façade.  ",
  photosAEcarter: [1],
  confidence: 'low',
})

describe('une photo inutilisable', () => {
  it("ne laisse passer aucun état, même si le modèle en a proposé un", () => {
    const a = normaliserAnalysePhoto(captureEvaluee(), 1, true)
    expect(a.photoInutilisable).toBe(true)
    expect(a.state).toBeNull()
    expect(a.priority).toBeNull()
    expect(a.stateReason).toBeNull()
    expect(a.note).toBeNull()
    expect(a.raisonInutilisable).toBe("C'est une capture d'écran, pas une façade.")
    expect(a.photosAEcarter).toEqual([1])
  })

  it("compte un autre élément CFC comme inutilisable pour l'élément choisi", () => {
    const a = normaliserAnalysePhoto({ matchesSelected: false, state: 'MOYEN', cfc: { code: '216.0' } }, 1, true)
    expect(a.photoInutilisable).toBe(true)
    expect(a.state).toBeNull()
    // La suggestion de CFC reste : elle dit où ranger la photo.
    expect(a.cfc).toEqual({ code: '216.0' })
  })

  it("ne juge pas la correspondance quand aucun CFC n'était choisi", () => {
    const a = normaliserAnalysePhoto({ matchesSelected: false, state: 'BON' }, 1, false)
    expect(a.photoInutilisable).toBe(false)
    expect(a.state).toBe('BON')
  })

  it('garde seulement les numéros de photos qui existent, sans doublon', () => {
    const a = normaliserAnalysePhoto({ photoInutilisable: true, photosAEcarter: [3, 0, 2, 3, 9, 1.5, '2'] }, 3, true)
    expect(a.photosAEcarter).toEqual([2, 3])
  })

  it("met toutes les photos en cause quand le modèle n'en désigne aucune", () => {
    const a = normaliserAnalysePhoto({ photoInutilisable: true }, 3, true)
    expect(a.photosAEcarter).toEqual([1, 2, 3])
    expect(a.raisonInutilisable).toBeNull()
  })
})

describe('une photo exploitable', () => {
  it("garde l'évaluation et efface les restes d'avertissement", () => {
    const a = normaliserAnalysePhoto(
      { matchesSelected: true, state: 'MOYEN', note: 'Fissures fines.', raisonInutilisable: '', photosAEcarter: [] },
      2,
      true,
    )
    expect(a.photoInutilisable).toBe(false)
    expect(a.state).toBe('MOYEN')
    expect(a.note).toBe('Fissures fines.')
    expect(a).not.toHaveProperty('raisonInutilisable')
    expect(a).not.toHaveProperty('photosAEcarter')
  })

  it("reste compatible avec une réponse qui ignore le nouveau champ", () => {
    const a = normaliserAnalysePhoto({ matchesSelected: true, state: 'BON' }, 1, true)
    expect(a.photoInutilisable).toBe(false)
    expect(a.state).toBe('BON')
  })
})
