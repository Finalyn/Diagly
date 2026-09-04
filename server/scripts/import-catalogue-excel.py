# -*- coding: utf-8 -*-
"""
Import du catalogue depuis le classeur Excel du bureau vers seed-data.json.

Le classeur a trois onglets :
  Feuil1  nomenclature CFC complete (codes + designations), non importee ici
  Feuil2  catalogue de travail : un element par ligne, les travaux a faire selon
          l'etat, regroupes sous des titres de categorie (en gras)
  Feuil3  descriptions d'etat (constats visuels), un element par ligne

Historiquement seul Feuil3 avait ete importe : les 102 items de l'app en viennent
tous. Les 44 elements de Feuil2, avec leurs codes CFC detailles, n'y etaient pas.

Regles de fusion :
  - on n'efface jamais un item existant (des diagnostics y sont rattaches)
  - un element deja present recoit ses textes de travaux manquants
  - un element absent est cree, sans prix ni unite : ils viendront d'ailleurs
  - un element dont le code CFC est deja utilise n'est PAS cree : c'est peut-etre
    le meme ouvrage sous un autre libelle (Paratonnerre / Protection contre la
    foudre). Il part dans une liste a trancher a la main.
  - les nouveaux items sont ranges apres les existants ; l'ordre de visite se
    revoit ensuite avec reorder-catalogue.mjs

Usage :
  python scripts/import-catalogue-excel.py <classeur.xlsx>              # apercu
  python scripts/import-catalogue-excel.py <classeur.xlsx> --appliquer  # ecrit
"""
import json, sys, io, re, unicodedata, os

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl requis : pip install openpyxl")

ICI = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(ICI, '..', 'prisma', 'seed-data.json')

# Colonnes de Feuil2, dans l'ordre du classeur.
COLS_TRAVAUX = [
    (2, 'workTbe'), (3, 'workBon'), (4, 'workMoyen'),
    (5, 'workMauvais'), (6, 'workImprovement'), (7, 'workNorms'),
]

def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def cell(v):
    s = '' if v is None else str(v).strip()
    return s or None

def lire_feuil2(ws):
    """Rend (categorie, ligne) pour chaque element. Les titres sont en gras."""
    elements, categorie, cfc_cat = [], None, None
    for row in ws.iter_rows(min_row=2):
        desc = cell(row[0].value)
        if not desc:
            continue
        if row[0].font and row[0].font.bold:
            categorie, cfc_cat = desc, cell(row[1].value)
            continue
        travaux = {k: cell(row[i].value) for i, k in COLS_TRAVAUX if i < len(row)}
        elements.append({
            'description': desc,
            'cfcCode': cell(row[1].value),
            'category': categorie,
            'categoryCfc': cfc_cat,
            'travaux': travaux,
            'vide': not any(travaux.values()),
        })
    return elements

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    classeur, appliquer = sys.argv[1], '--appliquer' in sys.argv

    wb = openpyxl.load_workbook(classeur)
    if 'Feuil2' not in wb.sheetnames:
        sys.exit("onglet Feuil2 introuvable : %s" % wb.sheetnames)
    elements = lire_feuil2(wb['Feuil2'])

    seed = json.load(io.open(SEED, encoding='utf-8'))
    items = seed['items']
    par_nom = {norm(i['description']): i for i in items}
    par_cfc = {}
    for i in items:
        par_cfc.setdefault(str(i.get('cfcCode') or '').strip(), []).append(i['description'])
    ordre_max = max((i.get('displayOrder') or 0) for i in items)

    ajouts, complements, inchanges, sans_travaux, a_trancher = [], [], [], [], []
    forcer = '--forcer' in sys.argv

    for el in elements:
        if el['vide']:
            sans_travaux.append(el)
            continue
        item = par_nom.get(norm(el['description']))
        if item is None:
            homonymes = par_cfc.get(str(el['cfcCode'] or '').strip(), [])
            if homonymes and not forcer:
                a_trancher.append((el, homonymes))
                continue
            ordre_max += 1
            nouveau = {
                'displayOrder': ordre_max,
                'category': el['category'] or 'A classer',
                'categoryCfc': el['categoryCfc'],
                'description': el['description'],
                'cfcCode': el['cfcCode'],
                'unit': None, 'quantityFormula': None,
                'priceTbe': None, 'priceBon': None, 'priceMoyen': None,
                'priceMauvais': None, 'priceImprovement': None, 'priceNorms': None,
                'descTbe': None, 'descBon': None, 'descMoyen': None, 'descMauvais': None,
                'scaffoldingNote': None,
            }
            nouveau.update(el['travaux'])
            items.append(nouveau)
            par_nom[norm(el['description'])] = nouveau
            ajouts.append(el)
            continue
        # Element deja present : on ne remplace rien, on comble les trous.
        combles = [k for k, v in el['travaux'].items() if v and not item.get(k)]
        for k in combles:
            item[k] = el['travaux'][k]
        if combles:
            complements.append((el, combles, item))
        else:
            inchanges.append(el)

    out = io.StringIO()
    w = out.write
    w("Classeur : %s\n" % classeur)
    w("Feuil2 : %d elements dont %d sans texte de travaux\n" % (len(elements), len(sans_travaux)))
    w("Catalogue : %d items avant, %d apres\n\n" % (len(items) - len(ajouts), len(items)))

    w("=== A TRANCHER : %d (code CFC deja utilise) ===\n" % len(a_trancher))
    for el, homonymes in a_trancher:
        w("  %-9s %-42s <-> %s\n" % (el['cfcCode'] or '?', el['description'][:42],
                                      ' / '.join(h[:40] for h in homonymes)))
    w("  Meme ouvrage sous un autre nom, ou ouvrage different ? --forcer les cree quand meme.\n\n")

    w("=== A CREER : %d ===\n" % len(ajouts))
    for el in ajouts:
        w("  %-9s %-45s [%s]\n" % (el['cfcCode'] or '?', el['description'][:45], el['category']))

    w("\n=== TEXTES DE TRAVAUX A COMPLETER : %d ===\n" % len(complements))
    for el, combles, _ in complements:
        w("  %-9s %-45s %s\n" % (el['cfcCode'] or '?', el['description'][:45], ', '.join(combles)))

    w("\n=== DEJA A JOUR : %d ===\n" % len(inchanges))
    for el in inchanges:
        w("  %-9s %s\n" % (el['cfcCode'] or '?', el['description'][:45]))

    w("\n=== LIGNES SANS TRAVAUX, IGNOREES : %d ===\n" % len(sans_travaux))
    for el in sans_travaux:
        w("  %-9s %s\n" % (el['cfcCode'] or '?', el['description'][:45]))

    w("\nLes nouveaux items n'ont ni prix ni unite ni formule de quantite.\n")
    w("L'app affichera « Aucun travail chiffre pour l'etat X » tant qu'ils ne sont pas renseignes.\n")

    rapport = out.getvalue()
    io.open(os.path.join(ICI, '..', '..', 'exports', 'import-catalogue.txt'), 'w', encoding='utf-8').write(rapport)
    sys.stdout.write(rapport)

    if appliquer:
        json.dump(seed, io.open(SEED, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print("\nseed-data.json mis a jour. Reste a faire : npx prisma db seed")
    else:
        print("\nApercu seul. Relancer avec --appliquer pour ecrire.")

main()
