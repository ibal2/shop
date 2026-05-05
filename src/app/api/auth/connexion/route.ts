import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { verifyPassword, validatePhone, sanitize, createToken, COOKIE_NAME_CLIENT } from '@/lib/auth'

const attempts = new Map<string, { count: number; time: number }>()

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const att = attempts.get(ip)
    if (att && att.count >= 5 && now - att.time < 15 * 60 * 1000)
      return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 15 min.' }, { status: 429 })

    const { telephone, mot_de_passe } = await req.json()
    if (!telephone || !mot_de_passe)
      return NextResponse.json({ error: 'Numéro et mot de passe requis' }, { status: 400 })
    if (!validatePhone(telephone))
      return NextResponse.json({ error: 'Numéro invalide' }, { status: 400 })

    // db.ts convertit automatiquement "= 1" en "= TRUE" pour PostgreSQL
    const client = await queryOne<any>(
      'SELECT * FROM clients WHERE telephone = ? AND est_actif = 1',
      [sanitize(telephone)]
    )
    const valid = client && await verifyPassword(mot_de_passe, client.mot_de_passe)

    if (!valid) {
      attempts.set(ip, { count: (att?.count || 0) + 1, time: now })
      return NextResponse.json({ error: 'Numéro ou mot de passe incorrect' }, { status: 401 })
    }

    attempts.delete(ip)
    const { mot_de_passe: _, ...safeClient } = client
    const token = await createToken({ id: client.id, telephone: client.telephone, role: 'client' })

    const response = NextResponse.json({ client: safeClient })
    response.cookies.set(COOKIE_NAME_CLIENT, token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/',
    })
    return response
  } catch (err) {
    console.error('Connexion error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
