import { useLayoutEffect, type RefObject } from 'react';

const applicationTitle = 'Heroínas y Héroes Paisanos';

// Scope navigation context to the route outlet, never the session/navigation header.
export function useRouteFocus(main: RefObject<HTMLElement | null>, pathname: string) {
  useLayoutEffect(() => {
    const region = main.current;
    if (!region) return;
    let previous: HTMLElement | null = null;
    let interrupted = false;
    let focusing = false;
    const onFocus = () => {
      if (!focusing) interrupted = true;
    };
    const update = () => {
      const content = region.querySelector('[data-route-content]') ?? region;
      const heading = content.querySelector<HTMLElement>('h1');
      const target = heading ?? content.querySelector<HTMLElement>('[role="alert"]');
      const context = target?.textContent || content.querySelector('output')?.textContent;
      document.title = context ? `${context.trim()} | ${applicationTitle}` : applicationTitle;
      if (!target || target === previous) return;
      previous = target;
      const active = document.activeElement;
      // A removed form/identity can leave focus on body; a live user-selected control wins.
      if (interrupted && active && active !== document.body && active.isConnected) return;
      target.tabIndex = -1;
      focusing = true;
      target.focus();
      focusing = false;
    };
    document.addEventListener('focusin', onFocus);
    const observer = new MutationObserver(update);
    observer.observe(region, { childList: true, subtree: true, characterData: true });
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', onFocus);
    };
  }, [main, pathname]);
}
