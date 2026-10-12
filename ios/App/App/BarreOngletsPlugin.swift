import UIKit
import Capacitor

/// La barre du bas de l'app sur iPhone, dessinée par iOS (src/components/layout/MobileNav.tsx).
///
/// Sur iOS 26, en Liquid Glass (UIGlassEffect) : le vrai matériau du système,
/// qui réfracte la page qui glisse dessous. Une imitation en CSS ne s'en
/// approchait pas. Avant iOS 26, le flou du système.
///
/// Le front décrit la barre (boutons, bouton actif) et reçoit les touchers par
/// l'événement « toucher » ; la navigation reste au routeur web.
@objc(BarreOngletsPlugin)
public class BarreOngletsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarreOngletsPlugin"
    public let jsName = "BarreOnglets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "afficher", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "masquer", returnType: CAPPluginReturnPromise)
    ]

    private var barre: BarreOnglets?

    override public func load() {
        // Le clavier réduit la vue web, qui porte la barre : elle remonterait
        // au-dessus du clavier, sur les champs. Elle s'efface pendant la saisie.
        let centre = NotificationCenter.default
        centre.addObserver(self, selector: #selector(clavierVisible), name: UIResponder.keyboardWillShowNotification, object: nil)
        centre.addObserver(self, selector: #selector(clavierCache), name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    @objc private func clavierVisible() {
        UIView.animate(withDuration: 0.15) { self.barre?.alpha = 0 }
    }

    @objc private func clavierCache() {
        UIView.animate(withDuration: 0.2) { self.barre?.alpha = 1 }
    }

    @objc func afficher(_ call: CAPPluginCall) {
        let gauche = BarreOngletsPlugin.bouton(call.getObject("gauche"))
        let centre = (call.getArray("centre", JSObject.self) ?? []).compactMap { BarreOngletsPlugin.bouton($0) }
        let droite = BarreOngletsPlugin.bouton(call.getObject("droite"))
        let actif = call.getString("actif")
        DispatchQueue.main.async {
            guard let vue = self.bridge?.viewController?.view else {
                call.reject("Vue de l'app introuvable.")
                return
            }
            let barre = self.barre ?? self.creerBarre(dans: vue)
            barre.configurer(gauche: gauche, centre: centre, droite: droite, actif: actif)
            barre.isHidden = false
            vue.bringSubviewToFront(barre)
            call.resolve()
        }
    }

    @objc func masquer(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.barre?.isHidden = true
            call.resolve()
        }
    }

    private func creerBarre(dans vue: UIView) -> BarreOnglets {
        let barre = BarreOnglets()
        barre.toucher = { [weak self] id in
            self?.notifyListeners("toucher", data: ["id": id])
        }
        barre.translatesAutoresizingMaskIntoConstraints = false
        vue.addSubview(barre)
        NSLayoutConstraint.activate([
            barre.leadingAnchor.constraint(equalTo: vue.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            barre.trailingAnchor.constraint(equalTo: vue.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            barre.bottomAnchor.constraint(equalTo: vue.safeAreaLayoutGuide.bottomAnchor, constant: -6),
            barre.heightAnchor.constraint(equalToConstant: 56)
        ])
        self.barre = barre
        return barre
    }

    private static func bouton(_ objet: JSObject?) -> BoutonDeBarre? {
        guard let o = objet, let id = o["id"] as? String, let symbole = o["symbole"] as? String else { return nil }
        return BoutonDeBarre(id: id, symbole: symbole, libelle: (o["libelle"] as? String) ?? id)
    }
}

struct BoutonDeBarre {
    let id: String
    let symbole: String
    let libelle: String
}

/// La barre : une pilule de verre au centre, un bouton rond de chaque côté.
final class BarreOnglets: UIView {
    var toucher: ((String) -> Void)?

    private let pilule = BarreOnglets.verre()
    private let pile = UIStackView()
    private var rondGauche: UIVisualEffectView?
    private var rondDroit: UIVisualEffectView?
    private let bleu = UIColor(red: 1 / 255, green: 103 / 255, blue: 234 / 255, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        pile.axis = .horizontal
        pile.spacing = 12
        pile.alignment = .center
        pile.translatesAutoresizingMaskIntoConstraints = false
        pilule.translatesAutoresizingMaskIntoConstraints = false
        pilule.contentView.addSubview(pile)
        addSubview(pilule)
        NSLayoutConstraint.activate([
            pilule.centerXAnchor.constraint(equalTo: centerXAnchor),
            pilule.centerYAnchor.constraint(equalTo: centerYAnchor),
            pilule.heightAnchor.constraint(equalToConstant: 56),
            pile.leadingAnchor.constraint(equalTo: pilule.contentView.leadingAnchor, constant: 10),
            pile.trailingAnchor.constraint(equalTo: pilule.contentView.trailingAnchor, constant: -10),
            pile.centerYAnchor.constraint(equalTo: pilule.contentView.centerYAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("BarreOnglets se crée en code")
    }

    /// Le matériau : Liquid Glass sur iOS 26, flou du système avant.
    static func verre() -> UIVisualEffectView {
        let effet: UIVisualEffect
        if #available(iOS 26.0, *) {
            let verre = UIGlassEffect()
            verre.isInteractive = true
            effet = verre
        } else {
            effet = UIBlurEffect(style: .systemUltraThinMaterial)
        }
        let vue = UIVisualEffectView(effect: effet)
        vue.clipsToBounds = true
        vue.layer.cornerCurve = .continuous
        return vue
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        for v in [pilule, rondGauche, rondDroit].compactMap({ $0 }) {
            v.layer.cornerRadius = v.bounds.height / 2
        }
    }

    /// Les touchers à côté des boutons passent à la page en dessous.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        for v in [pilule, rondGauche, rondDroit].compactMap({ $0 }) where !v.isHidden && v.frame.contains(point) {
            return true
        }
        return false
    }

    func configurer(gauche: BoutonDeBarre?, centre: [BoutonDeBarre], droite: BoutonDeBarre?, actif: String?) {
        pile.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for b in centre {
            pile.addArrangedSubview(bouton(b, actif: b.id == actif, cote: 44))
        }
        rondGauche?.removeFromSuperview()
        rondDroit?.removeFromSuperview()
        rondGauche = gauche.map { rond($0, actif: $0.id == actif, aGauche: true) }
        rondDroit = droite.map { rond($0, actif: $0.id == actif, aGauche: false) }
        setNeedsLayout()
    }

    private func rond(_ b: BoutonDeBarre, actif: Bool, aGauche: Bool) -> UIVisualEffectView {
        let rond = BarreOnglets.verre()
        rond.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rond)
        let contenu = bouton(b, actif: actif, cote: 52)
        rond.contentView.addSubview(contenu)
        NSLayoutConstraint.activate([
            rond.widthAnchor.constraint(equalToConstant: 52),
            rond.heightAnchor.constraint(equalToConstant: 52),
            rond.centerYAnchor.constraint(equalTo: centerYAnchor),
            aGauche ? rond.leadingAnchor.constraint(equalTo: leadingAnchor) : rond.trailingAnchor.constraint(equalTo: trailingAnchor),
            contenu.centerXAnchor.constraint(equalTo: rond.contentView.centerXAnchor),
            contenu.centerYAnchor.constraint(equalTo: rond.contentView.centerYAnchor)
        ])
        return rond
    }

    private func bouton(_ b: BoutonDeBarre, actif: Bool, cote: CGFloat) -> UIButton {
        let bouton = UIButton(type: .system)
        let reglage = UIImage.SymbolConfiguration(pointSize: 20, weight: actif ? .semibold : .regular)
        let image = UIImage(systemName: b.symbole, withConfiguration: reglage) ?? UIImage(systemName: "circle", withConfiguration: reglage)
        bouton.setImage(image, for: .normal)
        bouton.tintColor = actif ? bleu : UIColor.label.withAlphaComponent(0.75)
        bouton.accessibilityLabel = b.libelle
        if actif {
            bouton.backgroundColor = bleu.withAlphaComponent(0.12)
            bouton.layer.cornerRadius = cote / 2
        }
        bouton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            bouton.widthAnchor.constraint(equalToConstant: cote),
            bouton.heightAnchor.constraint(equalToConstant: cote)
        ])
        let id = b.id
        bouton.addAction(UIAction { [weak self] _ in
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            self?.toucher?(id)
        }, for: .touchUpInside)
        return bouton
    }
}
