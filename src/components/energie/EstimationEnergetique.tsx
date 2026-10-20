import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui'
import { api } from '@/lib/api'
import type { ApiProject } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import {
  AGENTS, comparer, libelleAgent, libelleElement,
  type Categorie, type Etat, type Ligne, type Resultat,
} from '@/lib/energie/calcul'
import { assembler, ELEMENTS, type SaisieEnergie } from '@/lib/energie/entree'
import type { OuvrageReleve } from '@/lib/energie/depuis-diagnostic'
import { AvantApres } from './EtiquetteAG'

/**
 * Estimation énergétique indicative, méthode simplifiée inspirée du CECB.
 *
 * Ce n'est pas un CECB, et l'écran le dit en permanence, pas une fois en bas de
 * page. Un bureau qui montre une étiquette A à G à un propriétaire sera compris
 * comme montrant un certificat : l'avertissement doit tenir dans le même regard
 * que le résultat.
 *
 * Tout ce qui peut être repris du diagnostic l'est. Le reste se corrige ici, et
 * se range dans energyData du projet, pour que l'écran rouvre où on l'a laissé.
 */

const ETATS: { v: Etat; label: string; couleur: string }[] = [
  { v: 1, label: 'Très bon', couleur: 'bg-green-500' },
  { v: 2, label: 'Bon', couleur: 'bg-green-400' },
  { v: 3, label: 'Moyen', couleur: 'bg-orange-400' },
  { v: 4, label: 'Mauvais', couleur: 'bg-red-500' },
]

const CATEGORIES: { v: Categorie; label: string }[] = [
  { v: 'INDIVIDUEL', label: 'Habitat individuel' },
  { v: 'COLLECTIF', label: 'Habitat collectif' },
  { v: 'ADMINISTRATIF', label: 'Administratif' },
]

/* La saisie corrigée à la main et l'assemblage de l'entrée vivent dans
   `@/lib/energie/entree`, partagés avec le rapport. */

