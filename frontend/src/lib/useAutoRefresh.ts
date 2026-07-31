'use client';

import { useEffect, useRef } from 'react';
import { REFRESH_EVENT } from './socket';

// Polling fallback cadence. Realtime socket pushes handle the instant case; this
// interval just catches anything that didn't emit an event (and keeps data fresh
// on pages open in the background).
const DEFAULT_INTERVAL = 8_000;

/**
 * Keeps a page's data fresh automatically — the user never has to hit refresh.
 *
 * Given a stable `load` callback (typically a `useCallback` that fetches and sets
 * state) it will re-run `load`:
 *   • immediately, and again whenever `load` changes (e.g. a filter),
 *   • the instant a realtime `lg:refresh` event arrives (server pushed a change),
 *   • when the tab regains focus / becomes visible,
 *   • on a background interval while the tab is visible (fallback).
 *
 * Background refreshes swallow errors (a transient blip must not break the page)
 * and should update state in place WITHOUT toggling a full-page loader, so the
 * screen never flickers. Pass `intervalMs` to tune the cadence, or a falsy
 * `enabled` to pause.
 */
export function useAutoRefresh(
  load: () => void | Promise<unknown>,
  intervalMs: number = DEFAULT_INTERVAL,
  enabled: boolean = true,
) {
  const loadRef = useRef(load);
  loadRef.current = load;

  // Effect 1: run load() on mount and whenever it changes (initial load + filters).
  useEffect(() => {
    if (!enabled) return;
    Promise.resolve(loadRef.current()).catch(() => {});
  }, [load, enabled]);

  // Effect 2: interval + focus/visibility + realtime listeners. Deliberately does
  // NOT depend on `load` so the timer keeps a steady cadence and is never reset by
  // parent re-renders; it always calls the latest load via the ref.
  useEffect(() => {
    if (!enabled) return;
    const run = () => Promise.resolve(loadRef.current()).catch(() => {});

    const id = intervalMs > 0
      ? setInterval(() => { if (document.visibilityState === 'visible') run(); }, intervalMs)
      : undefined;

    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    const onRealtime = () => run();

    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(REFRESH_EVENT, onRealtime);

    return () => {
      if (id) clearInterval(id);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(REFRESH_EVENT, onRealtime);
    };
  }, [intervalMs, enabled]);
}
