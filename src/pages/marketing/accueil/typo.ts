/**
 * Les espaces insécables de la typographie française : avant les deux-points,
 * le point-virgule, les points d'exclamation et d'interrogation, et à
 * l'intérieur des guillemets. Sans elles, un « ? » ou un « : » part seul en
 * début de ligne dès que la colonne se resserre.
 */
export function typo<T>(t: T): T {
  if (typeof t !== 'string') return t
  return t.replace(/ ([:;!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0') as T
}
