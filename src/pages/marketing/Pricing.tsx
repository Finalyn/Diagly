import { Link } from 'react-router-dom'
import { ClipboardCheck, Check, ArrowLeft } from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'

const plans = [
  { name: 'Starter', price: 49, desc: 'Pour les independants', features: ['5 projets actifs', '1 utilisateur', 'Diagnostic terrain', 'Rapports PDF', 'Calcul metres', 'Support email'], cta: 'Commencer', highlight: false },
  { name: 'Pro', price: 129, desc: 'Pour les petites equipes', features: ['Projets illimites', '5 utilisateurs', 'Tout Starter', 'CRM batiments', 'Estimation CECB', 'Appels d\'offres', 'Plans interactifs', 'Support prioritaire'], cta: 'Essai gratuit 14 jours', highlight: true },
  { name: 'Studio', price: 290, desc: 'Pour les grands bureaux', features: ['Tout Pro', 'Utilisateurs illimites', 'API REST', 'Export donnees', 'SSO / SAML', 'Account manager dedie', 'Formation equipe'], cta: 'Contacter les ventes', highlight: false },
]

export function Pricing() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center"><ClipboardCheck className="h-5 w-5 text-white" /></div>
            <span className="text-xl font-bold">Diagly</span>
          </Link>
          <div className="flex gap-4">
            <Link to="/login"><Button variant="ghost">Connexion</Button></Link>
            <Link to="/register"><Button>Commencer</Button></Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Tarifs simples et transparents</h1>
        <p className="text-lg text-muted-foreground mb-12">Tous les prix sont en CHF, hors TVA. Sans engagement.</p>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <Card key={plan.name} className={`p-8 text-left ${plan.highlight ? 'border-primary border-2 relative' : ''}`}>
              {plan.highlight && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Recommande</Badge>}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{plan.desc}</p>
              <p className="text-4xl font-bold mt-4">{plan.price} <span className="text-base font-normal text-muted-foreground">CHF/mois</span></p>
              <Link to="/register"><Button className="w-full mt-6" variant={plan.highlight ? 'default' : 'outline'}>{plan.cta}</Button></Link>
              <ul className="mt-6 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500 shrink-0" />{f}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
