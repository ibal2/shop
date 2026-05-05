/**
 * Couche base de données universelle
 * LOCAL  → SQLite via @libsql/client
 * PROD   → PostgreSQL via pg
 *
 * Gère automatiquement les différences SQLite/PostgreSQL :
 * - Placeholders ? → $1, $2...
 * - Booléens 1/0 → TRUE/FALSE
 * - datetime('now') → NOW()
 */

const IS_PROD = process.env.NODE_ENV === 'production'

function serialize<T>(rows: any[]): T[] {
  return JSON.parse(JSON.stringify(rows)) as T[]
}

// Adapte le SQL SQLite → PostgreSQL automatiquement
function adaptSql(sql: string): string {
  let i = 0
  return sql
    .replace(/\?/g, () => `$${++i}`)                          // placeholders
    .replace(/= 1\b/g, '= TRUE')                              // est_actif = 1
    .replace(/= 0\b/g, '= FALSE')                             // est_actif = 0
    .replace(/datetime\('now'\)/g, 'NOW()')                   // dates
    .replace(/est_actif\s*=\s*TRUE/g, 'est_actif = TRUE')
    .replace(/est_active\s*=\s*TRUE/g, 'est_active = TRUE')
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
let _pgPool: any = null
function getPgPool() {
  if (!_pgPool) {
    const { Pool } = require('pg')
    _pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  }
  return _pgPool
}

// ─── SQLite libsql ────────────────────────────────────────────────────────────
let _sqliteClient: any = null
async function getSqliteClient() {
  if (!_sqliteClient) {
    const { createClient } = require('@libsql/client')
    const path = require('path')
    const fs = require('fs')
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    _sqliteClient = createClient({ url: `file:${path.join(dataDir, 'shop.db')}` })
  }
  return _sqliteClient
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    if (IS_PROD) {
      const { rows } = await getPgPool().query(adaptSql(sql), params)
      return serialize<T>(rows)
    } else {
      const client = await getSqliteClient()
      const res = await client.execute({ sql, args: params })
      return serialize<T>(res.rows)
    }
  } catch (err) {
    console.error('DB query error:', err)
    throw new Error('Erreur base de données')
  }
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export async function execute(sql: string, params: any[] = []): Promise<{ lastInsertRowid?: number; changes?: number }> {
  try {
    if (IS_PROD) {
      const adapted = adaptSql(sql)
      const pgSql = /^\s*INSERT/i.test(sql) ? adapted + ' RETURNING id' : adapted
      const res = await getPgPool().query(pgSql, params)
      return { lastInsertRowid: res.rows?.[0]?.id, changes: res.rowCount ?? 0 }
    } else {
      const client = await getSqliteClient()
      const res = await client.execute({ sql, args: params })
      return {
        lastInsertRowid: Number(res.lastInsertRowid ?? 0),
        changes: res.rowsAffected ?? 0,
      }
    }
  } catch (err) {
    console.error('DB execute error:', err)
    throw new Error('Erreur base de données')
  }
}
