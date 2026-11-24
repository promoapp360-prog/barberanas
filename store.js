// Archivio dati: PostgreSQL se è impostata DATABASE_URL (Replit), altrimenti memoria (solo per prove locali).
//
// Modello:
//  - customers: i clienti con la loro tessera (token nel link/QR)
//  - promos: le promozioni create dal barbiere
//      kind 'punti'   -> raccolta timbri (goal timbri -> premio), es. "6 tagli, il 7° gratis"
//      kind 'offerta' -> offerta/annuncio mostrato sulla tessera, es. "Barba -50% fino a domenica"
//  - progress: i timbri di ogni cliente per ogni raccolta punti
//  - events: storico (iscrizione, timbro, correzione, omaggio)
const crypto = require('crypto');

const DEFAULT_PROMO = { kind: 'punti', title: 'Taglio', emoji: '✂️', goal: 6, reward: 'Il 7° taglio è gratis', description: '', active: true, ends_at: null };

function newToken() { return crypto.randomBytes(12).toString('base64url'); }
function todayRome() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); }
function isLive(p) {
  if (!p.active) return false;
  if (!p.ends_at) return true;
  const end = typeof p.ends_at === 'string' ? p.ends_at.slice(0, 10) : p.ends_at.toLocaleDateString('sv-SE');
  return end >= todayRome();
}
function dateOnly(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  return v.toLocaleDateString('sv-SE');
}
function cleanPromo(p) {
  return { ...p, ends_at: dateOnly(p.ends_at), live: isLive(p) };
}

