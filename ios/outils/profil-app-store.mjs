#!/usr/bin/env node
/**
 * Crée le profil App Store de l'app et l'installe pour Xcode. Lancé par la
 * compilation sur GitHub (.github/workflows/app-ios.yml), avant l'archive.
 *
 * Pourquoi un profil App Store, créé ici par l'API : la signature automatique
 * de Xcode passe par un profil de développement, qu'Apple refuse de créer tant
 * qu'aucun appareil n'est enregistré sur le compte. Un profil App Store ne
 * dépend d'aucun appareil. On le recrée à chaque fois : il suit ainsi les
 * capacités cochées sur l'identifiant (notifications, connexion Apple…).
 *
 * Variables : ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (fichier .p8),
 * CERT_PEM (le certificat de distribution, extrait du .p12 des secrets).
 */
import { createPrivateKey, sign } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const IDENTIFIANT = 'ch.diagly.app'
const NOM = 'Diagly App Store (CI)' // repris par PROVISIONING_PROFILE_SPECIFIER (Release)

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, CERT_PEM } = process.env
for (const [n, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, CERT_PEM })) {
  if (!v) { console.error(`Variable manquante : ${n}`); process.exit(1) }
}

const cle = createPrivateKey(readFileSync(ASC_KEY_PATH))
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jeton() {
  const t = Math.floor(Date.now() / 1000)
  const corps = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: t, exp: t + 600, aud: 'appstoreconnect-v1' })}`
  return `${corps}.${sign('sha256', Buffer.from(corps), { key: cle, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}
async function asc(methode, chemin, corps) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton()}`, 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  })
  const texte = await r.text()
  const j = texte ? JSON.parse(texte) : null
  if (!r.ok) throw new Error(`${methode} ${chemin} : ${r.status} ${JSON.stringify(j?.errors?.map((e) => e.detail ?? e.title))}`)
  return j
}

// L'app doit exister dans App Store Connect, sans quoi l'envoi échouerait au
// bout de l'archive. Apple ne permet pas de la créer par l'API : on le dit tout
// de suite.
if ((await asc('GET', `/v1/apps?filter[bundleId]=${IDENTIFIANT}`)).data.length === 0) {
  console.error(`::error::L'app ${IDENTIFIANT} n'existe pas encore dans App Store Connect : la créer (Apps, +, Nouvelle app), voir APP-IOS.md.`)
  process.exit(1)
}

// L'identifiant de l'app (créé s'il manque).
let bundle = (await asc('GET', `/v1/bundleIds?filter[identifier]=${IDENTIFIANT}`)).data[0]
if (!bundle) {
  bundle = (await asc('POST', '/v1/bundleIds', { data: { type: 'bundleIds', attributes: { identifier: IDENTIFIANT, name: 'Diagly', platform: 'IOS' } } })).data
}

// Le certificat de distribution des secrets, retrouvé chez Apple par son contenu.
const der = readFileSync(CERT_PEM, 'utf8').match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/)?.[1].replace(/\s+/g, '')
if (!der) throw new Error('Certificat illisible dans CERT_PEM.')
const certificats = (await asc('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=50')).data
const certificat = certificats.find((c) => c.attributes.certificateContent === der)
if (!certificat) throw new Error('Le certificat des secrets (IOS_DIST_P12) n’existe plus chez Apple : il a été révoqué ou a expiré. Voir APP-IOS.md.')

// Le profil : l'ancien s'efface, le nouveau suit l'état actuel de l'identifiant.
const anciens = (await asc('GET', `/v1/profiles?filter[name]=${encodeURIComponent(NOM)}&limit=50`)).data
for (const p of anciens) await asc('DELETE', `/v1/profiles/${p.id}`)
const profil = (await asc('POST', '/v1/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: NOM, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: [{ type: 'certificates', id: certificat.id }] },
    },
  },
})).data

// Xcode 16 et suivants lisent les profils ici ; les versions précédentes, là.
const contenu = Buffer.from(profil.attributes.profileContent, 'base64')
for (const dossier of [
  join(homedir(), 'Library/Developer/Xcode/UserData/Provisioning Profiles'),
  join(homedir(), 'Library/MobileDevice/Provisioning Profiles'),
]) {
  mkdirSync(dossier, { recursive: true })
  writeFileSync(join(dossier, `${profil.attributes.uuid}.mobileprovision`), contenu)
}
console.log(`Profil « ${NOM} » installé (${profil.attributes.uuid}), certificat ${certificat.attributes.name}, expire le ${profil.attributes.expirationDate.slice(0, 10)}.`)
