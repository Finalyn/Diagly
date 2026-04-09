import { Link } from 'react-router-dom'
import {
  ClipboardCheck, Building2, FileText, Zap, ArrowRight, Check, Ruler,
  Camera, BarChart3, Shield, Users, Star, Mail, ChevronRight,
  Smartphone, Cloud, Lock
} from 'lucide-react'
import { Button } from '@/components/ui'

export function Landing() {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-gray-900">Diagly</span>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Fonctionnalites</a>
              <a href="#how" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Comment ca marche</a>
              <Link to="/tarifs" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Tarifs</Link>
              <a href="#testimonials" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Temoignages</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" className="text-sm">Connexion</Button></Link>
            <Link to="/register"><Button className="text-sm rounded-full px-6">Essai gratuit</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-100/60 via-violet-50/40 to-transparent rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-orange-100/40 to-transparent rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              Plateforme pour les professionnels du batiment
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight">
              Diagnostiquez.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">Renovez.</span><br />
              Simplement.
            </h1>
            <p className="text-lg text-gray-600 mt-6 max-w-lg leading-relaxed">
              Diagly accompagne les directeurs de travaux, regies et architectes suisses du diagnostic terrain au devis final. Tout-en-un, sur le terrain et au bureau.
            </p>
            <div className="flex items-center gap-4 mt-8">
              <Link to="/register">
                <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-lg shadow-blue-500/25">
                  Commencer gratuitement <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <button className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <div className="h-0 w-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-gray-700 ml-0.5" />
                </div>
                Voir la demo
              </button>
            </div>
            <div className="flex items-center gap-6 mt-8 pt-6 border-t border-gray-100">
              <div className="flex -space-x-2">
                {['SB', 'MD', 'JF', 'PL'].map((initials, i) => (
                  <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">{initials}</div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}</div>
                <p className="text-xs text-gray-500 mt-0.5">Utilise par <strong>500+</strong> professionnels en Suisse</p>
              </div>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/60 border border-gray-200/60 overflow-hidden">
              {/* Mockup header bar */}
              <div className="h-8 bg-gray-50 border-b border-gray-100 flex items-center px-3 gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <div className="flex-1 flex justify-center"><div className="h-4 w-40 rounded bg-gray-200" /></div>
              </div>
              {/* Mockup content */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Projets actifs', value: '12', color: 'from-blue-500 to-blue-600' },
                    { label: 'Priorite I', value: '7', color: 'from-red-500 to-red-600' },
                    { label: 'Budget total', value: '2.4M', color: 'from-green-500 to-green-600' },
                    { label: 'CECB', value: '4', color: 'from-violet-500 to-violet-600' },
                  ].map(card => (
                    <div key={card.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[9px] text-gray-500">{card.label}</p>
                      <p className={`text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
                {/* Chart mockup */}
                <div className="bg-gray-50 rounded-lg p-3 h-32">
                  <p className="text-[9px] text-gray-500 mb-2">Budget mensuel</p>
                  <div className="flex items-end gap-1.5 h-20">
                    {[40, 55, 45, 35, 30, 60, 70, 65, 35, 50, 55, 62].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col gap-0.5 justify-end">
                        <div className="bg-blue-200 rounded-t" style={{ height: `${h * 0.7}%` }} />
                        <div className="bg-blue-500 rounded-t" style={{ height: `${h}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Table rows mockup */}
                <div className="space-y-1.5">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <div className={`h-2 w-2 rounded-full ${i === 1 ? 'bg-blue-500' : i === 2 ? 'bg-green-500' : 'bg-violet-500'}`} />
                      <div className="h-2.5 rounded bg-gray-200 flex-1" />
                      <div className="h-2.5 w-16 rounded bg-gray-200" />
                      <div className="h-5 w-14 rounded-full bg-gray-200" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Floating card */}
            <div className="absolute -bottom-6 -left-8 bg-white rounded-xl shadow-xl border border-gray-100 p-4 w-48">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center"><Check className="h-4 w-4 text-green-600" /></div>
                <span className="text-xs font-semibold text-gray-900">Diagnostic termine</span>
              </div>
              <p className="text-[10px] text-gray-500">Residence du Lac - 8 elements</p>
              <p className="text-sm font-bold text-gray-900 mt-1">1 417 000 CHF</p>
            </div>
            {/* Floating card 2 */}
            <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-36">
              <p className="text-[10px] text-gray-500">CECB Estime</p>
              <div className="flex gap-0.5 mt-1">
                {['A','B','C','D'].map(g => (
                  <div key={g} className={`h-5 flex-1 rounded text-[8px] text-white font-bold flex items-center justify-center ${g === 'D' ? 'bg-orange-400 ring-1 ring-orange-500' : g === 'A' ? 'bg-green-500 opacity-40' : g === 'B' ? 'bg-green-400 opacity-40' : 'bg-yellow-400 opacity-40'}`}>{g}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gray-50/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '500+', label: 'Professionnels actifs' },
              { value: '2 800', label: 'Projets realises' },
              { value: '15k+', label: 'Diagnostics terrain' },
              { value: '98%', label: 'Clients satisfaits' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 mb-2">Fonctionnalites</p>
            <h2 className="text-4xl font-bold text-gray-900">Tout pour vos projets de renovation</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">De la premiere visite au rapport final, Diagly centralise chaque etape de vos projets de renovation en Suisse.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ClipboardCheck, title: 'Diagnostic terrain', desc: 'Evaluez chaque element du batiment sur votre smartphone. Etats, priorites et couts calcules automatiquement.', color: 'bg-blue-100 text-blue-600' },
              { icon: Ruler, title: 'Metres automatiques', desc: 'Calcul automatique des surfaces (facade, toiture, echafaudage) selon les codes CFC suisses.', color: 'bg-violet-100 text-violet-600' },
              { icon: Camera, title: 'Plans PDF interactifs', desc: 'Importez vos plans, mesurez des surfaces et longueurs, annotez et exportez en PDF annote.', color: 'bg-orange-100 text-orange-600' },
              { icon: Building2, title: 'CRM Parc immobilier', desc: 'Gerez vos batiments, historique des travaux par appartement, suivi des locataires.', color: 'bg-green-100 text-green-600' },
              { icon: FileText, title: 'Rapports PDF', desc: 'Generez des rapports diagnostics et devis quantitatifs professionnels en un clic.', color: 'bg-red-100 text-red-600' },
              { icon: Zap, title: 'Estimation CECB', desc: 'Estimation indicative de la performance energetique basee sur votre diagnostic.', color: 'bg-yellow-100 text-yellow-700' },
            ].map(f => (
              <div key={f.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
                <div className={`h-12 w-12 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                <button className="flex items-center gap-1 text-sm font-medium text-blue-600 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  En savoir plus <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - split layout */}
      <section id="how" className="py-24 bg-gray-50/80 relative overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-l from-blue-100/50 to-transparent rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 mb-2">Comment ca marche</p>
            <h2 className="text-4xl font-bold text-gray-900">Du terrain au devis en 3 etapes</h2>
          </div>

          <div className="space-y-20">
            {/* Step 1 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white font-bold text-lg mb-4">1</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Diagnostic terrain sur smartphone</h3>
                <p className="text-gray-600 leading-relaxed mb-6">Parcourez chaque element du batiment avec votre telephone. Prenez des photos, evaluez l'etat et la priorite. Les couts sont calcules automatiquement selon les codes CFC.</p>
                <ul className="space-y-3">
                  {['Arborescence CFC 3 niveaux', 'Photos + notes par element', 'Calcul automatique des couts', 'Mode hors ligne complet'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-blue-600" /></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="space-y-3">
                  {[
                    { code: '271', label: 'Couverture toiture', state: 'Mauvais', priority: 'I', cost: '145 000 CHF', stateColor: 'bg-red-500' },
                    { code: '283', label: 'Isolation facade', state: 'Mauvais', priority: 'I', cost: '644 000 CHF', stateColor: 'bg-red-500' },
                    { code: '312', label: 'Fenetres PVC', state: 'Moyen', priority: 'II', cost: '180 000 CHF', stateColor: 'bg-orange-400' },
                    { code: '521', label: 'Production chaleur', state: 'Mauvais', priority: 'I', cost: '65 000 CHF', stateColor: 'bg-red-500' },
                  ].map(item => (
                    <div key={item.code} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                      <span className="font-mono text-xs text-gray-500 w-8">{item.code}</span>
                      <div className="flex-1"><p className="text-sm font-medium">{item.label}</p></div>
                      <span className={`h-2.5 w-2.5 rounded-full ${item.stateColor}`} />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${item.priority === 'I' ? 'bg-red-500' : 'bg-orange-500'}`}>{item.priority}</span>
                      <span className="text-sm font-semibold">{item.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex gap-1 mb-4">
                  {['A','B','C','D','E','F','G'].map(g => (
                    <div key={g} className={`h-10 flex-1 rounded flex items-center justify-center text-white font-bold text-sm ${g === 'D' ? 'ring-2 ring-offset-2 ring-orange-400' : 'opacity-30'} ${g === 'A' ? 'bg-green-600' : g === 'B' ? 'bg-green-500' : g === 'C' ? 'bg-yellow-400' : g === 'D' ? 'bg-orange-400' : g === 'E' ? 'bg-orange-500' : g === 'F' ? 'bg-red-400' : 'bg-red-600'}`}>{g}</div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 rounded-xl bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Surface facade</p>
                    <p className="text-lg font-bold">2 800 m2</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Echafaudage</p>
                    <p className="text-lg font-bold">4 914 m2</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Toiture plate</p>
                    <p className="text-lg font-bold">580 m2</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Fenetres</p>
                    <p className="text-lg font-bold">840 m2</p>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-violet-600 text-white font-bold text-lg mb-4">2</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Metres et calculs automatiques</h3>
                <p className="text-gray-600 leading-relaxed mb-6">Les surfaces et quantites sont calculees automatiquement a partir des dimensions du batiment. Facades, toiture, echafaudage, fenetres - tout est recalcule en temps reel.</p>
                <ul className="space-y-3">
                  {['Calcul facade, toiture, echafaudage', 'Slider % fenetres (10-60%)', 'Codes CFC avec prix suisses', 'Total HT + honoraires + reserve + TVA 8.1%'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <div className="h-5 w-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-violet-600" /></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-orange-500 text-white font-bold text-lg mb-4">3</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Rapports et appels d'offres</h3>
                <p className="text-gray-600 leading-relaxed mb-6">Generez des rapports PDF professionnels, envoyez vos appels d'offres et comparez les devis recus. Tout est centralise dans votre espace projet.</p>
                <ul className="space-y-3">
                  {['Rapport diagnostic PDF complet', 'Devis quantitatif par CFC', 'Envoi AO et comparatif', 'Suivi planning Gantt'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <div className="h-5 w-5 rounded-full bg-orange-100 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-orange-600" /></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-3">
                {[
                  { name: 'Rapport diagnostic', type: 'PDF', status: 'Genere', color: 'bg-green-100 text-green-700' },
                  { name: 'Devis estimatif', type: 'PDF', status: 'Genere', color: 'bg-green-100 text-green-700' },
                  { name: 'AO Lot 1 - Toiture', type: 'AO', status: '3 offres recues', color: 'bg-blue-100 text-blue-700' },
                  { name: 'AO Lot 2 - Facade', type: 'AO', status: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
                ].map(doc => (
                  <div key={doc.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <FileText className="h-5 w-5 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-[11px] text-gray-500">{doc.type}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${doc.color}`}>{doc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Extras */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 mb-2">Pourquoi Diagly</p>
            <h2 className="text-4xl font-bold text-gray-900">Concu pour le terrain suisse</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Smartphone, title: 'Mobile-first', desc: 'Application mobile React Native avec mode hors ligne complet. Diagnostiquez meme sans reseau.' },
              { icon: Shield, title: 'Donnees securisees', desc: 'Hebergement en Suisse, chiffrement de bout en bout. Conforme aux exigences legales suisses.' },
              { icon: BarChart3, title: 'Codes CFC suisses', desc: 'Base de prix integree selon les standards CFC. Personnalisable par region et fournisseur.' },
            ].map(f => (
              <div key={f.title} className="text-center p-8 rounded-2xl bg-gray-50/80">
                <div className="h-14 w-14 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-5">
                  <f.icon className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-gray-50/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 mb-2">Tarifs</p>
            <h2 className="text-4xl font-bold text-gray-900">Des offres simples et transparentes</h2>
            <p className="text-gray-600 mt-4">Sans engagement. Tous les prix sont en CHF, hors TVA.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name: 'Starter', price: '49', desc: 'Pour les independants', features: ['5 projets actifs', '1 utilisateur', 'Diagnostic terrain', 'Rapports PDF', 'Calcul metres'], highlight: false },
              { name: 'Pro', price: '129', desc: 'Pour les petites equipes', features: ['Projets illimites', '5 utilisateurs', 'Tout Starter', 'CRM batiments', 'Estimation CECB', 'Appels d\'offres', 'Plans interactifs'], highlight: true },
              { name: 'Studio', price: '290', desc: 'Pour les grands bureaux', features: ['Tout Pro', 'Utilisateurs illimites', 'API REST', 'SSO / SAML', 'Account manager dedie'], highlight: false },
            ].map(plan => (
              <div key={plan.name} className={`rounded-2xl p-8 ${plan.highlight ? 'bg-white shadow-xl shadow-blue-100/50 border-2 border-blue-500 relative scale-105' : 'bg-white border border-gray-200'}`}>
                {plan.highlight && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full">Recommande</div>}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{plan.desc}</p>
                <p className="mt-6"><span className="text-4xl font-bold text-gray-900">{plan.price}</span><span className="text-gray-500 ml-1">CHF/mois</span></p>
                <Link to="/register"><Button className={`w-full mt-6 rounded-full ${plan.highlight ? '' : 'bg-gray-900 hover:bg-gray-800'}`}>Commencer</Button></Link>
                <ul className="mt-6 space-y-3">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700"><Check className="h-4 w-4 text-blue-500 shrink-0" />{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 mb-2">Temoignages</p>
            <h2 className="text-4xl font-bold text-gray-900">Ce qu'en disent nos clients</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Marc Dubois', role: 'Architecte, Lausanne', quote: 'Diagly a divise par 3 le temps de nos diagnostics terrain. L\'arborescence CFC et le calcul automatique des metres sont un vrai gain de productivite.' },
              { name: 'Anne Schneider', role: 'Regie immobiliere, Geneve', quote: 'Le CRM batiments nous permet de suivre tout l\'historique des interventions par appartement. Indispensable pour notre parc de 200 logements.' },
              { name: 'Pierre Muller', role: 'Directeur de travaux, Fribourg', quote: 'Les rapports PDF generes automatiquement sont tres professionnels. Mes clients sont impressionnes par la qualite et la rapidite.' },
            ].map(t => (
              <div key={t.name} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex gap-0.5 mb-4">{[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}</div>
                <p className="text-gray-700 text-sm leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-xs font-bold flex items-center justify-center">{t.name.split(' ').map(n => n[0]).join('')}</div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-violet-700 rounded-3xl p-12 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
            <h2 className="text-3xl font-bold mb-4 relative">Pret a simplifier vos diagnostics ?</h2>
            <p className="text-blue-100 mb-8 max-w-lg mx-auto relative">Rejoignez les 500+ professionnels du batiment en Suisse qui utilisent Diagly au quotidien. Essai gratuit de 14 jours.</p>
            <div className="flex items-center justify-center gap-4 relative">
              <Link to="/register"><Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 rounded-full px-8 h-12 text-base font-semibold">Commencer gratuitement</Button></Link>
            </div>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-blue-200 relative">
              <span className="flex items-center gap-1"><Check className="h-4 w-4" />14 jours gratuits</span>
              <span className="flex items-center gap-1"><Check className="h-4 w-4" />Sans carte de credit</span>
              <span className="flex items-center gap-1"><Check className="h-4 w-4" />Annulation libre</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <span className="text-xl font-bold text-white">Diagly</span>
              <p className="text-sm mt-3 leading-relaxed">Plateforme SaaS pour le diagnostic et la renovation de batiments en Suisse romande.</p>
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-4">Produit</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Fonctionnalites</a></li>
                <li><Link to="/tarifs" className="hover:text-white transition-colors">Tarifs</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Mobile</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-4">Entreprise</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">A propos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carrieres</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-4">Legal</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Conditions generales</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Politique de confidentialite</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Mentions legales</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex items-center justify-between text-sm">
            <span>2026 Diagly SA - Lausanne, Suisse</span>
            <span>Fait avec soin en Suisse romande</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
