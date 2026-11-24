// Tessera punti digitale — server senza framework (solo Node + pg).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');
const { qrSvg } = require('./lib/qr');

const PORT = Number(process.env.PORT) || 5000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Anas';
const SHOP_NAME = process.env.SHOP_NAME || 'Anas Barber';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('tessera:' + ADMIN_PASSWORD).digest('hex');
const SESSION_DAYS = 60;
const PUBLIC = path.join(__dirname, 'public');

const store = createStore();

// ---------- utilità HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}
function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
}
function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Non trovato', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(file);
    const cache = ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600';
    send(res, 200, buf, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
  });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// ---------- sessione admin (cookie firmato) ----------
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function makeSession() { const exp = Date.now() + SESSION_DAYS * 864e5; return `${exp}.${sign('admin.' + exp)}`; }
function isAdmin(req) {
  const s = cookies(req).adm;
  if (!s) return false;
  const [exp, sig] = s.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign('admin.' + exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function sessionCookie(req, value, maxAge) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `adm=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Limite tentativi (login, iscrizione, recupero)
const attempts = new Map();
function tooMany(key, max, windowMs) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  attempts.set(key, list);
  return list.length > max;
}
setInterval(() => attempts.clear(), 6 * 36e5).unref();
const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

// ---------- validazione ----------
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0039')) d = d.slice(4);
  else if (d.startsWith('39') && d.length >= 11) d = d.slice(2);
  return d;
}
const validPhone = (d) => d.length >= 8 && d.length <= 13;
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function parsePromo(b, kind) {
  const out = {
    kind,
    title: clean(b.title, 40),
    emoji: clean(b.emoji, 8) || (kind === 'punti' ? '✂️' : '🔥'),
    goal: null,
    reward: clean(b.reward, 80),
    description: String(b.description ?? '').trim().slice(0, 300),
    active: b.active !== false,
    ends_at: null,
  };
  if (out.title.length < 2) return { error: 'Dai un nome alla promozione.' };
  if (kind === 'punti') {
    const g = Number(b.goal);
    if (!Number.isInteger(g) || g < 1 || g > 30) return { error: 'Il numero di timbri deve essere tra 1 e 30.' };
    out.goal = g;
    if (!out.reward) return { error: 'Scrivi il premio (es. "Il 7° taglio è gratis").' };
  }
  if (b.ends_at) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.ends_at)) return { error: 'Data di scadenza non valida.' };
    out.ends_at = b.ends_at;
  }
  return { promo: out };
}

// ---------- viste ----------
function adminCustomer(c) {
  return { id: c.id, token: c.token, name: c.name, phone: c.phone, visits: c.visits, created_at: c.created_at, last_visit: c.last_visit };
}
async function programsFor(customerId, promos) {
  const live = promos.filter((p) => p.kind === 'punti' && p.live);
  const prog = await store.progressFor([customerId]);
  return live.map((p) => {
    const r = prog.find((x) => x.promo_id === p.id) || { stamps: 0, rewards: 0 };
    return { id: p.id, title: p.title, emoji: p.emoji, goal: p.goal, reward: p.reward, description: p.description, ends_at: p.ends_at, stamps: Math.min(r.stamps, p.goal), rewards: r.rewards };
  });
}
function offersFrom(promos) {
  return promos.filter((p) => p.kind === 'offerta' && p.live).map((p) => ({ id: p.id, title: p.title, emoji: p.emoji, description: p.description, ends_at: p.ends_at }));
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  let mm;

  if (p === '/api/config' && m === 'GET') return json(res, 200, { shopName: SHOP_NAME });

  // Promozioni attive (pagina iscrizione)
  if (p === '/api/promos' && m === 'GET') {
    const promos = await store.promos();
    return json(res, 200, {
      programs: promos.filter((x) => x.kind === 'punti' && x.live).map((x) => ({ title: x.title, emoji: x.emoji, goal: x.goal, reward: x.reward })),
      offers: offersFrom(promos),
    });
  }

  if (p === '/api/register' && m === 'POST') {
    if (tooMany('reg:' + ip(req), 20, 36e5)) return json(res, 429, { error: 'Troppi tentativi, riprova più tardi.' });
    const b = await readBody(req);
    const name = clean(b.name, 60);
    const phone = normPhone(b.phone);
    if (name.length < 2) return json(res, 400, { error: 'Inserisci nome e cognome.' });
    if (!validPhone(phone)) return json(res, 400, { error: 'Numero di telefono non valido.' });
    const { customer, created } = await store.create(name, phone);
    return json(res, 200, { token: customer.token, created });
  }

  if (p === '/api/recover' && m === 'POST') {
    if (tooMany('rec:' + ip(req), 10, 36e5)) return json(res, 429, { error: 'Troppi tentativi, riprova più tardi.' });
    const b = await readBody(req);
    const c = await store.findByPhone(normPhone(b.phone));
    if (!c) return json(res, 404, { error: 'Nessuna tessera con questo numero.' });
    return json(res, 200, { token: c.token });
  }

  // Tessera del cliente
  mm = p.match(/^\/api\/card\/([\w-]{8,40})$/);
  if (mm && m === 'GET') {
    const c = await store.findByToken(mm[1]);
    if (!c) return json(res, 404, { error: 'Tessera non trovata.' });
    const promos = await store.promos();
    return json(res, 200, { shopName: SHOP_NAME, name: c.name, visits: c.visits, programs: await programsFor(c.id, promos), offers: offersFrom(promos) });
  }

  // ---- Admin ----
  if (p === '/api/admin/login' && m === 'POST') {
    if (tooMany('login:' + ip(req), 10, 15 * 6e4)) return json(res, 429, { error: 'Troppi tentativi. Attendi 15 minuti.' });
    const b = await readBody(req);
    if (!safeEqual(b.password || '', ADMIN_PASSWORD)) return json(res, 401, { error: 'Password errata.' });
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, makeSession(), SESSION_DAYS * 86400) });
  }
  if (p === '/api/admin/logout' && m === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });

  if (!p.startsWith('/api/admin/')) return json(res, 404, { error: 'Non trovato.' });
  if (!isAdmin(req)) return json(res, 401, { error: 'Accesso richiesto.' });

  if (p === '/api/admin/me' && m === 'GET') return json(res, 200, { ok: true, shopName: SHOP_NAME });
  if (p === '/api/admin/stats' && m === 'GET') return json(res, 200, await store.stats());

  // Promozioni
  if (p === '/api/admin/promos' && m === 'GET') return json(res, 200, await store.promos());
  if (p === '/api/admin/promos' && m === 'POST') {
    const b = await readBody(req);
    const kind = b.kind === 'offerta' ? 'offerta' : 'punti';
    const r = parsePromo(b, kind);
    if (r.error) return json(res, 400, { error: r.error });
    return json(res, 200, await store.createPromo(r.promo));
  }
  mm = p.match(/^\/api\/admin\/promos\/(\d+)$/);
  if (mm) {
    const old = await store.promo(Number(mm[1]));
    if (!old) return json(res, 404, { error: 'Promozione non trovata.' });
    if (m === 'PUT') {
      const r = parsePromo(await readBody(req), old.kind);
      if (r.error) return json(res, 400, { error: r.error });
      return json(res, 200, await store.updatePromo(old.id, r.promo));
    }
    if (m === 'DELETE') { await store.deletePromo(old.id); return json(res, 200, { ok: true }); }
  }

  // Clienti
  if (p === '/api/admin/customers' && m === 'GET') {
    const q = clean(url.searchParams.get('q'), 40);
    const search = /^[\d\s+]+$/.test(q) ? normPhone(q) || q.replace(/\D/g, '') : q;
    const list = await store.list(search);
    const prog = await store.progressFor(list.map((c) => c.id));
    return json(res, 200, list.map((c) => ({ ...adminCustomer(c), progress: prog.filter((x) => x.customer_id === c.id).map((x) => ({ promo_id: x.promo_id, stamps: x.stamps })) })));
  }
  if (p === '/api/admin/customers' && m === 'POST') {
    const b = await readBody(req);
    const name = clean(b.name, 60);
    const phone = normPhone(b.phone);
    if (name.length < 2) return json(res, 400, { error: 'Inserisci il nome.' });
    if (!validPhone(phone)) return json(res, 400, { error: 'Numero non valido.' });
    const { customer, created } = await store.create(name, phone);
    return json(res, 200, { customer: adminCustomer(customer), created });
  }
  mm = p.match(/^\/api\/admin\/token\/([\w-]{8,40})$/);
  if (mm && m === 'GET') {
    const c = await store.findByToken(mm[1]);
    if (!c) return json(res, 404, { error: 'Tessera non riconosciuta.' });
    return json(res, 200, adminCustomer(c));
  }
  mm = p.match(/^\/api\/admin\/customers\/(\d+)(?:\/(stamp|unstamp|redeem))?$/);
  if (mm) {
    const id = Number(mm[1]);
    const action = mm[2];
    const c = await store.findById(id);
    if (!c) return json(res, 404, { error: 'Cliente non trovato.' });

    if (!action && m === 'GET') {
      const promos = await store.promos();
      return json(res, 200, { customer: adminCustomer(c), programs: await programsFor(id, promos), events: await store.events(id) });
    }
    if (!action && m === 'PUT') {
      const b = await readBody(req);
      const name = clean(b.name, 60);
      const phone = normPhone(b.phone);
      if (name.length < 2 || !validPhone(phone)) return json(res, 400, { error: 'Dati non validi.' });
      const other = await store.findByPhone(phone);
      if (other && other.id !== id) return json(res, 409, { error: 'Numero già usato da un altro cliente.' });
      return json(res, 200, adminCustomer(await store.update(id, name, phone)));
    }
    if (!action && m === 'DELETE') { await store.remove(id); return json(res, 200, { ok: true }); }

    if (action && m === 'POST') {
      const b = await readBody(req);
      const promo = await store.promo(Number(b.promoId));
      if (!promo || promo.kind !== 'punti') return json(res, 400, { error: 'Scegli una raccolta punti.' });
      if (action !== 'unstamp' && !promo.live) return json(res, 409, { error: 'Questa promozione non è attiva.' });
      const r = action === 'unstamp' ? await store.unstamp(id, promo.id) : await store[action](id, promo.id, promo.goal);
      if (!r) {
        const msg = { stamp: 'Tessera piena: riscatta prima il premio.', unstamp: 'Non ci sono timbri da togliere.', redeem: `Servono ${promo.goal} timbri per il premio.` }[action];
        return json(res, 409, { error: msg });
      }
      return json(res, 200, { promo_id: promo.id, stamps: r.stamps, rewards: r.rewards, goal: promo.goal });
    }
  }
  return json(res, 404, { error: 'Non trovato.' });
}

// ---------- router ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p.startsWith('/api/')) return await api(req, res, url);
    if (p === '/' || p === '/iscriviti') return serveFile(res, path.join(PUBLIC, 'index.html'));
    if (/^\/c\/[\w-]{8,40}$/.test(p)) return serveFile(res, path.join(PUBLIC, 'card.html'));
    if (p === '/admin' || p === '/admin/') return serveFile(res, path.join(PUBLIC, 'admin.html'));
    if (p === '/locandina') return serveFile(res, path.join(PUBLIC, 'poster.html'));
    if (p === '/healthz') return send(res, 200, 'ok');
    if (p === '/qr.svg') {
      const d = String(url.searchParams.get('d') || '').slice(0, 300);
      if (!d) return send(res, 400, 'Manca il testo');
      return send(res, 200, qrSvg(d), { 'Content-Type': MIME['.svg'], 'Cache-Control': 'public, max-age=86400' });
    }
    // Manifest dinamico: l'icona sulla Home riapre la tessera giusta (o il pannello)
    const mf = p.match(/^\/m\/(admin|home|c-([\w-]{8,40}))\.webmanifest$/);
    if (mf) {
      const adm = mf[1] === 'admin';
      const start = adm ? '/admin' : mf[2] ? `/c/${mf[2]}` : '/';
      return send(res, 200, JSON.stringify({
        name: adm ? `${SHOP_NAME} · Gestione` : `${SHOP_NAME} · Tessera`,
        short_name: adm ? 'Gestione' : 'Tessera',
        id: start, start_url: start, scope: '/', display: 'standalone',
        background_color: '#0d0d0d', theme_color: '#0d0d0d',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      }), { 'Content-Type': MIME['.webmanifest'] });
    }
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Vietato');
    return serveFile(res, file);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Errore del server, riprova.' });
  }
});

store.init()
  .then(() => server.listen(PORT, '0.0.0.0', () => console.log(`Tessera punti "${SHOP_NAME}" su porta ${PORT} (archivio: ${store.kind})`)))
  .catch((e) => { console.error('Errore database:', e); process.exit(1); });

