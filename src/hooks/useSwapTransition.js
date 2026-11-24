import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function computeDirection(prevOrder, nextOrder) {
  if (typeof prevOrder !== 'number' || typeof nextOrder !== 'number') return 1;
  if (nextOrder > prevOrder) return 1;
  if (nextOrder < prevOrder) return -1;
  return 1;
}

/**
 * Coordinates a directional Transition Out -> Transition In swap whenever `keyOf(target)` changes.
 * Updates with the same key flow through immediately on the current render (0ms lag).
 */
export function useSwapTransition(target, { keyOf = (v) => v, orderOf = () => 0, outMs = 115, onSwap } = {}) {
  const targetKey = keyOf(target);
  const targetOrder = orderOf(target);

  const [state, setState] = useState(() => ({
    displayed: target,
    key: targetKey,
    order: targetOrder,
    phase: 'idle', // 'idle' | 'out' | 'in'
    dir: 1
  }));

  const latestRef = useRef({ target, targetKey, targetOrder, onSwap });
  latestRef.current = { target, targetKey, targetOrder, onSwap };

  // Keep `displayed` fresh in state when the key hasn't changed, without triggering an animation
  const sameKey = targetKey === state.key;
  const displayed = sameKey ? target : state.displayed;

  useEffect(() => {
    if (targetKey === state.key) return undefined;

    const nextDir = computeDirection(state.order, targetOrder);

    if (prefersReducedMotion() || outMs <= 0) {
      const cur = latestRef.current;
      setState({
        displayed: cur.target,
        key: cur.targetKey,
        order: cur.targetOrder,
        phase: 'idle',
        dir: nextDir
      });
      cur.onSwap?.(cur.target);
      return undefined;
    }

    setState(prev => (
      prev.phase === 'out' && prev.dir === nextDir
        ? prev
        : { ...prev, phase: 'out', dir: nextDir }
    ));

    const timer = setTimeout(() => {
      const cur = latestRef.current;
      setState(prev => ({
        displayed: cur.target,
        key: cur.targetKey,
        order: cur.targetOrder,
        phase: 'in',
        dir: computeDirection(prev.order, cur.targetOrder)
      }));
      cur.onSwap?.(cur.target);
    }, outMs);

    return () => clearTimeout(timer);
  }, [targetKey, targetOrder, state.key, state.order, outMs]);

  const className = state.phase === 'out'
    ? 'swap-stage swap-out'
    : state.phase === 'in'
      ? 'swap-stage swap-in'
      : 'swap-stage';

  return {
    displayed,
    displayedKey: sameKey ? targetKey : state.key,
    phase: state.phase,
    dir: state.dir,
    className,
    style: {
      '--swap-dir': state.dir,
      '--swap-out-ms': `${outMs}ms`
    }
  };
}
