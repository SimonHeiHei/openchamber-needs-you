// Panel and page entry. One bundle, two surfaces: the host tells us which one
// we are in, and the same store feeds both readings (time / space).
import { connectHost } from '@openchamber/sdk';
import type { GuestProject } from '@openchamber/sdk';
import {
  applyHostReady,
  mountBanner,
  mountEmpty,
  mountSearchField,
} from '@openchamber/sdk/ui';

import * as dom from './dom';
import * as motion from './motion';
import { ControlRoomStore, type Group, type Row, type StateName, type View } from './store';
import { BASE_STYLE, PAGE_STYLE, PANEL_STYLE } from './style';
import { formatClock, metaFor, setLocale, t } from './strings';

const host = connectHost();
const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Missing #root');

const styleEl = document.createElement('style');
styleEl.textContent = BASE_STYLE;
document.head.append(styleEl);

const DEBUG = false;
const debug = (...args: unknown[]): void => {
  if (DEBUG) console.debug('[control-room]', ...args);
};

const isTouch = (): boolean =>
  document.documentElement.dataset.pointer === 'coarse' || window.matchMedia('(pointer: coarse)').matches;

const isBlocked = (state: StateName): boolean => state === 'permission' || state === 'question';

const openSession = (sessionId: string): void => {
  void host.openSession(sessionId).catch((error) => debug('openSession', error));
};

const copyText = async (text: string): Promise<void> => {
  try {
    await host.writeClipboard(text.slice(0, 32_000));
    void host.toast({ kind: 'success', message: t().action.copyDone }).catch(() => undefined);
  } catch (error) {
    debug('clipboard', error);
  }
};

const toggleCollapsed = (store: ControlRoomStore, projectId: string): void => {
  store.toggleProjectCollapsed(projectId);
};

// ----- shared time tick: wait labels and relative times, no re-layout -----

function startClock(onTick: () => void): void {
  let timer = 0;
  const tick = (): void => {
    if (document.hidden) return;
    onTick();
  };
  const arm = (): void => {
    window.clearInterval(timer);
    timer = window.setInterval(tick, 30_000);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      tick();
      arm();
    }
  });
  arm();
}

function refreshTimes(scope: HTMLElement, store: ControlRoomStore): void {
  const view = store.run();
  const byId = new Map(view.rows.map((row) => [row.id, row]));
  for (const node of scope.querySelectorAll<HTMLElement>('[data-id]')) {
    const row = node.dataset.id ? byId.get(node.dataset.id) : undefined;
    if (!row) continue;
    const blocked = isBlocked(row.state);
    const meta = node.querySelector<HTMLElement>('.cr-wait, .bmeta') ?? node.querySelector<HTMLElement>('.nc-wait');
    if (meta) {
      const text = metaFor(row.state, row.waitedMs, row.updatedAt, row.archivedAt);
      if (meta.textContent !== text) meta.textContent = text;
      if (blocked && meta.classList.contains('cr-wait')) meta.dataset.age = row.waitedMs >= 30 * 60_000 ? '1' : '0';
    }
  }
}

// ============================================================
// panel
// ============================================================

