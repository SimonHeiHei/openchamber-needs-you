// Every user-facing string, zh and en, in one place. `zh*` locales get Chinese.
import type { StateName } from './store';

export type Lang = 'zh' | 'en';

export type StateCounts = {
  permissions: number;
  questions: number;
  inflight: number;
  failed: number;
};

export interface Strings {
  lang: Lang;
  join: string;
  sep: string;
  unit: { blocked: string; running: string; failed: string; sessions: string; projects: string };
  state: Record<StateName, string>;
  panel: {
    title: string;
    summary: { blocked: (n: number) => string; running: (n: number) => string; failed: (n: number) => string; loading: string };
    search: { open: string; placeholder: string; results: (query: string, n: number) => string; empty: string };
    more: string;
    clearWaiting: string;
    goodNews: { title: string; body: (running: number) => string; quiet: string; ended: (n: number, time: string) => string };
    live: (title: string, state: string) => string;
  };
  section: {
    waiting: string;
    failed: string;
    running: string;
    ended: string;
    archived: string;
    more: (n: number) => string;
    endedToggle: (n: number) => string;
  };
  footer: { idle: (n: number) => string; totals: (projects: number, sessions: number) => string; updated: (time: string) => string; updating: string; stale: (time: string) => string };
  time: { now: string; minutes: (n: number) => string; hours: (n: number) => string; days: (n: number) => string; waiting: (duration: string) => string };
  aria: { row: (title: string, state: string, project: string, waited: string | null) => string; section: (label: string, n: number) => string };
  board: {
    heading: string;
    updated: (time: string) => string;
    updating: string;
    summary: (blocked: number, failed: number, running: number, sessions: number) => string;
    needsYou: (n: number) => string;
    needsMeta: (blocked: number, failed: number) => string;
    meta: (sessions: number, projects: number) => string;
    column: (n: number) => string;
    otherProjects: (projects: number, sessions: number) => string;
    archived: (n: number) => string;
    projectEmpty: string;
    projectError: string;
    noMatch: string;
    clearFilter: string;
    openSession: string;
    filters: { all: string; needs: string; running: string; ended: string; archived: string };
    search: string;
    hideArchived: string;
    chip: { blocked: (n: number) => string; failed: (n: number) => string; running: (n: number) => string };
    archivedLink: (n: number) => string;
    moreSessions: (n: number) => string;
    fewerSessions: string;
  };
  action: { open: string; copyTitle: string; copyPath: string; copyDone: string; sheetTitle: string };
  status: {
    blocked: (n: number) => string;
    detail: (counts: StateCounts) => string;
    clear: string;
    clearDetail: (running: number, failed: number) => string;
    runningCount: (n: number) => string;
    failedCount: (n: number) => string;
    empty: string;
    open: string;
    partial: (n: number) => string;
    reading: string;
    error: string;
  };
  error: {
    partialTitle: (n: number) => string;
    partialBody: string;
    allTitle: string;
    allBody: string;
    retry: string;
    stale: (time: string) => string;
    notGrantedTitle: string;
    notGrantedBody: string;
    disabledTitle: string;
    disabledBody: string;
    unavailableTitle: string;
    unavailableBody: string;
  };
  overflow: {
    title: (n: number) => string;
    body: string;
    manage: string;
    blocked: string;
    unconnected: (n: number) => string;
    connect: string;
    connected: string;
  };
  empty: { noProjectsTitle: string; noProjectsBody: string; noSessionsTitle: string; noSessionsBody: string };
  misc: { wt: string; retry: string; updated: string };
}

