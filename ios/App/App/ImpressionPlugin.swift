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
        CAPPluginMethod(name: "imprimerHtml", returnType: CAPPluginReturnPromise)
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
