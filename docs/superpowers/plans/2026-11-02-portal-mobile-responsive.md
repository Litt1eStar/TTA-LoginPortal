# Portal Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TTA Portal comfortable on phones (360–430 px wide) for university coordinators, without changing the desktop layout.

**Architecture:** CSS-first. New mobile-only pieces (a bottom tab bar, a sticky submit bar, history cards) render in the DOM on every screen size and are shown or hidden by media queries in `src/index.css`, so there is no JS screen-size detection. One pure helper (`utils/history.js`) is extracted so the history table and the new cards share their data. A Playwright audit script (`scripts/mobile-audit.mjs`) is the acceptance test. It fails before the work and passes after.

**Tech Stack:** React 18, plain CSS (`src/index.css`), Vite, Vitest (node env) for pure helpers, `playwright-core` + the locally installed Chromium for the layout audit.

---

## Baseline (audit run on 2 Nov 2026, test build, 360/390/768 px)

| Screen | Finding |
|---|---|
| All | No page scrolls sideways: wide parts already sit in their own scroll areas |
| Navbar | Under 860 px the menu shows icons only, with no labels. Under 480 px the autosave indicator (`.nav-save`) is hidden, so users can't see whether work was saved |
| Dashboard | Status bars are 10–12 px wide hover targets (`ProgressStats.jsx`); hover tooltips don't work on touch |
| Submit | Submit and the readiness count are at the very end of a long form |
| Submit | Category scroll arrows are 32×32 px (`TrackSelector.jsx`) |
| Login | Show-password toggle is 19×19 px (`LoginView.jsx`) |
| History | Table is 780 px wide; on a phone the status column is off-screen |
| Modals | Centred card, `max-height: 90vh` (jumps when the mobile browser bar shows or hides), footer buttons small |
| Admin | Table is 1500 px wide (admins use desktop; only make the university column sticky) |

Out of scope: dashboard card redesign, admin mobile layout, the Landing Page (it has its own plan).

## File structure

| File | Responsibility |
|---|---|
| `scripts/mobile-audit.mjs` (new) | Acceptance test: logs in, visits each page at 360/390/768/1280 px, asserts the rules below |
| `src/utils/history.js` (new) + `history.test.js` | Pure: builds the 17 history rows from `submissions` |
| `src/components/layout/MobileTabBar.jsx` (new) | Bottom tab bar with labels (phones only) |
| `src/components/submit/MobileSubmitBar.jsx` (new) | Sticky bar: readiness, save state, submit button (≤ 980 px) |
| `src/components/layout/Navbar.jsx` | Renders `MobileTabBar`; marks top links `nav-top-links` |
| `src/components/history/HistoryView.jsx` | Uses `historyRows`; adds the card list |
| `src/components/submit/SubmitView.jsx` | Renders `MobileSubmitBar` |
| `src/components/submit/TrackSelector.jsx`, `auth/LoginView.jsx` | Tap target sizes |
| `src/components/admin/AdminView.jsx` | `admin-table` class |
| `src/index.css` | All media queries, in one new block at the end |
| `index.html` | `viewport-fit=cover` so the safe-area insets work on iPhone |

---

### Task 1: Mobile audit script (the failing acceptance test)

**Files:**
- Create: `scripts/mobile-audit.mjs`
- Modify: `package.json` (devDependency + script)

- [ ] **Step 1: Add the dependency and script**

Run: `npm i -D playwright-core@1.59`

In `package.json` `"scripts"` add:

```json
"audit:mobile": "node scripts/mobile-audit.mjs"
```

- [ ] **Step 2: Write the audit**

Create `scripts/mobile-audit.mjs`:

