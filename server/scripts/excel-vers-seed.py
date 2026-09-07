# -*- coding: utf-8 -*-
"""
Construit le catalogue de reference (prisma/seed-data.json) depuis le classeur
du bureau.

Le classeur est desormais complet : pour chaque ouvrage, les travaux a faire
selon l'etat, l'unite, la formule de quantite, les six prix et la note
d'echafaudage. Il fait foi, l'application ne fait que le servir.

Structure attendue de l'onglet Feuil2, une colonne par champ :
  0 description        6 travaux amelioration   12 prix etat moyen
  1 code CFC           7 travaux remise normes  13 prix mauvais etat
  2 travaux tres bon   8 unite                  14 prix amelioration
  3 travaux bon        9 formule de quantite    15 prix remise aux normes
  4 travaux moyen     10 prix tres bon etat     16 note echafaudage
  5 travaux mauvais   11 prix bon etat

Les lignes en gras sont des titres de categorie : elles regroupent les ouvrages
qui suivent, et ne sont pas des ouvrages elles-memes.

  python scripts/excel-vers-seed.py <classeur.xlsx>              apercu
  python scripts/excel-vers-seed.py <classeur.xlsx> --appliquer  ecrit le seed
"""
import json, sys, io, os, re, unicodedata

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl requis : pip install openpyxl")

ICI = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.join(ICI, '..', 'prisma', 'seed-data.json')

COLONNES = [
    (2, 'workTbe'), (3, 'workBon'), (4, 'workMoyen'), (5, 'workMauvais'),
    (6, 'workImprovement'), (7, 'workNorms'),
    (8, 'unit'), (9, 'quantityFormula'),
    (10, 'priceTbe'), (11, 'priceBon'), (12, 'priceMoyen'), (13, 'priceMauvais'),
    (14, 'priceImprovement'), (15, 'priceNorms'),
    (16, 'scaffoldingNote'),
]

def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def texte(v):
    """Cellule en texte, ou None si vide. Les prix restent des chaines : le
    catalogue accepte aussi bien « 45 » que « sur devis »."""
    if v is None:
        return None
    if isinstance(v, float) and v == int(v):
        v = int(v)
    s = str(v).strip()
    return s or None

def lire(classeur, onglet='Feuil2'):
    wb = openpyxl.load_workbook(classeur)
    if onglet not in wb.sheetnames:
        sys.exit("onglet %s introuvable : %s" % (onglet, wb.sheetnames))
    ws = wb[onglet]
    items, categorie, ordre = [], None, 0
    for row in ws.iter_rows(min_row=2):
        desc = texte(row[0].value)
        if not desc:
            continue
        # Un titre de categorie est en gras et n'a ni unite ni prix.
        gras = bool(row[0].font and row[0].font.bold)
        a_du_contenu = any(texte(row[i].value) for i, _ in COLONNES if i < len(row))
        if gras and not a_du_contenu:
            categorie = desc
            continue
        ordre += 1
        item = {
            'displayOrder': ordre,
            'category': categorie or 'A classer',
            'categoryCfc': None,
            'description': desc,
            'cfcCode': texte(row[1].value),
        }
        for i, champ in COLONNES:
            item[champ] = texte(row[i].value) if i < len(row) else None
        items.append(item)
    return items

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    classeur, appliquer = sys.argv[1], '--appliquer' in sys.argv
    items = lire(classeur)

    # Un meme libelle deux fois rendrait l'appariement ambigu cote base.
    vus, doublons = {}, []
    for it in items:
        c = norm(it['description'])
        if c in vus:
            doublons.append((it['description'], vus[c]['description']))
        vus[c] = it

    sans_cfc = [i for i in items if not i['cfcCode']]
    sans_prix = [i for i in items if not i['priceMoyen'] and not i['priceMauvais']]
    sans_unite = [i for i in items if not i['unit']]
    sans_formule = [i for i in items if not i['quantityFormula']]

    print("Classeur : %s" % classeur)
    print("%d ouvrages, %d categories" % (items and len(items) or 0, len({i['category'] for i in items})))
    print("  avec unite            : %d" % (len(items) - len(sans_unite)))
    print("  avec formule quantite : %d" % (len(items) - len(sans_formule)))
    print("  avec prix moyen       : %d" % len([i for i in items if i['priceMoyen']]))
    print("  avec prix mauvais     : %d" % len([i for i in items if i['priceMauvais']]))
    print("  avec note echafaudage : %d" % len([i for i in items if i['scaffoldingNote']]))

    if doublons:
        print("\nLIBELLES EN DOUBLE (l'appariement serait ambigu) : %d" % len(doublons))
        for a, b in doublons:
            print("   %s" % a)
    if sans_cfc:
        print("\nSANS CODE CFC : %d" % len(sans_cfc))
        for i in sans_cfc:
            print("   %-46s [%s]" % (i['description'][:46], i['category']))
    if sans_prix:
        print("\nSANS AUCUN PRIX : %d" % len(sans_prix))
        for i in sans_prix:
            print("   %-46s [%s]" % (i['description'][:46], i['category']))

    if appliquer:
        seed = json.load(io.open(SEED, encoding='utf-8'))
        seed['items'] = items
        json.dump(seed, io.open(SEED, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print("\nseed-data.json reecrit : %d ouvrages." % len(items))
        print("Reste a faire : node scripts/sync-catalogue.mjs (apercu) puis --appliquer")
    else:
        print("\nApercu seul. Relancer avec --appliquer pour reecrire le seed.")

main()
