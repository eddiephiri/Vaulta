# Vaulta — UI Design & Context Document

## 1. Application Overview

**Vaulta** is a multi-tenant, multi-app financial and fleet management platform built with React + TypeScript (Vite). It is structured as a **workspace-first application launcher**: a user logs in and selects a workspace, then launches one of several modular app experiences from a central hub.

### App Modules

| App | Accent Color | Description |
|---|---|---|
| **Transport Business** | `#3b82f6` (Blue) | Fleet ops — vehicles, drivers, income, expenses, licensing, service history, tyre changes, cashing schedules |
| **Home Budgeting** | `#10b981` (Emerald) | Household finance — income, expenses, reports |

---

## 2. Design System

### 2.1 Theme Architecture

Vaulta supports **Light** (default) and **Dark** themes, managed by a `ThemeContext` that persists to `localStorage` and applies a `.dark` class to the root `<html>` element.

All colors are expressed as **CSS custom properties (tokens)** in `src/index.css`. Components never hard-code theme colors — they always reference tokens.

```
:root  →  Light theme (default)
.dark  →  Dark theme overrides
```

### 2.2 Color Tokens

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--ff-bg` | `#f8fafc` | `#0f172a` | Page / canvas background |
| `--ff-surface` | `#ffffff` | `#1e293b` | Cards, modals, header, bottom nav |
| `--ff-surface-raised` | `#f1f5f9` | `#334155` | Sidebar, elevated panels |
| `--ff-border` | `#e2e8f0` | `#334155` | All borders and dividers |
| `--ff-text-primary` | `#0f172a` | `#f1f5f9` | Body text, headings |
| `--ff-text-muted` | `#64748b` | `#94a3b8` | Labels, secondary text, icons |
| `--ff-accent` | `#3b82f6` | `#3b82f6` | Primary actions, active nav |
| `--ff-accent-hover` | `#2563eb` | `#2563eb` | Button hover states |
| `--ff-green` | `#22c55e` | `#22c55e` | Income, positive values |
| `--ff-red` | `#ef4444` | `#ef4444` | Expenses, errors, danger |
| `--ff-amber` | `#f59e0b` | `#f59e0b` | Warnings, overdue alerts |
| `--ff-navy` | `#0f172a` | `#0f172a` | Retained for input field backgrounds in dark contexts |

### 2.3 Typography

- **Font family**: `Inter`, `system-ui`, `-apple-system`, sans-serif
- **Smoothing**: `-webkit-font-smoothing: antialiased`
- **Scale in use**:
  - `text-2xl font-bold` — Stat card values
  - `text-xl font-bold` — Page section totals
  - `text-lg font-semibold` — Page headings, section titles
  - `text-base font-semibold` — Top bar title
  - `text-sm` — Body, table cells, list items
  - `text-xs` — Labels, badges, timestamps, uppercase tracking

### 2.4 Spacing & Radius

- Cards / panels: `rounded-xl` (12px)
- Modals: `rounded-2xl` (16px)
- Badges / pills: `rounded-full`
- Buttons: `rounded-lg` (8px) or `rounded-xl` (12px)
- Standard padding in cards: `p-4` – `p-6`
- Gap between grid items: `gap-4` – `gap-6`

### 2.5 Scrollbar

Custom scrollbar (webkit): 6px wide, uses `--ff-border` for thumb, `--ff-bg` for track. Hidden for horizontal chip rows using `.scroll-hide`.

---

## 3. Layout Architecture

### 3.1 Full-Page Shell (`Layout.tsx`)