// ---------- PostgreSQL ----------
function pgStore(url) {
  const { Pool, types } = require('pg');
  types.setTypeParser(1082, (v) => v); // DATE come stringa 'YYYY-MM-DD'
  const ssl = /localhost|127\.0\.0\.1|helium/.test(url) || process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: url, ssl });
  const q = (text, params) => pool.query(text, params);

  const store = {
    kind: 'postgres',
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        visits INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_visit TIMESTAMPTZ
      )`);
      await q(`CREATE TABLE IF NOT EXISTS promos (
        id SERIAL PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('punti','offerta')),
        title TEXT NOT NULL,
        emoji TEXT NOT NULL DEFAULT '✂️',
        goal INTEGER,
        reward TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT true,
        ends_at DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await q(`CREATE TABLE IF NOT EXISTS progress (
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        promo_id INTEGER NOT NULL REFERENCES promos(id) ON DELETE CASCADE,
        stamps INTEGER NOT NULL DEFAULT 0,
        rewards INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (customer_id, promo_id)
      )`);
      await q(`CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        promo_id INTEGER REFERENCES promos(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await q(`CREATE INDEX IF NOT EXISTS events_customer_idx ON events(customer_id, created_at DESC)`);
      const n = (await q('SELECT count(*)::int AS n FROM promos')).rows[0].n;
      if (!n) await store.createPromo(DEFAULT_PROMO);
    },

    // --- clienti ---
    async findByPhone(phone) { return (await q('SELECT * FROM customers WHERE phone=$1', [phone])).rows[0] || null; },
    async findByToken(token) { return (await q('SELECT * FROM customers WHERE token=$1', [token])).rows[0] || null; },
    async findById(id) { return (await q('SELECT * FROM customers WHERE id=$1', [id])).rows[0] || null; },
    async create(name, phone) {
      const r = await q(`INSERT INTO customers (token, name, phone) VALUES ($1,$2,$3) ON CONFLICT (phone) DO NOTHING RETURNING *`, [newToken(), name, phone]);
      if (r.rows[0]) {
        await q(`INSERT INTO events (customer_id, type) VALUES ($1,'iscrizione')`, [r.rows[0].id]);
        return { customer: r.rows[0], created: true };
      }
      return { customer: await store.findByPhone(phone), created: false };
    },
    async list(search) {
      const order = 'ORDER BY last_visit DESC NULLS LAST, created_at DESC LIMIT 100';
      if (search) {
        const like = `%${search.toLowerCase()}%`;
        return (await q(`SELECT * FROM customers WHERE lower(name) LIKE $1 OR phone LIKE $1 ${order}`, [like])).rows;
      }
      return (await q(`SELECT * FROM customers ${order}`)).rows;
    },
    async update(id, name, phone) { return (await q('UPDATE customers SET name=$2, phone=$3 WHERE id=$1 RETURNING *', [id, name, phone])).rows[0] || null; },
    async remove(id) { await q('DELETE FROM customers WHERE id=$1', [id]); },
    async progressFor(ids) {
      if (!ids.length) return [];
      return (await q('SELECT * FROM progress WHERE customer_id = ANY($1::int[])', [ids])).rows;
    },
    async events(id) {
      return (await q(`SELECT e.type, e.created_at, p.title AS promo, p.emoji FROM events e
        LEFT JOIN promos p ON p.id=e.promo_id WHERE e.customer_id=$1 ORDER BY e.created_at DESC LIMIT 50`, [id])).rows;
    },

    // --- timbri ---
    async stamp(cid, pid, goal) {
      const r = await q(`INSERT INTO progress (customer_id, promo_id, stamps) VALUES ($1,$2,1)
        ON CONFLICT (customer_id, promo_id) DO UPDATE SET stamps=progress.stamps+1 WHERE progress.stamps < $3
        RETURNING *`, [cid, pid, goal]);
      if (!r.rows[0]) return null;
      await q('UPDATE customers SET visits=visits+1, last_visit=now() WHERE id=$1', [cid]);
      await q(`INSERT INTO events (customer_id, promo_id, type) VALUES ($1,$2,'timbro')`, [cid, pid]);
      return r.rows[0];
    },
    async unstamp(cid, pid) {
      const r = await q(`UPDATE progress SET stamps=stamps-1 WHERE customer_id=$1 AND promo_id=$2 AND stamps>0 RETURNING *`, [cid, pid]);
      if (!r.rows[0]) return null;
      await q('UPDATE customers SET visits=GREATEST(visits-1,0) WHERE id=$1', [cid]);
      await q(`INSERT INTO events (customer_id, promo_id, type) VALUES ($1,$2,'correzione')`, [cid, pid]);
      return r.rows[0];
    },
    async redeem(cid, pid, goal) {
      const r = await q(`UPDATE progress SET stamps=0, rewards=rewards+1 WHERE customer_id=$1 AND promo_id=$2 AND stamps >= $3 RETURNING *`, [cid, pid, goal]);
      if (!r.rows[0]) return null;
      await q('UPDATE customers SET visits=visits+1, last_visit=now() WHERE id=$1', [cid]);
      await q(`INSERT INTO events (customer_id, promo_id, type) VALUES ($1,$2,'omaggio')`, [cid, pid]);
      return r.rows[0];
    },

    // --- promozioni ---
    async promos() { return (await q('SELECT * FROM promos ORDER BY active DESC, kind DESC, created_at')).rows.map(cleanPromo); },
    async promo(id) { const p = (await q('SELECT * FROM promos WHERE id=$1', [id])).rows[0]; return p ? cleanPromo(p) : null; },
    async createPromo(p) {
      const r = await q(`INSERT INTO promos (kind,title,emoji,goal,reward,description,active,ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [p.kind, p.title, p.emoji, p.goal, p.reward, p.description, p.active, p.ends_at]);
      return cleanPromo(r.rows[0]);
    },
    async updatePromo(id, p) {
      const r = await q(`UPDATE promos SET title=$2, emoji=$3, goal=$4, reward=$5, description=$6, active=$7, ends_at=$8 WHERE id=$1 RETURNING *`,
        [id, p.title, p.emoji, p.goal, p.reward, p.description, p.active, p.ends_at]);
      return r.rows[0] ? cleanPromo(r.rows[0]) : null;
    },
    async deletePromo(id) { await q('DELETE FROM promos WHERE id=$1', [id]); },

    async stats() {
      const c = (await q(`SELECT count(*)::int AS customers FROM customers`)).rows[0];
      const r = (await q(`SELECT coalesce(sum(pr.rewards),0)::int AS rewards,
        count(DISTINCT pr.customer_id) FILTER (WHERE pr.stamps >= p.goal AND p.active)::int AS ready
        FROM progress pr JOIN promos p ON p.id=pr.promo_id`)).rows[0];
      const t = (await q(`SELECT count(*)::int AS today FROM events WHERE type IN ('timbro','omaggio')
        AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Rome') AT TIME ZONE 'Europe/Rome')`)).rows[0];
      return { customers: c.customers, rewards: r.rewards, ready: r.ready, today: t.today };
    },
  };
  return store;
}

