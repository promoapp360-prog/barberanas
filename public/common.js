// Funzioni condivise
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) { const e = new Error(data.error || 'Errore di rete'); e.status = res.status; throw e; }
  return data;
}

function toast(text, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDay(d) {
  if (!d) return '';
  const [y, m, g] = String(d).slice(0, 10).split('-');
  return new Date(+y, +m - 1, +g).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

function fmtPhone(p) {
  p = String(p || '');
  return p.length === 10 ? `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}` : p;
}

function setManifest(href) {
  let l = document.querySelector('link[rel="manifest"]');
  if (!l) { l = document.createElement('link'); l.rel = 'manifest'; document.head.appendChild(l); }
  l.href = href;
}

async function loadShopName() {
  try {
    const c = await api('/api/config');
    document.querySelectorAll('[data-shop]').forEach((el) => (el.textContent = c.shopName));
    document.title = document.title.replace('{shop}', c.shopName);
    return c;
  } catch { return { shopName: '', goal: 6 }; }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
