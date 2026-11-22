// The Work Status section: one 76px strip, its own iframe, its own
// subscriptions (same store code as the panel).
import { connectHost } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';

import { createStrip } from '../../panel/src/dom';
import { ControlRoomStore } from '../../panel/src/store';
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

const store = new ControlRoomStore(host, 'status');
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
  strip.update(store.run());
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
  if (!document.hidden) store.run();
});
