/**
 * Le devis d'un dossier, tel que tous les documents le lisent.
 *
 * Le rapport complet, le devis original, l'onglet Coûts, le lien de partage
 * et le contrôle avant envoi passent tous par ici : mêmes relevés, recalés
 * sur la fiche du bâtiment, mêmes majorations, même calcul. Un dossier ne peut
 * plus sortir deux totaux.
 */
import { buildDevis, enveloppeDe, type BaseDuDevis, type Devis, type DevisOptions } from './devis'
import { donneesDuBatiment } from './base-cfc/batiment'
import type { DonneesBatiment } from './base-cfc/quantites'
import { appliquerRecalculs, recalculsDuBatiment, type Recalcul } from './base-cfc/quantite-comptee'
import type { ApiDiagnosticItem, ApiProject } from './api-types'

/** Les majorations du dossier, telles que le devis les attend. */
export function optionsDuDevis(project: ApiProject, batiment = donneesDuBatiment(project)): DevisOptions {
  return {
    honoraryPct: project.honoraryPct,
    reservePct: project.reservePct,
    batiment,
    frais: project.majorations?.frais ?? [],
    installation: project.majorations?.installation ?? undefined,
    prixPostes: project.majorations?.prixPostes ?? null,
  }
}

export interface DossierChiffre {
  /** Les relevés, quantités recalées sur la fiche du bâtiment. */
  items: ApiDiagnosticItem[]
  /** Ce qu'il reste à écrire sur les relevés pour qu'ils disent la même chose. */
  recalculs: Recalcul[]
  batiment: DonneesBatiment
  devis: Devis
}

/**
 * Les relevés recalés, puis le devis.
 *
 * Un relevé ne se recalait que lorsqu'on l'ouvrait dans l'éditeur : une
 * façade corrigée dans la fiche laissait au devis les quantités d'avant. Le
 * calcul se fait donc ici, à chaque lecture, et les relevés qui ont changé
 * sont ensuite réécrits (useDevisDuDossier).
 */
export function chiffrerLeDossier(
  project: ApiProject,
  items: ApiDiagnosticItem[],
  base: BaseDuDevis,
  labels: Map<string, string>,
): DossierChiffre {
  const batiment = donneesDuBatiment(project)
  const recalculs = base.articles.length > 0 ? recalculsDuBatiment(items, base.articles, batiment) : []
  const aJour = appliquerRecalculs(items, recalculs)
  return { items: aJour, recalculs, batiment, devis: buildDevis(aJour, labels, base, optionsDuDevis(project, batiment)) }
}

/**
 * Le chiffrage du devis, pour l'export Excel, CSV ou JSON : le serveur le
 * reprend à la place du sien, et l'export dit le même total que le rapport.
 */
export function chiffragePourLExport(devis: Devis, project: Pick<ApiProject, 'honoraryPct' | 'reservePct'>) {
  const c = devis.cascade
  return {
    htPostes: enveloppeDe(devis, 'Poste de chantier').ht,
    htRepair: enveloppeDe(devis, 'Réparation').ht,
    htNorms: enveloppeDe(devis, 'Mise aux normes').ht,
    htImprovement: enveloppeDe(devis, 'Amélioration').ht,
    ht: devis.ht,
    honoraryPct: project.honoraryPct ?? 0,
    honoraires: c.honoraires,
    reservePct: project.reservePct ?? 0,
    reserve: c.reserve,
    frais: c.frais,
    detailFrais: c.detailFrais,
    sousTotal: c.sousTotal,
    tva: c.tva,
    total: c.total,
    byPriority: devis.priorites
      .filter((p): p is typeof p & { cle: 'I' | 'II' | 'III' } => p.cle !== 'NC')
      .map((p) => ({ priority: p.cle, total: p.ht, count: p.lignes })),
  }
}
