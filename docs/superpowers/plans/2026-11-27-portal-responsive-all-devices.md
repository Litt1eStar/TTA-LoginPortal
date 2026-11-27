# Login Portal: Responsive for All Devices (Phone, Tablet, Laptop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinators from all 10 universities can use the portal comfortably on any device: 320 px phones, tablets, 1024–1440 px laptops and large monitors, in portrait and landscape. No sideways scroll, no clipped or cut-off text, every control reachable and tappable, and the important information (deadline, progress, submit state) in view.

**Supersedes** `2026-11-02-portal-mobile-responsive.md`. That plan was written but never carried out; only its docs commit exists. Its findings that still hold are folded in below (marked *carried over*). Don't run both.

**Prerequisite:** The content update is merged before you start:
- The new dashboard hero title "สวัสดี คุณผู้ประสานงาน KMUTT >> มหาวิทยาลัย…", built as separate spans.
- Deadline 30 Dec 2026.

Audit the new content. The hero title is new and long, so it is one of the hardest cases here.

**Architecture:** CSS-first. Most rules go into `src/index.css` (admin: `src/components/admin/admin.css`). New phone-only pieces render on every screen and are shown or hidden by media queries, with no JS screen-size checks. Many components use inline `style={{…}}`. Move the inline layout values that must change per breakpoint into classes; leave the rest alone. A Playwright audit script is the acceptance test. It fails before the work and passes after.

**Tech stack:** React 18, React Router 7, plain CSS, Vite, Vitest, `playwright-core` with the local Chromium in `%LOCALAPPDATA%\ms-playwright` (version `chromium-1243` was present on 27 Nov 2026).

---

## Baseline (audit on 27 Nov 2026, Vite dev server and local API)

Logged in as `kmutt` and as `kmitl` (the longest university name). Ran /login, /dashboard, /submit, /history and /certificates at 320–1920 px.

| # | Where | Width | Finding | Severity |
|---|---|---|---|---|
| 1 | **Navbar**, every logged-in page | **1024–1440** | The page scrolls sideways. `.nav-user-text` shows the full "ผู้ประสานงาน <university full name>" with `white-space: nowrap`, which pushes "ออกจากระบบ" off-screen. kmutt: page is 1204 px wide at 1024 and 1299 at 1280. **kmitl: 1281 at 1024, 1376 at 1280, 1419 at 1366, 1456 at 1440.** This hits the most common laptop sizes | **Critical** |
| 2 | Navbar, every logged-in page | 320 | The page scrolls sideways by 33 px: the logout icon button sits at x 306–353 | High |
| 3 | Navbar | < 860 | *Carried over.* Icons only, with no labels: users can't tell ประวัติ from เกียรติบัตร. Below 480 the autosave indicator (`.nav-save`) is hidden | High |
| 4 | History table | < 1024 | *Carried over.* On phones only "หมวดหมู่" and "รายละเอียด" are visible; status and evidence are off-screen in the sideways scroller. At 768 the status chip is squeezed to one Thai word per line ("ใกล้ / ปิด / รับ") and "หมวดหมู่" names break mid-word | High |
| 5 | Submit header | 768 | The status badge ("ส่งแล้ว แก้ไข…") and the deadline line ("กำหนดส่งเอกสาร/ผลงาน: …") are cut off at the right edge | High |
| 6 | Dashboard progress (`.seg-cluster-label`) | < 1024 | Category labels are cut with an ellipsis: "สอนปฏิ…", "ศิล…", "สอน…" at 320. That is meaningless to the user | Medium |
| 7 | Dashboard hero title | 320–360 | "สวัสดี คุณผู้ประสาน / งาน" breaks mid-word. The **new** title with the university abbreviation and full name is much longer | High (after the content update) |
| 8 | Dashboard status bars (`ProgressStats.jsx`, `SegmentTooltip.jsx`) | touch | *Carried over.* 16 px tall hover targets; the tooltip needs hover, so it doesn't work on touch | Medium |
| 9 | Submit category tabs (`TrackSelector.jsx`) | < 1024 | *Carried over.* Scroll arrows 32×32 | Medium |
| 10 | Login show-password toggle (`LoginView.jsx`) | touch | *Carried over.* 19×19 tap target | Medium |
| 11 | Modals (`MemberModal`, `ConfirmSubmitModal`, admin `EntryDetailModal`) | phones, landscape | *Carried over.* `max-height: 90vh` jumps when the mobile browser bar shows or hides; footer buttons are small; on a landscape phone the form is taller than the screen | Medium |
| 12 | Submit: the submit button | < 980 | *Carried over.* The readiness count and submit button are at the end of a long form | Medium |
| 13 | Admin table | 1024–1366 | *Carried over.* 1500 px table. Admins use laptops, so keep the scroller but make the university column sticky, and check the admin header and toolbar at 1024 | Low |

