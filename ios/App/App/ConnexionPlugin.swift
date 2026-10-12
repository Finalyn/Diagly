import UIKit
import AuthenticationServices
import Capacitor

/// Connexion à un compte tiers, avec les fenêtres d'iOS (src/lib/connexion-native.ts).
///
/// - `apple` : la feuille « Se connecter avec Apple » (Face ID). Rend le jeton
///   d'identité, que le serveur vérifie auprès d'Apple.
/// - `web` : la fenêtre de connexion sécurisée d'iOS (ASWebAuthenticationSession),
///   pour Google. Google refuse les connexions dans la vue web d'une app ; cette
///   fenêtre-là est le navigateur du système. Elle se referme d'elle-même quand la
///   page revient sur l'adresse ch.diagly.app://, et rend cette adresse à l'app.
@objc(ConnexionPlugin)
public class ConnexionPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "ConnexionPlugin"
    public let jsName = "Connexion"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "apple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "web", returnType: CAPPluginReturnPromise)
    ]

    private var appelApple: CAPPluginCall?
    private var sessionWeb: ASWebAuthenticationSession?
    private lazy var ancreWeb = AncreDeConnexion { [weak self] in self?.fenetre() }

    private func fenetre() -> UIWindow {
        if let w = bridge?.webView?.window { return w }
        let scene = UIApplication.shared.connectedScenes.first { $0 is UIWindowScene } as? UIWindowScene
        return scene?.windows.first { $0.isKeyWindow } ?? UIWindow()
    }

    // MARK: Se connecter avec Apple

    @objc func apple(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.appelApple = call
            let demande = ASAuthorizationAppleIDProvider().createRequest()
            demande.requestedScopes = [.fullName, .email]
            let controleur = ASAuthorizationController(authorizationRequests: [demande])
            controleur.delegate = self
            controleur.presentationContextProvider = self
            controleur.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appel = appelApple else { return }
        appelApple = nil
        guard let identite = authorization.credential as? ASAuthorizationAppleIDCredential,
              let donnees = identite.identityToken,
              let jeton = String(data: donnees, encoding: .utf8) else {
            appel.reject("Apple n'a pas renvoyé d'identité.")
            return
        }
        var resultat: [String: Any] = ["identityToken": jeton]
        if let c = identite.authorizationCode, let code = String(data: c, encoding: .utf8) { resultat["authorizationCode"] = code }
        // Apple ne donne le nom et l'adresse qu'à la toute première connexion.
        if let prenom = identite.fullName?.givenName { resultat["givenName"] = prenom }
        if let nom = identite.fullName?.familyName { resultat["familyName"] = nom }
        if let email = identite.email { resultat["email"] = email }
        appel.resolve(resultat)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let appel = appelApple else { return }
        appelApple = nil
        if let e = error as? ASAuthorizationError, e.code == .canceled {
            appel.reject("Connexion annulée.", "ANNULE")
        } else {
            appel.reject(error.localizedDescription)
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return fenetre()
    }

    // MARK: Fenêtre de connexion sécurisée (Google)

    @objc func web(_ call: CAPPluginCall) {
        guard let texte = call.getString("url"), let adresse = URL(string: texte), let schema = call.getString("schema") else {
            call.reject("Adresse de connexion manquante.")
            return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: adresse, callbackURLScheme: schema) { [weak self] retour, erreur in
                self?.sessionWeb = nil
                if let retour = retour {
                    call.resolve(["url": retour.absoluteString])
                } else if let e = erreur as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
                    call.reject("Connexion annulée.", "ANNULE")
                } else {
                    call.reject(erreur?.localizedDescription ?? "Connexion impossible.")
                }
            }
            session.presentationContextProvider = self.ancreWeb
            // Session partagée avec Safari : une personne déjà connectée à Google
            // n'a qu'à choisir son compte.
            session.prefersEphemeralWebBrowserSession = false
            self.sessionWeb = session
            if !session.start() {
                self.sessionWeb = nil
                call.reject("La fenêtre de connexion n'a pas pu s'ouvrir.")
            }
        }
    }
}

/// Où s'ouvre la fenêtre de connexion sécurisée : dans la fenêtre de l'app.
final class AncreDeConnexion: NSObject, ASWebAuthenticationPresentationContextProviding {
    private let fenetre: () -> UIWindow?
    init(_ fenetre: @escaping () -> UIWindow?) { self.fenetre = fenetre }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return fenetre() ?? UIWindow()
    }
}
