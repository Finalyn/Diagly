/**
 * Le texte rédigé par l'IA, sans tiret cadratin.
 *
 * La maison n'en met nulle part (voir tirets.test.ts, qui le contrôle dans les
 * sources). Le modèle en écrit pourtant de temps en temps, malgré la consigne :
 * on les remplace avant que la réponse parte vers l'écran. En début de ligne,
 * le tiret servait de puce, il en redevient une ; ailleurs, il séparait deux
 * membres de phrase, une virgule fait le même travail.
 *
 * Le caractère est écrit par son code (\u2014) pour que ce fichier passe
 * lui-même le contrôle des sources.
 */
export function sansTiretCadratin(texte: string): string {
  return texte
    .replace(/^([ \t]*)\u2014[ \t]*/gm, "$1- ")
    .replace(/[ \t]*\u2014[ \t]*/g, ", ")
    .replace(/, ([,.;:!?])/g, "$1");
}
