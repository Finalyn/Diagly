import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Building2, Users, ArrowRight, Check, Upload } from 'lucide-react'
import { Button, Card, CardContent, Input, Select } from '@/components/ui'

const steps = [
  { icon: Building2, title: 'Votre entreprise', desc: 'Configurez les informations de votre societe.' },
  { icon: Users, title: 'Votre equipe', desc: 'Invitez vos collaborateurs.' },
  { icon: ClipboardCheck, title: 'Premier diagnostic', desc: 'Creez votre premier diagnostic.' },
]

export function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <header className="h-16 border-b bg-white flex items-center px-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">Diagly</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>
              <span className={`text-sm hidden md:block ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>{s.title}</span>
              {i < steps.length - 1 && <div className="w-12 h-0.5 bg-muted mx-2" />}
            </div>
          ))}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              {(() => { const Icon = steps[step].icon; return <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><Icon className="h-8 w-8 text-primary" /></div> })()}
              <h2 className="text-2xl font-bold">{steps[step].title}</h2>
              <p className="text-muted-foreground mt-1">{steps[step].desc}</p>
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nom de l'entreprise</label>
                  <Input placeholder="Berger & Fils SA" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Ville</label>
                    <Input placeholder="Lausanne" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Canton</label>
                    <Select>
                      {['VD', 'GE', 'FR', 'NE', 'VS', 'BE', 'JU', 'ZH'].map(c => <option key={c}>{c}</option>)}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Telephone</label>
                  <Input placeholder="+41 21 312 45 67" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Logo (optionnel)</label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Glisser-deposer ou cliquer pour telecharger</p>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Invitez des membres de votre equipe. Vous pourrez en ajouter d'autres plus tard.</p>
                {[0, 1, 2].map(i => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <Input placeholder="Email" />
                    <Select>
                      <option>Directeur de travaux</option>
                      <option>Architecte</option>
                      <option>Regie</option>
                      <option>Lecture seule</option>
                    </Select>
                  </div>
                ))}
                <button className="text-sm text-primary hover:underline">+ Ajouter un membre</button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nom du diagnostic</label>
                  <Input placeholder="Ex: Renovation Residence du Lac" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Adresse du batiment</label>
                  <Input placeholder="Rechercher une adresse..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Type</label>
                    <Select>
                      <option>Logement</option>
                      <option>Scolaire</option>
                      <option>Administratif</option>
                      <option>Hotel</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Annee construction</label>
                    <Input type="number" placeholder="1975" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8">
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>Precedent</Button>
              ) : (
                <Button variant="ghost" onClick={() => navigate('/app/dashboard')}>Passer</Button>
              )}
              <Button onClick={() => step < 2 ? setStep(step + 1) : navigate('/app/dashboard')}>
                {step < 2 ? <>Suivant <ArrowRight className="ml-2 h-4 w-4" /></> : <>Terminer <Check className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
