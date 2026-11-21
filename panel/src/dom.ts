// DOM builders. No UI text here: every label comes from strings.ts.
import type { GuestProject } from '@openchamber/sdk';
import { mountSpinner } from '@openchamber/sdk/ui';
import type { Row, StateName, View } from './store';
import { formatClock, formatDuration, formatWait, metaFor, t } from './strings';

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
  children: Node[] = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  if (children.length > 0) node.append(...children);
  return node;
};

export const setText = (node: HTMLElement, text: string): void => {
  if (node.textContent !== text) node.textContent = text;
};

export interface Keyed<T> {
  element: HTMLElement;
  update: (item: T) => void;
}

/** Reuses an element per key so hover, focus and an open menu survive a snapshot. */
export function reconcile<T>(
  container: HTMLElement,
  items: readonly T[],
  keyOf: (item: T) => string,
  create: (item: T) => Keyed<T>,
  cache: Map<string, Keyed<T>>,
): void {
  const next = new Map<string, Keyed<T>>();
  for (const item of items) {
    let key = keyOf(item);
    for (let copy = 1; next.has(key); copy += 1) key = `${keyOf(item)}\u0001${copy}`;
    const reused = cache.get(key);
    if (reused) reused.update(item);
    next.set(key, reused ?? create(item));
  }
  for (const [key, entry] of cache) if (next.get(key) !== entry) entry.element.remove();
  cache.clear();
  let index = 0;
  for (const [key, entry] of next) {
    cache.set(key, entry);
    const current = container.children[index] ?? null;
    if (current !== entry.element) container.insertBefore(entry.element, current);
    index += 1;
  }
}

// ----- icons (Remixicon paths, Apache-2.0; see NOTICE) -----

const svg = (size: number, body: string, stroke = false): SVGSVGElement => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('width', String(size));
  node.setAttribute('height', String(size));
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('aria-hidden', 'true');
  if (stroke) {
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', '1.7');
    node.setAttribute('stroke-linecap', 'round');
    node.setAttribute('stroke-linejoin', 'round');
  } else {
    node.setAttribute('fill', 'currentColor');
  }
  node.innerHTML = body;
  return node;
};

const DOTS = '<circle cx="5" cy="12" r="1.55"/><circle cx="12" cy="12" r="1.55"/><circle cx="19" cy="12" r="1.55"/>';
const SEARCH =
  '<path d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z"/>';
const COPY =
  '<path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h10A1.5 1.5 0 0 1 20 4.5v10a1.5 1.5 0 0 1-1.5 1.5H17v3.5A1.5 1.5 0 0 1 15.5 21h-10A1.5 1.5 0 0 1 4 19.5v-10A1.5 1.5 0 0 1 5.5 8H7zm2 0h5.5A1.5 1.5 0 0 1 16 7.5v7h2V4.5H9V6zM6 8.5v10h9v-10H6z"/>';
const OPEN = '<path d="M7.5 16.5 16.5 7.5M9.5 7.5h7v7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';
const CHECK = '<path d="M5 12.5 9.5 17 19 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';

export const dotsIcon = (size = 14): SVGSVGElement => svg(size, DOTS);
export const searchIcon = (size = 14): SVGSVGElement => svg(size, SEARCH);
export const copyIcon = (size = 14): SVGSVGElement => svg(size, COPY);
export const openIcon = (size = 16): SVGSVGElement => svg(size, OPEN);
export const checkIcon = (size = 14): SVGSVGElement => svg(size, CHECK);

const toneOf = (state: StateName): 'warning' | 'error' | 'info' | 'success' | null => {
  if (state === 'permission' || state === 'question') return 'warning';
  if (state === 'failed') return 'error';
  if (state === 'running' || state === 'retrying') return 'info';
  if (state === 'done') return 'success';
  return null;
};

const toneVars = (tone: 'warning' | 'error' | 'info' | 'success', node: HTMLElement): void => {
  node.style.setProperty('--tone', `var(--oc-${tone})`);
  node.style.setProperty('--tone-text', `var(--oc-${tone}-text)`);
};

const metaText = (row: Row): string =>
  metaFor(row.state, row.waitedMs, row.updatedAt, row.archivedAt);

const waitAge = (row: Row): boolean => row.waitedMs >= 30 * 60_000;

/** The row's meta cell: waited time for blocked, duration or clock for the rest. */
const paintMeta = (node: HTMLElement, row: Row): void => {
  const blocked = row.state === 'permission' || row.state === 'question';
  node.className = blocked ? 'cr-wait' : '';
  if (blocked) node.dataset.age = waitAge(row) ? '1' : '0';
  else delete node.dataset.age;
  setText(node, metaText(row));
};

export type RowKeyed = Keyed<Row>;

