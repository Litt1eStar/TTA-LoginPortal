import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './useSwapTransition';

export const easeOutCubic = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// Value between `from` and `to` at progress t (0..1), rounded to an integer
export const countAt = (from, to, t) => Math.round(from + (to - from) * easeOutCubic(t));

/**
 * Animates a number from its previous value (0 on first mount) to `target`.
 * Reduced motion: returns `target` straight away.
 */
export function useCountUp(target, { duration = 900, delay = 0 } = {}) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      fromRef.current = target;
      setValue(target);
      return undefined;
    }
    const from = fromRef.current;
    if (from === target) return undefined;

    let raf;
    let start;
    const step = (now) => {
      if (start === undefined) start = now + delay;
      const t = (now - start) / duration;
      if (t < 0) {
        raf = requestAnimationFrame(step);
        return;
      }
      const v = countAt(from, target, t);
      fromRef.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);

  return value;
}

/**
 * Measures the child marked data-active="true" inside the returned ref, so a
 * pill can slide under it. Returns [ref, box | null].
 */
export function useSlidingIndicator(activeKey) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const active = el.querySelector('[data-active="true"]');
      if (!active) {
        setBox(null);
        return;
      }
      const next = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
      setBox(prev => (
        prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next
      ));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach(c => ro.observe(c));
    return () => ro.disconnect();
  }, [activeKey]);

  return [ref, box];
}

// Pointer position inside an element as CSS vars (--mx/--my in px, --px/--py in -1..1)
export const trackPointer = (e) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  el.style.setProperty('--mx', `${x}px`);
  el.style.setProperty('--my', `${y}px`);
  el.style.setProperty('--px', ((x / r.width) * 2 - 1).toFixed(3));
  el.style.setProperty('--py', ((y / r.height) * 2 - 1).toFixed(3));
};

export const resetPointer = (e) => {
  e.currentTarget.style.setProperty('--px', '0');
  e.currentTarget.style.setProperty('--py', '0');
};
