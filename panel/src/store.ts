// Cross-project session store: project snapshots, per-project subscription
// budget, derived rows, sorting, counts and the rail-badge bookkeeping.
// No DOM and no UI text live here.
import type {
  GuestLoadState,
  GuestProject,
  GuestProjectsSnapshot,
  GuestSessionRecord,
  GuestSessionsSnapshot,
  HostClient,
} from '@openchamber/sdk';

export type StateName =
  | 'permission'
  | 'question'
  | 'failed'
  | 'retrying'
  | 'running'
  | 'done'
  | 'idle'
  | 'unknown'
  | 'archived';

export type Surface = 'panel' | 'page' | 'status';

export type Group = {
  /** The top-level session; it is the group header row. */
  head: Row;
  children: Row[];
  /** head + children, each state group sorted by the same rules as the queue. */
  members: Row[];
  /** The most urgent state in the group; decides which section the group joins. */
  state: StateName;
  /** Every blocked member (never empty for a group that must stay open). */
  blocked: Row[];
};

export type Row = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectDirectory: string;
  directory: string;
  parentId: string | null;
  updatedAt: number;
  archivedAt: number | null;
  worktree: boolean;
  branch: string | null;
  state: StateName;
  /** Milliseconds this session has been blocked, or 0 when it is not blocked. */
  waitedMs: number;
  /** A sub-session whose parent is in the same snapshot: it rides with the parent. */
  child: boolean;
};

export type Counts = {
  blocked: number;
  failed: number;
  inflight: number;
  ended: number;
  idle: number;
  archived: number;
  sessions: number;
  projects: number;
  permissions: number;
  questions: number;
};

export type FatalCode = 'NOT_GRANTED' | 'DISABLED' | 'HOST_TIMEOUT' | 'HOST_REJECTED';

export type View = {
  phase: GuestLoadState;
  /** A first project snapshot has arrived; before that, skeletons rather than empty states. */
  hasData: boolean;
  /** Every connected project has answered at least once, so an empty queue is real. */
  sessionsLoaded: boolean;
  fatal: FatalCode | null;
  rows: Row[];
  waiting: Row[];
  failed: Row[];
  running: Row[];
  ended: Row[];
  idle: Row[];
  archived: Row[];
  /** Top-level groups in section order (blocked first, then failed, running, done, idle). */
  groups: Group[];
  /** Non-archived rows, flat and ordered for search, children included. */
  flatRows: Row[];
  counts: Counts;
  /** Projects with a live subscription. */
  connected: GuestProject[];
  /** Projects beyond the 31-subscription budget or swapped out by hand. */
  unconnected: GuestProject[];
  errorProjects: string[];
  updatedAt: number;
  /** Blocked ids seen for the first time while this surface was watching. */
  fresh: string[];
};

export const MAX_SUBSCRIPTIONS = 31;
/**
 * The one escalation threshold in the extension: a blocked session that has
 * been waiting this long stops being "fresh" and gets the louder treatment.
 */
export const WAIT_ESCALATION_MS = 15 * 60_000;
const SEEN_KEY = 'cr.seen';
const SEEN_LIMIT = 200;
const SUBS_KEY = 'cr.subs';
const COLLAPSED_KEY = 'cr.collapsed';
const BOARD_KEY = 'cr.board';

type Entry = {
  project: GuestProject;
  sessions: GuestSessionRecord[];
  state: GuestLoadState;
  error: boolean;
  connected: boolean;
  unsub: (() => void) | null;
};

type StoredSeen = { ids?: unknown; at?: unknown };
type StoredSubs = { dropped?: unknown };
export type CollapsedState = { ended: boolean; projects: string[]; /** expanded parent session ids */ groups: string[] };
export type BoardState = { tab: string; query: string; others: boolean };

const isBlockedState = (state: StateName): boolean =>
  state === 'permission' || state === 'question';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const errorCode = (error: unknown): string => {
  if (isRecord(error) && typeof error.code === 'string') return error.code;
  return '';
};

