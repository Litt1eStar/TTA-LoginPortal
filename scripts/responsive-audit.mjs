// Portal responsive acceptance test (docs/superpowers/plans/2026-11-27-portal-responsive-all-devices.md).
// Needs the API and the frontend running:
//   cd server && npm start                      (API on 127.0.0.1:3001)
//   npx vite --port 3005 --strictPort --open false
//   PORTAL_USER=kmitl PORTAL_PW=... npm run audit:responsive
// Optional: ADMIN_USER / ADMIN_PW (admin page at laptop sizes), PORTAL_URL (default http://localhost:3005),
// ONLY=320x640,1024x768 (subset of the matrix), ROUTES=dashboard,history (subset of the routes),
// --baseline (overwrite audit-shots/baseline/), CHROME_PATH (default: newest Chromium in %LOCALAPPDATA%\ms-playwright).
// Credentials come only from the environment: never write them into a file.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PORTAL_URL || 'http://localhost:3005';
const CAPTURE_BASELINE = process.argv.includes('--baseline');

const MATRIX = [
  [320, 640], [360, 780], [390, 844], [430, 932],
  [667, 375], [844, 390],
  [600, 960], [768, 1024], [820, 1180],
  [1024, 768], [1180, 820], [1280, 800], [1366, 768],
  [1440, 900], [1920, 1080]
];
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const matrix = only.length ? MATRIX.filter(([w, h]) => only.includes(`${w}x${h}`)) : MATRIX;

const ROUTES = ['login', 'dashboard', 'submit/theory', 'history', 'certificates'];
const onlyRoutes = (process.env.ROUTES || '').split(',').filter(Boolean);
const routes = onlyRoutes.length ? ROUTES.filter(r => onlyRoutes.includes(r)) : ROUTES;

const findChrome = () => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const num = (d) => parseInt(d.split('-')[1], 10);
  const dir = fs.existsSync(root) && fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => num(a) - num(b)).pop();
  if (!dir) throw new Error('No Chromium found; set CHROME_PATH');
  return path.join(root, dir, 'chrome-win64', 'chrome.exe');
};

const BASELINE_DIR = path.resolve('audit-shots', 'baseline');
const AFTER_DIR = path.resolve('audit-shots', 'after');
fs.mkdirSync(BASELINE_DIR, { recursive: true });
fs.mkdirSync(AFTER_DIR, { recursive: true });

const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// Logs in once per account and returns its cookies; logging in per page hits the rate limit (429).
async function loginState(browser, username, password) {
  const ctx = await browser.newContext();
  try {
    const res = await ctx.request.post(`${BASE}/api/login`, { data: { username, password } });
    if (!res.ok()) throw new Error(`login as ${username} failed: HTTP ${res.status()}`);
    return await ctx.storageState();
  } finally {
    await ctx.close();
  }
}