export function EstimationEnergetique({ project, ouvrages }: {
  project: ApiProject
  ouvrages: OuvrageReleve[]
}) {
  const queryClient = useQueryClient()
  const enregistre = (project.energyData?.estimation as SaisieEnergie | undefined) ?? {}
  const [saisie, setSaisie] = useState<SaisieEnergie>(enregistre)

  const sauver = useMutation({
    mutationFn: (s: SaisieEnergie) => api.projects.update(project.id, {
      energyData: { ...(project.energyData ?? {}), estimation: s },
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', project.id] }),
  })

  // On n'écrit pas à chaque frappe : la saisie se pose une seconde avant de partir.
  useEffect(() => {
    const t = setTimeout(() => {
      if (JSON.stringify(saisie) !== JSON.stringify(enregistre)) sauver.mutate(saisie)
    }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saisie])

  const modifier = (p: Partial<SaisieEnergie>) => setSaisie((s) => ({ ...s, ...p }))

  // Un seul assemblage, partagé avec le rapport : deux constructions séparées du
  // même bâtiment finiraient par donner deux classes selon l'écran regardé.
  const { entree, reprise, mesuresPossibles, cochees, avant, apres } = useMemo(
    () => assembler(project, ouvrages, saisie),
    [project, ouvrages, saisie],
  )

  const gain = comparer(avant, apres, entree.sre)

  const basculer = (cle: string) => modifier({
    mesures: cochees.includes(cle) ? cochees.filter((c) => c !== cle) : [...cochees, cle],
  })

  return (
    <div className="space-y-4 md:space-y-6">
      <Avertissement provisoire={avant.provisoire} />

      {/* ------------------------------------------------ données du bâtiment */}
      <Card>
        <CardHeader><CardTitle>Données du bâtiment</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Champ label="Année de construction">
            <Input
              type="number"
              value={entree.anneeConstruction}
              onChange={(e) => modifier({ anneeConstruction: Number(e.target.value) || null })}
            />
          </Champ>
          <Champ label="Catégorie">
            <Select value={entree.categorie} onChange={(e) => modifier({ categorie: e.target.value as Categorie })}>
              {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </Select>
          </Champ>
          <Champ label="Surface de référence énergétique" indice="m²">
            <Input
              type="number"
              value={entree.sre || ''}
              onChange={(e) => modifier({ sre: Number(e.target.value) || null })}
            />
          </Champ>
          <Champ label="Agent énergétique du chauffage">
            <Select value={entree.agentChauffage} onChange={(e) => modifier({ agentChauffage: e.target.value })}>
              {AGENTS.map((a) => <option key={a} value={a}>{libelleAgent(a)}</option>)}
            </Select>
          </Champ>
          <Champ label="Eau chaude sanitaire">
            <Select
              value={entree.agentEcs ?? ''}
              onChange={(e) => modifier({ agentEcs: e.target.value || null })}
            >
              <option value="">Combinée au chauffage</option>
              {AGENTS.map((a) => <option key={a} value={a}>Séparée, {libelleAgent(a).toLowerCase()}</option>)}
            </Select>
          </Champ>
          <Champ label="Photovoltaïque installé" indice="kWc, vide si aucun">
            <Input
              type="number"
              value={entree.photovoltaiqueKwc ?? ''}
              onChange={(e) => modifier({ photovoltaiqueKwc: Number(e.target.value) || null })}
            />
          </Champ>
        </CardContent>
      </Card>

      {/* --------------------------------------------- état énergétique actuel */}
      <Card>
        <CardHeader>
          <CardTitle>État énergétique actuel</CardTitle>
          <p className="text-sm text-muted-foreground">
            Repris du diagnostic. L'état retenu pour un élément est le plus mauvais des ouvrages qui le composent.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...ELEMENTS, 'production' as const].map((e) => {
            const estProduction = e === 'production'
            const etat = estProduction ? entree.etatProduction : entree.elements[e].etat
            const def = ETATS.find((x) => x.v === etat)!
            const manquant = reprise.manquants.includes(e)
            return (
              <div key={e} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5">
                <span className={cn('h-3 w-3 shrink-0 rounded-full', def.couleur)} />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {estProduction ? 'Production de chaleur' : libelleElement(e)}
                  {manquant && (
                    <span className="ml-2 text-xs font-normal text-orange-600">
                      aucun ouvrage relevé, valeur par défaut
                    </span>
                  )}
                </span>
                <Select
                  className="w-36"
                  value={String(etat)}
                  onChange={(ev) => modifier({ etats: { ...saisie.etats, [e]: Number(ev.target.value) as Etat } })}
                >
                  {ETATS.map((x) => <option key={x.v} value={x.v}>{x.v} · {x.label}</option>)}
                </Select>
                {!estProduction && (
                  <Input
                    className="w-32"
                    type="number"
                    placeholder="Rénové en"
                    value={saisie.renovations?.[e] ?? ''}
                    onChange={(ev) => modifier({
                      renovations: { ...saisie.renovations, [e]: Number(ev.target.value) || null },
                    })}
                  />
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- mesures proposées */}
      <Card>
        <CardHeader>
          <CardTitle>Mesures proposées</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cochées par défaut quand le diagnostic les justifie. Le résultat se recalcule à chaque changement.
          </p>
        </CardHeader>
        <CardContent className="space-y-1">
          {mesuresPossibles.map((m) => (
            <label key={m.cle} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <input
                type="checkbox"
                checked={cochees.includes(m.cle)}
                onChange={() => basculer(m.cle)}
                className="h-4 w-4 shrink-0 accent-[#0167EA]"
              />
              <span className="min-w-0 flex-1 text-sm">{m.libelle}</span>
              {m.conseillee && (
                <span className="shrink-0 rounded-full bg-[#0167EA]/10 px-2 py-0.5 text-[11px] font-medium text-[#0167EA]">
                  conseillée
                </span>
              )}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ résultats */}
      <Card>
        <CardHeader><CardTitle>Résultats</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <AvantApres
              titre="Enveloppe"
              avant={avant.enveloppe.classe}
              apres={apres.enveloppe.classe}
              valeurAvant={avant.enveloppe.qh}
              valeurApres={apres.enveloppe.qh}
            />
            <AvantApres
              titre="Global"
              avant={avant.global.classe}
              apres={apres.global.classe}
              valeurAvant={avant.global.energiePonderee}
              valeurApres={apres.global.energiePonderee}
            />
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-3 rounded-xl bg-muted/40 px-5 py-4">
            <Chiffre valeur={`${String(gain.gainPourcent).replace('.', ',')} %`} libelle="de gain estimé" />
            <Chiffre valeur={`${gain.economieParM2}`} libelle="kWh/m²·an économisés" />
            <Chiffre valeur={gain.economieParAn.toLocaleString('fr-CH').replace(/\s/g, "'")} libelle="kWh économisés par an" />
          </div>

          <VoirLeCalcul avant={avant} apres={apres} />
        </CardContent>
      </Card>
    </div>
  )
}

function Avertissement({ provisoire }: { provisoire: string[] }) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
      <p className="flex items-start gap-2.5 text-sm font-medium text-orange-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Estimation énergétique indicative, méthode simplifiée inspirée de celle du CECB®.
      </p>
      <p className="mt-1.5 pl-7 text-sm text-orange-900/80">
        Ce n'est pas un certificat. Seul un expert CECB certifié peut délivrer un certificat officiel.
      </p>
      {provisoire.length > 0 && (
        <p className="mt-2 pl-7 text-xs text-orange-900/70">
          Tables de calcul encore provisoires : {provisoire.join(', ')}. La classe globale est à lire
          comme un ordre de grandeur tant que les valeurs officielles ne sont pas renseignées.
        </p>
      )}
    </div>
  )
}

function Champ({ label, indice, children }: { label: string; indice?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {indice && <span className="ml-1 font-normal text-muted-foreground">({indice})</span>}
      </span>
      {children}
    </label>
  )
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-xl font-bold tabular-nums">{valeur}</span>
      <span className="text-xs text-muted-foreground">{libelle}</span>
    </span>
  )
}

/**
 * La trace du calcul.
 *
 * Une estimation qu'on ne peut pas ouvrir ne se discute pas avec un propriétaire,
 * et ne se corrige pas quand un paramètre se révèle faux.
 */
function VoirLeCalcul({ avant, apres }: { avant: Resultat; apres: Resultat }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="border-t pt-3">
      <button
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex items-center gap-1.5 text-sm font-medium text-[#0167EA] hover:underline"
      >
        {ouvert ? 'Masquer le calcul' : 'Voir le calcul'}
        <ChevronDown className={cn('h-4 w-4 transition-transform', ouvert && 'rotate-180')} aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <Trace titre="Aujourd'hui" resultat={avant} />
          <Trace titre="Après les mesures cochées" resultat={apres} />
        </div>
      )}
    </div>
  )
}

function Trace({ titre, resultat }: { titre: string; resultat: Resultat }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titre}</p>
      <Lignes titre="Enveloppe" lignes={resultat.enveloppe.lignes} />
      <Lignes titre="Global" lignes={resultat.global.lignes} />
    </div>
  )
}

function Lignes({ titre, lignes }: { titre: string; lignes: Ligne[] }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-sm font-medium">{titre}</p>
      <div className="space-y-1">
        {lignes.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 border-b border-dashed py-1 text-xs">
            <span className="min-w-0">
              <span className="font-medium">{l.libelle}</span>
              <span className="ml-2 text-muted-foreground">{l.detail}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {l.valeur}{l.unite ? ` ${l.unite}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
