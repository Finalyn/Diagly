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
///
/// Comme la barre d'onglets d'iOS 26, la pilule se balaie du doigt : une
/// pastille, grossie comme une loupe, suit le doigt d'un bouton à l'autre,
/// avec un petit clic à chaque bouton franchi, et se pose sur celui où l'on
/// relâche. Un simple toucher fait glisser la pastille jusqu'au bouton.
final class BarreOnglets: UIView {
    var toucher: ((String) -> Void)?

    private struct Bouton {
        let id: String
        let symbole: String
        let vue: UIButton
        let rond: Bool
    }

    private let pilule = BarreOnglets.verre()
    private let pile = UIStackView()
    /// La pastille du bouton actif, sous les icônes.
    private let pastille = UIView()
    private var centre: [Bouton] = []
    private var ronds: [Bouton] = []
    private var rondGauche: UIVisualEffectView?
    private var rondDroit: UIVisualEffectView?
    private var actif: String?
    /// Les boutons affichés : tant qu'ils ne changent pas, une autre page ne
    /// fait que déplacer la pastille, sans redessiner la barre.
    private var signature = ""
    /// Le bouton sous le doigt pendant un balayage, nil sinon.
    private var survole: String?
    private let selection = UISelectionFeedbackGenerator()
    private let bleu = UIColor(red: 1 / 255, green: 103 / 255, blue: 234 / 255, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        pile.axis = .horizontal
        pile.spacing = 12
        pile.alignment = .center
        pile.translatesAutoresizingMaskIntoConstraints = false
        pilule.translatesAutoresizingMaskIntoConstraints = false
        pastille.isUserInteractionEnabled = false
        pastille.layer.cornerCurve = .continuous
        pastille.backgroundColor = bleu.withAlphaComponent(0.12)
        pastille.alpha = 0
        pilule.contentView.addSubview(pastille)
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
        let balayage = UIPanGestureRecognizer(target: self, action: #selector(balayer(_:)))
        pilule.addGestureRecognizer(balayage)
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
        // Pendant un balayage, c'est le doigt qui place la pastille.
        if survole == nil { placerPastille() }
    }

    /// Les touchers à côté des boutons passent à la page en dessous.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        for v in [pilule, rondGauche, rondDroit].compactMap({ $0 }) where !v.isHidden && v.frame.contains(point) {
            return true
        }
        return false
    }

    func configurer(gauche: BoutonDeBarre?, centre boutons: [BoutonDeBarre], droite: BoutonDeBarre?, actif nouveau: String?) {
        let nouvelle = ([gauche, droite].map { $0.map { "\($0.id):\($0.symbole)" } ?? "-" }
            + boutons.map { "\($0.id):\($0.symbole)" }).joined(separator: "|")
        if nouvelle == signature {
            // Même barre, autre page : la pastille glisse jusqu'au nouveau bouton.
            changerActif(nouveau, anime: true)
            return
        }
        signature = nouvelle
        pile.arrangedSubviews.forEach { $0.removeFromSuperview() }
        centre = boutons.map { (b: BoutonDeBarre) -> Bouton in
            let vue = bouton(b, cote: 44, dansLaPilule: true)
            pile.addArrangedSubview(vue)
            return Bouton(id: b.id, symbole: b.symbole, vue: vue, rond: false)
        }
        rondGauche?.removeFromSuperview()
        rondDroit?.removeFromSuperview()
        ronds = []
        rondGauche = gauche.map { rond($0, aGauche: true) }
        rondDroit = droite.map { rond($0, aGauche: false) }
        changerActif(nouveau, anime: false)
    }

    // MARK: Le bouton actif et sa pastille

    private func changerActif(_ id: String?, anime: Bool) {
        actif = id
        styler(actif: id)
        guard anime, window != nil else {
            setNeedsLayout()
            return
        }
        UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.78, initialSpringVelocity: 0.3,
                       options: [.beginFromCurrentState, .allowUserInteraction]) {
            self.placerPastille()
        }
    }

    /// Icône pleine et bleue pour le bouton allumé, contour gris pour les autres.
    private func styler(actif id: String?) {
        for b in centre + ronds {
            let allume = b.id == id
            b.vue.setImage(BarreOnglets.image(b.symbole, plein: allume), for: .normal)
            b.vue.tintColor = allume ? bleu : UIColor.label.withAlphaComponent(0.72)
            b.vue.accessibilityTraits = allume ? [.button, .selected] : .button
            if b.rond { b.vue.backgroundColor = allume ? bleu.withAlphaComponent(0.12) : .clear }
        }
    }

    /// Le symbole d'Apple, en version pleine quand il en a une.
    static func image(_ symbole: String, plein: Bool) -> UIImage? {
        let reglage = UIImage.SymbolConfiguration(pointSize: 19, weight: plein ? .semibold : .medium)
        if plein, let image = UIImage(systemName: "\(symbole).fill", withConfiguration: reglage) { return image }
        return UIImage(systemName: symbole, withConfiguration: reglage) ?? UIImage(systemName: "circle", withConfiguration: reglage)
    }

    private func cadre(de bouton: UIButton) -> CGRect {
        pile.layoutIfNeeded()
        return pile.convert(bouton.frame, to: pilule.contentView)
    }

    private func placerPastille() {
        guard let b = centre.first(where: { $0.id == actif }) else {
            pastille.alpha = 0
            return
        }
        let f = cadre(de: b.vue)
        pastille.transform = .identity
        pastille.bounds = CGRect(origin: .zero, size: f.size)
        pastille.center = CGPoint(x: f.midX, y: f.midY)
        pastille.layer.cornerRadius = f.height / 2
        pastille.alpha = 1
    }

    private func lePlusProche(de x: CGFloat) -> Bouton? {
        centre.min { abs(cadre(de: $0.vue).midX - x) < abs(cadre(de: $1.vue).midX - x) }
    }

    // MARK: Le balayage

    @objc private func balayer(_ geste: UIPanGestureRecognizer) {
        guard let premier = centre.first, let dernier = centre.last else { return }
        let x = min(max(geste.location(in: pilule.contentView).x, cadre(de: premier.vue).midX), cadre(de: dernier.vue).midX)
        switch geste.state {
        case .began:
            selection.prepare()
            survole = actif ?? ""
            if pastille.alpha == 0, let proche = lePlusProche(de: x) {
                // Aucun bouton allumé ici : la pastille naît sous le doigt.
                let f = cadre(de: proche.vue)
                pastille.bounds = CGRect(origin: .zero, size: f.size)
                pastille.center = CGPoint(x: x, y: f.midY)
                pastille.layer.cornerRadius = f.height / 2
            }
            UIView.animate(withDuration: 0.3, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.6,
                           options: [.beginFromCurrentState, .allowUserInteraction]) {
                self.pastille.alpha = 1
                self.pastille.transform = CGAffineTransform(scaleX: 1.3, y: 1.3)
                self.pastille.backgroundColor = UIColor.white.withAlphaComponent(0.6)
                self.pastille.layer.shadowColor = UIColor.black.cgColor
                self.pastille.layer.shadowOpacity = 0.12
                self.pastille.layer.shadowRadius = 8
                self.pastille.layer.shadowOffset = CGSize(width: 0, height: 2)
            }
            suivre(x)
        case .changed:
            suivre(x)
        default:
            let cible = geste.state == .ended ? lePlusProche(de: x)?.id : nil
            survole = nil
            actif = cible ?? actif
            styler(actif: actif)
            UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.72, initialSpringVelocity: 0.3,
                           options: [.beginFromCurrentState, .allowUserInteraction]) {
                self.pastille.backgroundColor = self.bleu.withAlphaComponent(0.12)
                self.pastille.layer.shadowOpacity = 0
                self.placerPastille()
            }
            if let cible {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                toucher?(cible)
            }
        }
    }

    /// La pastille suit le doigt ; le bouton dessous s'allume, avec un clic.
    private func suivre(_ x: CGFloat) {
        pastille.center.x = x
        guard let proche = lePlusProche(de: x), proche.id != survole else { return }
        survole = proche.id
        styler(actif: proche.id)
        selection.selectionChanged()
        selection.prepare()
    }

    // MARK: Les boutons

    private func rond(_ b: BoutonDeBarre, aGauche: Bool) -> UIVisualEffectView {
        let rond = BarreOnglets.verre()
        rond.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rond)
        let contenu = bouton(b, cote: 52, dansLaPilule: false)
        contenu.layer.cornerRadius = 26
        rond.contentView.addSubview(contenu)
        NSLayoutConstraint.activate([
            rond.widthAnchor.constraint(equalToConstant: 52),
            rond.heightAnchor.constraint(equalToConstant: 52),
            rond.centerYAnchor.constraint(equalTo: centerYAnchor),
            aGauche ? rond.leadingAnchor.constraint(equalTo: leadingAnchor) : rond.trailingAnchor.constraint(equalTo: trailingAnchor),
            contenu.centerXAnchor.constraint(equalTo: rond.contentView.centerXAnchor),
            contenu.centerYAnchor.constraint(equalTo: rond.contentView.centerYAnchor)
        ])
        ronds.append(Bouton(id: b.id, symbole: b.symbole, vue: contenu, rond: true))
        return rond
    }

    private func bouton(_ b: BoutonDeBarre, cote: CGFloat, dansLaPilule: Bool) -> UIButton {
        let bouton = UIButton(type: .system)
        bouton.setImage(BarreOnglets.image(b.symbole, plein: false), for: .normal)
        bouton.accessibilityLabel = b.libelle
        bouton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            bouton.widthAnchor.constraint(equalToConstant: cote),
            bouton.heightAnchor.constraint(equalToConstant: cote)
        ])
        let id = b.id
        bouton.addAction(UIAction { [weak self] _ in
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            // La pastille part tout de suite, sans attendre que la page change.
            if dansLaPilule { self?.changerActif(id, anime: true) }
            self?.toucher?(id)
        }, for: .touchUpInside)
        return bouton
    }
}
