# CHARGE — Suivi de musculation

Application personnelle de suivi de musculation, **mobile-first**, **local-first**
et **offline** (PWA installable). Note tes séries en salle, suis ta progression
par exercice et par groupe musculaire.

> Application autonome, sans rapport avec d'autres projets du dépôt.

## Fonctionnalités

- **Séance** — saisie ultra-rapide : steppers +/− et clavier (poids pas 2,5 kg,
  reps pas 1, virgule acceptée), pré-remplissage depuis la dernière séance,
  brouillon autosauvegardé, 1RM estimé en direct.
- **Sélecteur d'exercices** — recherche dans un catalogue embarqué de
  **873 exercices** ([free-exercise-db](https://github.com/yuhonas/free-exercise-db),
  domaine public). Les exercices utilisés sont « adoptés » dans *Mes exercices* ;
  création d'exercices perso possible.
- **Progrès** — verdict clair **progression / plateau / recul** (régression
  linéaire), courbe avec droite de tendance, métriques 1RM estimé / poids max /
  volume, et vue du **volume par groupe musculaire**.
- **Réglages** — gestion des exercices, **export JSON/CSV**, **import JSON**,
  réinitialisation, rappel de sauvegarde.

## Sécurité des données

- Stockage **IndexedDB** via Dexie.
- `navigator.storage.persist()` demandé au lancement pour limiter l'éviction.
- Toutes les opérations de stockage sont protégées (`try/catch`), jamais
  silencieuses.
- L'**export manuel** est le vrai filet de sécurité (rappel après 7 jours).

## Stack

Vite · React · TypeScript · Tailwind CSS · Dexie.js (IndexedDB) ·
vite-plugin-pwa · Recharts · lucide-react.

La couche d'accès aux données est isolée (`src/data/db.ts`) pour permettre une
synchro cloud ultérieure sans toucher aux composants.

## Développement

```bash
npm install
npm run dev        # serveur de dev
npm run build      # build de production (type-check + bundle)
npm run preview    # prévisualiser le build
```

Le catalogue d'exercices est figé dans `src/data/exercises-library.json`
(copié depuis free-exercise-db) afin que la recherche fonctionne entièrement
hors-ligne, sans requête réseau au runtime.