// Rules 1–4 inside a root element. Returns lists of problems.
async function checkRules(page, rootSel) {
  return page.evaluate((rootSel) => {
    const vw = document.documentElement.clientWidth;
    const out = { pageOver: 0, offscreen: [], clipped: [], tiny: [], smallBody: [], smallInput: [], tap: [] };
    const root = document.querySelector(rootSel);
    if (!root) return out;
    if (rootSel === 'body') out.pageOver = Math.max(0, document.documentElement.scrollWidth - vw);

    const visible = (el) => {
      if (el.closest('.sr-only')) return false;
      // Visually hidden text for screen readers (clip: rect(0 0 0 0)) is not on screen
      if (getComputedStyle(el).clip === 'rect(0px, 0px, 0px, 0px)') return false;
      for (let cur = el; cur && cur !== document.documentElement; cur = cur.parentElement) {
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // Allowed past the edge: inside its own horizontal scroller (tables, the category tabs)
    const inScroller = (el) => {
      for (let cur = el.parentElement; cur && cur !== document.body; cur = cur.parentElement) {
        const ox = getComputedStyle(cur).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      return false;
    };
    const name = (el) => {
      const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26);
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? `("${txt}")` : ''}`;
    };

    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (!(el instanceof HTMLElement) || !visible(el)) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

      if (cs.position !== 'fixed' && !inScroller(el) && (r.right > vw + 1 || r.left < -1) &&
          (ownText || el.matches('button, a, input, img, svg'))) {
        out.offscreen.push(`${name(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
      if (ownText) {
        const ox = cs.overflowX;
        if ((ox === 'hidden' || ox === 'clip' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 &&
            !el.hasAttribute('data-truncate-ok')) {
          out.clipped.push(name(el));
        }
        const fs = parseFloat(cs.fontSize);
        if (fs < 12) out.tiny.push(`${name(el)} ${fs.toFixed(1)}px`);
        else if (vw < 768 && el.matches('p') && fs < 14) out.smallBody.push(`${name(el)} ${fs.toFixed(1)}px`);
      }
      if (vw < 768 && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select') &&
          parseFloat(cs.fontSize) < 16) {
        out.smallInput.push(`${name(el)} ${cs.fontSize}`);
      }
      // Display-only on touch (pointer-events: none) is not a tap target
      if (vw < 1024 && el.matches('a, button, [role=button], [role=tab]') && !el.parentElement.closest('a, button, [role=button]') &&
          cs.pointerEvents !== 'none') {
        if (r.width < 44 || r.height < 44) out.tap.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  }, rootSel);
}

function report(where, res) {
  if (res.pageOver) fail(`${where}/page`, `scrolls sideways by ${res.pageOver}px`);
  const uniq = (a) => [...new Set(a)];
  uniq(res.offscreen).slice(0, 6).forEach((m) => fail(`${where}/offscreen`, m));
  uniq(res.clipped).forEach((m) => fail(`${where}/clipped`, m));
  uniq(res.tiny).forEach((m) => fail(`${where}/text<12`, m));
  uniq(res.smallBody).forEach((m) => fail(`${where}/body<14`, m));
  uniq(res.smallInput).forEach((m) => fail(`${where}/input<16`, m));
  uniq(res.tap).forEach((m) => fail(`${where}/tap<44`, m));
}

// Rule 5: nothing important under the fixed bottom bars once the page is scrolled to the end
async function checkBottomBars(page, where) {
  const covered = await page.evaluate(() => {
    scrollTo(0, document.documentElement.scrollHeight);
    const bars = [...document.querySelectorAll('.mobile-tabbar, .mobile-submit-bar')].filter((b) => getComputedStyle(b).display !== 'none');
    if (!bars.length) return null;
    const top = Math.min(...bars.map((b) => b.getBoundingClientRect().top));
    const main = document.querySelector('main') || document.body;
    const last = [...main.querySelectorAll('button, a, h1, h2, h3, p, td')].filter((e) => !e.closest('.mobile-tabbar, .mobile-submit-bar') && e.getBoundingClientRect().height > 0).pop();
    if (!last) return null;
    const r = last.getBoundingClientRect();
    return r.bottom > top + 1 ? `${last.tagName.toLowerCase()} "${(last.textContent || '').trim().slice(0, 20)}" bottom ${Math.round(r.bottom)} > bar top ${Math.round(top)}` : null;
  });
  if (covered) fail(`${where}/bottom-bar`, covered);
}

async function visit(browser, state, route, w, h, motion) {
  const touch = w < 1024;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, isMobile: touch && w < 768, hasTouch: touch,
    reducedMotion: motion, ...(state ? { storageState: state } : {})
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000); // full-page screenshots of long pages can take several seconds
  const tag = `${route}@${w}x${h}${motion === 'reduce' ? '' : '(motion)'}`;
  try {
    await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(motion === 'reduce' ? 150 : 900);
    const file = `${route.replace(/\//g, '_')}_${w}x${h}${motion === 'reduce' ? '' : '-motion'}.png`;
    if (motion === 'reduce') {
      const base = path.join(BASELINE_DIR, file);
      if (CAPTURE_BASELINE || !fs.existsSync(base)) await page.screenshot({ path: base, fullPage: true });
    }
    await page.screenshot({ path: path.join(AFTER_DIR, file), fullPage: true });
    report(tag, await checkRules(page, 'body'));
    if (motion !== 'reduce') return;
    if (w < 1024) await checkBottomBars(page, tag);

    // Rule 6: the key numbers are on screen without sideways scrolling
    if (route === 'dashboard') {
      const missing = await page.evaluate(() => ['.tile-hero', '.tile-orange'].filter((s) => {
        const e = document.querySelector(s);
        if (!e) return true;
        const r = e.getBoundingClientRect();
        return r.right > document.documentElement.clientWidth + 1 || r.left < -1;
      }));
      missing.forEach((s) => fail(`${tag}/key-info`, `${s} not fully in view horizontally`));
    }

    // Open states: the member form on the submit page, the status popover on the dashboard
    if (route === 'submit/theory') {
      const btn = page.locator('main button', { hasText: /เพิ่ม|แก้ไข/ }).first();
      if (await btn.count() && await btn.isVisible() && await btn.isEnabled()) {
        await btn.click();
        const dialog = page.locator('[role=dialog]');
        if (await dialog.count()) {
          await page.waitForTimeout(250);
          report(`${tag}/member-modal`, await checkRules(page, '[role=dialog]'));
          const fits = await page.evaluate(() => {
            const d = document.querySelector('[role=dialog]');
            const r = d.getBoundingClientRect();
            return r.top >= -1 && r.bottom <= innerHeight + 1;
          });
          if (!fits) fail(`${tag}/member-modal`, 'dialog box is taller than the screen (its body must scroll instead)');
          await page.keyboard.press('Escape');
        }
      }
    }
  } catch (err) {
    fail(`${tag}/run`, err.message.split('\n')[0]);
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch({ executablePath: findChrome() });
try {
  const user = process.env.PORTAL_USER;
  const pw = process.env.PORTAL_PW;
  if (!user || !pw) throw new Error('Set PORTAL_USER and PORTAL_PW (use kmitl: the longest university name)');
  const state = await loginState(browser, user, pw);

  for (const route of routes) {
    for (const [w, h] of matrix) {
      await visit(browser, route === 'login' ? null : state, route, w, h, 'reduce');
      // Motion on: reveal animations use transforms that can push content sideways
      if ([320, 390, 768, 1024, 1366].includes(w)) await visit(browser, route === 'login' ? null : state, route, w, h, 'no-preference');
    }
  }

  if (process.env.ADMIN_USER && process.env.ADMIN_PW) {
    const adminState = await loginState(browser, process.env.ADMIN_USER, process.env.ADMIN_PW);
    // Admins work on laptops (plan: admin phones/tablets are out of scope). At 768 the page does not
    // scroll sideways; its table cells are 34px with a ::before hit area to 44px, which this check cannot see.
    for (const [w, h] of matrix.filter(([w]) => w >= 1024)) await visit(browser, adminState, 'admin', w, h, 'reduce');
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('PASS: portal responsive audit');
