/**
 * Les bâtiments d'un dossier, un bloc par adresse.
 *
 * Un dossier est parfois une barre d'immeubles : Champrilly 16-18-20 est une
 * seule affaire et trois entrées. Chacune porte sa surface de plancher, son
 * emprise, ses étages et ses logements ; le total alimente le devis.
 *
 * Le périmètre et la surface de façade restent sur le dossier : des bâtiments
 * mitoyens les partagent, et les additionner par bâtiment compterait les murs
 * mitoyens, qui ne voient pas le jour et ne reçoivent ni crépi ni échafaudage.
 */
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui'
import { cumulerLesBatiments, nomDuBatiment } from '@/lib/base-cfc/batiments'
import type { ApiBatiment } from '@/lib/api-types'

/** Un bâtiment neuf, prêt à être rempli. */
const batimentNeuf = (): ApiBatiment => ({
  id: `b-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
})

const nombreOuNull = (v: string): number | null => (v.trim() === '' ? null : Number(v))
const texte = (v: number | null | undefined) => (v == null ? '' : String(v))

/**
 * Les bâtiments du dossier, un bloc par adresse.
 *
 * Un dossier est parfois une barre d'immeubles : Champrilly 16-18-20 est une
 * seule affaire et trois entrées. Chacune porte sa surface de plancher, son
 * emprise, ses étages et ses logements ; le total alimente le devis. Le
 * périmètre et la façade restent dans « Dimensions » : des bâtiments mitoyens
 * les partagent, et les additionner compterait les murs mitoyens.
 */
export function BatimentsDuDossier({ batiments, onChange }: {
  batiments: ApiBatiment[]
  onChange: (b: ApiBatiment[]) => void
}) {
  const modifier = (i: number, champ: keyof ApiBatiment, v: string) =>
    onChange(batiments.map((b, n) => (n === i
      ? { ...b, [champ]: champ === 'adresse' ? v : nombreOuNull(v) }
      : b)))
  const cumul = batiments.length > 0 ? cumulerLesBatiments(batiments) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bâtiments du dossier</CardTitle>
        <p className="text-sm text-muted-foreground">
          Une adresse par bâtiment. Leurs surfaces, logements et cages s'additionnent pour
          le devis. Le périmètre et la façade restent ci-dessous : des bâtiments mitoyens
          les partagent.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {batiments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun : le dossier décrit un seul bâtiment, par les champs ci-dessous.
          </p>
        )}

        {batiments.map((b, i) => (
          <div key={b.id} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{nomDuBatiment(b, i)}</span>
              <button
                type="button"
                onClick={() => onChange(batiments.filter((_, n) => n !== i))}
                className="ml-auto text-muted-foreground hover:text-red-600"
                aria-label={`Retirer ${nomDuBatiment(b, i)}`}
              ><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Adresse</label>
                <Input value={b.adresse ?? ''} onChange={(e) => modifier(i, 'adresse', e.target.value)} placeholder="Avenue de Champrilly 18" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Plancher (m²)</label>
                <Input type="number" value={texte(b.floorArea)} onChange={(e) => modifier(i, 'floorArea', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Bâtie (m²)</label>
                <Input type="number" value={texte(b.builtArea)} onChange={(e) => modifier(i, 'builtArea', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Étages</label>
                <Input type="number" value={texte(b.nbFloors)} onChange={(e) => modifier(i, 'nbFloors', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Logements</label>
                <Input type="number" value={texte(b.nbApartments)} onChange={(e) => modifier(i, 'nbApartments', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Cages</label>
                <Input type="number" value={texte(b.nbStaircases)} onChange={(e) => modifier(i, 'nbStaircases', e.target.value)} />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChange([...batiments, batimentNeuf()])}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:bg-muted/50"
        ><Plus className="h-4 w-4" />Ajouter un bâtiment</button>

        {cumul && (
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="font-semibold">{cumul.nombre} bâtiments</span>
            <span className="text-muted-foreground">
              {' · '}{cumul.floorArea ?? 'n.c.'} m² plancher
              {' · '}{cumul.builtArea ?? 'n.c.'} m² bâti
              {' · '}{cumul.nbApartments ?? 'n.c.'} logements
              {' · '}{cumul.nbStaircases ?? 'n.c.'} cages
              {cumul.nbFloors != null && ` · ${cumul.nbFloors} étages au plus haut`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