```js
// Mobile layout acceptance test. Needs a running portal (API + built frontend) and a coordinator login.
//   PORTAL_URL=http://localhost:3101 AUDIT_USER=kmutt AUDIT_PASS=... npm run audit:mobile
// Optional: CHROME_PATH (defaults to Playwright's Chromium in %LOCALAPPDATA%\ms-playwright)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PORTAL_URL || 'http://localhost:3101';
const USER = process.env.AUDIT_USER;
const PASS = process.env.AUDIT_PASS;
if (!USER || !PASS) { console.error('Set AUDIT_USER and AUDIT_PASS'); process.exit(2); }

const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const dir = fs.existsSync(root) && fs.readdirSync(root).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
  if (!dir) throw new Error('No Chromium found; set CHROME_PATH');
  return path.join(root, dir, 'chrome-win64', 'chrome.exe');
};

const PHONES = [360, 390];
const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// Controls a finger must hit: visible, clickable, at least 44x44 (WCAG 2.5.5 / Apple HIG)
const smallTargets = (page, selector) => page.$$eval(selector, els => els
  .filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).pointerEvents !== 'none';
  })
  .map(e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), name: e.getAttribute('aria-label') || e.innerText.trim().slice(0, 20) }; })
  .filter(s => s.w < 44 || s.h < 44));

const pageOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const isShown = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.height > 0; }).catch(() => false);
const inViewport = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0 && r.right <= window.innerWidth + 1; }).catch(() => false);

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input:not([type=password])').first().fill(USER);
  await page.locator('input[type=password]').fill(PASS);
  await page.locator('input[type=password]').press('Enter');
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

const browser = await chromium.launch({ executablePath: findChrome() });

for (const w of PHONES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  // Login page (before signing in)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  for (const s of await smallTargets(page, 'form button')) fail(`login@${w}`, `tap target ${s.w}x${s.h} "${s.name}"`);

  await login(page);

  for (const p of ['/dashboard', '/submit/theory', '/submit/singing', '/history', '/certificates']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const where = `${p}@${w}`;
    const over = await pageOverflow(page);
    if (over > 0) fail(where, `page scrolls sideways by ${over}px`);
    if (!(await isShown(page, '.mobile-tabbar'))) fail(where, 'bottom tab bar not shown');
    if (!(await inViewport(page, '.mobile-tabbar'))) fail(where, 'bottom tab bar not pinned to the screen');
    for (const s of await smallTargets(page, '.mobile-tabbar button')) fail(where, `tab ${s.w}x${s.h} "${s.name}"`);
    const labels = await page.$$eval('.mobile-tabbar button span', els => els.filter(e => e.offsetWidth > 0).length);
    if (labels < 4) fail(where, `tab bar shows ${labels}/4 text labels`);
    for (const s of await smallTargets(page, '.seg-cluster-row button, .track-arrow')) fail(where, `tap target ${s.w}x${s.h} "${s.name}"`);
  }

  // Submit page: sticky bar with readiness + save state + submit button
  await page.goto(`${BASE}/submit/singing`, { waitUntil: 'networkidle' });
  if (!(await inViewport(page, '.mobile-submit-bar'))) fail(`submit@${w}`, 'sticky submit bar not visible on load');
  if (!(await page.$('.mobile-submit-bar button'))) fail(`submit@${w}`, 'sticky bar has no submit button');
  const barOverlaps = await page.evaluate(() => {
    const a = document.querySelector('.mobile-submit-bar')?.getBoundingClientRect();
    const b = document.querySelector('.mobile-tabbar')?.getBoundingClientRect();
    return a && b ? a.bottom > b.top + 1 : false;
  });
  if (barOverlaps) fail(`submit@${w}`, 'submit bar overlaps the tab bar');

  // Member modal opens as a bottom sheet with its buttons reachable
  await page.getByRole('button', { name: /เพิ่มอาจารย์/ }).first().click();
  await page.waitForSelector('.modal');
  const sheet = await page.$eval('.modal', e => { const r = e.getBoundingClientRect(); return { bottom: r.bottom, width: r.width, vh: window.innerHeight, vw: window.innerWidth }; });
  if (Math.abs(sheet.bottom - sheet.vh) > 2) fail(`modal@${w}`, `not a bottom sheet (bottom=${sheet.bottom}, viewport=${sheet.vh})`);
  if (sheet.width < sheet.vw - 1) fail(`modal@${w}`, `sheet narrower than screen (${sheet.width}/${sheet.vw})`);
  if (!(await inViewport(page, '.modal-footer'))) fail(`modal@${w}`, 'footer buttons off-screen');
  await page.keyboard.press('Escape');

  // History: every entry shows its status without sideways scrolling
  await page.goto(`${BASE}/history`, { waitUntil: 'networkidle' });
  if (await isShown(page, '.history-table-wrap')) fail(`history@${w}`, 'wide table still shown on phone');
  const cards = await page.$$eval('.history-card', els => els.length);
  if (cards !== 17) fail(`history@${w}`, `expected 17 history cards, got ${cards}`);
  const statusOff = await page.$$eval('.history-card .history-status', els => els.filter(e => e.getBoundingClientRect().right > window.innerWidth).length);
  if (statusOff) fail(`history@${w}`, `${statusOff} status badges off-screen`);

  await ctx.close();
}

// Desktop must look as before: no mobile pieces
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  for (const [p, sel] of [['/dashboard', '.mobile-tabbar'], ['/submit/singing', '.mobile-submit-bar'], ['/history', '.history-cards']]) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    if (await isShown(page, sel)) fail(`${p}@1280`, `${sel} visible on desktop`);
  }
  if (!(await isShown(page, '.history-table-wrap'))) fail('/history@1280', 'table missing on desktop');
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('PASS: mobile audit');
```