function mountPanel(): void {
  styleEl.textContent = BASE_STYLE + PANEL_STYLE;
  root!.className = 'panel-root';

  const strings = t();
  const live = dom.el('div', 'gone');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  const header = dom.el('div', 'phead');
  const title = dom.el('div', 'ptitle', strings.panel.title);
  const searchBtn = dom.el('button', 'iconbtn');
  searchBtn.type = 'button';
  searchBtn.setAttribute('aria-label', strings.panel.search.open);
  searchBtn.setAttribute('aria-expanded', 'false');
  searchBtn.append(dom.searchIcon(15));

  const summary = dom.el('div', 'psum');
  const bannerSlot = dom.el('div', 'banner-slot');
  bannerSlot.hidden = true;
  const searchRow = dom.el('div', 'searchrow');
  searchRow.hidden = true;
  const manageSlot = dom.el('div', 'unconnected');
  manageSlot.hidden = true;
  const queue = dom.el('div', 'pqueue');
  const emptySlot = dom.el('div', 'empty-slot');
  emptySlot.hidden = true;
  const foot = dom.el('div', 'pfoot');

  header.append(title, searchBtn);
  root!.append(header, summary, bannerSlot, searchRow, manageSlot, queue, emptySlot, foot, live);

  let query = '';
  const search = mountSearchField(searchRow, {
    value: '',
    placeholder: strings.panel.search.placeholder,
    label: strings.panel.search.open,
    onChange: (value) => {
      query = value;
      render();
    },
  });

  searchBtn.addEventListener('click', () => {
    const open = searchRow.hidden;
    searchRow.hidden = !open;
    searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      search.update({ placeholder: t().panel.search.placeholder, label: t().panel.search.open });
      searchRow.querySelector('input')?.focus();
    } else {
      query = '';
      search.update({ value: '' });
      render();
    }
  });

  searchRow.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    searchRow.hidden = true;
    searchBtn.setAttribute('aria-expanded', 'false');
    query = '';
    search.update({ value: '' });
    render();
  });

  const store = new ControlRoomStore(host, 'panel');
  const expanded = { waiting: false, failed: false, running: false };
  const rowCaches = new Map<string, Map<string, dom.RowKeyed>>();
  const cacheFor = (key: string): Map<string, dom.RowKeyed> => {
    const existing = rowCaches.get(key);
    if (existing) return existing;
    const created = new Map<string, dom.RowKeyed>();
    rowCaches.set(key, created);
    return created;
  };

  let emptyHandle: ReturnType<typeof mountEmpty> | null = null;
  let emptyKey = '';
  let bannerHandle: ReturnType<typeof mountBanner> | null = null;
  let menu: HTMLElement | null = null;
  let lastLive = 0;
  let manageOpen = false;

  const freshIds = new Set<string>();
  const onFresh = (_id: string, node: HTMLElement): void => {
    if (node.dataset.fresh === '1') return;
    node.dataset.fresh = '1';
    node.classList.add('cr-fresh');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => node.classList.remove('cr-fresh'), reduce ? 1200 : 600);
  };

  const closeMenu = (): void => {
    if (menu) {
      menu.remove();
      menu = null;
    }
  };

  const openMenuFor = (row: Row, anchor: HTMLElement): void => {
    closeMenu();
    const actions: dom.MenuAction[] = isTouch() ? ['open', 'copyTitle', 'copyPath'] : ['copyTitle', 'copyPath'];
    const pick = (action: dom.MenuAction): void => {
      closeMenu();
      if (action === 'open') openSession(row.id);
      else if (action === 'copyTitle') void copyText(row.title);
      else void copyText(row.projectDirectory);
    };
    if (isTouch()) {
      root!.setAttribute('aria-hidden', 'true');
      const sheet = dom.createSheet(row.title, pick, () => close());
      document.body.append(sheet.layer);
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') close();
      };
      const close = (): void => {
        sheet.layer.remove();
        root!.removeAttribute('aria-hidden');
        document.removeEventListener('keydown', onKey);
      };
      document.addEventListener('keydown', onKey);
      const first = sheet.layer.querySelector<HTMLElement>('.sact');
      first?.focus();
      let startY = 0;
      sheet.layer.addEventListener('touchstart', (event) => {
        startY = event.touches[0]?.clientY ?? 0;
      }, { passive: true });
      sheet.layer.addEventListener('touchend', (event) => {
        const endY = event.changedTouches[0]?.clientY ?? startY;
        if (endY - startY > 60) close();
      }, { passive: true });
      return;
    }
    const element = dom.createRowMenu(actions, pick);
    document.body.append(element);
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(156, element.offsetWidth);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    let top = rect.bottom + 4;
    if (top + element.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - element.offsetHeight - 4);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    menu = element;
    const close = (event: Event): void => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'click' && element.contains(event.target as Node)) return;
      closeMenu();
      document.removeEventListener('click', close, true);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
    };
    document.addEventListener('click', close, true);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
  };

  const rowById = new Map<string, Row>();

  queue.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const more = target.closest<HTMLElement>('.cr-more');
    if (more) {
      event.stopPropagation();
      const row = more.closest<HTMLElement>('.cr-row');
      const found = row?.dataset.id ? rowById.get(row.dataset.id) : undefined;
      if (found) openMenuFor(found, more);
      return;
    }
    const row = target.closest<HTMLElement>('.cr-row');
    if (row?.dataset.id) openSession(row.dataset.id);
  });

  queue.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.cr-more')) return;
    const row = target.closest<HTMLElement>('.cr-row');
    if (!row) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (row.dataset.id) openSession(row.dataset.id);
      return;
    }
    const rows = [...queue.querySelectorAll<HTMLElement>('.cr-row')];
    const index = rows.indexOf(row);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else return;
    event.preventDefault();
    rows[next]?.focus();
  });

  const sectionHead = (
    label: string,
    count: number,
    opts: { tone?: 'warn' | 'err'; ended?: boolean; open?: boolean; onToggle?: () => void } = {},
  ): HTMLElement => {
    const stringsNow = t();
    if (opts.ended) {
      const button = dom.el('button', 'sect ended');
      button.type = 'button';
      button.setAttribute('aria-expanded', opts.open ? 'true' : 'false');
      button.setAttribute('aria-label', stringsNow.aria.section(label, count));
      button.append(dom.el('span', '', `${label} `), dom.el('span', 'n', String(count)), dom.el('span', 'spacer'), dom.el('i', 'tri'));
      button.addEventListener('click', () => opts.onToggle?.());
      return button;
    }
    const node = dom.el('div', 'sect');
    if (opts.tone) node.dataset.tone = opts.tone;
    node.setAttribute('aria-label', stringsNow.aria.section(label, count));
    node.append(dom.el('span', '', `${label} `), dom.el('span', 'n', String(count)));
    return node;
  };

  const moreLink = (label: string, onClick: () => void): HTMLElement => {
    const button = dom.el('button', 'sect morelink');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  };

  const groupsById = new Map<string, Group>();

  const toggleGroup = (id: string): void => {
    const group = groupsById.get(id);
    if (!group) return;
    store.toggleGroupExpanded(group);
    render();
  };

  const rowElement = (row: Row, opts: dom.GroupRowOpts = {}): HTMLElement => {
    const key = `${row.id}|${opts.group ? 'g' : ''}${opts.child ? 'c' : ''}${opts.search ? 's' : ''}|${opts.expanded ? 1 : 0}`;
    let entry = cacheFor('rows').get(key);
    if (!entry) {
      entry = dom.createPanelRow(row, freshIds, onFresh, { ...opts, onToggle: toggleGroup });
      cacheFor('rows').set(key, entry);
    } else {
      entry.update(row);
    }
    return entry.element;
  };

  const renderGroups = (container: HTMLElement, groups: Group[]): void => {
    for (const group of groups) {
      const expanded = store.isGroupExpanded(group);
      const collapsible = group.children.length > 0 && group.blocked.length === 0;
      container.append(rowElement(group.head, { group: collapsible, expanded }));
      if (expanded && group.children.length > 0) {
        const rail = dom.el('div', 'cr-children');
        for (const child of group.children) rail.append(rowElement(child, { child: true }));
        container.append(rail);
      }
    }
  };

  const showEmpty = (
    key: string,
    titleText: string,
    body: string,
    action?: { label: string; onClick: () => void },
  ): void => {
    emptySlot.hidden = false;
    queue.hidden = true;
    if (emptyKey === key) return;
    emptyKey = key;
    emptyHandle?.dispose();
    emptySlot.textContent = '';
    emptyHandle = mountEmpty(emptySlot, { title: titleText, body, ...(action ? { action } : {}) });
  };

  const hideEmpty = (): void => {
    emptyKey = '';
    emptyHandle?.dispose();
    emptyHandle = null;
    emptySlot.textContent = '';
    emptySlot.hidden = true;
    queue.hidden = false;
  };

  const renderBanner = (view: View): void => {
    const stringsNow = t();
    const retry = { label: stringsNow.error.retry, onClick: () => void store.retry() };
    let props: { tone: 'warning' | 'error'; title: string; body?: string; action?: { label: string; onClick: () => void } } | null = null;
    if (view.fatal) props = null;
    else if (view.phase === 'error' && view.hasData) {
      props = { tone: 'error', title: stringsNow.error.allTitle, body: stringsNow.error.allBody, action: retry };
    } else if (view.errorProjects.length > 0) {
      props = {
        tone: 'warning',
        title: stringsNow.error.partialTitle(view.errorProjects.length),
        body: stringsNow.error.partialBody,
        action: retry,
      };
    } else if (view.unconnected.length > 0) {
      props = {
        tone: 'warning',
        title: stringsNow.overflow.title(view.unconnected.length),
        body: stringsNow.overflow.body,
        action: {
          label: stringsNow.overflow.manage,
          onClick: () => {
            manageOpen = !manageOpen;
            render();
          },
        },
      };
    }
    if (!props) {
      bannerSlot.hidden = true;
      return;
    }
    bannerSlot.hidden = false;
    if (!bannerHandle) bannerHandle = mountBanner(bannerSlot, props);
    else bannerHandle.update(props);
  };

  const renderManage = (view: View): void => {
    const stringsNow = t();
    manageSlot.textContent = '';
    if (!manageOpen || view.unconnected.length === 0) {
      manageSlot.hidden = true;
      return;
    }
    manageSlot.hidden = false;
    for (const project of view.unconnected) {
      const row = dom.el('div', 'orow');
      row.append(dom.el('b', '', project.name));
      const button = dom.el('button', '', stringsNow.overflow.connect);
      button.type = 'button';
      button.addEventListener('click', () => {
        if (!store.connect(project.id)) {
          void host.toast({ kind: 'info', message: stringsNow.overflow.blocked }).catch(() => undefined);
        } else {
          manageOpen = false;
          render();
        }
      });
      row.append(button);
      manageSlot.append(row);
    }
  };

  const searchHits = (view: View): Row[] => {
    const needle = query.trim().toLowerCase();
    return view.flatRows.filter((row) =>
      `${row.title} ${row.projectName} ${row.branch ?? ''}`.toLowerCase().includes(needle),
    );
  };

  const renderQueue = (view: View): void => {
    const stringsNow = t();
    queue.textContent = '';
    rowById.clear();
    for (const row of view.rows) rowById.set(row.id, row);
    groupsById.clear();
    for (const group of view.groups) groupsById.set(group.head.id, group);
    freshIds.clear();
    for (const id of view.fresh) freshIds.add(id);

    if (query.trim()) {
      const hits = searchHits(view);
      if (hits.length === 0) {
        queue.append(dom.el('div', 'emptylist', stringsNow.panel.search.empty));
        return;
      }
      const box = dom.el('div');
      for (const row of hits) box.append(rowElement(row, { search: true }));
      queue.append(box);
      return;
    }

    if (view.waiting.length === 0 && view.failed.length === 0) {
      const news = dom.el('div', 'goodnews');
      const ring = dom.el('span', 'okring');
      ring.append(dom.checkIcon(14));
      news.append(ring, dom.el('h4', '', stringsNow.panel.goodNews.title));
      news.append(
        dom.el('p', '', view.counts.inflight ? stringsNow.panel.goodNews.body(view.counts.inflight) : stringsNow.panel.goodNews.quiet),
      );
      if (view.ended.length > 0) {
        news.append(dom.el('div', 'endedline', stringsNow.panel.goodNews.ended(view.ended.length, formatClock(view.ended[0]!.updatedAt))));
      }
      queue.append(news);
    } else if (view.waiting.length === 0) {
      const nowait = dom.el('div', 'nowait');
      const tick = dom.el('span', 'tick');
      tick.append(dom.checkIcon(12));
      nowait.append(tick, dom.el('span', '', stringsNow.panel.clearWaiting));
      queue.append(nowait);
    }

    const sessionCount = (groups: Group[]): number =>
      groups.reduce((total, group) => total + group.members.length, 0);

    const waitingGroups = view.groups.filter((group) => isBlocked(group.state));
    if (waitingGroups.length > 0 || view.failed.length > 0) {
      const block = dom.el('div', 'waitblock');
      block.append(sectionHead(stringsNow.section.waiting, view.waiting.length, { tone: 'warn' }));
      const list = dom.el('div');
      const cap = expanded.waiting ? waitingGroups.length : 6;
      const shown = waitingGroups.slice(0, cap);
      renderGroups(list, shown);
      block.append(list);
      const hidden = sessionCount(waitingGroups.slice(cap));
      if (!expanded.waiting && hidden > 0) {
        block.append(
          moreLink(stringsNow.section.more(hidden), () => {
            expanded.waiting = true;
            render();
          }),
        );
      }
      queue.append(block);
    }

    const failedGroups = view.groups.filter((group) => group.state === 'failed');
    if (failedGroups.length > 0) {
      queue.append(sectionHead(stringsNow.section.failed, view.failed.length, { tone: 'err' }));
      const list = dom.el('div');
      const cap = expanded.failed ? failedGroups.length : 3;
      renderGroups(list, failedGroups.slice(0, cap));
      queue.append(list);
      const hidden = sessionCount(failedGroups.slice(cap));
      if (!expanded.failed && hidden > 0) {
        queue.append(
          moreLink(stringsNow.section.more(hidden), () => {
            expanded.failed = true;
            render();
          }),
        );
      }
    }

    const runningGroups = view.groups.filter((group) => group.state === 'running' || group.state === 'retrying');
    if (runningGroups.length > 0) {
      queue.append(sectionHead(stringsNow.section.running, view.running.length));
      const list = dom.el('div');
      const cap = expanded.running ? runningGroups.length : 5;
      renderGroups(list, runningGroups.slice(0, cap));
      queue.append(list);
      const hidden = sessionCount(runningGroups.slice(cap));
      if (!expanded.running && hidden > 0) {
        queue.append(
          moreLink(stringsNow.section.more(hidden), () => {
            expanded.running = true;
            render();
          }),
        );
      }
    }

    const endedOpen = store.getCollapsed().ended;
    const endedHead = sectionHead(stringsNow.section.ended, view.ended.length, {
      ended: true,
      open: endedOpen,
      onToggle: () => {
        store.setEndedCollapsed(!endedOpen);
        render();
      },
    });
    if (view.ended.length === 0) {
      const button = endedHead as HTMLButtonElement;
      button.disabled = true;
      button.style.cursor = 'default';
    }
    queue.append(endedHead);
    if (endedOpen && view.ended.length > 0) {
      const endedGroups = view.groups.filter((group) => group.state === 'done');
      const list = dom.el('div', 'endedbox');
      renderGroups(list, endedGroups.slice(0, 8));
      queue.append(list);
      const hidden = sessionCount(endedGroups.slice(8));
      if (hidden > 0) queue.append(dom.el('div', 'emptylist', stringsNow.section.more(hidden)));
    }
  };

  const renderFoot = (view: View): void => {
    const stringsNow = t();
    foot.textContent = '';
    const idle = view.counts.idle;
    if (idle > 0) {
      const first = dom.el('div', 'row2');
      first.append(dom.el('span', '', stringsNow.footer.idle(idle)));
      foot.append(first);
    }
    const second = dom.el('div', 'row2');
    second.append(dom.el('span', '', stringsNow.footer.totals(view.counts.projects, view.counts.sessions)));
    second.append(dom.el('span', 'grow'));
    if (view.hasData) {
      if (view.phase === 'error') second.append(dom.el('span', '', stringsNow.error.stale(formatClock(view.updatedAt))));
      else if (view.phase === 'loading')
        second.append(dom.el('span', '', `${stringsNow.footer.updated(formatClock(view.updatedAt))} · ${stringsNow.footer.updating}`));
      else second.append(dom.el('span', '', stringsNow.footer.updated(formatClock(view.updatedAt))));
    }
    foot.append(second);
  };

  const render = (): void => {
    const stringsNow = t();
    const view = store.run();
    title.textContent = stringsNow.panel.title;
    searchBtn.setAttribute('aria-label', stringsNow.panel.search.open);

    summary.textContent = '';
    if (view.phase === 'loading' && !view.hasData) {
      summary.append(dom.el('span', '', stringsNow.panel.summary.loading));
    } else if (query.trim()) {
      summary.append(dom.el('span', '', stringsNow.panel.search.results(query.trim(), searchHits(view).length)));
    } else {
      summary.append(dom.summaryParts(view));
    }

    renderBanner(view);
    renderManage(view);

    if (view.fatal) {
      const copy =
        view.fatal === 'NOT_GRANTED'
          ? [stringsNow.error.notGrantedTitle, stringsNow.error.notGrantedBody]
          : view.fatal === 'DISABLED'
            ? [stringsNow.error.disabledTitle, stringsNow.error.disabledBody]
            : [stringsNow.error.unavailableTitle, stringsNow.error.unavailableBody];
      showEmpty(
        `fatal:${view.fatal}`,
        copy[0]!,
        copy[1]!,
        view.fatal === 'NOT_GRANTED' ? undefined : { label: stringsNow.error.retry, onClick: () => void store.retry() },
      );
      foot.hidden = true;
      summary.hidden = true;
      return;
    }
    foot.hidden = false;
    summary.hidden = false;

    if (view.phase === 'error' && !view.hasData) {
      showEmpty('projects-error', stringsNow.error.allTitle, '', {
        label: stringsNow.error.retry,
        onClick: () => void store.retry(),
      });
      foot.hidden = true;
      return;
    }
    if (!view.hasData || (view.counts.sessions === 0 && !view.sessionsLoaded)) {
      hideEmpty();
      queue.textContent = '';
      queue.append(dom.skeletonRows(3));
      foot.hidden = true;
      return;
    }
    if (view.counts.projects === 0) {
      showEmpty('no-projects', stringsNow.empty.noProjectsTitle, stringsNow.empty.noProjectsBody);
      renderFoot(view);
      return;
    }
    if (view.counts.sessions === 0 && view.phase === 'ready' && view.sessionsLoaded) {
      showEmpty('no-sessions', stringsNow.empty.noSessionsTitle, stringsNow.empty.noSessionsBody);
      renderFoot(view);
      return;
    }

    hideEmpty();
    renderQueue(view);
    renderFoot(view);

    if (view.fresh.length > 0 && Date.now() - lastLive > 30_000) {
      const first = view.rows.find((row) => row.id === view.fresh[0]);
      if (first) {
        lastLive = Date.now();
        const state = stringsNow.state[first.state];
        live.textContent = '';
        window.setTimeout(() => {
          live.textContent = stringsNow.panel.live(first.title, state);
        }, 50);
      }
    }
  };

  currentRender = render;
  store.onChange(render);
  render();
  void store.start();

  startClock(() => refreshTimes(queue, store));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) store.run();
  });

  debug('panel mounted');
}

