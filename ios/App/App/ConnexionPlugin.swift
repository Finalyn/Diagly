import UIKit
import AuthenticationServices
import CryptoKit
import Capacitor

/// Connexion à un compte tiers, avec les fenêtres d'iOS (src/lib/connexion-native.ts).
///
/// - `apple` : la feuille « Se connecter avec Apple » (Face ID). Rend le jeton
///   d'identité, que le serveur vérifie auprès d'Apple.
/// - `web` : la fenêtre de connexion sécurisée d'iOS (ASWebAuthenticationSession),
///   pour Google. Google refuse les connexions dans la vue web d'une app ; cette
///   fenêtre-là est le navigateur du système. Elle se referme d'elle-même quand la
///   page revient sur l'adresse ch.diagly.app://, et rend cette adresse à l'app.
///   Avec l'option `pkce`, elle tire d'abord un secret qui ne quitte pas l'app :
///   seule son empreinte part avec la demande, et le serveur ne rend au retour
///   qu'un code qui ne s'échange qu'avec ce secret. Une autre app qui déclarerait
///   l'adresse ch.diagly.app:// n'en ferait rien.
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
        guard let texte = call.getString("url"), let demandee = URL(string: texte), let schema = call.getString("schema") else {
            call.reject("Adresse de connexion manquante.")
            return
        }
        var adresse = demandee
        var secret: String?
        if call.getBool("pkce", false) {
            let verifier = ConnexionPlugin.secretAleatoire()
            guard var composants = URLComponents(url: demandee, resolvingAgainstBaseURL: false) else {
                call.reject("Adresse de connexion invalide.")
                return
            }
            let challenge = URLQueryItem(name: "challenge", value: ConnexionPlugin.empreinte(de: verifier))
            composants.queryItems = (composants.queryItems ?? []) + [challenge]
            guard let avecEmpreinte = composants.url else {
                call.reject("Adresse de connexion invalide.")
                return
            }
            adresse = avecEmpreinte
            secret = verifier
        }
        let adresseFinale = adresse
        let secretGarde = secret
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: adresseFinale, callbackURLScheme: schema) { [weak self] retour, erreur in
                self?.sessionWeb = nil
                if let retour = retour {
                    var resultat: [String: Any] = ["url": retour.absoluteString]
                    if let verifier = secretGarde { resultat["verifier"] = verifier }
                    call.resolve(resultat)
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

    // MARK: PKCE (RFC 7636)

    /// Le secret (verifier) : 32 octets tirés par le générateur cryptographique, en base64url.
    private static func secretAleatoire() -> String {
        let octets = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
        return base64url(octets)
    }

    /// L'empreinte du secret (challenge) : SHA-256, en base64url. Le serveur la
    /// recalcule à l'échange (server/src/lib/pkce.ts).
    private static func empreinte(de secret: String) -> String {
        return base64url(Data(SHA256.hash(data: Data(secret.utf8))))
    }

    /// base64url sans remplissage : sans caractère à échapper dans une adresse.
    private static func base64url(_ donnees: Data) -> String {
        return donnees.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
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
