/**
 * La scène three.js de la maquette 3D des métrés (Maquette3D.tsx), chargée à
 * l'ouverture de la vue : three.js ne pèse pas sur le reste de l'application.
 *
 * Elle dessine ce que lib/plans/maquette3d.ts a calculé, sans rien y ajouter :
 * chaque niveau à sa hauteur, sa dalle, ses murs en trois bandes (sous
 * l'allège, jusqu'au linteau, au-dessus), le sol de ses pièces, et ses portes
 * et fenêtres dans leurs percements. Une feuille qui vaut pour plusieurs
 * étages ne calcule ses volumes qu'une fois.
 *
 * Les niveaux montent l'un après l'autre à l'ouverture. On tourne autour, on
 * zoome et on se déplace à la souris ou au doigt ; le survol et le clic
 * remontent l'élément touché, la vue React en fait une infobulle.
 *
 * Repère : x vers l'est comme sur le plan, y vers le haut, z vers le bas de
 * la feuille. Les formes du plan, posées à plat puis tournées, s'élèvent en y.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MultiPolygon } from 'polygon-clipping'
import { ALLEGE, DALLE, LINTEAU, type Feuille3D, type Maquette3D, type Niveau3D, type Ouverture3D, type Piece3D, type Pt } from '@/lib/plans/maquette3d'

export type Cible =
  | { nature: 'piece'; niveau: Niveau3D; piece: Piece3D }
  | { nature: 'ouverture'; niveau: Niveau3D; ouverture: Ouverture3D }
  | { nature: 'murs'; niveau: Niveau3D }
  | { nature: 'dalle'; niveau: Niveau3D }

export interface Rappels {
  /** La teinte d'un élément, selon les couleurs choisies. */
  teinte(c: Cible): string
  survol(c: Cible | null, x: number, y: number): void
  clic(c: Cible): void
}

export interface Scene3D {
  /** Ne montre que les niveaux jusqu'au rang donné ; tous avec null. */
  couper(jusqua: number | null): void
  recolorer(): void
  recadrer(): void
  detruire(): void
}

/** Le temps de montée d'un niveau, et l'écart entre deux, en secondes. */
const MONTEE = 0.7
const ECART = 0.3
/** Le haut d'une porte : son vantail s'arrête sous le linteau. */
const VANTAIL = LINTEAU - 0.05

/** Un polygone du plan, en forme three.js : y retourné, pour qu'il s'élève vers le haut une fois tourné. */
function forme(poly: Pt[][]): THREE.Shape {
  const anneau = (r: Pt[]) => {
    const pts = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r
    return pts.map(([x, y]) => new THREE.Vector2(x, -y))
  }
  const [contour, ...trous] = poly
  const s = new THREE.Shape(anneau(contour))
  for (const t of trous) s.holes.push(new THREE.Path(anneau(t)))
  return s
}

function volume(m: MultiPolygon, hauteur: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(m.map((p) => forme(p as Pt[][])), { depth: hauteur, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
}

function aplat(poly: Pt[][]): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(forme(poly))
  g.rotateX(-Math.PI / 2)
  return g
}

/**
 * Les arêtes d'une bande de murs, sans le joint avec la bande voisine : la
 * façade ne se raye pas à l'allège ni au linteau. Restent le pied du mur, son
 * dessus et les montants des ouvertures.
 */
function aretesSansJoints(geometrie: THREE.BufferGeometry, hauteur: number, garderBas: boolean, garderHaut: boolean): THREE.BufferGeometry {
  const toutes = new THREE.EdgesGeometry(geometrie, 30)
  const p = toutes.getAttribute('position')
  const gardees: number[] = []
  const a = (y: number, h: number) => Math.abs(y - h) < 1e-4
  for (let i = 0; i < p.count; i += 2) {
    const y1 = p.getY(i), y2 = p.getY(i + 1)
    if ((!garderBas && a(y1, 0) && a(y2, 0)) || (!garderHaut && a(y1, hauteur) && a(y2, hauteur))) continue
    gardees.push(p.getX(i), y1, p.getZ(i), p.getX(i + 1), y2, p.getZ(i + 1))
  }
  toutes.dispose()
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(gardees, 3))
  return g
}