- [ ] **Step 3: Start a test portal and run the audit to see it fail**

Use a throwaway database so your real data is untouched (PowerShell; Git Bash equivalent works too):

```bash
cd server
# accounts file with one coordinator, e.g. C:\tmp\audit-accounts.md:
#   ## Coordinators
#   | username | password |
#   |---|---|
#   | kmutt | audit-pass-123 |
DB_PATH=/c/tmp/audit.db UPLOAD_DIR=/c/tmp/audit-up npm run seed -- /c/tmp/audit-accounts.md
cd .. && npx vite build --outDir /c/tmp/audit-dist --emptyOutDir
cd server && PORT=3101 DB_PATH=/c/tmp/audit.db UPLOAD_DIR=/c/tmp/audit-up SERVE_STATIC=true STATIC_DIR=/c/tmp/audit-dist APP_ORIGIN=http://localhost:3101 node src/index.js
```

In a second terminal:

```bash
PORTAL_URL=http://localhost:3101 AUDIT_USER=kmutt AUDIT_PASS=audit-pass-123 npm run audit:mobile
```

Expected: `FAIL (...)` listing at least: bottom tab bar not shown, sticky submit bar not visible, not a bottom sheet, wide table still shown, 0 history cards, tap targets on the eye toggle, track arrows and status bars.

From now on, "re-run the audit" means: rebuild into `/c/tmp/audit-dist` (`npx vite build --outDir /c/tmp/audit-dist --emptyOutDir`), then run the audit command. The server picks up the new files without a restart.

- [ ] **Step 4: Commit**

```bash
git add scripts/mobile-audit.mjs package.json package-lock.json
git commit -m "test: add mobile layout audit script"
```

---

### Task 2: Safe-area viewport and the CSS block

**Files:**
- Modify: `index.html` (viewport meta)
- Modify: `src/index.css` (append at end)

- [ ] **Step 1: Allow content under the iPhone home bar to be padded**

In `index.html` replace the viewport meta with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 2: Add the shared variables and the mobile section header to the end of `src/index.css`**

```css
/* ================================================================
   Mobile (phones and small tablets). Desktop rules above stay as is.
   --tabbar-h: height of the bottom tab bar (0 when it isn't shown)
   ================================================================ */
:root { --tabbar-h: 0px; }

@media (max-width: 768px) {
  :root { --tabbar-h: 64px; }
}
```