The main shell is a **flex row** that fills the viewport (`h-screen overflow-hidden`).

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (desktop/tablet)  │     Main Content Area    │
│  220px | 64px (collapsed)  │  flex column, flex-1     │
│  bg: --ff-surface-raised   │                          │
│                            │  ┌────────────────────┐  │
│  [App Logo]                │  │   Top Bar Header   │  │
│  [Nav Links]               │  │   bg: --ff-surface │  │
│  [Settings]                │  └────────────────────┘  │
│  [Sign Out]                │  ┌────────────────────┐  │
│  [Collapse toggle]         │  │   <Outlet />       │  │
│                            │  │   (page content)   │  │
│                            │  │   p-6 | p-4 mobile │  │
│                            │  └────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**On Mobile** (breakpoint: `max-width: 768px`):
- Sidebar is hidden; replaced by a **slide-in drawer** (280px, triggered by hamburger icon in top bar).
- A **`MobileBottomNav`** (64px fixed bar) appears at the bottom showing up to 4 primary nav items + a "More" button that opens the drawer.
- Page content gets `pb-20` to avoid overlap with the bottom nav.
- A **blurred backdrop** (`drawer-backdrop`) covers the page when the drawer is open.

### 3.2 Top Bar

Always visible. Contains:
- **Left**: hamburger button (mobile only) + current page title
- **Right**: `WorkspaceSwitcher` dropdown + "ZMW · Zambia" locale indicator (desktop only)

Background: `--ff-surface`. Border-bottom: `--ff-border`.

### 3.3 Sidebar

Collapsible on desktop (collapsed = icons-only at 64px). Each nav item uses a `NavLink` with:
- **Active**: `linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)` background, white text
- **Inactive**: transparent background, `--ff-text-muted` color, hover to `text-blue-600`

Bottom of sidebar: Settings link + Sign Out button; small circular collapse toggle.

---

## 4. Pre-Auth Screens

### 4.1 Login (`/login`)

Full-viewport centered layout (`min-h: 100vh`, `bg: --ff-bg`).

- **Brand mark**: square icon (56×56, `--ff-accent` fill, rounded-2xl) with "🔐" emoji
- **App name**: `Vaulta` in large bold text
- **Card**: `--ff-surface` background, `--ff-border` border, `border-radius: 16px`, `padding: 32px`
- **Inputs**: `bg: --ff-bg`, `border: --ff-border`, full-width, `border-radius: 8px`
- **Submit button**: full-width, `--ff-accent` background, white text. Grays out (`#334155`) while loading.
- **Forgot password**: muted text link below the card

### 4.2 Forgot Password / Reset Password

Similar centered-card layout. Multi-step (email → success message, or token → new password form).

---

## 5. App Launcher (`/`)

Displayed after login, before entering an app module.

**Step 1 — Workspace Selection** (if multiple workspaces or none is active):
- Full-page with a top header bar (logo + title)
- Workspace cards in a responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- Each card: icon + name + description + "Launch →" link
- Dashed border cards: "Create New Workspace" and "Redeem Access Code"

**Step 2 — App Selection** (after workspace is chosen):
- Same grid layout but showing available app modules
- Each app card has its branded icon (colored tinted background) and description
- Filtered automatically for guest users based on their authorized app list

---

## 6. Core UI Components

### 6.1 `StatCard`

KPI card shown in dashboard grids. Contains:
- Accent-tinted icon container (44×44, `${accent}20` background)
- Label (xs, uppercase, muted)
- Value (2xl, bold)
- Optional `trend` line (▲ green / ▼ red)

Used in grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

### 6.2 `PageHeader`

Simple header row at the top of each page. Left: title (lg, semibold) + subtitle (sm, muted). Right: optional action slot (typically an "Add" button).

### 6.3 `SearchInput`

Text input with a search icon prefix. Rounded-xl, full-width, uses `--ff-surface` background.

### 6.4 `Pagination`

Previous / Next + page number buttons. Active page uses `--ff-accent`. Compact style.

### 6.5 `MobileFilterSheet`

Adaptive filter wrapper:
- **Desktop**: renders children inline in a horizontal flex row with a surface card wrapper
- **Mobile**: renders a **"Filters" button** (with active-filter badge count). Tapping opens a **bottom sheet** (slide-up overlay, `rounded-t-2xl`, with a drag handle bar at the top, max-height 70vh)

### 6.6 `WorkspaceSwitcher`

Dropdown in the top bar. Shows current workspace name; clicking opens a popover list of all workspaces. Selecting one triggers a workspace switch.

### 6.7 Modals (generic pattern)

