<<<<<<< HEAD
# 🛍️ ShopCid — Boutique E-commerce

> Développé par **Ibrahim Tembely alias Cid**

**SQLite en développement** (aucune installation requise) · **PostgreSQL en production** (robuste, scalable)

---

## 🚀 Démarrage en 5 commandes (Windows/Mac/Linux)

```bash
# 1. Entrer dans le dossier
cd shop

# 2. Installer les dépendances (100% JavaScript, aucune compilation C++)
npm install

# 3. Copier la configuration
copy .env.example .env      # Windows
cp .env.example .env        # Mac/Linux

# 4. Initialiser la base SQLite (crée data/shop.db automatiquement)
npm run init-db

# 5. Lancer !
npm run dev
```

👉 **http://localhost:3000**

**Admin :** http://localhost:3000/admin/login  
Téléphone : `00000000` | Mot de passe : `Admin123!`  
⚠️ Changez ce mot de passe dès la première connexion !

---

## 🗄️ Base de données

| Environnement | Moteur | Comment |
|---|---|---|
| Développement (`npm run dev`) | **SQLite** via `@libsql/client` | Fichier `data/shop.db` — zéro config |
| Production (`NODE_ENV=production`) | **PostgreSQL** via `pg` | Renseigner `DATABASE_URL` dans `.env` |

Le code est **identique** dans les deux cas — la couche `src/lib/db.ts` gère la bascule automatiquement.

---

## 📦 Technologies

- **Next.js 15** — Framework React
- **TypeScript** — Typage statique
- **@libsql/client** — SQLite 100% JS (pas de compilation C++)
- **pg** — PostgreSQL en production
- **bcryptjs** — Mots de passe sécurisés
- **jose** — JWT
- **Tailwind CSS** — Styles
- **Recharts** — Graphiques

---

## 🌐 Déploiement VPS

Voir [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md)

---

*Développé par **Ibrahim Tembely alias Cid***
=======
# shop
>>>>>>> 89f63ceef169364b8709b3712ecd11ea448d670d
