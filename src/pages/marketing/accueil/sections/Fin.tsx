import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACT } from '../contenu'
import { Apparition, Bouton, Conteneur, FOCUS, LienSite } from '../ui'

/**
 * L'appel final : une bande pleine largeur sur le quadrillage du héros, la
 * coche de Diagly, une phrase et deux portes, réserver une démo ou nous
 * écrire. Son fond bleu clair se prolonge dans le pied de page : pas de carte
 * aux coins arrondis posée au-dessus, qui ressemblait à un tiroir. C'est la dernière chose qu'on lit
 * avant le pied de page, sur l'accueil comme sur la page Fonctionnalités.
 */
export function AppelFinal({ demoIci = false }: { demoIci?: boolean }) {
  return (
    <section aria-labelledby="titre-fin" className="relative overflow-hidden bg-gradient-to-b from-white via-[#f6f9fe] to-[#f3f7fe] pb-20 pt-16 text-center sm:pb-28 sm:pt-24">
      {/* Le quadrillage du héros revient en fin de page, et le fond se prolonge dans le pied de page. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(1,103,234,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(1,103,234,0.07)_1px,transparent_1px)] [background-size:72px_72px] [background-position:center_top] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_45%,#000_25%,transparent_100%)]" />
      <Conteneur className="relative">
        <Apparition className="px-2">
          <div className="relative mx-auto max-w-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_-10px_rgba(1,103,234,0.45)] ring-1 ring-[#0167EA]/10">
              <img src="/diagly-mark.svg" alt="" aria-hidden="true" className="h-7 w-7" />
            </span>
            <h2 id="titre-fin" className="mt-7 text-balance text-[clamp(2.1rem,4.6vw,3.4rem)] font-medium leading-[1.05] tracking-[-0.04em] text-[#0b1220]">
              Prenez un immeuble que vous connaissez.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-[16.5px] leading-[1.65] text-[#6b7280]">
              Réservez une démo : nous vous montrons ce que Diagly en ferait, des plans au rapport. La démo est offerte.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Bouton href={demoIci ? '#demo' : undefined} to={demoIci ? undefined : '/#demo'} className="w-full px-6 sm:w-auto">
                Réserver une démo<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Bouton>
              <Bouton href={CONTACT} variante="contour" className="w-full px-6 sm:w-auto">Nous écrire</Bouton>
            </div>
          </div>
        </Apparition>
      </Conteneur>
    </section>
  )
}

/**
 * Le pied de page. Les liens légaux sont ceux de la version précédente ; les
 * pages qu'ils visent n'existent pas encore dans l'application (voir le
 * compte rendu de cette refonte).
 */
const COLONNES: { titre: string; liens: [string, string][] }[] = [
  { titre: 'Produit', liens: [['Fonctionnalités', '/fonctionnalites'], ['Métrés par l’IA', '/fonctionnalites#metres'], ['Relevé sur le terrain', '/fonctionnalites#releve'], ['Chiffrage', '/fonctionnalites#chiffrage'], ['Rapports', '/fonctionnalites#rapports'], ['App iPhone et iPad', '/fonctionnalites#app'], ['Tarifs', '/#tarifs']] },
  { titre: 'Ressources', liens: [['Blog', '/blog'], ['Questions fréquentes', '/#faq'], ['Aide et support', '/app/support'], ['Nous écrire', CONTACT]] },
  { titre: 'Compte', liens: [['Se connecter', '/login'], ['Créer un compte', '/register']] },
  { titre: 'Légal', liens: [['Mentions légales', '/mentions-legales'], ['Confidentialité', '/confidentialite'], ['Conditions générales', '/cgu']] },
]

export function PiedDePage() {
  const lien = cn('inline-flex min-h-11 items-center text-[14px] text-[#48484a] hover:text-[#0167EA]', FOCUS)
  return (
    <footer className="bg-[#f3f7fe] pb-10 pt-4">
      <Conteneur>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <img src="/diagly-logo.svg" alt="Diagly" width={101} height={32} className="h-8 w-auto" />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[#545458]">
              Le diagnostic de bâtiment, des plans au rapport chiffré. Conçu et hébergé en Suisse.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {COLONNES.map((c) => (
              <nav key={c.titre} aria-label={c.titre}>
                <p className="text-[13px] font-semibold text-[#1d1d1f]">{c.titre}</p>
                <ul className="mt-2">
                  {c.liens.map(([libelle, href]) => (
                    <li key={libelle}>
                      <LienSite to={href} className={lien}>{libelle}</LienSite>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-12 space-y-3 border-t border-black/[0.08] pt-6 text-[12px] leading-relaxed text-[#6e6e73]">
          <p>
            Les estimations produites par Diagly sont indicatives et ne remplacent ni un devis d’entreprise ni une
            expertise. Les prix proviennent de la base de votre bureau.
          </p>
          <p className="flex items-center gap-2">
            <img src="/diagly-mark.svg" alt="" aria-hidden="true" className="h-4 w-4" />
            © {new Date().getFullYear()} Diagly, un produit Finalyn. Tous droits réservés.
          </p>
        </div>
      </Conteneur>
    </footer>
  )
}