All modals follow this pattern:
- Fixed overlay: `z-50`, `bg: rgba(0,0,0,0.6)`, `backdrop-blur-sm`
- Inner container: `--ff-surface` bg, `--ff-border` border, `border-radius: 16px`, `padding: 24–28px`
- Responsive width: `max-width: min(448px, 95vw)`, `max-height: 90vh`, `overflow-y: auto`
- Close button (X icon) in top-right corner
- Form submit: accent primary button + cancel ghost button in a flex row

---

## 7. Page Patterns

### List Pages (Income, Expenses, Vehicles, Drivers, etc.)

Consistent structure:
1. **`PageHeader`** with title + action button (add record)
2. **Summary strip** — 2–4 stat boxes (today / week / month totals)
3. **Category chip row** — horizontal scroll on mobile, wrap on desktop (`.scroll-hide`)
4. **`MobileFilterSheet`** wrapping select dropdowns + month picker + `SearchInput`
5. **Record list** — card rows with `--ff-surface` background. Each row: label/badge on left, amount on right; edit button (pencil icon, `touch-target` class for 44px min tap area)
6. **`Pagination`** — appears when more than one page of results

### Dashboard Pages

- **Top**: `PageHeader`
- **Alert banner**: amber banner if there are overdue cashings (clickable, links to schedules)
- **KPI grid**: `StatCard` components — 1/2/4 columns responsive
- **Summary panels**: 2-column grid of recent data panels (`recent income`, `recent expenses`, `fleet status`, `upcoming license expirations`)

### Settings Page

Divided into sections (each a `rounded-2xl` card):
1. **Account Security** — password change form (grid layout)
2. **Application Preferences** — theme switcher (Light / Dark toggle pill)
3. **Workspace Settings** — rename workspace + description
4. **Team & Guests** — members table (desktop) / card list (mobile), active guest pass list with revoke buttons, "Invite Member" button

---

## 8. Badge & Status Colors

| Context | Color |
|---|---|
| Active / Success | `#22c55e` (green) |
| Warning / Expiring | `#f59e0b` (amber) |
| Error / Expired / Expense | `#ef4444` (red) |
| Info / Accent | `#3b82f6` (blue) |
| Owner role badge | Red |
| Admin role badge | Amber |
| Guest role badge | Purple (`#8b5cf6`) |
| Member role badge | Blue |
| Auto-generated record | Muted border badge |

Badges always use a `20`-opacity tinted background from the same hue (e.g., `#22c55e20`).

---

## 9. Mobile Responsiveness Strategy

| Element | Mobile Behaviour |
|---|---|
| Sidebar | Hidden; replaced by slide-in drawer |
| Bottom nav | Fixed 64px bar with top 4 nav items + "More" |
| Filter bar | Collapsed into a "Filters" button + bottom sheet |
| Modals | `max-width: 95vw`, `max-height: 90vh`, scrollable |
| Members table | Replaced by stacked card list |
| Chip rows | Horizontal scroll with `.scroll-hide` |
| Interactive targets | `.touch-target` class enforces 44×44px minimum (Apple HIG) |
| Top bar padding | Reduced to `px-4 py-3` (vs. desktop `px-6 py-4`) |

Breakpoint: `MOBILE = max-width: 768px` via `useMediaQuery` hook.

---

## 10. Icon Library

All icons: **Lucide React**. Primary icons used:
- Navigation: `LayoutDashboard`, `Car`, `Wrench`, `CircleDot`, `FileCheck2`, `TrendingUp`, `Receipt`, `Users`, `CalendarClock`, `BarChart3`, `Wallet`, `Home`, `ShoppingCart`
- UI actions: `Plus`, `Pencil`, `X`, `LogOut`, `Settings`, `Menu`, `ChevronLeft/Right`, `Search`, `SlidersHorizontal`, `MoreHorizontal`
- Status: `CheckCircle`, `AlertTriangle`, `Lock`, `ShieldCheck`, `UserPlus`

---

## 11. Currency & Localization

- All monetary values: **ZMW (Zambian Kwacha)**
- Formatting: `toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
- Displayed as `ZMW 1,234.56`
- Locale indicator shown in the top bar: **ZMW · Zambia**
