"""Ajoute des fichiers au projet Xcode sans ouvrir Xcode (le poste est sous Windows).

    python ios/outils/ajouter-au-projet.py App/MonFichier.swift [App/Autre.entitlements ...]

Le chemin est relatif à ios/App. Un .swift entre dans la phase de compilation
de la cible App ; les autres fichiers sont seulement référencés dans le groupe
App (une entitlements, par exemple, est lue via CODE_SIGN_ENTITLEMENTS).
Relancer le script sur un fichier déjà présent ne change rien.
"""
import hashlib, os, re, sys

PROJET = os.path.join(os.path.dirname(__file__), '..', 'App', 'App.xcodeproj', 'project.pbxproj')
GROUPE_APP = '504EC3061FED79650016851F /* App */ = {'
PHASE_SOURCES = '504EC3001FED79650016851F /* Sources */ = {'
TYPES = {'.swift': 'sourcecode.swift', '.entitlements': 'text.plist.entitlements',
         '.plist': 'text.plist.xml', '.xcprivacy': 'text.xml'}


def ident(graine):
    # Identifiant stable de 24 caractères hexadécimaux, dérivé du chemin : deux
    # passages produisent le même, et il ne heurte pas ceux de Xcode.
    return hashlib.sha1(graine.encode()).hexdigest()[:24].upper()


def main(chemins):
    texte = open(PROJET, encoding='utf-8').read()
    for chemin in chemins:
        nom = os.path.basename(chemin)
        ext = os.path.splitext(nom)[1]
        ref, construit = ident('ref:' + chemin), ident('build:' + chemin)
        if ref in texte:
            print('déjà présent :', nom)
            continue
        texte = texte.replace(
            '/* End PBXFileReference section */',
            f'\t\t{ref} /* {nom} */ = {{isa = PBXFileReference; lastKnownFileType = {TYPES.get(ext, "text")}; path = {nom}; sourceTree = "<group>"; }};\n/* End PBXFileReference section */')
        debut = texte.index(GROUPE_APP)
        enfants = texte.index('children = (', debut) + len('children = (')
        texte = texte[:enfants] + f'\n\t\t\t\t{ref} /* {nom} */,' + texte[enfants:]
        if ext == '.swift':
            texte = texte.replace(
                '/* End PBXBuildFile section */',
                f'\t\t{construit} /* {nom} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref} /* {nom} */; }};\n/* End PBXBuildFile section */')
            debut = texte.index(PHASE_SOURCES)
            fichiers = texte.index('files = (', debut) + len('files = (')
            texte = texte[:fichiers] + f'\n\t\t\t\t{construit} /* {nom} in Sources */,' + texte[fichiers:]
        print('ajouté :', nom)
    open(PROJET, 'w', encoding='utf-8', newline='\n').write(texte)


if __name__ == '__main__':
    main(sys.argv[1:])
