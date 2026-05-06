const IS_PROD = process.env.NODE_ENV === 'production'

function serialize<T>(rows: any[]): T[] {
  return JSON.parse(JSON.stringify(rows)) as T[]
}

// Convertit le SQL SQLite → PostgreSQL
function adaptSql(sql: string): string {
  let i = 0
  return sql
    // Placeholders ? → $1, $2...
    .replace(/\?/g, () => `$${++i}`)
    // datetime SQLite → NOW() PostgreSQL
    .replace(/datetime\('now'\)/g, 'NOW()')
    // Gestion des booléens dans WHERE
    .replace(/(\w+)\s*=\s*1\b/g, (match, col) => {
      const boolCols = ['est_actif', 'est_active', 'est_vedette', 'lue']
      return boolCols.includes(col) ? `${col} = TRUE` : match
    })
    .replace(/(\w+)\s*=\s*0\b/g, (match, col) => {
      const boolCols = ['est_actif', 'est_active', 'est_vedette', 'lue']
      return boolCols.includes(col) ? `${col} = FALSE` : match
    })
}

// Convertit les valeurs 0/1 en TRUE/FALSE pour les colonnes booléennes
function adaptParams(sql: string, params: any[]): any[] {
  if (!IS_PROD) return params
  const boolCols = ['est_actif', 'est_active', 'est_vedette', 'lue']
  // Trouver les colonnes dans le SQL (INSERT ou UPDATE)
  const colMatches = sql.match(/\b(est_actif|est_active|est_vedette|lue)\b/g) || []
  if (colMatches.length === 0) return params

  // Pour INSERT: convertir les params correspondants
  if (/^\s*INSERT/i.test(sql)) {
    const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
    if (colsMatch) {
      const cols = colsMatch[1].split(',').map(c => c.trim())
      return params.map((p, idx) => {
        if (boolCols.includes(cols[idx]) && (p === 0 || p === 1)) {
          return p === 1
        }
        return p
      })
    }
  }

  // Pour UPDATE: convertir les valeurs 0/1 qui suivent les colonnes booléennes
  return params.map(p => {
    if ((p === 0 || p === 1) && colMatches.length > 0) {
      return p === 1 ? true : false
    }
    return p
  })
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
      const adapted = adaptSql(sql)
      const adaptedParams = adaptParams(sql, params)
      const { rows } = await getPgPool().query(adapted, adaptedParams)
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
      const adaptedParams = adaptParams(sql, params)
      const pgSql = /^\s*INSERT/i.test(sql) ? adapted + ' RETURNING id' : adapted
      const res = await getPgPool().query(pgSql, adaptedParams)
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
