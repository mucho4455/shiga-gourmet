const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 8890;
const SITE_DIR = __dirname;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/publish') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { title, slug, tag, excerpt, writer, html } = JSON.parse(body);
        if (!slug || !html) throw new Error('slug and html required');

        // 1. Create article directory and file
        const articleDir = path.join(SITE_DIR, 'articles', slug);
        fs.mkdirSync(articleDir, { recursive: true });

        const articleHTML = buildArticlePage(title, html);
        fs.writeFileSync(path.join(articleDir, 'index.html'), articleHTML, 'utf8');

        // 2. Update index.html with new article card
        addArticleToIndex({ title, slug, tag, excerpt, writer });

        // 3. Git commit & deploy
        const today = new Date().toISOString().slice(0, 10);
        execSync('git add -A', { cwd: SITE_DIR });
        execSync(`git commit -m "Add article: ${title}"`, { cwd: SITE_DIR });
        execSync('git push origin main', { cwd: SITE_DIR });
        execSync('vercel --yes --prod', { cwd: SITE_DIR, timeout: 60000 });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url: `https://shiga-gourmet.vercel.app/articles/${slug}/` }));
      } catch (e) {
        console.error(e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

function buildArticlePage(title, contentHTML) {
  // Strip ```html wrapper if present
  const clean = contentHTML.replace(/^```html\n?/i, '').replace(/\n?```$/i, '');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)}｜ポップリード</title>
<style>
  :root { --dark: #1a1a2e; --primary: #ff6b6b; --bg: #f5f5f7; --white: #fff; --gray: #888; --border: #e0e0e0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', serif; background: var(--bg); color: #333; line-height: 1.9; }
  .site-header { background: var(--dark); color: #fff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
  .site-header h1 { font-size: 16px; letter-spacing: 1px; }
  .site-header h1 em { font-style: normal; color: var(--primary); }
  .site-header a { color: var(--gray); text-decoration: none; font-size: 13px; }
  .article { max-width: 720px; margin: 0 auto; padding: 30px 20px; }
  .article h1 { font-size: 24px; line-height: 1.5; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--primary); }
  .article h2 { font-size: 20px; margin: 36px 0 16px; padding-left: 12px; border-left: 4px solid var(--primary); }
  .article h3 { font-size: 18px; margin: 28px 0 12px; color: var(--dark); }
  .article p { margin-bottom: 16px; font-size: 15px; }
  .article strong { color: var(--dark); }
  .article ul { margin: 12px 0 20px 20px; }
  .article li { margin-bottom: 6px; font-size: 14px; }
  .article table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; font-size: 14px; }
  .article th, .article td { border: 1px solid var(--border); padding: 10px 14px; text-align: left; }
  .article th { background: var(--bg); font-weight: 600; width: 120px; }
  .article details { margin: 10px 0; background: var(--white); border: 1px solid var(--border); border-radius: 8px; }
  .article summary { padding: 12px 16px; cursor: pointer; font-weight: 600; font-size: 14px; }
  .article details p { padding: 0 16px 12px; font-size: 14px; margin: 0; }
  .photo-placeholder { background: var(--bg); border: 2px dashed var(--border); border-radius: 8px; padding: 40px; text-align: center; color: var(--gray); font-size: 13px; margin: 16px 0; }
  .cta { text-align: center; margin: 40px 0; }
  .cta a { background: var(--dark); color: #fff; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; transition: all 0.2s; }
  .cta a:hover { background: var(--primary); }
  .footer { text-align: center; padding: 30px 20px; color: var(--gray); font-size: 12px; border-top: 1px solid var(--border); margin-top: 40px; }
</style>
</head>
<body>
<header class="site-header">
  <h1>POP<em>LEAD</em> MEDIA</h1>
  <a href="/">TOP</a>
</header>
<article class="article">
${clean}
</article>
<footer class="footer">&copy; 2026 POPLEAD MEDIA. All rights reserved.</footer>
</body>
</html>`;
}

function addArticleToIndex({ title, slug, tag, excerpt, writer }) {
  const indexPath = path.join(SITE_DIR, 'index.html');
  let indexHTML = fs.readFileSync(indexPath, 'utf8');

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const newCard = `
    <div class="article-card">
      <a href="/articles/${slug}/">
        <span class="tag">${escapeHTML(tag || '')}</span>
        <h2>${escapeHTML(title)}</h2>
        <p class="excerpt">${escapeHTML(excerpt || '')}</p>
        <div class="meta">${today} ・ ${escapeHTML(writer || '')}</div>
      </a>
    </div>`;

  // Insert after the article-list opening comment
  indexHTML = indexHTML.replace(
    '<!-- 記事が追加されるとここに並ぶ -->',
    '<!-- 記事が追加されるとここに並ぶ -->' + newCard
  );
  fs.writeFileSync(indexPath, indexHTML, 'utf8');
}

function escapeHTML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

server.listen(PORT, () => {
  console.log(`Publish server running on http://localhost:${PORT}`);
  console.log(`POST /publish to deploy articles`);
});
