// Les pages publiques de diagly.ch, rendues en HTML après `vite build`.
//
// L'application est une page React : sans JavaScript, un robot ne voit
// qu'une page vide. Les moteurs de recherche et la plupart des assistants
// d'IA (ChatGPT, Claude, Perplexity) lisent le HTML tel qu'il arrive. Ce
// script rend donc chaque page publique (accueil, fonctionnalités, blog et
// articles) avec sa tête (titre, description, adresse canonique, données
// structurées), dans dist/prerendu/. Le serveur sert ces fichiers pour ces
// adresses (server/src/index.ts) ; l'application, elle, garde dist/index.html.
//
// Il écrit aussi dist/sitemap.xml, et dist/llms.txt et dist/llms-full.txt :
// le résumé de Diagly que lisent les assistants d'IA, et sa version longue,
// avec le texte des articles.
//
// Lancé par `npm run build`, après la compilation du site.

import { build } from 'vite'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(RACINE, 'dist')
const SSR = join(RACINE, 'dist-prerendu')
const SORTIE = join(DIST, 'prerendu')

// 1. Le code des pages, compilé pour Node.
await build({
  root: RACINE,
  logLevel: 'warn',
  build: {
    ssr: 'src/prerendu.tsx',
    outDir: SSR,
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: 'prerendu.mjs' } },
  },
})
const m = await import(pathToFileURL(join(SSR, 'prerendu.mjs')).href)

// 2. Chaque page, dans la coquille du build (ses styles et son script).
const gabarit = readFileSync(join(DIST, 'index.html'), 'utf8')
const attribut = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const texte = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

function avecLaTete(html, t) {
  const url = `${m.SITE}${t.chemin === '/' ? '/' : t.chemin}`
  const remplacer = (motif, valeur) => {
    if (!motif.test(html)) throw new Error(`Gabarit : introuvable ${motif}`)
    html = html.replace(motif, valeur)
  }
  remplacer(/<title>[^<]*<\/title>/, `<title>${texte(t.titre)}</title>`)
  remplacer(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${attribut(t.description)}" />\n    <link rel="canonical" href="${url}" />`)
  remplacer(/<meta property="og:type" content="[^"]*" \/>/, `<meta property="og:type" content="${t.type}" />`)
  remplacer(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
  remplacer(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${attribut(t.titre)}" />`)
  remplacer(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${attribut(t.description)}" />`)
  remplacer(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${attribut(t.titre)}" />`)
  remplacer(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${attribut(t.description)}" />`)
  // Les données structurées, en un graphe ; « </ » échappé pour ne jamais fermer la balise.
  const graphe = JSON.stringify({ '@context': 'https://schema.org', '@graph': t.jsonld }).replace(/<\//g, '<\\/')
  html = html.replace('</head>', `    <script type="application/ld+json">${graphe}</script>\n  </head>`)
  return html
}

rmSync(SORTIE, { recursive: true, force: true })
for (const page of m.PAGES) {
  const corps = m.rendre(page)
  let html = avecLaTete(gabarit, page.tete)
  if (!html.includes('<div id="root"></div>')) throw new Error('Gabarit : <div id="root"></div> introuvable')
  html = html.replace('<div id="root"></div>', `<div id="prerendu">${corps}</div><div id="root"></div>`)
  const fichier = join(SORTIE, page.fichier)
  mkdirSync(dirname(fichier), { recursive: true })
  writeFileSync(fichier, html)
  console.log(`prérendu ${page.tete.chemin.padEnd(48)} ${Math.round(html.length / 1024)} Ko`)
}

// 3. Le plan du site.
const aujourdhui = new Date().toISOString().slice(0, 10)
const datesArticles = new Map(m.ARTICLES.map((a) => [`/blog/${a.slug}`, a.date]))
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${m.PAGES.map((p) => `  <url><loc>${m.SITE}${p.tete.chemin === '/' ? '/' : p.tete.chemin}</loc><lastmod>${datesArticles.get(p.tete.chemin) ?? aujourdhui}</lastmod></url>`).join('\n')}
</urlset>
`
writeFileSync(join(DIST, 'sitemap.xml'), sitemap)

// 4. Ce que lisent les assistants d'IA : llms.txt (le résumé) et llms-full.txt (avec les articles).
const f = m.francs
const llms = `# Diagly

> Diagly est un logiciel suisse de diagnostic de bâtiment et de planification de rénovation, créé par des professionnels du bâtiment en Suisse romande. Il tire les métrés des plans avec l’IA, guide le relevé de l’état sur iPad et iPhone (même hors connexion), chiffre les travaux par code CFC et produit le rapport à l’en-tête du bureau. Les données sont hébergées en Suisse.

Diagly s’adresse aux diagnostiqueurs, architectes, bureaux d’ingénieurs, régies et gérances de Suisse romande. Il est publié par Finalyn. Contact : ${m.CONTACT.replace('mailto:', '')}.

## Ce que fait Diagly

${m.FONCTIONNALITES_CLES.map((x) => `- ${x}`).join('\n')}

## Tarifs

- Diagnostic à l’unité : ${f(m.PRIX_DIAGNOSTIC)} par diagnostic.
- Tarif dégressif dès ${m.SEUIL_DEGRESSIF} diagnostics achetés, sur demande.
- Abonnement : ${f(m.PRIX_ABONNEMENT)} par mois, avec un engagement de ${m.ENGAGEMENT_MOIS} mois ; diagnostics illimités ; rentable dès ${m.SEUIL_RENTABLE} diagnostics par mois ; une heure de formation incluse la première année.
- La démo est offerte.

## Pages

- [Accueil](${m.SITE}/): ce qu’est Diagly, ce qu’il fait, tarifs et questions fréquentes.
- [Fonctionnalités](${m.SITE}/fonctionnalites): chaque outil de Diagly, montré sur l’application.
- [Blog](${m.SITE}/blog): guides pratiques sur le diagnostic de bâtiment en Suisse.
${m.ARTICLES.map((a) => `- [${a.titre}](${m.SITE}/blog/${a.slug}): ${a.description}`).join('\n')}

## Questions fréquentes

${m.QUESTIONS.map((q) => `### ${q.q}\n\n${q.r}`).join('\n\n')}
`
writeFileSync(join(DIST, 'llms.txt'), llms)

const articlesEnTexte = m.ARTICLES.map((a) => [
  `## ${a.titre}`,
  `${m.SITE}/blog/${a.slug} · ${a.date}`,
  `**En bref.** ${a.enBref}`,
  ...a.blocs.map((b) => [
    `### ${b.titre}`,
    ...(b.paragraphes ?? []),
    ...(b.liste ? [b.liste.map((l, i) => (b.ordonnee ? `${i + 1}. ${l}` : `- ${l}`)).join('\n')] : []),
  ].join('\n\n')),
  ...(a.faq ?? []).map((q) => `**${q.q}** ${q.r}`),
  ...(a.mention ? [a.mention] : []),
].join('\n\n')).join('\n\n---\n\n')
writeFileSync(join(DIST, 'llms-full.txt'), `${llms}\n## Articles\n\n${articlesEnTexte}\n`)

rmSync(SSR, { recursive: true, force: true })
console.log(`sitemap.xml (${m.PAGES.length} adresses), llms.txt et llms-full.txt écrits.`)
