const fs = require('fs');
const tables = ['vecinos', 'alertas', 'confirmaciones', 'pedidos_confirmacion', 'anuncios', 'bitacora', 'media'];
const empty = () => Object.fromEntries(tables.map(t => [t, []]));
class Store {
  constructor() { this.data = empty(); this.pool = process.env.DATABASE_URL ? new (require('pg').Pool)({ connectionString: process.env.DATABASE_URL }) : null; this.queue = Promise.resolve(); }
  async init() { if (this.pool) { await this.pool.query(fs.readFileSync(require('path').join(__dirname, 'schema.sql'), 'utf8')); await this.load(); } }
  async load() { for (const t of tables) this.data[t] = (await this.pool.query(`SELECT * FROM ${t}`)).rows; }
  async save() {
    if (!this.pool) return;
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN'); await c.query('LOCK TABLE vecinos, alertas, confirmaciones, pedidos_confirmacion, anuncios, bitacora, media IN EXCLUSIVE MODE');
      for (const t of [...tables].reverse()) await c.query(`DELETE FROM ${t}`);
      for (const t of tables) for (const row of this.data[t]) { const keys = Object.keys(row); if (!keys.length) continue; await c.query(`INSERT INTO ${t} (${keys.map(k => '"' + k + '"').join(',')}) VALUES (${keys.map((_, i) => '$' + (i+1)).join(',')})`, keys.map(k => Array.isArray(row[k]) || (row[k] && typeof row[k] === 'object' && !(row[k] instanceof Date)) ? JSON.stringify(row[k]) : row[k])); }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async transaction(fn) { const next = this.queue.then(async () => { const result = await fn(this.data); await this.save(); return result; }); this.queue = next.catch(() => {}); return next; }
}
module.exports = Store;