/** `raw` is the host activity; `outcome` the last finished turn. */
export function stateOf(session: GuestSessionRecord): StateName {
  if (session.archivedAt != null) return 'archived';
  const activity = session.activity;
  if (activity === 'waiting-permission') return 'permission';
  if (activity === 'waiting-question') return 'question';
  if (activity !== 'running' && activity !== 'retrying' && session.outcome === 'failed') return 'failed';
  if (activity === 'retrying') return 'retrying';
  if (activity === 'running') return 'running';
  if (activity === 'idle' && session.outcome === 'completed') return 'done';
  if (activity === 'idle') return 'idle';
  return 'unknown';
}

const branchOf = (session: GuestSessionRecord): string | null => {
  const worktree = session.worktree;
  if (!worktree) return null;
  return worktree.branch || worktree.name || null;
};

/** Ascending updatedAt, then id, so the same data always renders in the same order. */
const byUpdatedAsc = (a: Row, b: Row): number =>
  a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byUpdatedDesc = (a: Row, b: Row): number => -byUpdatedAsc(a, b);

const waitingRank = (row: Row): number => (row.state === 'permission' ? 0 : 1);
const runningRank = (row: Row): number => (row.state === 'retrying' ? 0 : 1);

export const sortWaiting = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => waitingRank(a) - waitingRank(b) || byUpdatedAsc(a, b));
export const sortFailed = (rows: Row[]): Row[] => [...rows].sort(byUpdatedDesc);
export const sortRunning = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => runningRank(a) - runningRank(b) || byUpdatedDesc(a, b));
export const sortEnded = (rows: Row[]): Row[] => [...rows].sort(byUpdatedDesc);

export class ControlRoomStore {
  private entries = new Map<string, Entry>();
  private subs = new Map<string, () => void>();
  private pending = new Set<string>();
  private unsubProjects: (() => void) | null = null;

  private projects: GuestProject[] = [];
  private projectsState: GuestLoadState = 'loading';
  private fatal: FatalCode | null = null;

  private dropped = new Set<string>();
  private preferred: string[] = [];

  private seen = new Set<string>();
  private blockedSince = new Map<string, number>();
  private previousStates = new Map<string, StateName>();
  private freshIds = new Set<string>();
  private lastReadyAt = 0;
  private lastSeenRead = 0;
  private initialComplete = false;
  private currentBlocked: string[] = [];
  private started = false;
  private hydrated = false;
  private disposed = false;

  private collapsed: CollapsedState = { ended: false, projects: [], groups: [] };
  private board: BoardState = { tab: 'all', query: '', others: false };

  private changeHandler: (() => void) | null = null;

  constructor(
    private host: HostClient,
    private surface: Surface,
  ) {}

  onChange(handler: () => void): void {
    this.changeHandler = handler;
  }

  /** Storage (board filter, search, folds) has been read. */
  isHydrated(): boolean {
    return this.hydrated;
  }

  private changed(): void {
    this.changeHandler?.();
  }

  // ----- storage -----

  private write(key: string, value: unknown): void {
    void this.host.storage.set(key, value as never).catch(() => undefined);
  }

  private async loadStorage(): Promise<void> {
    const [seen, subs, collapsed, board] = await Promise.allSettled([
      this.host.storage.get(SEEN_KEY),
      this.host.storage.get(SUBS_KEY),
      this.host.storage.get(COLLAPSED_KEY),
      this.host.storage.get(BOARD_KEY),
    ]);
    if (seen.status === 'fulfilled' && isRecord(seen.value)) {
      this.seen = new Set(stringList((seen.value as StoredSeen).ids).slice(-SEEN_LIMIT));
    }
    if (subs.status === 'fulfilled' && isRecord(subs.value)) {
      this.dropped = new Set(stringList((subs.value as StoredSubs).dropped).slice(0, 200));
    }
    if (collapsed.status === 'fulfilled' && isRecord(collapsed.value)) {
      const value = collapsed.value;
      this.collapsed = {
        ended: value.ended === true,
        projects: stringList(value.projects).slice(0, 400),
        groups: stringList(value.groups).slice(0, 200),
      };
    }
    if (board.status === 'fulfilled' && isRecord(board.value)) {
      const value = board.value;
      this.board = {
        tab: typeof value.tab === 'string' ? value.tab : 'all',
        query: typeof value.query === 'string' ? value.query.slice(0, 200) : '',
        others: value.others === true,
      };
    }
  }

  getCollapsed(): CollapsedState {
    return this.collapsed;
  }

