import { describe, it, expect } from 'vitest'
import { messageAdressesInconnues, nomExpediteur, trierDestinataires } from './mails-visite.js'

const CONTACTS = [
  { name: 'Régie du Lac', email: 'Gerance@RegieDuLac.ch' },
  { name: 'M. Favre', email: 'favre@exemple.ch' },
  { name: 'Concierge', email: null },
]

describe('les destinataires d’un mail de visite', () => {
  it('ne retient que les interlocuteurs du dossier, avec leur nom enregistré', () => {
    const { retenus, inconnus } = trierDestinataires(
      [{ email: 'favre@exemple.ch' }, { email: 'inconnu@ailleurs.com' }],
      CONTACTS,
    )
    expect(retenus).toEqual([{ name: 'M. Favre', email: 'favre@exemple.ch' }])
    expect(inconnus).toEqual(['inconnu@ailleurs.com'])
  })

  it('ignore la casse et les espaces', () => {
    const { retenus, inconnus } = trierDestinataires([{ email: ' gerance@regiedulac.CH ' }], CONTACTS)
    expect(retenus).toEqual([{ name: 'Régie du Lac', email: 'Gerance@RegieDuLac.ch' }])
    expect(inconnus).toEqual([])
  })

  it('n’écrit qu’une fois à une adresse demandée deux fois', () => {
    const { retenus } = trierDestinataires([{ email: 'favre@exemple.ch' }, { email: 'FAVRE@exemple.ch' }], CONTACTS)
    expect(retenus).toHaveLength(1)
  })

  it('refuse tout quand le dossier n’a pas d’interlocuteur', () => {
    const { retenus, inconnus } = trierDestinataires([{ email: 'a@b.ch' }, { email: 'c@d.ch' }], [])
    expect(retenus).toEqual([])
    expect(inconnus).toEqual(['a@b.ch', 'c@d.ch'])
  })

  it('dit quoi faire d’une adresse refusée', () => {
    expect(messageAdressesInconnues(['a@b.ch'])).toBe(
      "Cette adresse n'est pas un interlocuteur du dossier : a@b.ch. Ajoutez-la aux interlocuteurs pour lui écrire depuis Diagly, ou ouvrez le mail dans votre messagerie.",
    )
    expect(messageAdressesInconnues(['a@b.ch', 'c@d.ch'])).toMatch(/^Ces adresses ne sont pas des interlocuteurs du dossier : a@b\.ch, c@d\.ch\. Ajoutez-les/)
  })
})

describe('le nom de l’expéditeur', () => {
  it('est celui du compte, suivi de « via Diagly »', () => {
    expect(nomExpediteur({ prenom: 'Claire', nom: 'Rochat', societe: 'Bureau Rochat SA' })).toBe('Claire Rochat via Diagly')
  })

  it('prend l’entreprise quand le compte n’a pas de nom', () => {
    expect(nomExpediteur({ prenom: null, nom: '', societe: 'Bureau Rochat SA' })).toBe('Bureau Rochat SA via Diagly')
  })

  it('reste « Diagly » sans nom ni entreprise', () => {
    expect(nomExpediteur({})).toBe('Diagly')
    expect(nomExpediteur({ prenom: '  ', nom: '"', societe: null })).toBe('Diagly')
  })

  it('ne laisse rien qui puisse réécrire l’en-tête', () => {
    const nom = nomExpediteur({ prenom: 'Eve"\r\nBcc: x@y.ch <', nom: 'Martin>' })
    expect(nom).toBe('Eve Bcc: x@y.ch Martin via Diagly')
    expect(nom).not.toMatch(/["<>\r\n]/)
  })

  it('coupe un nom trop long', () => {
    const nom = nomExpediteur({ prenom: 'A'.repeat(200) })
    expect(nom).toBe(`${'A'.repeat(80)} via Diagly`)
  })
})