/** Les volumes d'une feuille, faits une fois pour tous les étages qu'elle représente. */
interface Volumes {
  dalle: THREE.BufferGeometry
  murs: { geometrie: THREE.BufferGeometry; aretes: THREE.BufferGeometry; bas: number }[]
  sols: THREE.BufferGeometry[]
}

function volumesDe(f: Feuille3D): Volumes {
  return {
    dalle: volume(f.dalle, DALLE),
    murs: f.murs.filter((b) => b.forme.length && b.haut > b.bas).map((b, i, toutes) => {
      const geometrie = volume(b.forme, b.haut - b.bas)
      return { geometrie, aretes: aretesSansJoints(geometrie, b.haut - b.bas, i === 0, i === toutes.length - 1), bas: b.bas }
    }),
    sols: f.pieces.map((p) => aplat([p.contour, ...p.trous])),
  }
}

export function monterScene(hote: HTMLElement, maquette: Maquette3D, rappels: Rappels, options: { animer: boolean }): Scene3D {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  hote.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6dce6, 1.6))
  const soleil = new THREE.DirectionalLight(0xffffff, 1.5)
  soleil.position.set(-30, 50, 40)
  scene.add(soleil)

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2000)
  const controles = new OrbitControls(camera, renderer.domElement)
  controles.enableDamping = true
  controles.maxPolarAngle = Math.PI * 0.49

  // Chaque niveau dans son groupe, posé à sa hauteur : il monte depuis son pied.
  const cibles = new Map<THREE.Mesh, Cible>()
  const niveaux: { groupe: THREE.Group; rang: number }[] = []
  const caches = new Map<string, Volumes>()
  const aretes = new THREE.LineBasicMaterial({ color: 0x8a94a6, transparent: true, opacity: 0.45 })
  const ajouter = (groupe: THREE.Group, objet: THREE.Mesh, cible: Cible) => {
    groupe.add(objet)
    cibles.set(objet, cible)
  }

  for (const niveau of maquette.niveaux) {
    const f = niveau.feuille
    let v = caches.get(f.cle)
    if (!v) { v = volumesDe(f); caches.set(f.cle, v) }
    const groupe = new THREE.Group()
    groupe.position.y = niveau.z
    if (options.animer) groupe.scale.y = 0.001

    ajouter(groupe, new THREE.Mesh(v.dalle, new THREE.MeshLambertMaterial()), { nature: 'dalle', niveau })
    const matMurs = new THREE.MeshLambertMaterial()
    for (const b of v.murs) {
      const mur = new THREE.Mesh(b.geometrie, matMurs)
      mur.position.y = DALLE + b.bas
      ajouter(groupe, mur, { nature: 'murs', niveau })
      const traits = new THREE.LineSegments(b.aretes, aretes)
      traits.position.y = mur.position.y
      groupe.add(traits)
    }
    f.pieces.forEach((piece, i) => {
      const sol = new THREE.Mesh(v.sols[i], new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }))
      sol.position.y = DALLE + 0.01
      ajouter(groupe, sol, { nature: 'piece', niveau, piece })
    })
    for (const o of f.ouvertures) {
      const haut = o.porte ? VANTAIL : LINTEAU - ALLEGE
      const materiau = o.porte
        ? new THREE.MeshLambertMaterial()
        : new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.6, depthWrite: false })
      const piece = new THREE.Mesh(new THREE.BoxGeometry(o.largeur - 0.04, haut, o.porte ? 0.05 : 0.04), materiau)
      piece.position.set(o.centre[0], DALLE + (o.porte ? 0 : ALLEGE) + haut / 2, o.centre[1])
      piece.rotation.y = -o.angle
      ajouter(groupe, piece, { nature: 'ouverture', niveau, ouverture: o })
    }
    scene.add(groupe)
    niveaux.push({ groupe, rang: niveau.rang })
  }

  const recolorer = () => {
    for (const [mesh, cible] of cibles) (mesh.material as THREE.MeshLambertMaterial).color.set(rappels.teinte(cible))
  }
  recolorer()

  // Le cadrage : tout le bâtiment, vu du sud-ouest et d'en haut.
  const b = maquette.boite
  const centre = new THREE.Vector3((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, (b.y0 + b.y1) / 2)
  const rayon = Math.max(4, Math.hypot(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) / 2)
  const recadrer = () => {
    const distance = rayon / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05
    camera.position.copy(centre).add(new THREE.Vector3(-0.62, 0.62, 0.9).normalize().multiplyScalar(distance))
    controles.target.copy(centre)
    controles.minDistance = rayon * 0.4
    controles.maxDistance = distance * 3
    controles.update()
  }
  recadrer()

  const taille = () => {
    const l = hote.clientWidth || 1, h = hote.clientHeight || 1
    renderer.setSize(l, h, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    camera.aspect = l / h
    camera.updateProjectionMatrix()
  }
  taille()
  const observateur = new ResizeObserver(taille)
  observateur.observe(hote)

  // Le survol : l'élément sous le pointeur, mis en valeur, et remonté à la vue.
  const rayons = new THREE.Raycaster()
  let survole: THREE.Mesh | null = null
  const toucher = (e: PointerEvent): THREE.Mesh | null => {
    const r = renderer.domElement.getBoundingClientRect()
    rayons.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
    const visibles = [...cibles.keys()].filter((m) => m.parent?.visible)
    return (rayons.intersectObjects(visibles, false)[0]?.object as THREE.Mesh | undefined) ?? null
  }
  const eclairer = (m: THREE.Mesh | null) => {
    if (m === survole) return
    if (survole) (survole.material as THREE.MeshLambertMaterial).emissive.set(0x000000)
    survole = m
    if (m) (m.material as THREE.MeshLambertMaterial).emissive.set(0x1d4ed8).multiplyScalar(0.22)
  }
  let depart: { x: number; y: number } | null = null
  const bouger = (e: PointerEvent) => {
    if (e.buttons) { eclairer(null); rappels.survol(null, 0, 0); return }
    const m = toucher(e)
    eclairer(m)
    const r = renderer.domElement.getBoundingClientRect()
    rappels.survol(m ? cibles.get(m)! : null, e.clientX - r.left, e.clientY - r.top)
  }
  const appuyer = (e: PointerEvent) => { depart = { x: e.clientX, y: e.clientY } }
  const lacher = (e: PointerEvent) => {
    if (depart && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) < 5) {
      const m = toucher(e)
      if (m) rappels.clic(cibles.get(m)!)
    }
    depart = null
  }
  const sortir = () => { eclairer(null); rappels.survol(null, 0, 0) }
  renderer.domElement.addEventListener('pointermove', bouger)
  renderer.domElement.addEventListener('pointerdown', appuyer)
  renderer.domElement.addEventListener('pointerup', lacher)
  renderer.domElement.addEventListener('pointerleave', sortir)

  // La boucle : la montée des niveaux, l'inertie des contrôles.
  const debut = performance.now()
  let image = 0
  const boucle = () => {
    image = requestAnimationFrame(boucle)
    if (options.animer) {
      const t = (performance.now() - debut) / 1000
      niveaux.forEach(({ groupe }, i) => {
        const k = Math.min(1, Math.max(0, (t - i * ECART) / MONTEE))
        groupe.scale.y = Math.max(0.001, 1 - (1 - k) ** 3)
      })
    }
    controles.update()
    renderer.render(scene, camera)
  }
  boucle()

  // Couper : les niveaux au-dessus disparaissent, et la vue descend sur ce qui reste.
  const couper = (jusqua: number | null) => {
    let haut = b.z0
    maquette.niveaux.forEach((n, i) => {
      const visible = jusqua == null || n.rang <= jusqua
      niveaux[i].groupe.visible = visible
      if (visible) haut = Math.max(haut, n.z + n.feuille.hauteur)
    })
    const y = (b.z0 + haut) / 2
    const dy = y - controles.target.y
    controles.target.y += dy
    camera.position.y += dy
    controles.update()
  }

  return {
    couper,
    recolorer,
    recadrer,
    detruire: () => {
      cancelAnimationFrame(image)
      observateur.disconnect()
      renderer.domElement.removeEventListener('pointermove', bouger)
      renderer.domElement.removeEventListener('pointerdown', appuyer)
      renderer.domElement.removeEventListener('pointerup', lacher)
      renderer.domElement.removeEventListener('pointerleave', sortir)
      controles.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose()
          const m = o.material as THREE.Material | THREE.Material[]
          for (const x of Array.isArray(m) ? m : [m]) x.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
