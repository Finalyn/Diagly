import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, CreditCard, Check, Shield } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Badge } from '@/components/ui'

export function Payment() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold">Diagly</span>
            </div>
            <CardTitle>Paiement</CardTitle>
            <p className="text-sm text-muted-foreground">Finalisez votre inscription avec le plan Pro.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
              <div className="flex justify-between items-center">
                <div>
                  <Badge>Plan Pro</Badge>
                  <p className="text-2xl font-bold mt-2">129 CHF <span className="text-sm font-normal text-muted-foreground">/mois</span></p>
                </div>
                <Check className="h-6 w-6 text-primary" />
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>Diagnostics illimites</li>
                <li>5 utilisateurs</li>
                <li>CRM batiments + CECB</li>
              </ul>
            </div>

            <div className="pt-2 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Numero de carte</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="4242 4242 4242 4242" className="pl-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Date d'expiration</label>
                  <Input placeholder="MM/AA" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">CVC</label>
                  <Input placeholder="123" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nom sur la carte</label>
                <Input placeholder="Sophie Berger" />
              </div>
            </div>

            <Button className="w-full" onClick={() => navigate('/onboarding')}>
              Payer 129 CHF / mois
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Paiement securise via Stripe. Sans engagement, annulez a tout moment.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Recapitulatif</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span>Plan Pro (mensuel)</span><span className="font-medium">129.00 CHF</span></div>
              <div className="flex justify-between text-sm"><span>TVA (8.1%)</span><span>10.45 CHF</span></div>
              <div className="flex justify-between text-base font-bold border-t pt-3"><span>Total</span><span>139.45 CHF</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold">Essai gratuit de 14 jours</h3>
              <p className="text-sm text-muted-foreground">Vous ne serez pas debite avant la fin de votre periode d'essai. Annulez a tout moment.</p>
              <ul className="text-sm space-y-2">
                {['Acces complet a toutes les fonctionnalites', 'Support prioritaire', 'Aucun engagement'].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" />{f}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
