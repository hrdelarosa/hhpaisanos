import { useEffect, useLayoutEffect, useRef } from 'react';

// Capture intent before a preflight/write; a later intentional focus change takes priority.
export function useConfirmationFocus() {
  const pending = useRef<{ target: () => HTMLElement | null; interrupted: boolean } | null>(null);
  useEffect(() => {
    const onFocus = () => {
      if (pending.current) pending.current.interrupted = true;
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);
  useLayoutEffect(() => {
    const request = pending.current;
    const target = request?.target();
    if (!request || !target) return;
    pending.current = null;
    const active = document.activeElement;
    if (!request.interrupted || !active || active === document.body || !active.isConnected)
      target.focus();
  });
  return (target: () => HTMLElement | null) => {
    pending.current = { target, interrupted: false };
  };
}
