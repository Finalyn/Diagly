import { cn } from '@/lib/utils'
import { Apparition, Conteneur, EnTeteCentre } from '../ui'
import { typo } from '../typo'

/**
 * Normes et sécurité, en mosaïque : six tuiles, chacune portée par un grand
 * mot (CFC, SIA 416, 8,1 %, CH, 2FA, les rôles) et une phrase. Deux tuiles
 * larges, sur un quadrillage (la première en bleu), donnent le rythme.
 * Chaque tuile décrit un fait vérifiable dans le code ou l'hébergement ; la
 * dernière, sur toute la largeur, dit où partent les analyses par l'IA (aux
 * États-Unis, chez Anthropic) et qu'on peut s'en passer, plutôt que de
 * laisser croire que tout reste en Suisse.
 */

const TUILES: { mot: string; titre: string; texte: string; large?: boolean; bleu?: boolean; etiquettes?: string[] }[] = [
  { mot: 'CFC', titre: 'La nomenclature des travaux', texte: 'Chaque ouvrage porte son code CFC, son unité et sa quantité. Rapports et exports suivent la même structure.', large: true, bleu: true },
  { mot: 'SIA 416', titre: 'Les surfaces', texte: 'SP, SN et SC, étage par étage.' },
  { mot: '8,1 %', titre: 'La TVA suisse', texte: 'Appliquée en cascade, après honoraires et réserve.' },
  { mot: 'CH', titre: 'Hébergé en Suisse', texte: 'Vos dossiers, photos et plans restent en Suisse, chez Infomaniak.', large: true, etiquettes: ['Infomaniak', 'Connexion chiffrée'] },
  { mot: '2FA', titre: 'Double authentification', texte: 'Par application ou par code reçu par e-mail.' },
  { mot: '4 rôles', titre: 'Les droits de chacun', texte: 'Propriétaire, administrateur, membre ou lecture seule.' },
]

export function Confiance() {
  return (
    <section id="confiance" aria-labelledby="titre-confiance" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Conteneur>
        <EnTeteCentre
          id="titre-confiance"
          titre="Aux normes suisses, en sécurité."
          sousTitre="Conçu en Suisse romande, pour les normes et les usages des bureaux suisses. Vos dossiers restent à vous."
        />
        <ul className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
          {TUILES.map((t, i) => (
            <Apparition
              as="li"
              key={t.mot}
              delai={(i % 3) * 80}
              className={cn(
                'relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[28px] p-7',
                t.large && 'sm:col-span-2',
                t.bleu ? 'bg-gradient-to-br from-[#0167EA] via-[#0b5bd3] to-[#0b3d8f] text-white' : t.large ? 'bg-[#eef5ff] text-[#0b1220]' : 'bg-[#f4f5f7] text-[#0b1220]',
              )}
            >
              {t.large && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-0 [background-size:44px_44px] [mask-image:linear-gradient(to_left,#000,transparent_80%)]',
                    t.bleu
                      ? '[background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)]'
                      : '[background-image:linear-gradient(to_right,rgba(1,103,234,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(1,103,234,0.08)_1px,transparent_1px)]',
                  )}
                />
              )}
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <p
                  aria-hidden="true"
                  className={cn(
                    'whitespace-nowrap font-medium leading-none tracking-[-0.055em]',
                    t.large ? 'text-[clamp(3rem,6vw,4.75rem)]' : 'text-[clamp(2.4rem,3.4vw,3rem)]',
                    t.bleu ? 'text-white' : 'text-[#0167EA]',
                  )}
                >
                  {t.mot}
                </p>
                {t.etiquettes && (
                  <ul className="flex flex-wrap gap-1.5">
                    {t.etiquettes.map((e) => <li key={e} className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#0b1220] ring-1 ring-black/[0.06]">{e}</li>)}
                  </ul>
                )}
              </div>
              <div className="relative mt-8">
                <h3 className={cn('text-[17px] font-semibold tracking-[-0.01em]', t.bleu ? 'text-white' : 'text-[#0b1220]')}>{t.titre}</h3>
                <p className={cn('mt-1 max-w-[30rem] text-[14.5px] leading-[1.55]', t.bleu ? 'text-white/75' : 'text-[#6b7280]')}>{typo(t.texte)}</p>
              </div>
            </Apparition>
          ))}
        </ul>
        {/* L'IA, dite en toutes lettres : où partent les données, et qu'on peut s'en passer. */}
        <Apparition className="mt-4 grid gap-6 rounded-[28px] bg-[#f4f5f7] p-7 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-10 sm:p-9">
          <p aria-hidden="true" className="text-[clamp(3rem,6vw,4.75rem)] font-medium leading-none tracking-[-0.055em] text-[#0167EA]">IA</p>
          <div>
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#0b1220]">L’IA, en toute transparence</h3>
            <p className="mt-1.5 max-w-[52rem] text-[14.5px] leading-[1.6] text-[#6b7280]">
              {typo('Quand vous lancez une analyse par l’IA (plans, photos, documents, questions à l’assistant), les éléments concernés sont envoyés à notre fournisseur, Anthropic, aux États-Unis, pour y être analysés. Vos dossiers, eux, restent stockés en Suisse. Et l’IA reste facultative : le Guide IA se règle sur « Sans guide », et le relevé, le chiffrage et les rapports fonctionnent sans elle.')}
            </p>
          </div>
        </Apparition>
      </Conteneur>
    </section>
  )
}
