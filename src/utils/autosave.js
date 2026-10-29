// Per-entry debounced autosave. Pure: no React, no fetch.
// save(key, data, version) -> Promise<entry with .version>

const COMPUTED = ['status', 'draftAt', 'submittedAt', 'hash', 'version'];

// The part of an entry the server stores (PUT /submissions/:key { data }).
// Work files still uploading or failed are local-only.
export const entryData = (entry) => {
  const out = {};
  Object.keys(entry || {}).forEach((k) => {
    if (!COMPUTED.includes(k)) out[k] = entry[k];
  });
  if (Array.isArray(out.files)) out.files = out.files.filter(f => f.status === 'done' && f.fileId != null);
  return out;
};

export function createAutosaver({ save, delay = 1000, onStateChange = () => {}, onError = () => {} }) {
  const saved = new Map();    // key -> { json, version }
  const pending = new Map();  // key -> data waiting to be sent
  const timers = new Map();   // key -> timeout id
  const inflight = new Map(); // key -> promise of the running save
  let active = 0;
  let generation = 0;         // bumped by reset(); stale saves are ignored

  const clearTimer = (key) => {
    clearTimeout(timers.get(key));
    timers.delete(key);
  };

  const setBaseline = (key, data, version) => {
    clearTimer(key);
    pending.delete(key);
    saved.set(key, { json: JSON.stringify(data), version });
  };

  const schedule = (key, data) => {
    const base = saved.get(key);
    if (base && base.json === JSON.stringify(data)) {
      clearTimer(key);
      pending.delete(key);
      return false;
    }
    pending.set(key, data);
    clearTimer(key);
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      flush(key).catch(() => {}); // already reported through onError
    }, delay));
    return true;
  };

  const flush = async (key, { force = false } = {}) => {
    clearTimer(key);
    const running = inflight.get(key);
    if (running) await running.catch(() => {});

    const base = saved.get(key);
    let data = pending.get(key);
    if (data === undefined) {
      if (!force || !base) return null;
      data = JSON.parse(base.json);
    }
    const json = JSON.stringify(data);
    if (!force && base && base.json === json) {
      pending.delete(key);
      return null;
    }
    pending.delete(key);

    const gen = generation;
    active += 1;
    onStateChange('saving');
    const promise = Promise.resolve().then(() => save(key, data, base ? base.version : 1));
    inflight.set(key, promise);
    try {
      const entry = await promise;
      if (gen === generation) saved.set(key, { json, version: entry.version });
      active -= 1;
      if (gen === generation) onStateChange(active > 0 ? 'saving' : 'saved');
      return entry;
    } catch (err) {
      active -= 1;
      if (gen === generation) {
        // Keep the data so the next flush (or the next change) sends it again
        if (!pending.has(key)) pending.set(key, data);
        onStateChange('error');
        onError(key, err);
      }
      throw err;
    } finally {
      if (inflight.get(key) === promise) inflight.delete(key);
    }
  };

  const flushAll = async () => {
    const keys = new Set([...pending.keys(), ...inflight.keys()]);
    await Promise.allSettled([...keys].map(k => flush(k)));
  };

  const hasUnsaved = () => pending.size > 0 || inflight.size > 0;

  const reset = () => {
    generation += 1;
    timers.forEach(t => clearTimeout(t));
    timers.clear();
    pending.clear();
    saved.clear();
    inflight.clear();
    active = 0;
  };

  return { setBaseline, schedule, flush, flushAll, hasUnsaved, reset };
}