- [ ] **Step 3: Build to check the CSS parses**

Run: `npx vite build`
Expected: `✓ built in ...`

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "style: safe-area viewport and mobile CSS section"
```

---

### Task 3: Bottom tab bar with labels

**Files:**
- Create: `src/components/layout/MobileTabBar.jsx`
- Modify: `src/components/layout/Navbar.jsx` (the `<nav>` at about line 113 and the end of the component)
- Modify: `src/App.jsx` (`ProtectedLayout` `<main>`)
- Modify: `src/index.css` (append)

- [ ] **Step 1: Create the component**

`src/components/layout/MobileTabBar.jsx`:

```jsx
import React from 'react';

// Bottom navigation for phones: same items as the top nav, always with text labels.
// Hidden above 768px by CSS (.mobile-tabbar).
export const MobileTabBar = ({ items, onNavigate }) => (
  <nav className="mobile-tabbar" aria-label="เมนูหลัก">
    {items.map(({ id, path, label, icon: Icon, isActive }) => (
      <button
        key={id}
        type="button"
        onClick={() => onNavigate(path)}
        aria-current={isActive ? 'page' : undefined}
        className={isActive ? 'active' : undefined}
      >
        <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
        <span>{label}</span>
      </button>
    ))}
  </nav>
);
```

- [ ] **Step 2: Render it from the Navbar (coordinators only) and tag the top links**

In `Navbar.jsx` add the import:

```jsx
import { MobileTabBar } from './MobileTabBar';
```

Change the top navigation opening tag from

```jsx
<nav style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-main)', padding: '4px', borderRadius: '999px' }}>
```

to

```jsx
<nav className="nav-top-links" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-main)', padding: '4px', borderRadius: '999px' }}>
```

and change the end of the component from

```jsx
      </div>
    </header>
  );
};
```

to

```jsx
      </div>
      {!isAdmin && <MobileTabBar items={navItems} onNavigate={navigate} />}
    </header>
  );
};
```

(`position: fixed` in the CSS takes the bar out of the sticky header's flow.)

- [ ] **Step 3: Keep page content clear of the bar**

In `src/App.jsx` `ProtectedLayout`, change `<main style={{ flex: 1 }}>` to:

```jsx
<main className="with-tabbar" style={{ flex: 1 }}>
```

- [ ] **Step 4: CSS (append to `src/index.css`)**

```css
.mobile-tabbar { display: none; }

@media (max-width: 768px) {
  .nav-top-links { display: none !important; }

  .mobile-tabbar {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: #FFFFFF;
    border-top: 1px solid var(--border-light);
    box-shadow: 0 -4px 16px rgba(27, 29, 41, 0.06);
  }
  .mobile-tabbar button {
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
  }
  .mobile-tabbar button.active { color: var(--primary); font-weight: 700; }

  .with-tabbar { padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); }
}
```

- [ ] **Step 5: Re-run the audit**

Expected: no more "bottom tab bar" or "tab bar shows n/4 text labels" failures. Other failures remain.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/MobileTabBar.jsx src/components/layout/Navbar.jsx src/App.jsx src/index.css
git commit -m "feat(mobile): bottom tab bar with labels on phones"
```

---

### Task 4: Sticky submit bar with save state

**Files:**
- Create: `src/components/submit/MobileSubmitBar.jsx`
- Modify: `src/components/submit/SubmitView.jsx` (after the `<SubmissionChecklist …/>` block, about line 260)
- Modify: `src/index.css` (append)

- [ ] **Step 1: Create the component**

`src/components/submit/MobileSubmitBar.jsx`:

