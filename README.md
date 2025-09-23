![Build](https://github.com/calamondino/deployment-checklists/actions/workflows/ci.yml/badge.svg)
![Release](https://img.shields.io/github/v/release/calamondino/deployment-checklists)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

# Deployment Checklists ✅

Et Next.js-prosjekt for å lage og kjøre sjekklister.  
Bygget for å lære fullstack-utvikling, CI/CD, og moderne dev-verktøy i praksis.

---

## 🚀 Funksjoner
- Registrering og innlogging av brukere
- Opprettelse av templates (sjekkliste-maler)
- Kjøre “runs” basert på templates
- Lagre status og progresjon for hvert run
- API-er bygd med Next.js App Router
- Prisma ORM med SQLite (enkelt å bytte database senere)
- CI/CD med GitHub Actions + Release Please

---

## 🛠️ Teknologi-stack
- [Next.js 15](https://nextjs.org/) – React-rammeverk med App Router
- [Prisma](https://www.prisma.io/) – ORM for databasehåndtering
- [SQLite](https://sqlite.org/) – enkel database for utvikling
- [Tailwind CSS](https://tailwindcss.com/) – styling
- [GitHub Actions](https://docs.github.com/en/actions) – CI/CD pipelines
- [Release Please](https://github.com/googleapis/release-please) – automatisk versjonering og changelog

---

## 🏗️ Kom i gang lokalt

1. **Klon repoet**
   git clone git@github.com:calamondino/deployment-checklists.git
   cd deployment-checklists

2. **Installer dependencies**
   npm ci

3. **Kjør Prisma**
   npx prisma generate
   npx prisma migrate dev -n init

4. **Start utviklingsserver**
   npm run dev

Åpne http://localhost:3000 i nettleseren.