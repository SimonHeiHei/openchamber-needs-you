// Panel and page entry. One bundle, two surfaces: the host tells us which one
// we are in, and the same store feeds both readings (time / space).
import { connectHost } from '@openchamber/sdk';
import type { GuestProject } from '@openchamber/sdk';
import {
  applyHostReady,
  mountBanner,
  mountEmpty,
  mountSearchField,
  mountTabs,
} from '@openchamber/sdk/ui';

import * as dom from './dom';
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

  const strings = t();
  const live = dom.el('div', 'gone');
  live.setAttribute('aria-live', 'polite');

  const head = dom.el('div', 'pghead');
  const title = dom.el('div', 'pgtitle', strings.panel.title);
  const updated = dom.el('div', 'pgupd');
  head.append(title, updated);

  const summary = dom.el('div', 'pgsum');
  const tools = dom.el('div', 'pgtools');
  const tabsSlot = dom.el('div');
  const searchSlot = dom.el('div', 'searchslot');
  tools.append(tabsSlot, searchSlot);

  const bannerSlot = dom.el('div', 'banner-slot');
  bannerSlot.hidden = true;
  const railHead = dom.el('div', 'boardhead');
  const railTitle = dom.el('h3');
  const railMeta = dom.el('span', 'meta');
  railHead.append(railTitle, railMeta);
  const rail = dom.el('div', 'railcards');

  const boardHead = dom.el('div', 'boardhead');
  const boardTitle = dom.el('h3', '', strings.board.heading);
  const boardMeta = dom.el('span', 'meta');
  boardHead.append(boardTitle, boardMeta);
  const board = dom.el('div', 'board');
  const boardFoot = dom.el('div', 'boardfoot');
  const unconnected = dom.el('div', 'unconnected');
  unconnected.hidden = true;
  const emptySlot = dom.el('div', 'empty-slot');
  emptySlot.hidden = true;

  root!.append(head, summary, tools, bannerSlot, railHead, rail, boardHead, board, boardFoot, unconnected, emptySlot, live);

  const store = new ControlRoomStore(host, 'page');
  const saved = store.getBoard();
  let filter: Filter = (['all', 'needs', 'running', 'ended', 'archived'] as Filter[]).includes(saved.tab as Filter)
    ? (saved.tab as Filter)
    : 'all';
  let query = saved.query;
  let othersOpen = false;
  let unconnectedOpen = false;
  let phoneSeeded = false;
  const CARD_ROW_LIMIT = 6;
  const cardShowAll = new Set<string>();
  const pageGroups = new Map<string, Group>();

  const toggleBoardGroup = (id: string): void => {
    const group = pageGroups.get(id);
    if (!group) return;
    store.toggleGroupExpanded(group);
    render();
  };

  const tabs = mountTabs(tabsSlot, {
    items: [],
    activeId: filter,
    trackBackground: true,
    onChange: (id) => {
      filter = id as Filter;
      store.setBoard({ tab: filter });
      render();
    },
  });

  const search = mountSearchField(searchSlot, {
    value: query,
    placeholder: strings.board.search,
    label: strings.board.search,
    onChange: (value) => {
      query = value;
      store.setBoard({ query });
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
    boardFoot.hidden = true;
    rail.hidden = true;
    railHead.hidden = true;
    boardMeta.textContent = '';
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

    const countsFor = (projectId: string): { blocked: number; failed: number; running: number; done: number; archived: number } => {
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

    const visible = projects.filter((project) => (byProject.get(project.id)?.length ?? 0) > 0);
    const score = (project: GuestProject): number => {
      const counts = countsFor(project.id);
      if (counts.blocked > 0) return 0;
      if (counts.failed > 0) return 1;
      if (counts.running > 0) return 2;
      return 3;
    };
    const latest = (project: GuestProject): number =>
      (byProject.get(project.id) ?? []).reduce((max, row) => Math.max(max, row.updatedAt), 0);
    visible.sort((a, b) => score(a) - score(b) || latest(b) - latest(a) || a.name.localeCompare(b.name));

    const cards = othersOpen ? visible : visible.slice(0, 16);
    const firstBlockedId = visible.find((project) => countsFor(project.id).blocked > 0)?.id;
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
        const rows = sortForBoard((byProject.get(project.id) ?? []));
        const items = rows.map((row) => ({ row, child: row.child } as dom.BoardItem));
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

    board.textContent = '';
    for (const project of cards) {
      const built = buildItems(project);
      const showAll = cardShowAll.has(project.id);
      board.append(
        dom.createProjectCard({
          project,
          items: built.items,
          counts: {
            ...countsFor(project.id),
            archived: filter === 'archived' ? 0 : countsFor(project.id).archived,
          },
          collapsed: store.getCollapsed().projects.includes(project.id),
          error: view.errorProjects.includes(project.name),
          hiddenRows: Math.max(0, built.total - built.items.length),
          showAll,
          onToggleGroup: toggleBoardGroup,
        }),
      );
    }

    const rest = projects.filter((project) => !cards.some((card) => card.id === project.id));
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
        render();
      });
      boardFoot.append(archived);
    }
  };

  const renderRail = (view: View): void => {
    const stringsNow = t();
    const show = filter !== 'ended' && filter !== 'archived';
    const cards = [...view.waiting, ...view.failed].filter(matchesQuery);
    const visible = show && cards.length > 0;
    railHead.hidden = !visible;
    rail.hidden = !visible;
    if (!visible) return;
    railTitle.textContent = stringsNow.board.needsYou(view.counts.blocked + view.counts.failed);
    railMeta.textContent = stringsNow.board.needsMeta(view.counts.blocked, view.counts.failed);
    rail.textContent = '';
    rail.classList.toggle('few', cards.length < 3);
    for (const row of cards) rail.append(dom.createNeedCard(row).element);
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

  const render = (): void => {
    const stringsNow = t();
    const view = store.run();
    title.textContent = stringsNow.panel.title;
    search.update({ placeholder: stringsNow.board.search, label: stringsNow.board.search });

    if (view.phase === 'loading' && !view.hasData) updated.textContent = stringsNow.board.updating;
    else if (view.hasData) {
      updated.textContent = view.phase === 'loading' ? stringsNow.board.updating : stringsNow.board.updated(formatClock(view.updatedAt));
    } else updated.textContent = '';

    summary.textContent = '';
    summary.append(dom.pageSummaryParts(view));

    tabs.update({
      items: [
        { id: 'all', label: stringsNow.board.filters.all, count: view.rows.filter((row) => row.state !== 'archived').length },
        { id: 'needs', label: stringsNow.board.filters.needs, count: view.counts.blocked + view.counts.failed },
        { id: 'running', label: stringsNow.board.filters.running, count: view.counts.inflight },
        { id: 'ended', label: stringsNow.board.filters.ended, count: view.counts.ended },
        { id: 'archived', label: stringsNow.board.filters.archived, count: view.counts.archived },
      ],
      activeId: filter,
    });

    renderBanner(view);

    if (view.fatal) {
      hideBoard();
      const copy =
        view.fatal === 'NOT_GRANTED'
          ? [stringsNow.error.notGrantedTitle, stringsNow.error.notGrantedBody]
          : view.fatal === 'DISABLED'
            ? [stringsNow.error.disabledTitle, stringsNow.error.disabledBody]
            : [stringsNow.error.unavailableTitle, stringsNow.error.unavailableBody];
      showEmpty(`fatal:${view.fatal}`, copy[0]!, copy[1]!);
      return;
    }

    if (view.phase === 'error' && !view.hasData) {
      showEmpty('projects-error', stringsNow.error.allTitle, '', {
        label: stringsNow.error.retry,
        onClick: () => void store.retry(),
      });
      hideBoard();
      renderUnconnected(view);
      return;
    }
    if (!view.hasData || (view.counts.sessions === 0 && !view.sessionsLoaded)) {
      hideEmpty();
      board.textContent = '';
      board.append(dom.pageSkeleton());
      boardFoot.hidden = true;
      renderUnconnected(view);
      return;
    }
    if (view.counts.projects === 0) {
      showEmpty('no-projects', stringsNow.empty.noProjectsTitle, stringsNow.empty.noProjectsBody);
      hideBoard();
      renderUnconnected(view);
      return;
    }
    if (view.counts.sessions === 0 && view.phase === 'ready' && view.sessionsLoaded) {
      showEmpty('no-sessions', stringsNow.empty.noSessionsTitle, stringsNow.empty.noSessionsBody);
      hideBoard();
      renderUnconnected(view);
      return;
    }

    const rows = rowsForTab(view);
    if (rows.length === 0) {
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
            render();
          },
        },
      );
      hideBoard();
      renderUnconnected(view);
      return;
    }

    hideEmpty();
    renderRail(view);
    boardMeta.textContent = stringsNow.board.meta(view.counts.sessions - view.counts.archived, view.counts.projects);
    renderCards(view, rows);
    renderUnconnected(view);
  };

  currentRender = render;
  store.onChange(render);
  render();
  void store.start();

  startClock(() => refreshTimes(root!, store));

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
      toggleCollapsed(store, cardHead.dataset.card);
      render();
      return;
    }
    const archivedLink = target.closest<HTMLElement>('[data-archived-link]');
    if (archivedLink) {
      filter = 'archived';
      store.setBoard({ tab: 'archived' });
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