```jsx
import React from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { usePortal } from '../../context/PortalContext';
import { getTrack } from '../../data/tracks';
import { getRequirements } from '../../utils/requirements';

const SAVE_TEXT = { saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว', error: 'บันทึกไม่สำเร็จ' };

// Pinned above the tab bar on screens ≤ 980px, where the readiness panel sits at the end of the form.
// Same submit handler as the panel; hidden once the entry is submitted or closed.
export const MobileSubmitBar = ({ trackId, isLocked, isClosed, onAttemptSubmit }) => {
  const { submissions, saveState } = usePortal();
  if (isLocked || isClosed) return null;

  const sub = submissions[trackId] || { members: [], files: [], links: {} };
  const reqs = getRequirements(getTrack(trackId), sub);
  const done = reqs.filter(r => r.ok).length;
  const saveText = SAVE_TEXT[saveState];

  return (
    <div className="mobile-submit-bar" role="region" aria-label="ส่งผลงาน">
      <div className="msb-status">
        <strong>พร้อมส่ง {done}/{reqs.length}</strong>
        {saveText && <span className={`msb-save msb-${saveState}`} role="status" aria-live="polite">{saveText}</span>}
      </div>
      <button type="button" className="btn btn-primary" onClick={onAttemptSubmit}>
        <PaperPlaneTilt size={18} weight="fill" />
        <span>ส่งผลงาน</span>
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Render it in SubmitView**

Add the import in `SubmitView.jsx`:

```jsx
import { MobileSubmitBar } from './MobileSubmitBar';
```

Directly after the closing `</div>` of `<div className="submit-grid">` (the line after the sticky-checklist `</div>`), add:

```jsx
          <MobileSubmitBar
            trackId={entryId}
            isLocked={isLocked}
            isClosed={deadline.closed}
            onAttemptSubmit={handleAttemptSubmit}
          />
```

- [ ] **Step 3: CSS (append)**

```css
.mobile-submit-bar { display: none; }

@media (max-width: 980px) {
  .mobile-submit-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    z-index: 55;
    padding: 10px 16px;
    background: #FFFFFF;
    border-top: 1px solid var(--border-light);
    box-shadow: 0 -4px 16px rgba(27, 29, 41, 0.06);
  }
  .mobile-submit-bar .btn { min-height: 44px; flex-shrink: 0; }
  .msb-status { display: flex; flex-direction: column; font-size: var(--fs-sm); line-height: 1.3; min-width: 0; }
  .msb-save { font-size: var(--fs-xs); color: var(--text-muted); }
  .msb-saved { color: #1F7A3D; }
  .msb-error { color: var(--danger); }

  /* room for the bar under the last form section */
  .submit-grid { padding-bottom: 76px; }
}
```

- [ ] **Step 4: Re-run the audit**

Expected: no "sticky submit bar" or "overlaps the tab bar" failures.

- [ ] **Step 5: Check by hand at 390 px (DevTools device mode)**

Add an advisor, then watch the bar change from "กำลังบันทึก…" to "บันทึกแล้ว". Tapping "ส่งผลงาน" with missing items must behave exactly like the panel's button (it scrolls to the first error).

- [ ] **Step 6: Commit**

```bash
git add src/components/submit/MobileSubmitBar.jsx src/components/submit/SubmitView.jsx src/index.css
git commit -m "feat(mobile): sticky submit bar with readiness and save state"
```

---

### Task 5: History rows helper (TDD)

**Files:**
- Create: `src/utils/history.js`
- Test: `src/utils/history.test.js`

- [ ] **Step 1: Write the failing test**

`src/utils/history.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { historyRows } from './history';
import { emptySubmission } from '../data/seedData';
import { TRACKS, isGrouped, entryKey } from '../data/tracks';

// Every entry blank, the way the API returns a new account
const blankSubmissions = () => {
  const out = {};
  TRACKS.forEach(t => {
    if (isGrouped(t)) t.subjectGroups.forEach((g, i) => { out[entryKey(t.id, i)] = emptySubmission({ subjectGroup: g }); });
    else out[t.id] = emptySubmission();
  });
  return out;
};

