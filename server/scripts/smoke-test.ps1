# Smoke test du flow diagnostique complet.
# Lance le serveur d'abord (npm run dev), puis exécute ce script.

$ErrorActionPreference = "Stop"
$base = "http://localhost:4000"
$email = "smoke-$(Get-Random -Minimum 1000 -Maximum 9999)@diagly.test"
$password = "test1234"

function Post($path, $body, $headers = @{}) {
  $headers["Content-Type"] = "application/json"
  Invoke-RestMethod -Method POST -Uri "$base$path" -Body ($body | ConvertTo-Json -Depth 6) -Headers $headers
}
function Get-Api($path, $headers = @{}) {
  Invoke-RestMethod -Method GET -Uri "$base$path" -Headers $headers
}

Write-Host "=> Health check" -ForegroundColor Cyan
Get-Api "/health"

Write-Host "`n=> Register" -ForegroundColor Cyan
$auth = Post "/api/auth/register" @{
  email = $email
  password = $password
  firstName = "Smoke"
  lastName = "Test"
  role = "DT"
}
$auth | Format-List user, accessToken
$h = @{ Authorization = "Bearer $($auth.accessToken)" }

Write-Host "`n=> Catégories CFC" -ForegroundColor Cyan
$cats = Get-Api "/api/cfc/categories" $h
Write-Host ("Categories: " + ($cats.categories -join ", "))

Write-Host "`n=> Items FACADE" -ForegroundColor Cyan
$facade = Get-Api "/api/cfc/items?category=FACADE" $h
Write-Host ("Found " + $facade.count + " items in FACADE")

Write-Host "`n=> Create project" -ForegroundColor Cyan
$proj = (Post "/api/projects" @{
  name = "Immeuble Test rue de la Paix 12"
  address = "Rue de la Paix 12"
  city = "Lausanne"
  postalCode = "1003"
  canton = "VD"
  buildingType = "LOGEMENT"
  yearBuilt = 1975
  nbApartments = 8
  nbFloors = 4
  floorHeight = 2.7
} $h).project
Write-Host ("Project id: " + $proj.id)

Write-Host "`n=> Create diagnostic" -ForegroundColor Cyan
$diag = (Post "/api/projects/$($proj.id)/diagnostics" @{
  notes = "Visite initiale"
} $h).diagnostic
Write-Host ("Diagnostic id: " + $diag.id)

Write-Host "`n=> Add diagnostic item (Façade ventilée métallique)" -ForegroundColor Cyan
$item = (Post "/api/diagnostics/$($diag.id)/items" @{
  cfcCode = "215.2"
  cfcLabel = "Façade ventilée métallique"
  state = "MOYEN"
  priority = "II"
  notes = "Quelques plaques à reprendre côté nord"
  works = @("Réfection partielle", "Nettoyage haute pression")
  photos = @()
  area = 240
  unit = "m2"
  estimatedCost = 36000
} $h).item
Write-Host ("Item id: " + $item.id)

Write-Host "`n=> List items of diagnostic" -ForegroundColor Cyan
$items = Get-Api "/api/diagnostics/$($diag.id)/items" $h
Write-Host ("Diagnostic now has " + $items.count + " item(s)")

Write-Host "`n=> List projects" -ForegroundColor Cyan
$list = Get-Api "/api/projects" $h
Write-Host ("User has " + $list.count + " project(s)")

Write-Host "`n=> Cleanup (delete project = cascade tout)" -ForegroundColor Cyan
Invoke-RestMethod -Method DELETE -Uri "$base/api/projects/$($proj.id)" -Headers $h
Write-Host "OK — smoke test passed" -ForegroundColor Green
