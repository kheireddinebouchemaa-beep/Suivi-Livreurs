# Suivi-Livreurs — IMIR Logistics

Dashboard KPI pour les livreurs du réseau IMIR Logistics (76 stations, 55 wilayas, exports ECOTRACK v3.11).

Stack : React 19 + TypeScript + Vite, backend Express (serverless sur Vercel), Supabase (Postgres).

## Lancer en local

**Prérequis :** Node.js

1. Installer les dépendances :
   `npm install`
2. Copier `.env.example` vers `.env.local` et renseigner `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`
3. Lancer l'app :
   `npm run dev`

## Build de production

`npm run build`
