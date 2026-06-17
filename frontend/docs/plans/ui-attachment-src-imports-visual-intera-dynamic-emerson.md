# Plan: Lumitime (拾光筑梦) UI Implementation

## Context

Based on the design specification in `docs/design/visual-interaction-design-lumitime.md`, build a complete multi-page UI for the personal workstation "Lumitime". The spec defines a monochromatic black/white/gray visual system with subtle light ("微光") accents, a narrative login experience (falling → rising), an interactive cat element, and distinct pages for workstation tools, data dashboard, and admin management.

---

## Architecture

**Routing:** React Router v7 `createHashRouter` (hash-based for Figma Make compatibility).

**Pages (7 total):**
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `LoginPage` | Dark atmospheric login (light beam + figure + cat) |
| `/home` | `HomePage` | Public main page with module cards |
| `/workstation` | `WorkstationPage` | Service cards grid |
| `/workstation/log-submit` | `LogSubmitPage` | Auto-submit service |
| `/records` | `RecordsPage` | Submission history list + detail |
| `/dashboard` | `DashboardPage` | Full-screen dark data dashboard |
| `/admin` | `AdminPage` | Admin panel with left sidebar |

---

## File Structure

```
src/
├── app/                             ← App route shell + global providers
├── features/                        ← feature-specific components
├── layouts/                         ← navigation and page layouts
├── mocks/                           ← prototype data
├── pages/                           ← route page components
├── shared/                          ← shared UI, helpers, primitives
└── styles/                          ← global style entry and theme
```

**New style file:**
- `src/styles/fonts.css` — import `Ma Shan Zheng` (calligraphy) + `Inter` from Google Fonts

---

## Key Implementation Details

### 1. Fonts (`src/styles/fonts.css`)
```css
@import url('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Inter:wght@300;400;500&display=swap');
```
Use `font-family: 'Ma Shan Zheng', serif` only for the brand title on LoginPage and HomePage hero.

---

### 2. `LoginPage.tsx` — The centerpiece

**Layout:** CSS grid `grid-cols-[1fr_2fr]` on desktop, stacked on mobile.

**Left panel (dark, 1/3):**
- `LightBeam.tsx`: A `<div>` with `background: conic-gradient(from 180deg at 50% -10%, transparent 340deg, rgba(255,252,240,0.18) 355deg, transparent 360deg)` plus a subtle radial glow at beam center. CSS `@keyframes beamPulse` animates opacity between 0.6–1.0 over 3s.
- `FallingFigure.tsx`: Inline SVG of a human silhouette in a "reaching downward / falling" pose, rendered in white (`fill="white"`). On login success, Motion animates `rotate: [0, 180]` + `y: [-20, 20]` over 0.8s before page transition, giving the "下坠到向上" flip.
- `InteractiveCat.tsx`: SVG Q-style cat positioned `absolute bottom-8 right-0` on the left panel (sits on the divider). States: `idle` (CSS `@keyframes breathe` scale 1→1.03), `following` (Motion spring tracking `mouseX/mouseY` with `lerp` dampening). Click toggles following on/off. Auto-stops when any input is focused.

**Right panel (light, 2/3):**
- Brand title: `<h1 className="font-['Ma_Shan_Zheng']">拾光筑梦 <span>Lumitime</span></h1>`
- Subtitle: `Every faint light of time, paves the way for your dream.` (light weight, small)
- Form: shadcn `Input` (account + password) + `Button` (black bg, white text). Button disabled until both fields non-empty.
- Login flow: click → loading spinner → simulated 1.5s delay → trigger figure flip animation → `useNavigate('/home')`.
- Error state: small red-tinted text below form, no revealing which field is wrong.
- Invite code link: ghost-style text button below form.

**Login transition animation (Motion `AnimatePresence`):**
1. Button enters loading state (spinner replaces label text)
2. After 1s: `LightBeam` opacity increases (CSS var update)
3. `FallingFigure` rotates 180° (Motion animate)
4. Page container animates `opacity: 0, scale: 1.02` exit
5. HomePage enters with `opacity: 0 → 1` over 0.6s

---

### 3. `HomePage.tsx`

**Top nav (`MainNav.tsx`):** logo left, links center (随记, 大屏看板), auth buttons right. Sticky with `backdrop-blur-sm bg-white/90`.

**Hero section:** Brand name (calligraphy), one-line tagline, two CTA buttons.

**Module grid:** 6 cards using `ModuleCard.tsx`. Each card: icon (lucide), title, description, status. Cards for logged-in users have hover lift animation; cards for guests show a lock overlay with "需要邀请码" prompt on click (using shadcn `Dialog`).