**Good already:** /login and /certificates have no overflow at any width. The dashboard track cards reflow well (1 column on phones, 3 at 1024).

**Not measured; check by eye and add to the audit:**
- The modals while open, and the member form with the phone keyboard open. Inputs under 16 px make iOS Safari zoom the page.
- Toasts on phones (are they covered by the bottom tab bar?).
- The submit celebration (confetti) overlay on phones.
- The `kmitl` account everywhere, as the longest-name case.

## Acceptance rules (the audit enforces these at every viewport, on every route)

1. `document.documentElement.scrollWidth <= innerWidth`. No sideways page scroll. **Includes laptops 1024–1440 with the longest university name (`kmitl`).**
2. No element with text overflows its box, **including with `text-overflow: ellipsis`** on labels that carry meaning. Allowed exception: user-typed long text such as a project title in a card, with a `title` attribute that shows the full text.
3. Visible text ≥ 12 px. Body text ≥ 14 px below 768 px. Form inputs ≥ 16 px below 768 px, so iOS doesn't zoom.
4. Interactive elements ≥ 44 × 44 px below 1024 px.
5. Fixed and sticky bars (navbar, mobile tab bar, sticky submit bar, toasts) never cover content. The last element on each page can scroll above the bottom bar, and safe-area insets are respected (`env(safe-area-inset-bottom)`).
6. The deadline countdown, the "x / 18 ส่งแล้ว" progress and the submit status are visible without horizontal scrolling at every width.
7. Wide tables (history, admin) may scroll inside their own container. The page must not scroll sideways, and the first column stays visible (sticky).
8. **Desktop ≥ 1440 with `kmutt` looks the same** as the baseline, except the intended fixes.

## Device matrix

320×640, 360×780, 390×844, 430×932, 667×375 (landscape), 844×390 (landscape), 600×960, 768×1024, 820×1180, 1024×768, 1180×820, 1280×800, 1366×768, 1440×900, 1920×1080.
`isMobile`/`hasTouch` for widths < 1024. Run with motion both on and off.

## Thai line-breaking rule

Thai has no spaces between words, so the browser may break a line inside a word. For headings, chips, buttons, table cells and labels:
- Wrap phrases that must stay together in `<span className="nowrap">`, or use `display: inline-block` per phrase.
- Never use `word-break: break-all` on Thai text.
- The new hero title is made of three spans: greeting / abbreviation / full name. Each may wrap as a unit; the `>>` separator stays with the abbreviation.

## How to run the portal locally for the audit

1. API: `cd server && npm start`. It needs `server/.env`, which exists locally. Check with `curl http://127.0.0.1:3001/api/health`.
2. Frontend: `npx vite --port 3005 --strictPort --open false`. It proxies `/api` to 3001.
3. Credentials come **only from environment variables**: `PORTAL_USER`/`PORTAL_PW` (coordinator; use `kmitl` for the longest name), plus optionally `ADMIN_USER`/`ADMIN_PW`. Ask the owner for them, or read them from the owner's local accounts file. **Never write a password into a file, script or commit.**
4. Log in **once** per account with `request.post('/api/login', { data: { username, password } })` and reuse its `storageState` for every page and viewport. Logging in per viewport hits the rate limit (HTTP 429). If you hit it, restart only the API process you started.

