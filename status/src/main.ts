// The Work Status section: one 76px strip, its own iframe, its own
// subscriptions (same store code as the panel).
import { connectHost } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';

import { createStrip } from '../../panel/src/dom';
import { ControlRoomStore, type View } from '../../panel/src/store';
import { BASE_STYLE, STATUS_STYLE } from '../../panel/src/style';
import { setLocale, t } from '../../panel/src/strings';

const PANEL_SURFACE_ID = 'plugin:needs-you';

const host = connectHost();
const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Missing #root');

const styleEl = document.createElement('style');
styleEl.textContent = BASE_STYLE + STATUS_STYLE;
document.head.append(styleEl);
root.className = 'status-root';

// The badge belongs to this surface. The store still contains its older
// seen-based badge bookkeeping, so hide setBadge from it and own the call here:
// the rail shows how many sessions are waiting on you, total.
const storeHost = new Proxy(host, {
  get(target, property, receiver) {
    if (property === 'setBadge') return async () => undefined;
    const value = Reflect.get(target, property, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

const store = new ControlRoomStore(storeHost, 'status');
let lastBadge: number | null | undefined;

const syncBadge = (view: View): void => {
  if (view.fatal || view.phase !== 'ready' || !view.hasData) return;
  const next = view.counts.blocked > 0 ? Math.min(view.counts.blocked, 999) : null;
  if (next === lastBadge) return;
  lastBadge = next;
  void host.setBadge(next).catch(() => undefined);
};

const strip = createStrip(
  () => {
    void host.openSurface(PANEL_SURFACE_ID).catch(() => undefined);
  },
  () => {
    void store.retry();
  },
);
root.append(strip.element);

const render = (): void => {
  document.title = t().panel.title;
  const view = store.run();
  strip.update(view);
  syncBadge(view);
};

store.onChange(render);
render();

let started = false;
host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement);
  setLocale(ctx.locale);
  if (ctx.device) {
    document.documentElement.style.setProperty('--safe-bottom', `${Math.max(0, ctx.device.insets.bottom)}px`);
  }
  render();
  if (started) return;
  started = true;
  void store.start();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncBadge(store.run());
});
