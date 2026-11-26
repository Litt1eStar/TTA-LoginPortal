// A file from public/ written as '/assets/...' must carry the app's base path when the app is not
// served at the root (KMUTT: https://tta2027.kmutt.ac.th/portal/, built with PORTAL_BASE=/portal/).
// Vite rewrites its own bundle URLs, but not string paths in our code, hence this helper.
// Is this browser path (window.location.pathname, which includes the base path) a submit page?
export function isSubmitUrl(pathname, base = import.meta.env?.BASE_URL || '/') {
  return String(pathname).startsWith(`${base.replace(/\/+$/, '')}/submit`);
}

export function publicUrl(path, base = import.meta.env?.BASE_URL || '/') {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  return base.replace(/\/+$/, '') + path;
}