## File structure

| File | Change |
|---|---|
| `scripts/responsive-audit.mjs` (new) | Acceptance test: logs in as above, visits every route over the matrix, enforces the rules, opens the modals, saves screenshots to `audit-shots/` (git-ignored) |
| `package.json` | `npm i -D playwright-core@1.59`; script `"audit:responsive": "node scripts/responsive-audit.mjs"` |
| `src/components/layout/Navbar.jsx` | User block: short form (avatar plus university abbreviation) below 1440, full name in the `title` tooltip; class hooks instead of inline layout |
| `src/components/layout/MobileTabBar.jsx` (new) | Bottom tab bar with icon and label, phones only (< 768) |
| `src/components/submit/MobileSubmitBar.jsx` (new) | Sticky bar with readiness, save state and the submit button (< 980) |
| `src/utils/history.js` (new) + `history.test.js` | Pure: history rows shared by the table and the new phone cards |
| `src/components/history/HistoryView.jsx` | Card list on phones; sticky first column and wider status column on tablets |
| `src/components/dashboard/ProgressStats.jsx`, `SegmentTooltip.jsx` | Labels without ellipsis; tap-to-show summary for touch |
| `src/components/submit/SubmitView.jsx`, `TrackSelector.jsx`, `auth/LoginView.jsx`, `submit/MemberModal.jsx`, `submit/ConfirmSubmitModal.jsx` | Tap targets, wrapping header, modal sizing |
| `src/components/admin/AdminView.jsx`, `admin.css` | Sticky university column, header and toolbar at 1024 |
| `src/index.css` | New blocks at the end: phones (< 768), tablets (768–1023), laptops (1024–1439), landscape phones `(max-height: 500px) and (orientation: landscape)` |
| `index.html` | `viewport-fit=cover`, so the safe-area insets work on iPhone |

---

### Task 1: The failing audit and baseline screenshots

- [ ] Install `playwright-core@1.59` and add the script.
- [ ] Write `scripts/responsive-audit.mjs` with the generic checks (rules 1–4, skip `.sr-only`, allow elements inside their own `overflow-x: auto|scroll` ancestor) and the page-specific checks (rules 5–7).
- [ ] Capture baseline screenshots of every route and viewport into `audit-shots/baseline/` before any CSS change. Add `audit-shots/` to `.gitignore`.
- [ ] Run it as `kmitl`. It must fail on #1 (1024–1440) and #2 (320). Commit: `test(responsive): portal audit across device matrix`.

### Task 2: Navbar at every width (#1, #2, #3), the critical fix

- [ ] **Laptops (1024–1439):** the user block shows the avatar plus the university abbreviation (for example "KMITL", from `UNIVERSITIES` in `src/data/referenceData.js`, the same source the hero title uses), with the full name in the `title` tooltip. Give the logout button an icon and the label "ออกจากระบบ". It must fit with the 4 nav pills at 1024 and the longest name.
- [ ] **≥ 1440:** the full name may show, but it must be capped (`max-width` + `min-width: 0`) so it can never push the bar wider than the screen. If a cap would cut the text, show the abbreviation instead.
- [ ] **Tablets (768–1023):** nav pills with icon and label if they fit, else icon only with a tooltip. Show the save indicator.
- [ ] **Phones (< 768):** the top bar holds the logo, save indicator, avatar and logout (≥ 44 px each), with no overflow at 320. The 4 sections move to `MobileTabBar` at the bottom (icon + label, 4 equal tabs, `padding-bottom: env(safe-area-inset-bottom)`). Pad the page bottom so nothing hides under it.
- [ ] Rerun the audit as `kmitl` and `kmutt`. Commit.