export function createPanelRow(row: Row, freshIds: Set<string>, onFreshPaint: (id: string, node: HTMLElement) => void): RowKeyed {
  const strings = t();
  const element = el('div', 'cr-row');
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  const dot = el('span', 'cr-dot');
  dot.setAttribute('aria-hidden', 'true');
  const title = el('span', 'cr-title');
  const sub = el('span', 'cr-sub');
  const metaWrap = el('span', 'cr-meta');
  const meta = el('span');
  metaWrap.append(meta);
  const main = el('span', 'cr-main', '', [title, sub]);
  const more = el('button', 'cr-more');
  more.type = 'button';
  more.tabIndex = 0;
  more.append(dotsIcon());
  element.append(dot, main, metaWrap, more);

  const paint = (item: Row): void => {
    element.dataset.id = item.id;
    element.dataset.state = item.state;
    element.title = item.title;
    dot.dataset.state = item.state;
    setText(title, item.title);
    const blocked = item.state === 'permission' || item.state === 'question';
    sub.textContent = '';
    if (blocked || item.state === 'failed') {
      const tone = toneOf(item.state) ?? 'warning';
      const pill = el('span', 'cr-pill', strings.state[item.state]);
      toneVars(tone, pill);
      sub.append(pill);
    } else {
      sub.append(el('span', 'cr-lbl', strings.state[item.state]));
    }
    sub.append(el('span', 'cr-proj', item.projectName));
    if (item.branch) {
      sub.append(el('span', 'cr-sep', strings.sep));
      sub.append(el('span', 'cr-branch', `${item.worktree ? 'wt/' : ''}${item.branch}`));
    }
    paintMeta(meta, item);
    const waited = blocked ? formatDuration(item.waitedMs) : null;
    element.setAttribute('aria-label', strings.aria.row(item.title, strings.state[item.state], item.projectName, waited));
    more.setAttribute('aria-label', strings.panel.more);
    if (freshIds.has(item.id)) onFreshPaint(item.id, element);
  };
  paint(row);
  return { element, update: paint };
}

export function createBoardRow(row: Row): RowKeyed {
  const strings = t();
  const element = el('div', 'brow');
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  const dot = el('span', 'bdot');
  dot.setAttribute('aria-hidden', 'true');
  const title = el('span', 'btitle');
  const meta = el('span', 'bmeta');
  element.append(dot, title, meta);
  const paint = (item: Row): void => {
    element.dataset.id = item.id;
    element.dataset.state = item.state;
    if (item.archivedAt != null) element.dataset.archived = 'true';
    else delete element.dataset.archived;
    element.title = item.title;
    dot.dataset.state = item.state;
    title.textContent = '';
    if (item.child) title.append(el('span', 'child-mark', '↳'));
    title.append(document.createTextNode(item.title));
    if (item.worktree) title.append(document.createTextNode(' '), el('i', 'wt', strings.misc.wt));
    const blocked = item.state === 'permission' || item.state === 'question';
    meta.className = blocked ? 'bmeta wait' : 'bmeta';
    setText(meta, metaText(item));
    const waited = blocked ? formatDuration(item.waitedMs) : null;
    element.setAttribute('aria-label', strings.aria.row(item.title, strings.state[item.state], item.projectName, waited));
  };
  paint(row);
  return { element, update: paint };
}

export type NeedCard = { element: HTMLElement };

export function createNeedCard(row: Row): NeedCard {
  const strings = t();
  const tone = toneOf(row.state) ?? 'warning';
  const element = el('div', 'ncard');
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.dataset.id = row.id;
  element.title = row.title;
  toneVars(tone, element);

  const pill = el('span', 'cr-pill', strings.state[row.state]);
  toneVars(tone, pill);
  const blocked = row.state === 'permission' || row.state === 'question';
  const top = el('div', 'nc-top', '', [pill, el('span', 'nc-proj', row.projectName)]);
  if (blocked) top.append(el('span', 'nc-wait', formatWait(row.waitedMs)));
  const title = el('div', 'nc-title', row.title);
  const bottom = el('div', 'nc-bot');
  if (row.worktree) bottom.append(el('i', 'wt', strings.misc.wt));
  if (row.branch) bottom.append(el('span', 'nc-branch', row.branch));
  if (!blocked) bottom.append(el('span', 'nc-wait', formatClock(row.updatedAt)));
  bottom.append(el('span', 'nc-open', strings.board.openSession));
  element.append(top, title, bottom);
  const waited = row.state === 'permission' || row.state === 'question' ? formatDuration(row.waitedMs) : null;
  element.setAttribute('aria-label', strings.aria.row(row.title, strings.state[row.state], row.projectName, waited));
  return { element };
}

