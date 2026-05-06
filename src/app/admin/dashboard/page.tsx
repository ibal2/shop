import AdminLayout from '@/components/admin/AdminLayout'
import { queryOne, query } from '@/lib/db'
import { TrendingUp, Clock, CheckCircle, Users, Package } from 'lucide-react'
import Link from 'next/link'

const IS_PROD = process.env.NODE_ENV === 'production'

export default async function DashboardPage() {
  let stats: any = { attente: 0, validees: 0, ca: 0, clients: 0, produits: 0 }
  let recentes: any[] = []

  try {
    // Requête stats — gère SQLite et PostgreSQL
    stats = await queryOne<any>(`
      SELECT
        (SELECT COUNT(*) FROM commandes WHERE statut='en_attente') as attente,
        (SELECT COUNT(*) FROM commandes WHERE statut='validée') as validees,
        (SELECT COALESCE(SUM(montant_total),0) FROM commandes WHERE statut='validée') as ca,
        (SELECT COUNT(*) FROM clients) as clients,
        (SELECT COUNT(*) FROM produits WHERE est_actif = ${IS_PROD ? 'TRUE' : '1'}) as produits
    `) || stats

    // GROUP_CONCAT (SQLite) vs STRING_AGG (PostgreSQL)
    if (IS_PROD) {
      recentes = await query<any>(`
        SELECT c.*,
          COALESCE(cl.nom, c.nom_invite) as nom,
          COALESCE(cl.prenom, c.prenom_invite) as prenom,
          STRING_AGG(lg.nom_produit, ', ') as articles
        FROM commandes c
        LEFT JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN commande_lignes lg ON c.id = lg.commande_id
        GROUP BY c.id, cl.nom, cl.prenom, c.nom_invite, c.prenom_invite
        ORDER BY c.id DESC LIMIT 5
      `)
    } else {
      recentes = await query<any>(`
        SELECT c.*,
          COALESCE(cl.nom, c.nom_invite) as nom,
          COALESCE(cl.prenom, c.prenom_invite) as prenom,
          GROUP_CONCAT(lg.nom_produit, ', ') as articles
        FROM commandes c
        LEFT JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN commande_lignes lg ON c.id = lg.commande_id
        GROUP BY c.id ORDER BY c.id DESC LIMIT 5
      `)
    }
  } catch(e) { console.error(e) }

  const cards = [
    { icon: Clock, label: 'En attente', value: stats.attente ?? 0, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', href: '/admin/commandes' },
    { icon: CheckCircle, label: 'Validées', value: stats.validees ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', href: '/admin/commandes' },
    { icon: TrendingUp, label: 'CA total', value: `${Number(stats.ca || 0).toLocaleString('fr-FR')} FCFA`, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', href: '/admin/statistiques' },
    { icon: Users, label: 'Clients', value: stats.clients ?? 0, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', href: '/admin/clients' },
    { icon: Package, label: 'Produits', value: stats.produits ?? 0, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', href: '/admin/produits' },
  ]

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-white/40 text-xs mt-0.5">Vue d'ensemble de votre boutique</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {cards.map(({ icon: Icon, label, value, color, bg, href }) => (
            <Link key={label} href={href} className={`glass rounded-2xl border p-4 hover:scale-[1.02] transition-all duration-300 ${bg}`}>
              <Icon size={20} className={`${color} mb-2`} />
              <div className={`text-xl sm:text-2xl font-bold ${color} mb-0.5 leading-tight`}>{value}</div>
              <div className="text-white/40 text-xs">{label}</div>
            </Link>
          ))}
        </div>

        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h2 className="text-white font-semibold text-sm">Commandes récentes</h2>
            <Link href="/admin/commandes" className="text-orange-400 text-xs hover:text-orange-300 transition-colors">Voir tout →</Link>
          </div>
          <div className="overflow-x-auto hidden sm:block">
            <table className="admin-table">
              <thead><tr><th>N°</th><th>Client</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody>
                {recentes.length === 0
                  ? <tr><td colSpan={5} className="text-center text-white/30 py-8 text-sm">Aucune commande</td></tr>
                  : recentes.map((c: any) => (
                    <tr key={c.id}>
                      <td className="text-orange-400 font-mono text-xs">{c.numero_commande}</td>
                      <td className="text-sm">{c.prenom} {c.nom}</td>
                      <td className="font-semibold text-sm">{Number(c.montant_total).toLocaleString('fr-FR')} FCFA</td>
                      <td><span className={c.statut === 'validée' ? 'badge-validated' : c.statut === 'annulée' ? 'badge-cancelled' : 'badge-pending'}>{c.statut}</span></td>
                      <td className="text-white/40 text-xs">{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden divide-y divide-white/5">
            {recentes.length === 0
              ? <div className="text-center py-8 text-white/30 text-sm">Aucune commande</div>
              : recentes.map((c: any) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{c.prenom} {c.nom}</div>
                    <div className="text-orange-400/70 font-mono text-xs">{c.numero_commande}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-orange-400 font-bold text-sm">{Number(c.montant_total).toLocaleString('fr-FR')}</span>
                    <span className={c.statut === 'validée' ? 'badge-validated' : c.statut === 'annulée' ? 'badge-cancelled' : 'badge-pending'}>{c.statut}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
