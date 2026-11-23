// Board motion v2: one decelerating curve, four durations, no library.
// Only transform / opacity / grid-template-rows move; height, top and left never do.
export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const D = { feedback: 120, state: 200, layout: 320, authored: 520 } as const;

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type RectMap = Map<string, DOMRect>;

const keyOf = (element: Element, attribute: string): string | null =>
  element.getAttribute(attribute);

/** Snapshot rects before a render, keyed by a stable data attribute. */
export function snap(scope: ParentNode, selector: string, attribute: string): RectMap {
  const map: RectMap = new Map();
  for (const element of scope.querySelectorAll(selector)) {
    const key = keyOf(element, attribute);
    if (key) map.set(key, element.getBoundingClientRect());
  }
  return map;
}

/** Flip survivors from their old rect to the new one. New elements do not participate. */
export function flip(
  scope: ParentNode,
  selector: string,
  attribute: string,
  before: RectMap,
  duration: number,
): void {
  if (reducedMotion()) return;
  for (const element of scope.querySelectorAll<HTMLElement>(selector)) {
    const key = keyOf(element, attribute);
    if (!key) continue;
    const previous = before.get(key);
    if (!previous) continue;
    const next = element.getBoundingClientRect();
    const dx = previous.left - next.left;
    const dy = previous.top - next.top;
    if (!dx && !dy) continue;
    element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration, easing: EASE },
    );
  }
}

/** The lifted clone: fixed, aria-hidden, removed when the flight ends. */
export function makeFlyer(title: string, project: string, from: DOMRect): HTMLElement {
  const element = document.createElement('div');
  element.className = 'flyer float';
  element.setAttribute('aria-hidden', 'true');
  element.dataset.crFlyer = '1';
  element.style.left = `${from.left}px`;
  element.style.top = `${from.top}px`;
  element.style.width = `${Math.min(Math.max(from.width, 180), 300)}px`;
  const dot = document.createElement('span');
  dot.className = 'fdot';
  const text = document.createElement('span');
  text.className = 'ft';
  text.textContent = title;
  const proj = document.createElement('span');
  proj.className = 'fproj';
  proj.textContent = project;
  element.append(dot, text, proj);
  document.body.append(element);
  return element;
}

export function flyTo(
  element: HTMLElement,
  from: DOMRect,
  to: DOMRect,
  duration: number,
  arc: number,
): void {
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const animation = element.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      {
        transform: `translate(${dx * 0.6}px, ${dy * 0.6 + arc}px) scale(.985)`,
        opacity: 0.96,
        offset: 0.55,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(.9)`, opacity: 0 },
    ],
    { duration, easing: EASE },
  );
  const remove = (): void => element.remove();
  animation.finished.then(remove, remove);
  window.setTimeout(remove, duration + 120);
}

/** Landing bloom: one ring, then gone. Soft is the reverse-direction fade only. */
export function pulse(element: HTMLElement, soft: boolean): void {
  const halo = element.querySelector<HTMLElement>('.halo');
  if (!halo) return;
  halo.classList.remove('run', 'soft');
  void halo.offsetWidth;
  if (soft) halo.classList.add('soft');
  halo.classList.add('run');
  window.setTimeout(() => halo.classList.remove('run', 'soft'), 1000);
}

const countTokens = new WeakMap<HTMLElement, number>();

/** One text node, tabular figures, cubic ease-out; a new call cancels the old one. */
export function countTo(element: HTMLElement | null, to: number, from?: number): void {
  if (!element) return;
  const start = (from ?? Number(element.textContent ?? 0)) || 0;
  if (reducedMotion() || start === to) {
    countTokens.set(element, (countTokens.get(element) ?? 0) + 1);
    element.textContent = String(to);
    return;
  }
  const token = (countTokens.get(element) ?? 0) + 1;
  countTokens.set(element, token);
  const t0 = performance.now();
  const duration = 320;
  const step = (time: number): void => {
    if (countTokens.get(element) !== token) return;
    const progress = Math.min(1, (time - t0) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(start + (to - start) * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function popChip(chip: HTMLElement | null): void {
  if (!chip || reducedMotion()) return;
  chip.classList.remove('pop');
  void chip.offsetWidth;
  chip.classList.add('pop');
  window.setTimeout(() => chip.classList.remove('pop'), 300);
}

export function land(element: HTMLElement | null, soft: boolean): void {
  if (!element) return;
  element.classList.remove('land');
  void element.offsetWidth;
  if (soft) element.classList.add('land-soft');
  element.classList.add('land');
  window.setTimeout(() => element.classList.remove('land', 'land-soft'), 560);
}

export function fadeIn(element: HTMLElement, duration: number): void {
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE });
}

export function removeFlyers(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-cr-flyer]')) element.remove();
}
