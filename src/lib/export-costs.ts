import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ApiProject, ApiDiagnosticItem } from './api-types'

const STATE_LABEL: Record<string, string> = {
  TRES_BON: 'Très bon', BON: 'Bon', MOYEN: 'Moyen', MAUVAIS: 'Mauvais',
}
const num = (v: string | null | undefined) => (v ? Number(v) : 0)
const chf = (n: number) =>
  new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n)

export interface CostTotals {
  ht: number
  honoraryPct: number
  honoraires: number
  reservePct: number
  reserve: number
  sousTotal: number
  tva: number
  total: number
}

function fileBase(project: ApiProject) {
  const slug = (project.name || 'diagnostic').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')
  return `couts-${slug || 'diagnostic'}`
}

/** Export PDF : en-tête projet + tableau des éléments + synthèse. */
export function exportCostsPdf(project: ApiProject, items: ApiDiagnosticItem[], t: CostTotals) {
  const doc = new jsPDF()

  doc.setFontSize(16); doc.setTextColor(30)
  doc.text('Diagly · Estimation des coûts', 14, 18)
  doc.setFontSize(10); doc.setTextColor(90)
  doc.text(project.name, 14, 26)
  const addr = [project.address, [project.postalCode, project.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  if (addr) doc.text(addr, 14, 31)

  autoTable(doc, {
    startY: 38,
    head: [['CFC', 'Élément', 'État', 'P.', 'Qté', 'Coût HT']],
    body: items.map(i => [
      i.cfcCode,
      i.cfcLabel,
      i.state ? (STATE_LABEL[i.state] ?? i.state) : 'À évaluer',
      i.priority ?? '',
      i.area != null ? String(i.area) : '',
      chf(num(i.estimatedCost)),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: { 5: { halign: 'right' } },
  })

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  autoTable(doc, {
    startY: afterTable + 8,
    body: [
      ['Travaux (HT)', chf(t.ht)],
      [`Honoraires (${t.honoraryPct}%)`, chf(t.honoraires)],
      [`Réserve (${t.reservePct}%)`, chf(t.reserve)],
      ['Sous-total', chf(t.sousTotal)],
      ['TVA 8.1%', chf(t.tva)],
      ['Total TTC', chf(t.total)],
    ],
    theme: 'plain',
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
    tableWidth: 'wrap',
    margin: { left: 14 },
  })

  const end = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(8); doc.setTextColor(150)
  doc.text('Estimation ±15%. Total = HT × (1 + honoraires) × (1 + réserve) × 1.081.', 14, end + 8)

  doc.save(`${fileBase(project)}.pdf`)
}