Public modules: 随记, 大屏看板  
Locked modules (show lock icon): 脚本分享, 个人作品, 经验心得, 工作站

Cards use Motion `whileInView={{ opacity: 1, y: 0 }}` staggered by index × 0.08s.

**State:** A `useState` for `isLoggedIn` (mock: defaults to `false`, set to `true` after login flow).

---

### 4. `WorkstationPage.tsx`

Grid of `ServiceCard.tsx` components (mock data: 4–6 services).

`ServiceCard.tsx` contains:
- Service name + description
- Status badge: `运行中` (green dot), `维护中` (yellow), `已下线` (gray)
- Last updated time
- "进入服务" button (primary)

Bottom section: "我的提交记录" preview — 3 recent record rows with status chips + "查看全部" link.

---

### 5. `LogSubmitPage.tsx`

Vertical single-column layout (max-w-lg centered):
1. **Service description** card — what it does, security notice
2. **Input area** — account field + password field (type="password"), helper text "此账号密码不同于Lumitime登录账号"
3. **Submit button** — disabled until both fields filled, enters loading state on click
4. **`StatusCard.tsx`** — appears after submit, shows: current state, request_id, polling indicator (animated dots), estimated wait. On "success": result summary + "重新提交" button. On "failure": failure category + summary + "重新提交" (clears password field only).
5. **Recent records** — last 5 rows inline

`StatusCard` polling: `useEffect` with `setInterval(2000)` cycling through `pending → executing → success/failure` mock states.

---

### 6. `RecordsPage.tsx`

shadcn `Table` with columns: 服务名称, 提交时间, 状态, service_request_id (truncated), 耗时, 结果摘要, 账号掩码(***).

Row click opens shadcn `Sheet` (slide-in panel) showing detail: status, failure category, summary, account mask, retry button if applicable.

Filters: status filter `Select`, date range (two `Input type="date"`). Pagination at bottom.

---

### 7. `DashboardPage.tsx`

Full-screen dark page (`bg-[#080808] text-white`).

Layout: 3-column grid of `MetricBlock` cards + one wide recharts `LineChart` at bottom.

`MetricBlock.tsx`: Large animated counter (Motion `useMotionValue` + `useTransform` counting up from 0 on mount), metric label below, tiny sparkline (recharts `AreaChart` with no axes, fill opacity 0.2).

Metrics (mock data): 用户数, 开发者数, 访问数, 作品数, 脚本数, 博客数, 随记数, 服务数.

Bottom chart: 日度访问趋势, dark recharts `LineChart`, white lines on `#111` background.

Full-screen button (lucide `Maximize2`) in top-right corner uses `document.documentElement.requestFullscreen()`.

---

### 8. `AdminPage.tsx`

Left sidebar (`AdminSidebar.tsx`, fixed 240px): logo, nav items (总览, 用户管理, 邀请码, 内容管理, 服务记录, 系统设置), account info at bottom.

Main content: Currently shows "用户管理" by default — shadcn `Table` with search input, status filter, add button. Delete action opens shadcn `AlertDialog` for confirmation. Toast (sonner) on save success/failure.

Admin uses standard system fonts only (no calligraphy).

---

## Color Strategy

Override Tailwind with inline classes since theme.css uses OKLch vars. Key raw values:
- Dark bg: `bg-[#080808]` / `bg-[#0d0d0d]`
- Beam color: `rgba(255,252,235,0.12)` (warm white)
- Border subtle: `border-white/10`
- Glow highlight: `shadow-[0_0_40px_rgba(255,255,255,0.06)]`
- Status green: `text-emerald-400` (low saturation)
- Status yellow: `text-amber-400`

---

## Accessibility & Degradation

- `@media (prefers-reduced-motion: reduce)` → skip Motion animations, use `transition-opacity` only
- All interactive elements have `focus-visible` ring
- Cat never covers form fields (z-index below inputs)
- Login works fully with keyboard (Tab + Enter)

---

## Mock Data Strategy

All data is local mock state (no API calls):
- `src/mocks/mockServices.ts` — workstation service list
- `src/mocks/mockRecords.ts` — submission record history
- `src/mocks/mockMetrics.ts` — dashboard metric values + sparkline series

---

## Verification

1. Navigate to `/` → see dark login with light beam animation + cat
2. Fill login form → button enables → click → figure flips → transition to `/home`
3. On `/home` → public cards visible, locked cards show lock icon + dialog on click
4. On `/workstation` → service cards with status badges + recent records
5. On `/workstation/log-submit` → form → submit → status card cycles through states
6. On `/dashboard` → full-screen dark page with counters animating up
7. On `/admin` → left sidebar + user table with CRUD confirmations
8. Mobile: login shows stacked layout, cat becomes tap-only, beam is simplified