// ---------- Memoria (prove locali) ----------
function memoryStore() {
  let cSeq = 0, pSeq = 0;
  const customers = [], promos = [], progress = [], events = [];
  const now = () => new Date().toISOString();
  const log = (customer_id, promo_id, type) => events.push({ customer_id, promo_id, type, created_at: now() });
  const byId = (id) => customers.find((c) => c.id === Number(id)) || null;
  const prog = (cid, pid, create) => {
    let r = progress.find((x) => x.customer_id === Number(cid) && x.promo_id === Number(pid));
    if (!r && create) { r = { customer_id: Number(cid), promo_id: Number(pid), stamps: 0, rewards: 0 }; progress.push(r); }
    return r || null;
  };

  const store = {
    kind: 'memory',
    async init() { if (!promos.length) await store.createPromo(DEFAULT_PROMO); },
    async findByPhone(phone) { return customers.find((c) => c.phone === phone) || null; },
    async findByToken(token) { return customers.find((c) => c.token === token) || null; },
    async findById(id) { return byId(id); },
    async create(name, phone) {
      const ex = customers.find((c) => c.phone === phone);
      if (ex) return { customer: ex, created: false };
      const c = { id: ++cSeq, token: newToken(), name, phone, visits: 0, created_at: now(), last_visit: null };
      customers.push(c); log(c.id, null, 'iscrizione');
      return { customer: c, created: true };
    },
    async list(search) {
      let r = customers.slice();
      if (search) { const s = search.toLowerCase(); r = r.filter((c) => c.name.toLowerCase().includes(s) || c.phone.includes(s)); }
      return r.sort((a, b) => String(b.last_visit || b.created_at).localeCompare(String(a.last_visit || a.created_at))).slice(0, 100);
    },
    async update(id, name, phone) { const c = byId(id); if (!c) return null; c.name = name; c.phone = phone; return c; },
    async remove(id) {
      const i = customers.findIndex((c) => c.id === Number(id));
      if (i >= 0) customers.splice(i, 1);
      for (let j = progress.length - 1; j >= 0; j--) if (progress[j].customer_id === Number(id)) progress.splice(j, 1);
    },
    async progressFor(ids) { return progress.filter((p) => ids.includes(p.customer_id)); },
    async events(id) {
      return events.filter((e) => e.customer_id === Number(id)).slice().reverse().slice(0, 50).map((e) => {
        const p = promos.find((x) => x.id === e.promo_id);
        return { type: e.type, created_at: e.created_at, promo: p ? p.title : null, emoji: p ? p.emoji : null };
      });
    },
    async stamp(cid, pid, goal) {
      const c = byId(cid); if (!c) return null;
      const r = prog(cid, pid, true); if (r.stamps >= goal) return null;
      r.stamps++; c.visits++; c.last_visit = now(); log(c.id, Number(pid), 'timbro'); return r;
    },
    async unstamp(cid, pid) {
      const c = byId(cid); const r = prog(cid, pid); if (!c || !r || r.stamps <= 0) return null;
      r.stamps--; c.visits = Math.max(c.visits - 1, 0); log(c.id, Number(pid), 'correzione'); return r;
    },
    async redeem(cid, pid, goal) {
      const c = byId(cid); const r = prog(cid, pid); if (!c || !r || r.stamps < goal) return null;
      r.stamps = 0; r.rewards++; c.visits++; c.last_visit = now(); log(c.id, Number(pid), 'omaggio'); return r;
    },
    async promos() {
      return promos.slice().sort((a, b) => (b.active - a.active) || b.kind.localeCompare(a.kind) || a.id - b.id).map(cleanPromo);
    },
    async promo(id) { const p = promos.find((x) => x.id === Number(id)); return p ? cleanPromo(p) : null; },
    async createPromo(p) { const n = { ...p, id: ++pSeq, created_at: now() }; promos.push(n); return cleanPromo(n); },
    async updatePromo(id, p) {
      const x = promos.find((y) => y.id === Number(id)); if (!x) return null;
      Object.assign(x, { title: p.title, emoji: p.emoji, goal: p.goal, reward: p.reward, description: p.description, active: p.active, ends_at: p.ends_at });
      return cleanPromo(x);
    },
    async deletePromo(id) {
      const i = promos.findIndex((x) => x.id === Number(id)); if (i >= 0) promos.splice(i, 1);
      for (let j = progress.length - 1; j >= 0; j--) if (progress[j].promo_id === Number(id)) progress.splice(j, 1);
    },
    async stats() {
      const today = todayRome();
      const ready = new Set(progress.filter((r) => { const p = promos.find((x) => x.id === r.promo_id); return p && p.active && r.stamps >= p.goal; }).map((r) => r.customer_id));
      return {
        customers: customers.length,
        rewards: progress.reduce((s, r) => s + r.rewards, 0),
        ready: ready.size,
        today: events.filter((e) => (e.type === 'timbro' || e.type === 'omaggio') && new Date(e.created_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) === today).length,
      };
    },
  };
  return store;
}

module.exports = {
  isLive,
  createStore() {
    const url = process.env.DATABASE_URL;
    return url ? pgStore(url) : memoryStore();
  },
};
