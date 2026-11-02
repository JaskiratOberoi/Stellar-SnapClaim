import { gsap } from 'gsap';
import type { RefObject } from 'react';

export { gsap };

// Development only: lets a test or a screenshot run fast-forward every tween
// (window.__gsap.globalTimeline.timeScale(100)) when the tab is throttled.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as { __gsap?: typeof gsap }).__gsap = gsap;
}

/** Confident arrival: the same curve as Motion.ease in the theme. */
export const EASE = 'expo.out';

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** react-native-web hands the DOM node back through the ref. */
export function dom(ref: RefObject<unknown>): HTMLElement | null {
  const el = ref.current;
  return el instanceof HTMLElement ? el : null;
}