describe('historyRows', () => {
  it('returns one row per entry (17)', () => {
    expect(historyRows(blankSubmissions())).toHaveLength(17);
  });

  it('marks a submitted entry and uses its submit time', () => {
    const subs = blankSubmissions();
    subs.singing = { ...subs.singing, status: 'submitted', submittedAt: '2026-11-03T10:00:00+07:00', hash: 'abc123' };
    const row = historyRows(subs).find(r => r.key === 'singing');
    expect(row.isSubmitted).toBe(true);
    expect(row.isDraft).toBe(false);
    expect(row.hash).toBe('abc123');
    expect(row.timestamp).not.toBe('-');
  });

  it('labels a draft time and counts finished files and the video link', () => {
    const subs = blankSubmissions();
    subs.clip = {
      ...subs.clip,
      status: 'draft',
      draftAt: '2026-11-02T09:00:00+07:00',
      files: [{ status: 'done' }, { status: 'error' }],
      links: { video: 'https://youtu.be/x' }
    };
    const row = historyRows(subs).find(r => r.key === 'clip');
    expect(row.isDraft).toBe(true);
    expect(row.timestamp).toMatch(/\(ร่าง\)$/);
    expect(row.filesCount).toBe(1);
    expect(row.linksCount).toBe(1);
  });

  it('gives grouped entries their group index for the edit link', () => {
    const row = historyRows(blankSubmissions()).find(r => r.key === 'theory.g2');
    expect(row.groupIdx).toBe(2);
    expect(row.subtitle).toBe('กลุ่มสาขาวิชาโยธา');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/utils/history.test.js`
Expected: FAIL, `Failed to resolve import "./history"`.

- [ ] **Step 3: Implement**

`src/utils/history.js`:

```js
// Rows for the history page (table on desktop, cards on phones): one per entry,
// grouped tracks (theory / practice) get one row per กลุ่มสาขาวิชา.
import { TRACKS, trackSubtitle } from '../data/tracks';
import { fmtDateTime, statusMeta } from './formatters';
import { submissionSummary } from './requirements';
import { getEntries } from './entries';

export const historyRows = (submissions) =>
  TRACKS.flatMap(t => getEntries(t, submissions).map(e => {
    const sub = e.sub;
    const isSubmitted = sub.status === 'submitted';
    const isDraft = sub.status === 'draft';
    return {
      key: e.key,
      track: t,
      groupIdx: e.groupIdx ?? null,
      title: t.th,
      subtitle: e.group || trackSubtitle(t),
      sub,
      meta: statusMeta(sub.status, 0),
      isSubmitted,
      isDraft,
      hash: isSubmitted ? sub.hash || null : null,
      timestamp: sub.submittedAt
        ? fmtDateTime(sub.submittedAt)
        : (sub.draftAt ? `${fmtDateTime(sub.draftAt)} (ร่าง)` : '-'),
      filesCount: (sub.files || []).filter(f => f.status === 'done').length,
      linksCount: sub.links?.video ? 1 : 0,
      summary: submissionSummary(t, sub),
      actionLabel: isSubmitted ? 'ดูรายละเอียด' : (isDraft ? 'แก้ไขต่อ' : 'เริ่มส่ง')
    };
  }));
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/utils/history.test.js`
Expected: `4 passed`.
If `emptySubmission` is no longer exported from `src/data/seedData.js` (the demo data was removed in `1039b2c`), check `git grep -n "export const emptySubmission"` and import it from where it lives now.

- [ ] **Step 5: Commit**

```bash
git add src/utils/history.js src/utils/history.test.js
git commit -m "refactor(history): extract historyRows helper"
```

---

### Task 6: History cards on phones

**Files:**
- Modify: `src/components/history/HistoryView.jsx`
- Modify: `src/index.css` (append)

- [ ] **Step 1: Use the helper in the table**

In `HistoryView.jsx`:
1. Add `import { historyRows } from '../../utils/history';`. Remove the imports that become unused (`fmtDateTime`, `statusMeta`, `submissionSummary`, `getEntries`, `trackSubtitle`, `TRACKS`) only after this step compiles.
2. In the component body, before `return`, add:

```jsx
  const rows = historyRows(submissions);
  const openRow = (r) => (r.groupIdx != null ? navigate(`/submit/${r.track.id}/${r.groupIdx}`) : openTrack(r.track.id));
```

3. Replace the `{TRACKS.flatMap(...).map(({ t, e }) => { ... })}` block inside `<tbody>` with a `rows.map(r => ...)` that renders the same cells from `r`: `r.title` / `r.subtitle`, `r.summary || 'ยังไม่มีข้อมูล'` / `r.timestamp`, the badge from `r.meta`, `teamLabel(r.sub.members)`, `r.hash` with `r.filesCount` / `r.linksCount`, and the button with `onClick={() => openRow(r)}` and `r.actionLabel`. Keep every inline style exactly as it is now; only the data source changes.

4. Add `className="history-table-wrap"` to the `<div style={{ overflowX: 'auto' }}>` around the table.

- [ ] **Step 2: Add the card list after the table card's closing `</div>`**

```jsx
      {/* Phones: one card per entry (the table is hidden by CSS) */}
      <ul className="history-cards" aria-label="ประวัติการส่งผลงาน">
        {rows.map(r => (
          <li key={r.key} className="history-card">
            <div className="history-card-head">
              <div style={{ minWidth: 0 }}>
                <div className="row-title">{r.title}</div>
                <div className="row-meta">{r.subtitle}</div>
              </div>
              <span
                className="history-status"
                style={{ background: r.meta.badgeBg, color: r.meta.badgeColor, border: r.meta.badgeBorder }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.meta.dotColor }} />
                {r.meta.label}
              </span>
            </div>
            <div className="row-meta">
              {r.summary || 'ยังไม่มีข้อมูล'} · {r.timestamp}
              {r.hash && <> · <span style={{ fontFamily: 'monospace' }}>#{r.hash}</span></>}
            </div>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => openRow(r)}>
              <span>{r.actionLabel}</span>
              <ArrowRight size={14} weight="bold" />
            </button>
          </li>
        ))}
      </ul>
```

- [ ] **Step 3: CSS (append)**

```css
.history-cards { display: none; }

@media (max-width: 640px) {
  .history-table-wrap { display: none; }
  .history-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .history-card {
    background: #FFFFFF;
    border: 1px solid var(--border-light);
    border-radius: 18px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .history-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .history-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: var(--fs-xs);
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .history-card .btn { min-height: 44px; }
}
```

The table's card wrapper (white box around the table) stays. When the table is hidden it would be an empty box, so also add `className="history-table-card"` to that wrapper `<div>` (the one with `borderRadius: '24px'` right after `{/* History Table */}`) and add inside the same media query:

```css
  .history-table-card { display: none; }
```

- [ ] **Step 4: Run unit tests and the audit**

Run: `npx vitest run`
Expected: all pass.
Re-run the audit. Expected: no history failures.

- [ ] **Step 5: Commit**

```bash
git add src/components/history/HistoryView.jsx src/index.css
git commit -m "feat(mobile): history as cards on phones"
```

---

### Task 7: Tap targets (eye toggle, track arrows, status bars)

**Files:**
- Modify: `src/components/auth/LoginView.jsx` (toggle button style, about line 185)
- Modify: `src/components/submit/TrackSelector.jsx` (both arrow buttons, about lines 130 and 217)
- Modify: `src/index.css` (append)

- [ ] **Step 1: Eye toggle: 44 px hit area, same icon**

In `LoginView.jsx`, change the show-password button's style from

```jsx
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    color: '#A3A6B4',
                    display: 'flex',
                    alignItems: 'center'
                  }}
```

to

```jsx
                  style={{
                    position: 'absolute',
                    right: '2px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '44px',
                    height: '44px',
                    background: 'transparent',
                    color: '#A3A6B4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
```

Make sure the button has `aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}`; add it if missing.

- [ ] **Step 2: Track arrows: class hook**

In `TrackSelector.jsx` add `className="track-arrow"` to both the "เลื่อนซ้าย" and "เลื่อนขวา" buttons (keep their inline styles).

- [ ] **Step 3: CSS (append)**

```css
/* Touch screens: bigger arrows; status bars are display-only (hover tooltips don't work on touch,
   and each category card below already opens its entry) */
@media (pointer: coarse) {
  .track-arrow { width: 44px !important; height: 44px !important; }
  .seg-cluster-row button { pointer-events: none; }
}
```

- [ ] **Step 4: Re-run the audit**

Expected: no tap-target failures.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/LoginView.jsx src/components/submit/TrackSelector.jsx src/index.css
git commit -m "fix(mobile): 44px tap targets for eye toggle and track arrows"
```

---

### Task 8: Modals as bottom sheets; sticky admin column

**Files:**
- Modify: `src/index.css` (`.modal` rule at about line 558, plus append)
- Modify: `src/components/admin/AdminView.jsx:110`

- [ ] **Step 1: Stop the modal from jumping with the browser bar**

In the existing `.modal` rule, directly after `max-height: 90vh;` add:

```css
  max-height: 90dvh;
```

(Browsers without `dvh` keep the `vh` line.)

- [ ] **Step 2: Bottom sheet on phones (append)**

```css
@media (max-width: 560px) {
  .modal-overlay { align-items: flex-end; padding: 0; }
  .modal {
    width: 100%;
    max-height: 92dvh;
    border-radius: 20px 20px 0 0;
  }
  .modal-header,
  .modal-body { padding-left: 18px; padding-right: 18px; }
  .modal-footer {
    padding: 12px 18px calc(12px + env(safe-area-inset-bottom));
  }
  .modal-footer > .btn { flex: 1; min-height: 48px; }
}
```

- [ ] **Step 3: Admin table: keep the university column visible while scrolling**

In `AdminView.jsx` line 110 add `className="admin-table"` to the `<table>`. Append:

```css
.admin-table th:first-child,
.admin-table td:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #FFFFFF;
  box-shadow: 1px 0 0 var(--border-light);
}
```

- [ ] **Step 4: Re-run the audit**

Expected: `PASS: mobile audit`.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/admin/AdminView.jsx
git commit -m "feat(mobile): bottom-sheet modals and sticky admin column"
```

---

### Task 9: Real-device check and release

- [ ] **Step 1: Full checks**

```bash
npx vitest run
npm run audit:mobile   # with the env vars from Task 1
npx vite build
```

Expected: all tests pass, `PASS: mobile audit`, build succeeds.

- [ ] **Step 2: Phone check on the staging URL** (one Android Chrome, one iPhone Safari if available)

Walk through and tick:
- [ ] Log in (eye toggle easy to tap; keyboard doesn't zoom the page: inputs are 16px)
- [ ] Bottom tabs switch pages; the active tab is orange; nothing hidden behind the bar at the end of any page
- [ ] Submit page: add an advisor with a photo from the camera; the bar shows "บันทึกแล้ว"; the sheet's buttons stay above the keyboard
- [ ] Press "ส่งผลงาน" with missing items → jumps to the first error; complete it and submit → confirm popup is usable
- [ ] History: every entry shows its status; "แก้ไขต่อ" opens the right group
- [ ] iPhone: the tab bar sits above the home indicator (safe area)

- [ ] **Step 3: Update the review doc limitation**

In `../data/Thailand Teaching Academy 13th - Prototype Update.md`, under "ข้อจำกัด ณ ปัจจุบัน", replace the desktop-only line for the Portal with a note that the Portal now supports phones.

- [ ] **Step 4: Commit**

```bash
git add -A src scripts index.html
git commit -m "chore(mobile): verified on devices"
```
