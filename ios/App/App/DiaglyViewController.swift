import UIKit
import WebKit
import Capacitor

/// La vue principale de l'app : la vue web de Capacitor, réglée pour se
/// comporter comme une app iOS plutôt que comme une page ouverte dans Safari.
class DiaglyViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        // Les plugins écrits dans ce projet (et non livrés par un paquet npm)
        // s'enregistrent à la main.
        bridge?.registerPluginInstance(ImpressionPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView = webView else { return }
        // Glisser depuis le bord gauche revient à l'écran précédent, comme
        // dans les autres apps de l'iPhone et de l'iPad.
        webView.allowsBackForwardNavigationGestures = true
        // Un appui long sur un lien ouvrirait l'aperçu de Safari, qui n'a rien
        // à montrer dans une app.
        webView.allowsLinkPreview = false
    }
}