### Task 3: Dashboard (#6, #7, #8)

- [ ] Hero title, built as structured spans by the content update: check it at 320–1920. At 320 the abbreviation + `>>` + full name may take 3 lines but must never break mid-word. Use `font-size: clamp(...)` so it stays a heading on phones without becoming 5 lines.
- [ ] Progress labels: no ellipsis. Let the clusters wrap onto 2 rows on narrow screens, or use the full category names under the bars on phones.
- [ ] Touch: tapping a status bar shows its summary (popover or inline). The bars get a ≥ 44 px tall hit area; the visible bar can stay thin.
- [ ] Countdown card: on phones it sits right under the hero (the deadline is the key information). Check the landscape phone view.
- [ ] Rerun the audit. Commit.

### Task 4: Submit page (#5, #9, #11, #12)

- [ ] Header: the badge and the deadline text wrap inside the card at 768 and below (no `nowrap` on the long line; the badge moves under the title if needed).
- [ ] `TrackSelector` arrows ≥ 44 px. The active category scrolls into view.
- [ ] `MobileSubmitBar` (< 980): sticky at the bottom (above the tab bar on phones) with readiness "3/4", save state and the submit button. The in-page submit block stays for desktop.
- [ ] `MemberModal` and `ConfirmSubmitModal`: full-screen sheet on phones (`100dvh`, header and footer sticky, body scrolls), inputs ≥ 16 px, footer buttons ≥ 44 px. Usable at 667×375 with the keyboard open.
- [ ] Group chips ("กลุ่มสาขาวิชาไฟฟ้า" …) never break mid-word.
- [ ] Rerun the audit. Commit.

### Task 5: History (#4)

- [ ] Extract `historyRows(submissions)` into `src/utils/history.js` with a unit test, so the table and the cards share it.
- [ ] Phones (< 768): one card per row with category, status chip, details and evidence. Hide the table.
- [ ] Tablets (768–1023): keep the table; the first column is sticky; the status column has a min-width so a chip stays on one line; category names don't break mid-word.
- [ ] Rerun the audit. Commit.

### Task 6: Login, certificates, modals, toasts (#10, #11)

- [ ] Show-password toggle ≥ 44 px. Login inputs ≥ 16 px on phones. The login form is usable at 667×375 with the keyboard open.
- [ ] Certificates: check by eye at all sizes. It passes today; keep it that way.
- [ ] Toasts sit above the tab bar and the sticky submit bar on phones.
- [ ] Rerun the audit. Commit.

### Task 7: Admin on laptops (#13)

- [ ] The admin page at 1024×768, 1280×800 and 1366×768: no page sideways scroll. The table scrolls inside its container with a sticky university column. The toolbar, tabs and Drive cards wrap cleanly. `EntryDetailModal` fits at 1024×768.
- [ ] Phones are out of scope for admin, but the page must not break at 768.
- [ ] Rerun the audit (admin pass with `ADMIN_USER`/`ADMIN_PW`). Commit.

### Task 8: Final verification

- [ ] `npm test` (frontend) and `cd server && npm test` pass.
- [ ] `npm run build` succeeds.
- [ ] The audit passes for the whole matrix as `kmitl` and `kmutt`, motion on and off.
- [ ] Before/after montage per device group for review.
- [ ] Check by eye in Chrome DevTools device mode: iPhone SE, iPhone 14 Pro, Galaxy S20, iPad Mini, iPad Air landscape, a 1366×768 laptop and a 1920 monitor.
- [ ] Report the fixes, the audit output and the montage paths. Don't deploy; the owner deploys.

## Out of scope

- Content changes (hero text, dates). They are done before this plan.
- Visual redesign: keep the current look and adapt the layout only.
- The Landing Page. It has its own plan: `TTA-LandingPage/docs/superpowers/plans/2026-11-27-landing-responsive-all-devices.md`.
