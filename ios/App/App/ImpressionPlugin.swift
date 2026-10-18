import UIKit
import Capacitor

/// Impression avec la feuille d'impression d'iOS.
///
/// window.print() ne fait rien dans la vue web d'une app, et une fenêtre ouverte
/// par window.open() n'existe pas. Ce plugin confie le contenu au système : on
/// imprime, ou on choisit « Enregistrer dans Fichiers » pour en faire un PDF.
@objc(ImpressionPlugin)
public class ImpressionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ImpressionPlugin"
    public let jsName = "Impression"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "imprimer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "imprimerHtml", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pdfDiapositives", returnType: CAPPluginReturnPromise)
    ]

    /// La page affichée, mise en page avec ses styles @media print (rapports).
    @objc func imprimer(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("La page à imprimer est introuvable.")
                return
            }
            self.presenter(webView.viewPrintFormatter(), titre: call.getString("titre"), call: call)
        }
    }

    /// Un document HTML autonome, sans script (avis aux locataires, par exemple).
    @objc func imprimerHtml(_ call: CAPPluginCall) {
        guard let html = call.getString("html"), !html.isEmpty else {
            call.reject("Aucun contenu à imprimer.")
            return
        }
        DispatchQueue.main.async {
            let mise = UIMarkupTextPrintFormatter(markupText: html)
            // Marges d'une feuille A4 ordinaire, environ 18 mm.
            mise.perPageContentInsets = UIEdgeInsets(top: 51, left: 51, bottom: 51, right: 51)
            self.presenter(mise, titre: call.getString("titre"), call: call)
        }
    }

    /// La présentation des métrés, en PDF aux pages de la taille demandée (16:9).
    ///
    /// La feuille d'impression du système impose son papier, A4 ou Letter : une
    /// présentation y sortirait en pages portrait. Ici, la page affichée est mise
    /// en pages avec ses styles @media print (la présentation ne laisse imprimer
    /// qu'elle), sur des pages de `largeur` × `hauteur` points, et le PDF part
    /// dans la feuille de partage : Enregistrer dans Fichiers, AirDrop, Mail, ou
    /// Imprimer.
    @objc func pdfDiapositives(_ call: CAPPluginCall) {
        let largeur = call.getDouble("largeur") ?? 960
        let hauteur = call.getDouble("hauteur") ?? 540
        let nom = ImpressionPlugin.nomDeFichier(call.getString("nom") ?? "Diagly")
        guard largeur > 0, hauteur > 0 else {
            call.reject("Taille de page invalide.")
            return
        }
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView, let vue = self.bridge?.viewController else {
                call.reject("La page à imprimer est introuvable.")
                return
            }
            let page = CGRect(x: 0, y: 0, width: largeur, height: hauteur)
            let rendu = PagesDeTaille(page: page)
            rendu.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)

            let donnees = NSMutableData()
            UIGraphicsBeginPDFContextToData(donnees, page, [kCGPDFContextTitle as String: nom])
            let nombre = rendu.numberOfPages
            rendu.prepare(forDrawingPages: NSRange(location: 0, length: nombre))
            for i in 0..<nombre {
                UIGraphicsBeginPDFPage()
                rendu.drawPage(at: i, in: UIGraphicsGetPDFContextBounds())
            }
            UIGraphicsEndPDFContext()
            guard nombre > 0 else {
                call.reject("La présentation n'a produit aucune page.")
                return
            }

            let fichier = FileManager.default.temporaryDirectory.appendingPathComponent("\(nom).pdf")
            do {
                try donnees.write(to: fichier, options: .atomic)
            } catch {
                call.reject("Le PDF n'a pas pu être écrit : \(error.localizedDescription)")
                return
            }

            let partage = UIActivityViewController(activityItems: [fichier], applicationActivities: nil)
            partage.completionWithItemsHandler = { _, fait, _, erreur in
                if let erreur = erreur {
                    call.reject(erreur.localizedDescription)
                } else {
                    call.resolve(["partage": fait])
                }
            }
            // Sur iPad, la feuille de partage s'ouvre en bulle, ancrée en haut au centre.
            if let bulle = partage.popoverPresentationController {
                bulle.sourceView = webView
                bulle.sourceRect = CGRect(x: webView.bounds.midX, y: webView.safeAreaInsets.top + 8, width: 1, height: 1)
            }
            vue.present(partage, animated: true)
        }
    }

    /// Un nom de fichier sans les caractères qu'un système de fichiers refuse.
    private static func nomDeFichier(_ nom: String) -> String {
        let interdits = CharacterSet(charactersIn: "/\\:*?\"<>|")
        let propre = nom.components(separatedBy: interdits).joined(separator: "-").trimmingCharacters(in: .whitespacesAndNewlines)
        return propre.isEmpty ? "Diagly" : propre
    }

    private func presenter(_ mise: UIPrintFormatter, titre: String?, call: CAPPluginCall) {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = titre ?? "Diagly"

        let impression = UIPrintInteractionController.shared
        impression.printInfo = info
        impression.printFormatter = mise

        let fin: UIPrintInteractionController.CompletionHandler = { _, imprime, erreur in
            if let erreur = erreur {
                call.reject(erreur.localizedDescription)
            } else {
                call.resolve(["imprime": imprime])
            }
        }
        // Sur iPad, la feuille s'ouvre en bulle : elle a besoin d'un point
        // d'ancrage, pris en haut au centre de l'écran.
        if UIDevice.current.userInterfaceIdiom == .pad, let vue = bridge?.webView {
            let ancre = CGRect(x: vue.bounds.midX, y: vue.safeAreaInsets.top + 8, width: 1, height: 1)
            impression.present(from: ancre, in: vue, animated: true, completionHandler: fin)
        } else {
            impression.present(animated: true, completionHandler: fin)
        }
    }
}

/// Des pages de la taille voulue, plutôt que celles du papier de l'imprimante.
private final class PagesDeTaille: UIPrintPageRenderer {
    private let page: CGRect

    init(page: CGRect) {
        self.page = page
        super.init()
    }

    override var paperRect: CGRect { page }
    override var printableRect: CGRect { page }
}