  setEndedCollapsed(ended: boolean): void {
    this.collapsed.ended = ended;
    this.write(COLLAPSED_KEY, this.collapsed);
  }

  /** Blocked groups are always open; everything else opens only when listed. */
  isGroupExpanded(group: Group): boolean {
    return group.blocked.length > 0 || this.collapsed.groups.includes(group.head.id);
  }

  toggleGroupExpanded(group: Group): void {
    if (group.blocked.length > 0) return;
    const set = new Set(this.collapsed.groups);
    if (set.has(group.head.id)) set.delete(group.head.id);
    else set.add(group.head.id);
    this.collapsed.groups = [...set].slice(0, 200);
    this.write(COLLAPSED_KEY, this.collapsed);
  }

  toggleProjectCollapsed(projectId: string): void {
    const set = new Set(this.collapsed.projects);
    if (set.has(projectId)) set.delete(projectId);
    else set.add(projectId);
    this.collapsed.projects = [...set].slice(0, 400);
    this.write(COLLAPSED_KEY, this.collapsed);
  }

  getBoard(): BoardState {
    return this.board;
  }

  setBoard(next: Partial<BoardState>): void {
    this.board = { ...this.board, ...next };
    this.write(BOARD_KEY, this.board);
  }

  // ----- subscriptions -----

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.loadStorage();
    this.hydrated = true;
    this.changed();
    try {
      const unsub = await this.host.onProjects((snapshot) => this.applyProjects(snapshot));
      if (this.disposed) {
        unsub();
        return;
      }
      this.unsubProjects = unsub;
    } catch (error) {
      this.fatal = this.fatalFrom(error);
      this.projectsState = 'error';
      this.changed();
    }
  }

  private fatalFrom(error: unknown): FatalCode | null {
    const code = errorCode(error);
    if (code === 'NOT_GRANTED' || code === 'DISABLED' || code === 'HOST_TIMEOUT' || code === 'HOST_REJECTED') {
      return code;
    }
    if (code === 'HOST_UNAVAILABLE') return 'HOST_REJECTED';
    return code ? 'HOST_REJECTED' : null;
  }

  private applyProjects(snapshot: GuestProjectsSnapshot): void {
    this.projectsState = snapshot.state;
    if (snapshot.state === 'ready') {
      this.projects = snapshot.projects;
      this.lastReadyAt = Date.now();
    } else if (snapshot.state === 'loading' && snapshot.projects.length > 0) {
      this.projects = snapshot.projects;
    }
    void this.ensureSubscriptions();
    this.changed();
  }

  private signalIds(): Set<string> {
    const ids = new Set<string>();
    for (const entry of this.entries.values()) {
      if (!entry.connected) continue;
      for (const session of entry.sessions) {
        const state = stateOf(session);
        if (isBlockedState(state) || state === 'failed') ids.add(entry.project.id);
      }
    }
    return ids;
  }

  /** Blocked/failed first, then swapped-in projects, then by name; 31 at most. */
  private selectProjects(): GuestProject[] {
    const signal = this.signalIds();
    const preferredRank = new Map(this.preferred.map((id, index) => [id, index]));
    const byName = (a: GuestProject, b: GuestProject): number => a.name.localeCompare(b.name);
    const available = this.projects.filter(
      (project) => !this.dropped.has(project.id) || preferredRank.has(project.id),
    );
    const must = available.filter((project) => signal.has(project.id)).sort(byName);
    const rest = available
      .filter((project) => !signal.has(project.id))
      .sort((a, b) => {
        const ra = preferredRank.get(a.id);
        const rb = preferredRank.get(b.id);
        if (ra !== undefined || rb !== undefined) return (ra ?? 1e9) - (rb ?? 1e9);
        return byName(a, b);
      });
    return [...must, ...rest].slice(0, MAX_SUBSCRIPTIONS);
  }

  private async ensureSubscriptions(): Promise<void> {
    const selected = this.selectProjects();
    const wanted = new Set(selected.map((project) => project.id));
    for (const [projectId, unsub] of [...this.subs]) {
      if (wanted.has(projectId)) continue;
      this.subs.delete(projectId);
      const entry = this.entries.get(projectId);
      if (entry) entry.connected = false;
      try {
        unsub();
      } catch {
        // The host already dropped it.
      }
    }
    for (const project of selected) {
      if (this.subs.has(project.id) || this.pending.has(project.id)) continue;
      const entry = this.entryFor(project);
      entry.connected = true;
      this.pending.add(project.id);
      try {
        const unsub = await this.host.onSessions(project.id, (snapshot) => this.applySessions(project.id, snapshot));
        this.pending.delete(project.id);
        if (this.subs.has(project.id) || this.disposed || !this.selectProjects().some((item) => item.id === project.id)) {
          unsub();
          entry.connected = false;
          continue;
        }
        this.subs.set(project.id, unsub);
        entry.unsub = unsub;
        entry.error = false;
      } catch (error) {
        this.pending.delete(project.id);
        entry.state = 'error';
        entry.error = true;
        if (this.fatalFrom(error) === 'NOT_GRANTED') this.fatal = 'NOT_GRANTED';
        this.changed();
      }
    }
  }

  private entryFor(project: GuestProject): Entry {
    const existing = this.entries.get(project.id);
    if (existing) {
      existing.project = project;
      return existing;
    }
    const entry: Entry = {
      project,
      sessions: [],
      state: 'loading',
      error: false,
      connected: true,
      unsub: null,
    };
    this.entries.set(project.id, entry);
    return entry;
  }

  private applySessions(projectId: string, snapshot: GuestSessionsSnapshot): void {
    const project = this.projects.find((item) => item.id === projectId);
    const entry = project ? this.entryFor(project) : this.entries.get(projectId);
    if (!entry) return;
    entry.state = snapshot.state;
    if (snapshot.state !== 'error') entry.sessions = snapshot.sessions;
    entry.error = snapshot.state === 'error';
    this.changed();
  }

  async retry(): Promise<void> {
    if (!this.started) return;
    try {
      const snapshot = await this.host.listProjects();
      this.applyProjects(snapshot);
    } catch (error) {
      this.fatal = this.fatalFrom(error);
      this.projectsState = 'error';
      this.changed();
    }
    for (const [projectId, unsub] of [...this.subs]) {
      const entry = this.entries.get(projectId);
      if (!entry?.error) continue;
      this.subs.delete(projectId);
      try {
        unsub();
      } catch {
        // ignore
      }
      entry.connected = false;
      this.pending.delete(projectId);
    }
    await this.ensureSubscriptions();
    this.changed();
  }

  /** Swaps an unconnected project in; refuses when every connected one is blocked. */
  connect(projectId: string): boolean {
    const selected = this.selectProjects();
    if (selected.some((project) => project.id === projectId)) return true;
    if (selected.length >= MAX_SUBSCRIPTIONS) {
      const victim = [...selected].reverse().find((project) => !this.signalIds().has(project.id));
      if (!victim) return false;
      this.dropped.add(victim.id);
      this.preferred = this.preferred.filter((id) => id !== victim.id);
    }
    this.dropped.delete(projectId);
    this.preferred = [projectId, ...this.preferred.filter((id) => id !== projectId)].slice(0, 64);
    this.write(SUBS_KEY, { dropped: [...this.dropped] });
    void this.ensureSubscriptions();
    this.changed();
    return true;
  }

  // ----- badge -----

  private markSeen(ids: string[]): void {
    const next = new Set(ids.slice(-SEEN_LIMIT));
    let same = next.size === this.seen.size;
    if (same) for (const id of next) if (!this.seen.has(id)) { same = false; break; }
    this.seen = next;
    if (!same) this.write(SEEN_KEY, { ids: [...next], at: Date.now() });
  }

  /** Another surface (the panel) may have marked waits as seen; read before counting. */
  private async refreshSeen(): Promise<void> {
    if (Date.now() - this.lastSeenRead < 5000) return;
    this.lastSeenRead = Date.now();
    try {
      const value = await this.host.storage.get(SEEN_KEY);
      if (isRecord(value)) this.seen = new Set(stringList((value as StoredSeen).ids).slice(-SEEN_LIMIT));
    } catch {
      // Keep the local set.
    }
  }

  private updateBadge(view: View): void {
    if (this.fatal || view.phase !== 'ready' || !view.hasData) return;
    const blockedIds = this.currentBlocked;
    const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    if (this.surface !== 'status' && visible) {
      this.markSeen(blockedIds);
      void this.host.setBadge(null).catch(() => undefined);
      return;
    }
    const count = (): number => blockedIds.filter((id) => !this.seen.has(id)).length;
    const fresh = count();
    if (this.surface === 'status' && fresh > 0) {
      void this.refreshSeen().then(() => {
        // Sessions may have arrived while storage was being read.
        const next = this.currentBlocked.filter((id) => !this.seen.has(id)).length;
        void this.host.setBadge(next > 0 ? Math.min(next, 999) : null).catch(() => undefined);
      });
      return;
    }
    void this.host.setBadge(fresh > 0 ? Math.min(fresh, 999) : null).catch(() => undefined);
  }

  // ----- derive -----

  run(): View {
    const now = Date.now();
    const raw: Row[] = [];
    let sessions = 0;
    for (const entry of this.entries.values()) {
      if (!entry.connected) continue;
      for (const session of entry.sessions) {
        sessions += 1;
        const state = stateOf(session);
        const project = this.projects.find((item) => item.id === session.projectId) ?? entry.project;
        raw.push({
          id: session.id,
          title: session.title || session.id,
          projectId: session.projectId,
          projectName: project?.name ?? session.projectId,
          projectDirectory: project?.directory ?? session.directory,
          directory: session.directory,
          parentId: session.parentId,
          updatedAt: session.updatedAt,
          archivedAt: session.archivedAt,
          worktree: session.worktree != null,
          branch: branchOf(session),
          state,
          waitedMs: 0,
          child: false,
        });
      }
    }
    const rawIds = new Set(raw.map((row) => row.id));
    for (const row of raw) row.child = row.parentId != null && rawIds.has(row.parentId);

    // Entering a blocked state starts the clock; a first sighting falls back to
    // updatedAt, which the host keeps close to the moment the wait began.
    const blockedNow = new Set<string>();
    for (const row of raw) {
      if (!isBlockedState(row.state)) continue;
      blockedNow.add(row.id);
      let since = this.blockedSince.get(row.id);
      if (since == null) {
        const previous = this.previousStates.get(row.id);
        since = previous && !isBlockedState(previous) ? now : row.updatedAt;
        this.blockedSince.set(row.id, since);
      }
      row.waitedMs = Math.max(0, now - since);
    }
    for (const id of [...this.blockedSince.keys()]) if (!blockedNow.has(id)) this.blockedSince.delete(id);

    const fresh: string[] = [];
    if (this.initialComplete && this.surface !== 'status') {
      for (const id of blockedNow) {
        if (!isBlockedState(this.previousStates.get(id) as StateName)) fresh.push(id);
      }
    }
    this.previousStates = new Map(raw.map((row) => [row.id, row.state]));
    this.freshIds = new Set(fresh);
    if (this.entries.size > 0 && [...this.entries.values()].every((entry) => entry.state !== 'loading')) {
      this.initialComplete = true;
    }

    const activeRows = raw.filter((row) => row.state !== 'archived');
    const archived = sortEnded(raw.filter((row) => row.state === 'archived'));
    const waiting = sortWaiting(activeRows.filter((row) => isBlockedState(row.state)));

    const childrenByParent = new Map<string, Row[]>();
    for (const row of activeRows) {
      if (!row.child || !row.parentId) continue;
      const list = childrenByParent.get(row.parentId);
      if (list) list.push(row);
      else childrenByParent.set(row.parentId, [row]);
    }
    const sortMembers = (rows: Row[]): Row[] => [
      ...sortWaiting(rows.filter((row) => isBlockedState(row.state))),
      ...sortFailed(rows.filter((row) => row.state === 'failed')),
      ...sortRunning(rows.filter((row) => row.state === 'running' || row.state === 'retrying')),
      ...sortEnded(rows.filter((row) => row.state === 'done')),
      ...sortEnded(rows.filter((row) => row.state === 'idle' || row.state === 'unknown')),
    ];
    const groups: Group[] = [];
    for (const head of activeRows) {
      if (head.child) continue;
      const children = sortMembers(childrenByParent.get(head.id) ?? []);
      const members = [head, ...children];
      const blocked = members.filter((row) => isBlockedState(row.state));
      // A blocked child forces the group into the queue; otherwise the child
      // follows its parent, exactly like the host's own session list.
      const state: StateName = blocked.length > 0
        ? (blocked.some((row) => row.state === 'permission') ? 'permission' : 'question')
        : head.state;
      groups.push({ head, children, members, state, blocked });
    }
    const groupRank = (group: Group): number =>
      group.state === 'permission' ? 0
        : group.state === 'question' ? 1
          : group.state === 'failed' ? 2
            : group.state === 'retrying' || group.state === 'running' ? 3
              : group.state === 'done' ? 4
                : 5;
    const oldestBlock = (group: Group): number =>
      Math.min(...group.blocked.map((row) => row.updatedAt));
    const newestMember = (group: Group): number =>
      Math.max(...group.members.map((row) => row.updatedAt));
    groups.sort((a, b) => {
      const rankA = groupRank(a);
      const rankB = groupRank(b);
      if (rankA !== rankB) return rankA - rankB;
      if (rankA <= 1) return oldestBlock(a) - oldestBlock(b) || a.head.id.localeCompare(b.head.id);
      if (rankA === 2) return newestMember(b) - newestMember(a) || a.head.id.localeCompare(b.head.id);
      if (rankA === 3) {
        const runningA = a.state === 'retrying' ? 0 : 1;
        const runningB = b.state === 'retrying' ? 0 : 1;
        return runningA - runningB || b.head.updatedAt - a.head.updatedAt || a.head.id.localeCompare(b.head.id);
      }
      return b.head.updatedAt - a.head.updatedAt || a.head.id.localeCompare(b.head.id);
    });

    const headsIn = (...states: StateName[]): Row[] =>
      groups.filter((group) => states.includes(group.state)).map((group) => group.head);
    const failed = headsIn('failed');
    const running = headsIn('running', 'retrying');
    const ended = headsIn('done');
    const idle = headsIn('idle');
    const flatRows = [
      ...waiting,
      ...sortFailed(activeRows.filter((row) => row.state === 'failed')),
      ...sortRunning(activeRows.filter((row) => row.state === 'running' || row.state === 'retrying')),
      ...sortEnded(activeRows.filter((row) => row.state === 'done')),
      ...sortEnded(activeRows.filter((row) => row.state === 'idle' || row.state === 'unknown')),
    ];

    this.currentBlocked = waiting.map((row) => row.id);

    const connectedIds = new Set([...this.subs.keys()]);
    for (const project of this.projects) {
      const entry = this.entries.get(project.id);
      if (entry?.connected) connectedIds.add(project.id);
    }
    const connected = this.projects.filter((project) => connectedIds.has(project.id));
    const unconnected = this.projects.filter((project) => !connectedIds.has(project.id));
    const errorProjects = this.projects
      .filter((project) => this.entries.get(project.id)?.error)
      .map((project) => project.name);

    const counts: Counts = {
      blocked: waiting.length,
      failed: failed.length,
      inflight: running.length,
      ended: ended.length,
      idle: idle.length,
      archived: archived.length,
      sessions,
      projects: this.projects.length,
      permissions: waiting.filter((row) => row.state === 'permission').length,
      questions: waiting.filter((row) => row.state === 'question').length,
    };

    const view: View = {
      phase: this.fatal ? 'error' : this.projectsState,
      hasData: this.lastReadyAt > 0,
      sessionsLoaded:
        this.projects.length === 0
        || (this.entries.size > 0 && [...this.entries.values()].every((entry) => entry.state !== 'loading')),
      fatal: this.fatal,
      rows: raw,
      waiting,
      failed,
      running,
      ended,
      idle,
      archived,
      groups,
      flatRows,
      counts,
      connected,
      unconnected,
      errorProjects,
      updatedAt: this.lastReadyAt,
      fresh,
    };
    this.updateBadge(view);
    return view;
  }

  isUnconnected(projectId: string): boolean {
    return !this.subs.has(projectId);
  }

  hasSignal(projectId: string): boolean {
    return this.signalIds().has(projectId);
  }

  allProjects(): GuestProject[] {
    return this.projects;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubProjects?.();
    this.unsubProjects = null;
    for (const unsub of this.subs.values()) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.subs.clear();
  }
}