export type ProjectCardInput = {
  project: GuestProject;
  rows: Row[];
  counts: { blocked: number; failed: number; running: number; done: number; archived: number };
  collapsed: boolean;
  error: boolean;
};

export function createProjectCard(input: ProjectCardInput): HTMLElement {
  const strings = t();
  const { project } = input;
  const section = el('section', 'pcard');
  section.dataset.projectId = project.id;
  section.dataset.collapsed = input.collapsed ? 'true' : 'false';

  const head = el('button', 'pchead');
  head.type = 'button';
  head.setAttribute('aria-expanded', input.collapsed ? 'false' : 'true');
  head.dataset.card = project.id;
  head.append(el('span', 'pname', project.name));
  if (input.counts.blocked) {
    const chip = el('span', 'chipb', strings.board.chip.blocked(input.counts.blocked));
    toneVars('warning', chip);
    head.append(chip);
  }
  if (input.counts.failed) {
    const chip = el('span', 'chipb', strings.board.chip.failed(input.counts.failed));
    toneVars('error', chip);
    head.append(chip);
  }
  if (input.counts.running) {
    const chip = el('span', 'chipb', strings.board.chip.running(input.counts.running));
    toneVars('info', chip);
    head.append(chip);
  }
  head.append(el('i', 'tri'));
  section.append(head);

  const body = el('div', 'pcardbody');
  if (input.error) {
    const error = el('div', 'project-error');
    error.append(el('span', '', `${strings.board.projectError} · `));
    const retry = el('button', '', strings.error.retry);
    retry.type = 'button';
    retry.dataset.retry = project.id;
    error.append(retry);
    body.append(error);
  } else if (input.rows.length === 0) {
    body.append(el('div', 'project-error', strings.board.projectEmpty));
  } else {
    for (const row of input.rows) body.append(createBoardRow(row).element);
  }
  section.append(body);

  if (input.counts.archived && input.rows.length > 0) {
    const foot = el('div', 'pcfoot');
    foot.append(el('span', 'grow'));
    const link = el('button', 'link', strings.board.archivedLink(input.counts.archived));
    link.type = 'button';
    link.dataset.archivedLink = project.id;
    foot.append(link);
    section.append(foot);
  }
  return section;
}

export type MenuAction = 'open' | 'copyTitle' | 'copyPath';

