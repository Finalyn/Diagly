import UIKit
import VisionKit
import Capacitor

/// Le scanner de documents d'iOS, pour les plans papier (src/lib/scanner-natif.ts).
///
/// VNDocumentCameraViewController est celui de l'app Notes : il trouve les
/// bords de la feuille, la redresse et enchaîne plusieurs pages. Chaque page
/// revient en JPEG (qualité 0,9) à la résolution que l'appareil photo a
/// donnée, sans la réduire : c'est sur elle que se lira l'échelle du plan.
///
/// Les images passent par des fichiers temporaires que la vue web lit à leur
/// adresse capacitor:// : plusieurs pages de quelques mégaoctets ne
/// traversent pas le pont en base64. Le dossier se vide au scan suivant, ou
/// quand la page web a fini de les lire (`nettoyer`).
@objc(ScannerPlugin)
public class ScannerPlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "ScannerPlugin"
    public let jsName = "Scanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "disponible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "nettoyer", returnType: CAPPluginReturnPromise)
    ]

    /// L'appel en attente du scan, tenu jusqu'à ce que la personne termine ou annule.
    private var appel: CAPPluginCall?

    /// Le dossier des pages scannées, dans les fichiers temporaires de l'app.
    private static var dossier: URL {
        return FileManager.default.temporaryDirectory.appendingPathComponent("scans-plans", isDirectory: true)
    }

    /// Le scanner existe-t-il sur cet appareil ? (Pas sur le simulateur, ni sans appareil photo.)
    @objc func disponible(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["disponible": VNDocumentCameraViewController.isSupported])
        }
    }

    @objc func scanner(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard VNDocumentCameraViewController.isSupported else {
                call.reject("Le scanner de documents n'est pas disponible sur cet appareil.", "INDISPONIBLE")
                return
            }
            guard self.appel == nil else {
                call.reject("Un scan est déjà en cours.", "OCCUPE")
                return
            }
            guard var dessus = self.bridge?.viewController else {
                call.reject("La vue de l'app est introuvable.")
                return
            }
            // Au-dessus de ce qui est déjà présenté, sans quoi la présentation échouerait sans bruit.
            while let presente = dessus.presentedViewController { dessus = presente }
            self.appel = call
            let scanner = VNDocumentCameraViewController()
            scanner.delegate = self
            scanner.modalPresentationStyle = .fullScreen
            dessus.present(scanner, animated: true)
        }
    }

    /// Les pages ont été lues par la page web : leurs fichiers peuvent partir.
    @objc func nettoyer(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .utility).async {
            try? FileManager.default.removeItem(at: ScannerPlugin.dossier)
            call.resolve()
        }
    }

    // MARK: VNDocumentCameraViewControllerDelegate

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        guard let call = appel else {
            controller.dismiss(animated: true)
            return
        }
        appel = nil
        // Les pages se lisent ici, sur le fil principal, tant que le scan est là ;
        // leur encodage en JPEG, plus long, se fait en arrière-plan.
        var images: [UIImage] = []
        for i in 0..<scan.pageCount {
            images.append(scan.imageOfPage(at: i))
        }
        let pont = bridge
        controller.dismiss(animated: true)
        DispatchQueue.global(qos: .userInitiated).async {
            let fichiers = FileManager.default
            let dossier = ScannerPlugin.dossier
            try? fichiers.removeItem(at: dossier)
            do {
                try fichiers.createDirectory(at: dossier, withIntermediateDirectories: true)
            } catch {
                call.reject("Les pages scannées n'ont pas pu être enregistrées.")
                return
            }
            // Un nom propre à ce scan : la vue web ne relit pas une page d'un scan précédent dans son cache.
            let lot = String(UUID().uuidString.prefix(8))
            var pages: [[String: Any]] = []
            for (i, image) in images.enumerated() {
                autoreleasepool {
                    guard let donnees = image.jpegData(compressionQuality: 0.9) else { return }
                    let fichier = dossier.appendingPathComponent("page-\(lot)-\(i + 1).jpg")
                    do {
                        try donnees.write(to: fichier, options: .atomic)
                    } catch {
                        return
                    }
                    guard let adresse = pont?.portablePath(fromLocalURL: fichier) else { return }
                    pages.append([
                        "chemin": adresse.absoluteString,
                        "largeur": Int((image.size.width * image.scale).rounded()),
                        "hauteur": Int((image.size.height * image.scale).rounded())
                    ])
                }
            }
            if pages.isEmpty {
                call.reject("Aucune page n'a pu être lue.")
            } else {
                call.resolve(["pages": pages])
            }
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        appel?.reject("Scan annulé.", "ANNULE")
        appel = nil
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        controller.dismiss(animated: true)
        appel?.reject(error.localizedDescription)
        appel = nil
    }
}