// ============================================================
// page
// ============================================================

type Filter = 'all' | 'needs' | 'running' | 'ended' | 'archived';

function mountPage(): void {
  styleEl.textContent = BASE_STYLE + PAGE_STYLE;
  root!.className = 'page-root';

  const page = root!;
  const strings = t();
  const live = dom.el('div', 'gone');
  live.setAttribute('aria-live', 'polite');

  const head = dom.el('div', 'pghead');
  const title = dom.el('div', 'pgtitle', strings.panel.title);
  const updated = dom.el('div', 'pgupd');
  head.append(title, updated);

  const tools = dom.el('div', 'pgtools');
  const tabsBar = dom.el('div', 'tabs');
  tabsBar.setAttribute('role', 'tablist');
  const tabButtons = new Map<Filter, HTMLButtonElement>();
  const tabCounts = new Map<Filter, HTMLElement>();
  const order: Filter[] = ['all', 'needs', 'running', 'ended', 'archived'];
  for (const id of order) {
    const button = dom.el('button', 'tab');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.dataset.filter = id;
    const label = dom.el('span', 'tab-label');
    const count = dom.el('span', 'n');
    button.append(label, count);
    tabsBar.append(button);
    tabButtons.set(id, button);
    tabCounts.set(id, count);
  }
  const indicator = dom.el('span', 'tab-ind');
  indicator.setAttribute('aria-hidden', 'true');
  tabsBar.append(indicator);
  const searchSlot = dom.el('div', 'searchslot');
  tools.append(tabsBar, searchSlot);

  const bannerSlot = dom.el('div', 'banner-slot');
  bannerSlot.hidden = true;

  const needs = dom.el('section', 'needs');
  needs.setAttribute('aria-label', t().board.filters.needs);
  needs.dataset.collapsed = 'false';
  const needsInner = dom.el('div', 'needs-inner');
  const railLine = dom.el('div', 'sectline');
  const railLabel = dom.el('span', '', t().board.filters.needs);
  const railCount = dom.el('span', 'n', '0');
  const railMeta = dom.el('span', 'sm');
  railLine.append(railLabel, railCount, railMeta);
  const rail = dom.el('div', 'railcards');
  needsInner.append(railLine, rail);
  needs.append(needsInner);

  const boardSection = dom.el('section', 'boardsec');
  const boardLine = dom.el('div', 'sectline');
  const boardLabel = dom.el('span', '', strings.board.heading);
  const boardMeta = dom.el('span', 'sm');
  boardLine.append(boardLabel, boardMeta);
  const board = dom.el('div', 'board');
  const boardFoot = dom.el('div', 'boardfoot');
  const othersWrap = dom.el('div', 'others');
  othersWrap.dataset.open = 'false';
  const othersInner = dom.el('div', 'others-inner');
  const extraBoard = dom.el('div', 'board board-extra');
  othersInner.append(extraBoard);
  othersWrap.append(othersInner);

  const unconnected = dom.el('div', 'unconnected');
  unconnected.hidden = true;
  const emptySlot = dom.el('div', 'empty-slot');
  emptySlot.hidden = true;

  const skel = dom.el('div', 'page-skel');
  skel.setAttribute('aria-hidden', 'true');
  const skHead = dom.el('div', 'skhead');
  skHead.append(dom.el('i', 'skbar'), dom.el('i', 'skbar'));
  const skRail = dom.el('div', 'skrail');
  for (let index = 0; index < 3; index += 1) skRail.append(dom.el('i'));
  const skGrid = dom.el('div', 'skgrid');
  for (let index = 0; index < 6; index += 1) skGrid.append(dom.el('i'));
  const skFoot = dom.el('div', 'skhead');
  skFoot.append(dom.el('i', 'skbar'));
  skel.append(skHead, skRail, skGrid, skFoot);

  boardSection.append(boardLine, board, boardFoot, othersWrap);
  page.append(head, tools, bannerSlot, needs, boardSection, unconnected, emptySlot, live, skel);

  const store = new ControlRoomStore(host, 'page');
  const saved = store.getBoard();
  let filter: Filter = (order as string[]).includes(saved.tab) ? (saved.tab as Filter) : 'all';
  let query = saved.query;
  let othersOpen = false;
  let unconnectedOpen = false;
  let phoneSeeded = false;
  const CARD_ROW_LIMIT = 6;
  const cardShowAll = new Set<string>();
  const pageGroups = new Map<string, Group>();

  const pendingFlip = { cards: false };
  let pendingIndicator = false;
  let bootIndex = false;
  let contentReady = false;

  const pageStates = new Map<string, StateName>();
  const lastCounts = new Map<string, number>();
  const prevBlockedChips = new Map<string, number>();
  const flightTimers: number[] = [];

  interface Migration {
    id: string;
    row: Row;
    direction: 'in' | 'out';
    from: DOMRect;
  }

  const prefersReduced = (): boolean => motion.reducedMotion();

  const findById = (selector: string, id: string): HTMLElement | null => {
    for (const element of page.querySelectorAll<HTMLElement>(selector)) {
      if (element.dataset.id === id) return element;
    }
    return null;
  };

  const clearFlights = (): void => {
    motion.removeFlyers();
    for (const timer of flightTimers) window.clearTimeout(timer);
    flightTimers.length = 0;
    for (const element of page.querySelectorAll<HTMLElement>('[data-cr-ghost]')) {
      element.style.opacity = '';
      delete element.dataset.crGhost;
    }
  };

  const toggleBoardGroup = (id: string): void => {
    const group = pageGroups.get(id);
    if (!group) return;
    store.toggleGroupExpanded(group);
    render();
  };

  const search = mountSearchField(searchSlot, {
    value: query,
    placeholder: strings.board.search,
    label: strings.board.search,
    onChange: (value) => {
      query = value;
      store.setBoard({ query });
      pendingFlip.cards = true;
      render();
    },
  });

  let emptyHandle: ReturnType<typeof mountEmpty> | null = null;
  let emptyKey = '';
  let bannerHandle: ReturnType<typeof mountBanner> | null = null;

  const showEmpty = (key: string, titleText: string, body: string, action?: { label: string; onClick: () => void }): void => {
    emptySlot.hidden = false;
    if (emptyKey === key) return;
    emptyKey = key;
    emptyHandle?.dispose();
    emptySlot.textContent = '';
    emptyHandle = mountEmpty(emptySlot, { title: titleText, body, ...(action ? { action } : {}) });
  };

  const hideEmpty = (): void => {
    emptyKey = '';
    emptyHandle?.dispose();
    emptyHandle = null;
    emptySlot.textContent = '';
    emptySlot.hidden = true;
  };

  const setSectionsVisible = (visible: boolean): void => {
    needs.hidden = !visible;
    boardSection.hidden = !visible;
    unconnected.hidden = !visible;
  };

  const renderBanner = (view: View): void => {
    const stringsNow = t();
    const retry = { label: stringsNow.error.retry, onClick: () => void store.retry() };
    let props: { tone: 'warning' | 'error'; title: string; body?: string; action?: { label: string; onClick: () => void } } | null = null;
    if (view.phase === 'error' && view.hasData) {
      props = { tone: 'error', title: stringsNow.error.allTitle, body: stringsNow.error.allBody, action: retry };
    } else if (view.errorProjects.length > 0) {
      props = {
        tone: 'warning',
        title: stringsNow.error.partialTitle(view.errorProjects.length),
        body: stringsNow.error.partialBody,
        action: retry,
      };
    }
    if (!props) {
      bannerSlot.hidden = true;
      return;
    }
    bannerSlot.hidden = false;
    if (!bannerHandle) bannerHandle = mountBanner(bannerSlot, props);
    else bannerHandle.update(props);
  };

  const matchesQuery = (row: Row): boolean => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return `${row.title} ${row.projectName} ${row.branch ?? ''}`.toLowerCase().includes(needle);
  };

  const rowsForTab = (view: View): Row[] => {
    const base = view.rows.filter((row) => (filter === 'archived' ? row.state === 'archived' : row.state !== 'archived'));
    const rows = base.filter(matchesQuery);
    if (filter === 'needs') return rows.filter((row) => isBlocked(row.state) || row.state === 'failed');
    if (filter === 'running') return rows.filter((row) => row.state === 'running' || row.state === 'retrying');
    if (filter === 'ended') return rows.filter((row) => row.state === 'done');
    return rows;
  };

  /** Blocked first (oldest wait on top), then failed, running, done, idle, archived. */
  const sortForBoard = (rows: Row[]): Row[] => {
    const groups = [
      rows.filter((row) => isBlocked(row.state)),
      rows.filter((row) => row.state === 'failed'),
      rows.filter((row) => row.state === 'retrying' || row.state === 'running'),
      rows.filter((row) => row.state === 'done'),
      rows.filter((row) => row.state === 'idle' || row.state === 'unknown'),
      rows.filter((row) => row.state === 'archived'),
    ];
    const byId = (a: Row, b: Row): number => a.id.localeCompare(b.id);
    groups[0] = [...groups[0]!].sort((a, b) => a.updatedAt - b.updatedAt || byId(a, b));
    for (let index = 1; index < groups.length; index += 1) {
      groups[index] = [...groups[index]!].sort((a, b) => b.updatedAt - a.updatedAt || byId(a, b));
    }
    return groups.flat();
  };

  const hideBoard = (): void => {
    board.textContent = '';
    extraBoard.textContent = '';
    boardFoot.hidden = true;
    boardMeta.textContent = '';
  };

  const countsFor = (view: View, projectId: string): { blocked: number; failed: number; running: number; done: number; archived: number } => {
    const counts = { blocked: 0, failed: 0, running: 0, done: 0, archived: 0 };
    for (const row of view.rows) {
      if (row.projectId !== projectId) continue;
      if (isBlocked(row.state)) counts.blocked += 1;
      else if (row.state === 'failed') counts.failed += 1;
      else if (row.state === 'running' || row.state === 'retrying') counts.running += 1;
      else if (row.state === 'done') counts.done += 1;
      else if (row.state === 'archived') counts.archived += 1;
    }
    return counts;
  };

  const renderCards = (view: View, rows: Row[]): void => {
    const stringsNow = t();
    const projects = store.allProjects();
    const byProject = new Map<string, Row[]>();
    for (const row of rows) {
      const list = byProject.get(row.projectId);
      if (list) list.push(row);
      else byProject.set(row.projectId, [row]);
    }

    const visible = projects.filter((project) => (byProject.get(project.id)?.length ?? 0) > 0);
    const score = (project: GuestProject): number => {
      const counts = countsFor(view, project.id);
      if (counts.blocked > 0) return 0;
      if (counts.failed > 0) return 1;
      if (counts.running > 0) return 2;
      return 3;
    };
    const latest = (project: GuestProject): number =>
      (byProject.get(project.id) ?? []).reduce((max, row) => Math.max(max, row.updatedAt), 0);
    visible.sort((a, b) => score(a) - score(b) || latest(b) - latest(a) || a.name.localeCompare(b.name));

    const primary = visible.slice(0, 16);
    const extra = visible.slice(16);
    const firstBlockedId = visible.find((project) => countsFor(view, project.id).blocked > 0)?.id;
    if (isTouch() && !phoneSeeded) {
      phoneSeeded = true;
      for (const project of visible) {
        if (project.id !== firstBlockedId && !store.getCollapsed().projects.includes(project.id)) {
          store.toggleProjectCollapsed(project.id);
        }
      }
    }

    pageGroups.clear();
    for (const group of view.groups) pageGroups.set(group.head.id, group);

    const tabMember = (row: Row): boolean => {
      if (filter === 'needs') return isBlocked(row.state) || row.state === 'failed';
      if (filter === 'running') return row.state === 'running' || row.state === 'retrying';
      if (filter === 'ended') return row.state === 'done';
      if (filter === 'archived') return row.state === 'archived';
      return row.state !== 'archived';
    };

    const buildItems = (project: GuestProject): { items: dom.BoardItem[]; total: number } => {
      const showAll = cardShowAll.has(project.id);
      if (filter === 'archived') {
        const archivedRows = sortForBoard(byProject.get(project.id) ?? []);
        const items = archivedRows.map((row) => ({ row, child: row.child } as dom.BoardItem));
        return { items: showAll ? items : items.slice(0, CARD_ROW_LIMIT), total: items.length };
      }
      const items: dom.BoardItem[] = [];
      let total = 0;
      for (const group of view.groups) {
        if (group.head.projectId !== project.id) continue;
        const headMatches = tabMember(group.head) && matchesQuery(group.head);
        const children = group.children.filter((row) => tabMember(row) && matchesQuery(row));
        if (!headMatches && children.length === 0) continue;
        const expanded = showAll || store.isGroupExpanded(group);
        items.push({
          row: group.head,
          child: false,
          group,
          expanded,
          collapsible: group.children.length > 0 && group.blocked.length === 0,
        });
        total += 1;
        if (expanded) {
          for (const child of children) {
            items.push({ row: child, child: true });
            total += 1;
          }
        } else {
          total += children.length;
        }
      }
      return { items: showAll ? items : items.slice(0, CARD_ROW_LIMIT), total };
    };

    const appendCard = (container: HTMLElement, project: GuestProject): void => {
      const built = buildItems(project);
      const showAll = cardShowAll.has(project.id);
      const counts = countsFor(view, project.id);
      container.append(
        dom.createProjectCard({
          project,
          items: built.items,
          counts: {
            ...counts,
            archived: filter === 'archived' ? 0 : counts.archived,
          },
          collapsed: store.getCollapsed().projects.includes(project.id),
          error: view.errorProjects.includes(project.name),
          hiddenRows: Math.max(0, built.total - built.items.length),
          showAll,
          onToggleGroup: toggleBoardGroup,
        }),
      );
    };

    board.textContent = '';
    extraBoard.textContent = '';
    for (const project of primary) appendCard(board, project);
    for (const project of extra) appendCard(extraBoard, project);

    // A "waiting" chip only pops when it is new (0 → >0), never on a number change.
    if (contentReady) {
      for (const project of projects) {
        const current = countsFor(view, project.id).blocked;
        const previous = prevBlockedChips.get(project.id) ?? current;
        if (previous === 0 && current > 0) {
          motion.popChip(page.querySelector<HTMLElement>(`[data-chip="${project.id}:blocked"]`));
        }
        prevBlockedChips.set(project.id, current);
      }
    } else {
      for (const project of projects) prevBlockedChips.set(project.id, countsFor(view, project.id).blocked);
    }

    const rest = projects.filter((project) => !primary.some((card) => card.id === project.id));
    const restSessions = rest.reduce(
      (total, project) => total + view.rows.filter((row) => row.projectId === project.id).length,
      0,
    );
    boardFoot.textContent = '';
    boardFoot.hidden = false;
    if (rest.length > 0) {
      const otherButton = dom.el('button', 'link');
      otherButton.type = 'button';
      otherButton.append(dom.el('span', '', stringsNow.board.otherProjects(rest.length, restSessions)), dom.el('i', 'tri'));
      otherButton.addEventListener('click', () => {
        othersOpen = !othersOpen;
        render();
      });
      boardFoot.append(otherButton);
    }
    boardFoot.append(dom.el('span', 'grow'));
    if (view.counts.archived > 0) {
      const archived = dom.el('button', 'link', stringsNow.board.archived(view.counts.archived));
      archived.type = 'button';
      archived.addEventListener('click', () => {
        filter = 'archived';
        store.setBoard({ tab: 'archived' });
        othersOpen = false;
        pendingFlip.cards = true;
        pendingIndicator = true;
        render();
      });
      boardFoot.append(archived);
    }
    othersWrap.dataset.open = othersOpen ? 'true' : 'false';
    boardFoot.hidden = false;
  };

  const renderRail = (view: View): void => {
    const stringsNow = t();
    const cards = [...view.waiting, ...view.failed].filter(matchesQuery);
    railLabel.textContent = stringsNow.board.filters.needs;
    railMeta.textContent = stringsNow.board.needsMeta(view.counts.blocked, view.counts.failed);
    rail.textContent = '';
    rail.classList.toggle('few', cards.length < 3);
    if (cards.length === 0) {
      rail.append(dom.el('div', 'calm', stringsNow.panel.clearWaiting));
      return;
    }
    cards.forEach((row, index) => {
      const card = dom.createNeedCard(row).element;
      if (bootIndex) card.style.setProperty('--i', String(index));
      rail.append(card);
    });
  };

  const renderUnconnected = (view: View): void => {
    const stringsNow = t();
    unconnected.textContent = '';
    if (view.unconnected.length === 0) {
      unconnected.hidden = true;
      return;
    }
    unconnected.hidden = false;
    const button = dom.el('button', 'link');
    button.type = 'button';
    button.style.fontSize = '11px';
    button.style.color = 'var(--oc-muted)';
    button.textContent = `${stringsNow.overflow.unconnected(view.unconnected.length)} ${stringsNow.overflow.manage}`;
    button.addEventListener('click', () => {
      unconnectedOpen = !unconnectedOpen;
      render();
    });
    unconnected.append(button);
    if (!unconnectedOpen) return;
    for (const project of view.unconnected) {
      const row = dom.el('div', 'orow');
      row.append(dom.el('b', '', project.name));
      const connect = dom.el('button', '', stringsNow.overflow.connect);
      connect.type = 'button';
      connect.addEventListener('click', () => {
        if (!store.connect(project.id)) {
          void host.toast({ kind: 'info', message: stringsNow.overflow.blocked }).catch(() => undefined);
        } else {
          render();
        }
      });
      row.append(connect);
      unconnected.append(row);
    }
  };

  const indicatorPosition = { x: 0, w: 0 };

  const updateIndicator = (animate: boolean): void => {
    const active = tabsBar.querySelector<HTMLElement>('.tab[aria-selected="true"]');
    if (!active) return;
    const x = active.offsetLeft;
    const w = active.offsetWidth;
    const transform = `translateX(${x}px) scaleX(${w})`;
    indicator.style.transform = transform;
    if (!animate || prefersReduced() || indicatorPosition.w === 0) {
      indicatorPosition.x = x;
      indicatorPosition.w = w;
      return;
    }
    indicator.animate(
      [
        { transform: `translateX(${indicatorPosition.x}px) scaleX(${indicatorPosition.w})` },
        { transform },
      ],
      { duration: 240, easing: motion.EASE },
    );
    indicatorPosition.x = x;
    indicatorPosition.w = w;
  };

  const updateTabs = (view: View, animateCounts: boolean): void => {
    const stringsNow = t();
    const counts: Record<Filter, number> = {
      all: view.rows.filter((row) => row.state !== 'archived').length,
      needs: view.counts.blocked + view.counts.failed,
      running: view.counts.inflight,
      ended: view.counts.ended,
      archived: view.counts.archived,
    };
    for (const id of order) {
      const button = tabButtons.get(id);
      const count = tabCounts.get(id);
      if (!button || !count) continue;
      button.setAttribute('aria-selected', id === filter ? 'true' : 'false');
      const label = button.querySelector<HTMLElement>('.tab-label');
      if (label) label.textContent = stringsNow.board.filters[id];
      const next = counts[id];
      const previous = lastCounts.get(id);
      if (animateCounts && previous !== undefined && previous !== next) motion.countTo(count, next, previous);
      else count.textContent = String(next);
      lastCounts.set(id, next);
    }
    const needsNext = counts.needs;
    const needsPrevious = lastCounts.get('needsSection');
    if (animateCounts && needsPrevious !== undefined && needsPrevious !== needsNext) motion.countTo(railCount, needsNext, needsPrevious);
    else railCount.textContent = String(needsNext);
    lastCounts.set('needsSection', needsNext);
  };

  const renderMigrations = (list: Migration[]): void => {
    list.forEach((migration, index) => {
      const timer = window.setTimeout(() => {
        if (migration.direction === 'in') {
          const card = findById('.ncard', migration.id);
          if (!card) return;
          if (prefersReduced()) {
            motion.fadeIn(card, 220);
            motion.pulse(card, true);
            return;
          }
          const to = card.getBoundingClientRect();
          card.dataset.crGhost = '1';
          card.style.opacity = '0';
          const flyer = motion.makeFlyer(migration.row.title, migration.row.projectName, migration.from);
          motion.flyTo(flyer, migration.from, to, 500, -10);
          window.setTimeout(() => {
            card.style.opacity = '';
            delete card.dataset.crGhost;
            card.animate(
              [
                { opacity: 0, transform: 'translateY(8px) scale(.98)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' },
              ],
              { duration: 300, easing: motion.EASE },
            );
            motion.pulse(card, false);
          }, 240);
          return;
        }
        const rowElement = findById('.brow', migration.id);
        if (!rowElement) return;
        if (prefersReduced()) {
          motion.fadeIn(rowElement, 180);
          motion.land(rowElement, true);
          return;
        }
        const to = rowElement.getBoundingClientRect();
        rowElement.dataset.crGhost = '1';
        rowElement.style.opacity = '0';
        const flyer = motion.makeFlyer(migration.row.title, migration.row.projectName, migration.from);
        motion.flyTo(flyer, migration.from, to, 400, 6);
        window.setTimeout(() => {
          rowElement.style.opacity = '';
          delete rowElement.dataset.crGhost;
          rowElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: motion.EASE });
          motion.land(rowElement, false);
        }, 260);
      }, index * 40);
      flightTimers.push(timer);
    });
  };

  const render = (): void => {
    const stringsNow = t();
    const view = store.run();
    if (contentReady) page.classList.remove('boot');
    const previousStates = new Map(pageStates);
    pageStates.clear();
    for (const row of view.rows) pageStates.set(row.id, row.state);
    clearFlights();
    title.textContent = stringsNow.panel.title;
    boardLabel.textContent = stringsNow.board.heading;
    search.update({ placeholder: stringsNow.board.search, label: stringsNow.board.search });
    needs.setAttribute('aria-label', stringsNow.board.filters.needs);

    if (view.phase === 'loading' && !view.hasData) updated.textContent = stringsNow.board.updating;
    else if (view.hasData) {
      updated.textContent = view.phase === 'loading' ? stringsNow.board.updating : stringsNow.board.updated(formatClock(view.updatedAt));
    } else updated.textContent = '';

    renderBanner(view);

    const loading = !view.hasData || (view.counts.sessions === 0 && !view.sessionsLoaded && view.phase !== 'error');
    page.classList.toggle('is-loading', loading && !view.fatal);
    if (loading && !view.fatal) {
      page.setAttribute('aria-busy', 'true');
      updateTabs(view, false);
      return;
    }
    page.classList.remove('is-loading');
    page.removeAttribute('aria-busy');

    const fatalCopy = view.fatal
      ? view.fatal === 'NOT_GRANTED'
        ? [stringsNow.error.notGrantedTitle, stringsNow.error.notGrantedBody]
        : view.fatal === 'DISABLED'
          ? [stringsNow.error.disabledTitle, stringsNow.error.disabledBody]
          : [stringsNow.error.unavailableTitle, stringsNow.error.unavailableBody]
      : null;

    if (fatalCopy) {
      hideBoard();
      setSectionsVisible(false);
      showEmpty(`fatal:${view.fatal}`, fatalCopy[0]!, fatalCopy[1]!);
      updateTabs(view, false);
      return;
    }
    if (view.phase === 'error' && !view.hasData) {
      hideBoard();
      setSectionsVisible(false);
      showEmpty('projects-error', stringsNow.error.allTitle, '', {
        label: stringsNow.error.retry,
        onClick: () => void store.retry(),
      });
      updateTabs(view, false);
      return;
    }
    if (view.counts.projects === 0) {
      hideBoard();
      setSectionsVisible(false);
      showEmpty('no-projects', stringsNow.empty.noProjectsTitle, stringsNow.empty.noProjectsBody);
      updateTabs(view, false);
      return;
    }
    if (view.counts.sessions === 0 && view.phase === 'ready' && view.sessionsLoaded) {
      hideBoard();
      setSectionsVisible(false);
      showEmpty('no-sessions', stringsNow.empty.noSessionsTitle, stringsNow.empty.noSessionsBody);
      updateTabs(view, false);
      return;
    }

    const rows = rowsForTab(view);
    if (rows.length === 0) {
      hideBoard();
      setSectionsVisible(false);
      showEmpty(
        'no-match',
        stringsNow.board.noMatch,
        filter === 'archived' ? stringsNow.board.hideArchived : '',
        {
          label: stringsNow.board.clearFilter,
          onClick: () => {
            query = '';
            filter = 'all';
            search.update({ value: '' });
            store.setBoard({ tab: 'all', query: '' });
            pendingFlip.cards = true;
            pendingIndicator = true;
            render();
          },
        },
      );
      updateTabs(view, false);
      return;
    }

    hideEmpty();
    setSectionsVisible(true);
    renderUnconnected(view);

    // Capture the old geometry before the DOM changes.
    const cardsBefore = pendingFlip.cards ? motion.snap(board, '.pcard', 'data-project-id') : null;
    const railBefore = pendingFlip.cards ? motion.snap(rail, '.ncard', 'data-id') : null;
    const migrations: Migration[] = [];
    if (previousStates.size > 0) {
      for (const row of view.rows) {
        const previous = previousStates.get(row.id);
        if (!previous) continue;
        const wasRunning = previous === 'running' || previous === 'retrying';
        const nowBlocked = row.state === 'permission' || row.state === 'question';
        const wasBlocked = previous === 'permission' || previous === 'question';
        const nowRunning = row.state === 'running' || row.state === 'retrying';
        if (wasRunning && nowBlocked) {
          const source = findById('.brow', row.id);
          if (source) migrations.push({ id: row.id, row, direction: 'in', from: source.getBoundingClientRect() });
        } else if (wasBlocked && nowRunning) {
          const source = findById('.ncard', row.id);
          if (source) migrations.push({ id: row.id, row, direction: 'out', from: source.getBoundingClientRect() });
        }
      }
    }

    const firstContent = !contentReady;
    if (firstContent) {
      bootIndex = true;
      page.classList.add('boot');
      window.setTimeout(() => page.classList.remove('boot'), 900);
    }

    needs.dataset.collapsed = filter === 'ended' || filter === 'archived' ? 'true' : 'false';
    renderRail(view);
    boardMeta.textContent = stringsNow.board.meta(view.counts.sessions - view.counts.archived, view.counts.projects);
    renderCards(view, rows);

    // Hide the landing target before the browser paints: the flight owns the reveal.
    for (const migration of migrations) {
      const target = migration.direction === 'in' ? findById('.ncard', migration.id) : findById('.brow', migration.id);
      if (!target) continue;
      target.dataset.crGhost = '1';
      target.style.opacity = '0';
    }

    updateTabs(view, !firstContent);
    updateIndicator(pendingIndicator);
    bootIndex = false;
    contentReady = true;

    if (pendingFlip.cards && cardsBefore && railBefore) {
      requestAnimationFrame(() => {
        motion.flip(board, '.pcard', 'data-project-id', cardsBefore, 340);
        motion.flip(rail, '.ncard', 'data-id', railBefore, 300);
      });
    }
    pendingFlip.cards = false;
    pendingIndicator = false;

    if (migrations.length > 0) requestAnimationFrame(() => renderMigrations(migrations));

    if (view.fresh.length > 0) {
      live.textContent = '';
    }
  };

  currentRender = render;
  store.onChange(render);
  render();
  void store.start();

  startClock(() => refreshTimes(root!, store));

  const paused = (): void => {
    page.classList.toggle('is-paused', document.hidden);
  };
  document.addEventListener('visibilitychange', paused);
  paused();
  window.addEventListener('resize', () => updateIndicator(false));

  tabsBar.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-filter]');
    if (!target) return;
    const next = target.dataset.filter as Filter;
    if (next === filter) return;
    filter = next;
    store.setBoard({ tab: filter });
    pendingFlip.cards = true;
    pendingIndicator = true;
    render();
  });

  tabsBar.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = order.indexOf(filter);
    let next = index;
    if (event.key === 'ArrowLeft') next = (index - 1 + order.length) % order.length;
    else if (event.key === 'ArrowRight') next = (index + 1) % order.length;
    else if (event.key === 'Home') next = 0;
    else next = order.length - 1;
    filter = order[next]!;
    store.setBoard({ tab: filter });
    pendingFlip.cards = true;
    pendingIndicator = true;
    render();
    tabButtons.get(filter)?.focus();
  });

  board.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('.b-twist')) return;
    const cardMore = target.closest<HTMLElement>('[data-card-more]');
    if (cardMore?.dataset.cardMore) {
      const id = cardMore.dataset.cardMore;
      if (cardShowAll.has(id)) cardShowAll.delete(id);
      else cardShowAll.add(id);
      render();
      return;
    }
    const cardHead = target.closest<HTMLElement>('[data-card]');
    if (cardHead?.dataset.card) {
      const id = cardHead.dataset.card;
      toggleCollapsed(store, id);
      const card = cardHead.closest<HTMLElement>('.pcard');
      const body = card?.querySelector<HTMLElement>('.pcardbody');
      const collapsed = store.getCollapsed().projects.includes(id);
      cardHead.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (body) body.dataset.collapsed = collapsed ? 'true' : 'false';
      if (card) card.dataset.collapsed = collapsed ? 'true' : 'false';
      return;
    }
    const archivedLink = target.closest<HTMLElement>('[data-archived-link]');
    if (archivedLink) {
      filter = 'archived';
      store.setBoard({ tab: 'archived' });
      pendingFlip.cards = true;
      pendingIndicator = true;
      render();
      return;
    }
    const retry = target.closest<HTMLElement>('[data-retry]');
    if (retry) {
      void store.retry();
      return;
    }
    const row = target.closest<HTMLElement>('.brow');
    if (row?.dataset.id) openSession(row.dataset.id);
  });

  board.addEventListener('keydown', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.brow');
    if (!row) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (row.dataset.id) openSession(row.dataset.id);
    }
  });

  rail.addEventListener('click', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('.ncard');
    if (card?.dataset.id) openSession(card.dataset.id);
  });

  rail.addEventListener('keydown', (event) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>('.ncard');
    if (!card) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (card.dataset.id) openSession(card.dataset.id);
    }
  });

  debug('page mounted');
}

// ----- ready: theme, locale, surface -----

let currentRender: (() => void) | null = null;
let mountedSurface: 'panel' | 'page' | null = null;

host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement);
  setLocale(ctx.locale);
  const device = ctx.device;
  if (device) {
    document.documentElement.style.setProperty('--safe-bottom', `${Math.max(0, device.insets.bottom)}px`);
    document.documentElement.dataset.pointer = device.pointer;
    document.documentElement.dataset.form = device.formFactor;
    document.documentElement.dataset.keyboard = String(Math.max(0, device.keyboard));
  }
  const surface: 'panel' | 'page' = ctx.surface === 'page' ? 'page' : 'panel';
  if (mountedSurface) {
    // Theme and locale refresh on every ready; the UI itself mounts once.
    if (surface === mountedSurface) currentRender?.();
    return;
  }
  mountedSurface = surface;
  if (surface === 'page') mountPage();
  else mountPanel();
});
