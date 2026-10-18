import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { CONTACT } from '../contenu'
import { Apparition, Bouton, Conteneur, FOCUS } from '../ui'

/** L'appel final : une seule proposition, sur fond sombre. */
export function AppelFinal() {
  return (
    <section aria-labelledby="titre-fin" className="relative overflow-hidden bg-[#0b1220] py-24 text-center text-white sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_100%,rgba(1,103,234,0.45)_0%,rgba(11,18,32,0)_70%)]" />
      <Conteneur className="relative">
        <Apparition className="mx-auto max-w-2xl">
          <img src="/diagly-mark.svg" alt="" aria-hidden="true" className="mx-auto h-12 w-12 rounded-xl bg-white p-2" />
          <h2 id="titre-fin" className="mt-6 text-balance text-[clamp(2rem,4.6vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.03em]">
            Prenez un immeuble que vous connaissez.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/70 sm:text-[19px]">
            Déposez ses plans, relevez-le, et comparez le rapport qui en sort avec celui que vous auriez rendu.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Bouton to="/register" className="w-full px-6 sm:w-auto">Créer un compte gratuit</Bouton>
            <Bouton to="/login" variante="clair" className="w-full px-6 sm:w-auto">Se connecter</Bouton>
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
  { titre: 'Produit', liens: [['Métrés par l’IA', '#metres'], ['Relevé sur le terrain', '#releve'], ['Chiffrage', '#chiffrage'], ['Rapports', '#rapports'], ['App iPhone et iPad', '#app'], ['Tarifs', '#tarifs']] },
  { titre: 'Ressources', liens: [['Questions fréquentes', '#faq'], ['Aide et support', '/app/support'], ['Nous écrire', CONTACT]] },
  { titre: 'Compte', liens: [['Se connecter', '/login'], ['Créer un compte', '/register']] },
  { titre: 'Légal', liens: [['Mentions légales', '/mentions-legales'], ['Confidentialité', '/confidentialite'], ['Conditions générales', '/cgu']] },
]

export function PiedDePage() {
  const lien = cn('inline-flex min-h-11 items-center text-[14px] text-[#48484a] hover:text-[#0167EA]', FOCUS)
  return (
    <footer className="border-t border-black/[0.06] bg-[#f5f7fa] pb-10 pt-14">
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
                      {href.startsWith('/')
                        ? <Link to={href} className={lien}>{libelle}</Link>
                        : <a href={href} className={lien}>{libelle}</a>}
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