export function createRowMenu(actions: MenuAction[], onPick: (action: MenuAction) => void): HTMLElement {
  const strings = t();
  const menu = el('div', 'rowmenu float');
  menu.setAttribute('role', 'menu');
  const labels: Record<MenuAction, string> = {
    open: strings.action.open,
    copyTitle: strings.action.copyTitle,
    copyPath: strings.action.copyPath,
  };
  for (const action of actions) {
    const button = el('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.dataset.action = action;
    button.append(action === 'open' ? openIcon() : copyIcon(), el('span', '', labels[action]));
    button.addEventListener('click', () => onPick(action));
    menu.append(button);
  }
  return menu;
}

export function createSheet(title: string, onPick: (action: MenuAction) => void, onClose: () => void): { layer: HTMLElement } {
  const strings = t();
  const layer = el('div', 'sheet-layer');
  const scrim = el('div', 'sheet-scrim');
  scrim.addEventListener('click', onClose);
  const sheet = el('div', 'sheet float');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', strings.action.sheetTitle);
  const head = el('div', 'grab');
  const titleEl = el('div', 'sheet-title', title);
  sheet.append(head, titleEl);

  const actions: Array<[MenuAction, string, Node]> = [
    ['open', strings.action.open, openIcon()],
    ['copyTitle', strings.action.copyTitle, copyIcon()],
    ['copyPath', strings.action.copyPath, copyIcon()],
  ];
  for (const [action, label, icon] of actions) {
    const button = el('button', 'sact');
    button.type = 'button';
    button.dataset.action = action;
    button.append(icon, el('span', '', label));
    button.addEventListener('click', () => onPick(action));
    sheet.append(button);
  }
  layer.append(scrim, sheet);
  return { layer };
}

export function pageSkeleton(): HTMLElement {
  const wrap = el('div');
  for (let index = 0; index < 2; index += 1) {
    const card = el('div', 'pcard');
    const head = el('div', 'skelhead');
    head.append(el('span', 'sk t1'));
    card.append(head, skeletonRows(2));
    wrap.append(card);
  }
  return wrap;
}

export function skeletonRows(count: number): HTMLElement {
  const box = el('div');
  for (let index = 0; index < count; index += 1) {
    const row = el('div', 'skelrow');
    row.append(
      el('span', 'sk dot'),
      el('div', '', '', [el('div', 'sk t1'), el('div', 'sk t2')]),
      el('span', 'sk m'),
    );
    box.append(row);
  }
  return box;
}

export function summaryParts(view: View): HTMLElement {
  const strings = t();
  const wrap = el('span');
  const parts: Array<[number, string, string]> = [
    [view.counts.blocked, 'b-warn', strings.unit.blocked],
    [view.counts.inflight, 'b-info', strings.unit.running],
    [view.counts.failed, 'b-err', strings.unit.failed],
  ];
  parts.forEach(([value, tone, label], index) => {
    if (index > 0) wrap.append(el('span', 'dot-sep', strings.sep));
    wrap.append(el('b', tone, String(value)), el('span', '', ` ${label}`));
  });
  return wrap;
}

export function pageSummaryParts(view: View): HTMLElement {
  const strings = t();
  const wrap = el('span');
  const parts: Array<[number, string, string]> = [
    [view.counts.blocked, 'b-warn', strings.unit.blocked],
    [view.counts.failed, 'b-err', strings.unit.failed],
    [view.counts.inflight, 'b-info', strings.unit.running],
    [view.counts.sessions, '', strings.unit.sessions],
  ];
  parts.forEach(([value, tone, label], index) => {
    if (index > 0) wrap.append(el('span', 'dot-sep', strings.sep));
    wrap.append(el('b', tone, String(value)), el('span', '', ` ${label}`));
  });
  return wrap;
}

export function createStrip(onOpen: () => void, onRetry: () => void): { element: HTMLElement; update: (view: View) => void } {
  const strings = t();
  let spinner: ReturnType<typeof mountSpinner> | null = null;
  const element = el('div', 'strip');
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  const dotSlot = el('span', 'dot-slot');
  const dot = el('span', 'cr-dot');
  dot.setAttribute('aria-hidden', 'true');
  dotSlot.append(dot);
  const title = el('span', 'strip-title');
  const sub = el('span', 'strip-sub');
  const open = el('span', 'strip-open', strings.status.open);
  const main = el('span', 'strip-main', '', [title, sub]);
  element.append(dotSlot, main, open);

  element.addEventListener('click', onOpen);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  });

  const update = (view: View): void => {
    const strings = t();
    delete element.dataset.tone;
    delete element.dataset.variant;
    element.removeAttribute('aria-busy');
    spinner?.dispose();
    spinner = null;
    dotSlot.textContent = '';
    sub.textContent = '';
    open.textContent = '';
    setText(open, strings.status.open);

    if (!view.fatal && view.phase !== 'error' && (!view.hasData || (view.counts.sessions === 0 && !view.sessionsLoaded))) {
      element.setAttribute('aria-busy', 'true');
      const dotSkeleton = el('span', 'sk dot');
      dotSlot.append(dotSkeleton);
      title.textContent = '';
      title.append(el('span', 'sk t1'), el('span', 'sk t2'));
      open.textContent = '';
      spinner = mountSpinner(open, { size: 'sm' });
      return;
    }

    if (view.fatal || view.phase === 'error') {
      dotSlot.append(dot);
      dot.dataset.state = 'unknown';
      setText(title, strings.status.error);
      const retry = el('button', 'text-btn', strings.error.retry);
      retry.type = 'button';
      retry.style.color = 'var(--oc-warning-text)';
      retry.style.marginLeft = '6px';
      retry.addEventListener('click', (event) => {
        event.stopPropagation();
        onRetry();
      });
      if (view.hasData) sub.append(el('span', '', strings.error.allBody));
      sub.append(retry);
      return;
    }

    dotSlot.append(dot);
    if (view.counts.sessions === 0 && view.phase === 'ready') {
      dot.dataset.state = 'idle';
      element.dataset.variant = 'clear';
      setText(title, strings.status.empty);
      setText(sub, view.counts.projects === 0 ? strings.empty.noProjectsBody : '');
      return;
    }

    if (view.counts.blocked > 0) {
      element.dataset.tone = 'warn';
      dot.dataset.state = 'permission';
      setText(title, strings.status.blocked(view.counts.blocked));
      const detail = strings.status.detail(view.counts);
      const partial = view.errorProjects.length ? ` ${strings.status.partial(view.errorProjects.length)}` : '';
      setText(sub, detail + partial);
      return;
    }

    dot.dataset.state = 'done';
    element.dataset.variant = 'clear';
    setText(title, strings.status.clear);
    const partial = view.errorProjects.length ? ` ${strings.status.partial(view.errorProjects.length)}` : '';
    if (view.counts.inflight) sub.append(el('span', '', strings.status.runningCount(view.counts.inflight)));
    if (view.counts.failed) {
      if (sub.textContent) sub.append(el('span', '', ` ${strings.sep} `));
      sub.append(el('span', 'b-err', strings.status.failedCount(view.counts.failed)));
    }
    if (partial) sub.append(el('span', '', partial));
  };

  return { element, update };
}

export { formatClock, formatDuration, formatWait };