const zh: Strings = {
  lang: 'zh',
  join: '，',
  sep: '·',
  unit: { blocked: '个在等你', running: '个在运行', failed: '个失败', sessions: '个会话', projects: '个项目' },
  state: {
    permission: '权限',
    question: '提问',
    failed: '失败',
    retrying: '重试中',
    running: '运行中',
    done: '已完成',
    idle: '空闲',
    unknown: '未知',
    archived: '已归档',
  },
  panel: {
    title: '会话控制室',
    summary: {
      blocked: (n) => `${n} 个在等你`,
      running: (n) => `${n} 个在运行`,
      failed: (n) => `${n} 个失败`,
      loading: '正在读取…',
    },
    search: {
      open: '搜索会话',
      placeholder: '搜索会话或项目',
      results: (query, n) => `搜索「${query}」· ${n} 个结果`,
      empty: '没有匹配的会话',
    },
    more: '更多操作',
    clearWaiting: '没有会话在等你',
    goodNews: {
      title: '没有会话需要你',
      body: (running) => `${running} 个会话在后台运行，有结果会出现在这里。`,
      quiet: '没有正在运行的会话。',
      ended: (n, time) => `${n} 个已完成 · ${time}`,
    },
    live: (title, state) => `新的等待：${title}，${state}`,
  },
  section: {
    waiting: '等你',
    failed: '失败',
    running: '进行中',
    ended: '已结束',
    archived: '已归档',
    more: (n) => `还有 ${n} 条`,
    endedToggle: (n) => `已结束 ${n}`,
  },
  footer: {
    idle: (n) => `另有 ${n} 个空闲会话`,
    totals: (projects, sessions) => `${projects} 个项目 · ${sessions} 个会话`,
    updated: (time) => `更新于 ${time}`,
    updating: '正在更新',
    stale: (time) => `显示的是 ${time} 的结果`,
  },
  time: {
    now: '刚刚',
    minutes: (n) => `${n} 分`,
    hours: (n) => `${n} 小时`,
    days: (n) => `${n} 天`,
    waiting: (duration) => `等了 ${duration}`,
  },
  aria: {
    row: (title, state, project, waited) =>
      `${title}，${state}，项目 ${project}${waited ? `，已等待 ${waited}` : ''}`,
    section: (label, n) => `${label}，${n} 个会话`,
  },
  board: {
    heading: '会话看板',
    updated: (time) => `更新于 ${time}`,
    updating: '更新中…',
    summary: (blocked, failed, running, sessions) =>
      `${blocked} 个在等你 · ${failed} 个失败 · ${running} 个在运行 · ${sessions} 个会话`,
    needsYou: (n) => `需要你 ${n}`,
    needsMeta: (blocked, failed) => `${blocked} 个在等你 · ${failed} 个失败`,
    meta: (sessions, projects) => `${sessions} 个会话 · ${projects} 个项目`,
    column: (n) => `${n} 个会话`,
    otherProjects: (projects, sessions) => `其他 ${projects} 个项目 · ${sessions} 个会话`,
    archived: (n) => `已归档 ${n}`,
    projectEmpty: '这个项目没有会话',
    projectError: '读取失败',
    noMatch: '没有匹配的会话',
    clearFilter: '清除筛选',
    openSession: '打开 →',
    filters: { all: '全部', needs: '需要你', running: '进行中', ended: '已结束', archived: '已归档' },
    search: '搜索会话或项目',
    hideArchived: '归档会话不进入队列',
    chip: { blocked: (n) => `等你 ${n}`, failed: (n) => `失败 ${n}`, running: (n) => `运行 ${n}` },
    archivedLink: (n) => `已归档 ${n}`,
    moreSessions: (n) => `还有 ${n} 个会话`,
    fewerSessions: '收起',
  },
  action: {
    open: '打开会话',
    copyTitle: '复制标题',
    copyPath: '复制项目路径',
    copyDone: '已复制',
    sheetTitle: '更多操作',
  },
  status: {
    blocked: (n) => `${n} 个会话在等你`,
    detail: (counts) =>
      [
        counts.permissions ? `${counts.permissions} 个权限` : '',
        counts.questions ? `${counts.questions} 个提问` : '',
        counts.inflight ? `${counts.inflight} 个运行中` : '',
        counts.failed ? `${counts.failed} 个失败` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    clear: '没有会话在等你',
    clearDetail: (running, failed) =>
      [running ? `${running} 个运行中` : '', failed ? `${failed} 个失败` : ''].filter(Boolean).join(' · '),
    runningCount: (n) => `${n} 个运行中`,
    failedCount: (n) => `${n} 个失败`,
    empty: '还没有会话',
    open: '打开控制室 →',
    partial: (n) => `· ${n} 个项目未读到`,
    reading: '正在读取…',
    error: '读不到会话状态',
  },
  error: {
    partialTitle: (n) => `${n} 个项目读取失败`,
    partialBody: '可能漏掉等待中的会话，其余项目仍是最新。',
    allTitle: '读不到会话状态',
    allBody: '显示的是上次结果。',
    retry: '重试',
    stale: (time) => `更新于 ${time} · 读取失败`,
    notGrantedTitle: '扩展权限未批准',
    notGrantedBody: '这个扩展只申请 sessions 能力。请在 设置 → 扩展 里重新批准后打开。',
    disabledTitle: '扩展已暂停',
    disabledBody: '在 设置 → 扩展 里重新启用它，队列就会继续更新。',
    unavailableTitle: '连不上 OpenChamber',
    unavailableBody: '这个界面需要运行在 OpenChamber 的 web 或桌面端里。',
  },
  overflow: {
    title: (n) => `还有 ${n} 个项目未连接`,
    body: '一次最多连接 31 个项目，换一个上来。',
    manage: '管理',
    blocked: '先处理完等待中的会话再换出',
    unconnected: (n) => `${n} 个项目未连接`,
    connect: '换入',
    connected: '已连接',
  },
  empty: {
    noProjectsTitle: '还没有项目',
    noProjectsBody: '在 OpenChamber 里打开一个项目，会话就会出现在这里。',
    noSessionsTitle: '还没有会话',
    noSessionsBody: '在任意项目里开始一个会话，它就会出现在这条队列里。',
  },
  misc: { wt: 'wt', retry: '重试', updated: '更新于' },
};

const en: Strings = {
  lang: 'en',
  join: ', ',
  sep: '·',
  unit: { blocked: 'waiting on you', running: 'running', failed: 'failed', sessions: 'sessions', projects: 'projects' },
  state: {
    permission: 'Permission',
    question: 'Question',
    failed: 'Failed',
    retrying: 'Retrying',
    running: 'Running',
    done: 'Done',
    idle: 'Idle',
    unknown: 'Unknown',
    archived: 'Archived',
  },
  panel: {
    title: 'Session Control Room',
    summary: {
      blocked: (n) => `${n} waiting on you`,
      running: (n) => `${n} running`,
      failed: (n) => `${n} failed`,
      loading: 'Reading…',
    },
    search: {
      open: 'Search sessions',
      placeholder: 'Search sessions or projects',
      results: (query, n) => `“${query}” · ${n} results`,
      empty: 'No matching sessions',
    },
    more: 'More actions',
    clearWaiting: 'Nothing is waiting on you',
    goodNews: {
      title: 'Nothing needs you',
      body: (running) => `${running} sessions are running in the background. Results land here.`,
      quiet: 'Nothing is running right now.',
      ended: (n, time) => `${n} done · ${time}`,
    },
    live: (title, state) => `New wait: ${title}, ${state}`,
  },
  section: {
    waiting: 'Waiting on you',
    failed: 'Failed',
    running: 'In flight',
    ended: 'Ended',
    archived: 'Archived',
    more: (n) => `${n} more`,
    endedToggle: (n) => `Ended ${n}`,
  },
  footer: {
    idle: (n) => `${n} idle sessions`,
    totals: (projects, sessions) => `${projects} projects · ${sessions} sessions`,
    updated: (time) => `Updated ${time}`,
    updating: 'updating',
    stale: (time) => `Showing the ${time} result`,
  },
  time: {
    now: 'now',
    minutes: (n) => `${n}m`,
    hours: (n) => `${n}h`,
    days: (n) => `${n}d`,
    waiting: (duration) => `waiting ${duration}`,
  },
  aria: {
    row: (title, state, project, waited) =>
      `${title}, ${state}, project ${project}${waited ? `, waiting for ${waited}` : ''}`,
    section: (label, n) => `${label}, ${n} sessions`,
  },
  board: {
    heading: 'Session board',
    updated: (time) => `Updated ${time}`,
    updating: 'updating…',
    summary: (blocked, failed, running, sessions) =>
      `${blocked} waiting · ${failed} failed · ${running} running · ${sessions} sessions`,
    needsYou: (n) => `Needs you ${n}`,
    needsMeta: (blocked, failed) => `${blocked} waiting · ${failed} failed`,
    meta: (sessions, projects) => `${sessions} sessions · ${projects} projects`,
    column: (n) => `${n} sessions`,
    otherProjects: (projects, sessions) => `${projects} more projects · ${sessions} sessions`,
    archived: (n) => `${n} archived`,
    projectEmpty: 'No sessions in this project',
    projectError: 'Could not read',
    noMatch: 'No matching sessions',
    clearFilter: 'Clear filters',
    openSession: 'Open →',
    filters: { all: 'All', needs: 'Needs you', running: 'In flight', ended: 'Ended', archived: 'Archived' },
    search: 'Search sessions or projects',
    hideArchived: 'Archived sessions stay out of the queue',
    chip: { blocked: (n) => `${n} waiting`, failed: (n) => `${n} failed`, running: (n) => `${n} running` },
    archivedLink: (n) => `${n} archived`,
    moreSessions: (n) => `${n} more sessions`,
    fewerSessions: 'Show fewer',
  },
  action: {
    open: 'Open session',
    copyTitle: 'Copy title',
    copyPath: 'Copy project path',
    copyDone: 'Copied',
    sheetTitle: 'More actions',
  },
  status: {
    blocked: (n) => `${n} ${n === 1 ? 'session' : 'sessions'} waiting on you`,
    detail: (counts) =>
      [
        counts.permissions ? `${counts.permissions} permission` : '',
        counts.questions ? `${counts.questions} question` : '',
        counts.inflight ? `${counts.inflight} running` : '',
        counts.failed ? `${counts.failed} failed` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    clear: 'Nothing is waiting on you',
    clearDetail: (running, failed) =>
      [running ? `${running} running` : '', failed ? `${failed} failed` : ''].filter(Boolean).join(' · '),
    runningCount: (n) => `${n} running`,
    failedCount: (n) => `${n} failed`,
    empty: 'No sessions yet',
    open: 'Open control room →',
    partial: (n) => `· ${n} projects unread`,
    reading: 'Reading…',
    error: 'Cannot read session state',
  },
  error: {
    partialTitle: (n) => `Could not read ${n} projects`,
    partialBody: 'Some waits may be missing. The rest is up to date.',
    allTitle: 'Cannot read session state',
    allBody: 'Showing the last result.',
    retry: 'Retry',
    stale: (time) => `Updated ${time} · read failed`,
    notGrantedTitle: 'Sessions permission is not approved',
    notGrantedBody: 'This extension asks for sessions only. Approve it again in Settings → Extensions.',
    disabledTitle: 'Extension paused',
    disabledBody: 'Enable it again in Settings → Extensions and the queue resumes.',
    unavailableTitle: 'Cannot reach OpenChamber',
    unavailableBody: 'This view runs inside OpenChamber on web or desktop.',
  },
  overflow: {
    title: (n) => `${n} more projects not connected`,
    body: 'Up to 31 projects at a time. Swap one in.',
    manage: 'Manage',
    blocked: 'Clear waiting sessions first',
    unconnected: (n) => `${n} projects not connected`,
    connect: 'Swap in',
    connected: 'Connected',
  },
  empty: {
    noProjectsTitle: 'No projects yet',
    noProjectsBody: 'Open a project in OpenChamber and its sessions show up here.',
    noSessionsTitle: 'No sessions yet',
    noSessionsBody: 'Start a session in any project and it lands in this queue.',
  },
  misc: { wt: 'wt', retry: 'Retry', updated: 'Updated' },
};

const TABLE: Record<Lang, Strings> = { zh, en };
let current: Strings = en;
let currentLang: Lang = 'en';

export function setLocale(locale: string | null | undefined): Lang {
  const next: Lang = (locale ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  current = TABLE[next];
  currentLang = next;
  return next;
}

export const t = (): Strings => current;
export const lang = (): Lang => currentLang;

/** `12 分`, `1 小时`, `2 天` — whole units, no seconds. */
export function formatDuration(ms: number): string {
  const strings = t().time;
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return strings.now;
  if (minutes < 60) return strings.minutes(minutes);
  if (minutes < 1440) return strings.hours(Math.floor(minutes / 60));
  return strings.days(Math.floor(minutes / 1440));
}

export function formatWait(ms: number): string {
  return t().time.waiting(formatDuration(ms));
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 24-hour clock, `12:31`. */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `11-02` for archived rows. */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function metaFor(state: StateName, waitedMs: number, updatedAt: number, archivedAt: number | null): string {
  if (state === 'permission' || state === 'question') return formatWait(waitedMs);
  if (state === 'archived') return formatDate(archivedAt ?? updatedAt);
  if (state === 'running' || state === 'retrying') return formatDuration(Date.now() - updatedAt);
  return formatClock(updatedAt);
}
