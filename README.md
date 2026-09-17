# Vaulta — Fleet & Business Management

A Progressive Web App (PWA) for tracking vehicles, income, expenses, drivers, and licensing — built for a single admin user.

**Stack:** React · TypeScript · Vite · Tailwind CSS · Supabase

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18 or later |
| npm | 9 or later |
| Supabase account | [supabase.com](https://supabase.com) |

---

## 1 — Clone & Install

```bash
git clone <your-repo-url>
cd fleetflow
npm install
```

---

## 2 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Copy your project's **URL** and **anon public key** from  
   *Project Settings → API*

---

## 3 — Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> `.env` is git-ignored. Never commit secrets.

---

## 4 — Apply the Database Schema

Open the **Supabase SQL Editor** (*project dashboard → SQL Editor*) and run these files **in order**:

| Step | File | Purpose |
|---|---|---|
| 1 | `supabase/schema.sql` | Core tables (vehicles, income, expenses, service, tyres, licensing) |
| 2 | `supabase/triggers.sql` | Auto-expense triggers (service → expense, tyre → expense, etc.) |
| 3 | `supabase/drivers_and_schedules.sql` | Drivers, cashing schedules, expected cashings, new income/expense columns |

Paste each file's contents into the SQL Editor and click **Run**.

> **Auth:** Create your admin user in *Supabase → Authentication → Users → Invite user*. The app blocks access until signed in.

---

## 5 — Run the Dev Server

```bash
npm run dev
```

The app will be available at **http://localhost:5173** (or the next available port).

---

## 6 — Build for Production

```bash
npm run build
```

Output goes to `dist/`. Deploy to any static host (Netlify, Vercel, Cloudflare Pages, etc.).

To preview the production build locally:

```bash
npm run preview
```

---

## Project Structure

```
src/
├── components/       # Reusable UI components and modals
├── hooks/            # Data-fetching hooks (useVehicles, useIncome, useDrivers, …)
├── lib/              # Supabase client
├── pages/            # One file per route (Dashboard, Income, Expenses, Drivers, …)
└── types/            # Shared TypeScript interfaces

supabase/
├── schema.sql                  # Core schema
├── triggers.sql                # Auto-expense DB triggers
└── drivers_and_schedules.sql   # Driver management migration
```

---

## Key Features

- **Dashboard** — KPI cards, recent income, overdue cashing reminders, license expiry alerts
- **Vehicles** — fleet status tracking (active, maintenance, retired)
- **Income** — per-vehicle income with Yango, Bus/Public Transport, and Rental sources; cashing period tracking
- **Expenses** — manual entry with auto-generated service/tyre/licensing expenses via DB triggers
- **Drivers** — driver profiles linked to vehicles and salary expenses
- **Cashing Schedules** — configurable weekly cashing cycles with overdue alerts
- **Service / Tyre / Licensing** — each record auto-creates a corresponding expense entry
- **Reports** — income vs. expense summaries per vehicle

---

## Useful Commands

```bash
npm run dev        # Start development server with hot reload
npm run build      # Production build
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
npx tsc --noEmit   # Type-check without emitting files
```
