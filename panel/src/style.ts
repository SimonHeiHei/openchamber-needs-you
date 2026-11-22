// All CSS. Colours are host tokens written by applyHostReady; nothing here
// invents a palette. Ported from the approved mockup, scoped to our root.
export const BASE_STYLE = String.raw`
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font-family: var(--oc-font, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
  font-size: 12px;
  line-height: 1.4;
  color: var(--oc-fg);
  background: var(--oc-bg);
  -webkit-font-smoothing: antialiased;
  color-scheme: light dark;
}
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
:focus-visible { outline: none; }
[hidden] { display: none !important; }
.gone {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.num { font-variant-numeric: tabular-nums; }
.mono { font-family: var(--oc-mono); }

/* ---------- state dots: shape + colour, 7px in rows ---------- */
.cr-dot, .bdot { position: relative; flex: none; border-radius: 50%; }
.cr-dot { width: 7px; height: 7px; }
.cr-dot[data-state="permission"], .cr-dot[data-state="question"] {
  background: var(--oc-warning);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--oc-warning) 12%, transparent);
}
.cr-dot[data-state="permission"]::after, .cr-dot[data-state="question"]::after {
  content: ""; position: absolute; inset: -3px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--oc-warning) 70%, transparent);
  animation: cr-halo 2.8s ease-out infinite;
}
.cr-dot[data-state="failed"] { border-radius: 2px; background: var(--oc-error); }
.cr-dot[data-state="running"] { background: var(--oc-info); }
.cr-dot[data-state="running"]::after {
  content: ""; position: absolute; inset: -2px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--oc-info) 60%, transparent);
  animation: cr-breathe 3.6s ease-in-out infinite;
}
.cr-dot[data-state="retrying"] { background: var(--oc-info); }
.cr-dot[data-state="retrying"]::after {
  content: ""; position: absolute; inset: -3px; border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--oc-info) 80%, transparent);
  border-right-color: transparent;
  animation: cr-spin 3s linear infinite;
}
.cr-dot[data-state="done"] { background: transparent; border: 1.5px solid var(--oc-success); }
.cr-dot[data-state="idle"] { background: transparent; border: 1.5px solid color-mix(in srgb, var(--oc-muted) 60%, transparent); }
.cr-dot[data-state="unknown"] { background: transparent; border: 1px dashed var(--oc-muted); }
.cr-dot[data-state="archived"] { width: 6px; height: 6px; background: transparent; border: 1.5px solid var(--oc-muted); }

@keyframes cr-halo { 0% { transform: scale(.9); opacity: .5 } 70% { transform: scale(1.9); opacity: 0 } 100% { opacity: 0 } }
@keyframes cr-breathe { 0%, 100% { opacity: .3 } 50% { opacity: .8 } }
@keyframes cr-spin { to { transform: rotate(360deg) } }
@keyframes cr-skel { 50% { opacity: .45 } }

/* ---------- floating layers: the official chart-tip recipe ---------- */
.float {
  background: var(--oc-elevated);
  color: var(--oc-elevated-fg);
  box-shadow:
    inset 0 1px 0 0 rgb(255 255 255 / .8),
    inset 0 0 0 1px rgb(0 0 0 / .04),
    0 0 0 1px rgb(0 0 0 / .1),
    0 1px 2px -.5px rgb(0 0 0 / .08);
}
:root[data-oc-theme="dark"] .float {
  box-shadow:
    inset 0 1px 0 0 rgb(255 255 255 / .06),
    inset 0 0 0 1px rgb(255 255 255 / .08),
    0 0 0 1px rgb(0 0 0 / .36),
    0 1px 1px -.5px rgb(0 0 0 / .22);
}

/* ---------- shared bits ---------- */
.cr-pill {
  flex: none; padding: 0 5px; border-radius: 4px;
  font-size: 10px; font-weight: 500; line-height: 16px;
  background: color-mix(in srgb, var(--tone, var(--oc-warning)) 14%, transparent);
  color: var(--tone-text, var(--oc-warning-text));
}
.cr-lbl { flex: none; font-size: 11px; font-weight: 600; color: var(--oc-muted); }
.cr-proj { flex: none; white-space: nowrap; }
.cr-sep { opacity: .5; flex: none; }
.cr-branch {
  font-family: var(--oc-mono); font-size: 10.5px; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.wt {
  font-family: var(--oc-mono); font-size: 9.5px; line-height: 16px; padding: 0 4px;
  border-radius: 4px; background: color-mix(in srgb, var(--oc-fg) 6%, transparent);
  color: var(--oc-muted); font-style: normal;
}
.okring {
  width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  border: 1.5px solid var(--oc-success); color: var(--oc-success-text); margin-bottom: 2px;
}
.tri {
  width: 0; height: 0; flex: none;
  border-left: 4px solid currentColor;
  border-top: 3.5px solid transparent; border-bottom: 3.5px solid transparent;
  transition: transform .15s ease;
}
[aria-expanded="true"] > .tri { transform: rotate(90deg); }
.sk { border-radius: 4px; background: color-mix(in srgb, var(--oc-fg) 8%, transparent); animation: cr-skel 1.8s ease-in-out infinite; }
.sk.dot { width: 7px; height: 7px; border-radius: 50%; }
.sk.t1 { height: 9px; width: 62%; }
.sk.t2 { height: 7px; width: 44%; margin-top: 6px; }
.sk.m { height: 7px; width: 40px; }
.skelrow { display: grid; grid-template-columns: 12px 1fr auto; gap: 8px; align-items: center; padding: 7px 6px; min-height: 48px; }

@media (prefers-reduced-motion: reduce) {
  .cr-dot::after, .sk { animation: none !important; }
  .cr-dot[data-state="retrying"]::after { border-right-color: currentColor; opacity: .7; }
  * { transition-duration: 0s !important; }
}
`;

export const PANEL_STYLE = String.raw`
#root.panel-root { padding: 0 0 20px; min-height: 100%; }

.phead {
  display: flex; align-items: center; gap: 2px;
  padding: 11px 10px 0 12px; position: sticky; top: 0; z-index: 3;
  background: var(--oc-bg);
}
.ptitle { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; letter-spacing: -.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.iconbtn { width: 26px; height: 26px; border-radius: 4px; display: grid; place-items: center; color: var(--oc-muted); flex: none; }
.iconbtn:hover, .iconbtn:focus-visible { background: var(--oc-hover); color: var(--oc-fg); }
.iconbtn[aria-expanded="true"] { color: var(--oc-fg); background: var(--oc-active); }

.psum {
  padding: 1px 12px 8px; font-size: 11px; color: var(--oc-muted);
  display: flex; flex-wrap: wrap; gap: 0 4px; align-items: baseline;
}
.psum b { font-weight: 500; font-variant-numeric: tabular-nums; }
.psum .b-warn, .pgsum .b-warn { color: var(--oc-warning-text); }
.psum .b-info, .pgsum .b-info { color: var(--oc-info-text); }
.psum .b-err, .pgsum .b-err { color: var(--oc-error-text); }
.dot-sep {
  display: inline-block; width: 2px; height: 2px; border-radius: 50%;
  background: currentColor; font-size: 0; line-height: 0; vertical-align: middle;
  align-self: center; opacity: .45;
}

.searchrow { padding: 0 12px 8px; }
.searchrow input { height: 32px; }

.pqueue { padding: 0 6px; }

.sect {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 11px 6px 4px; font-size: 11px; font-weight: 600;
  letter-spacing: .02em; text-transform: uppercase; color: var(--oc-muted);
  text-align: left; position: sticky; top: 37px; z-index: 2;
  background: var(--oc-bg);
}
.sect[data-tone="warn"] { color: var(--oc-warning-text); }
.sect[data-tone="err"] { color: var(--oc-error-text); }
.sect .n {
  font-family: var(--oc-mono); font-weight: 400; font-size: 10.5px;
  letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; opacity: .9;
}
.sect .spacer { flex: 1; }
.sect.ended { padding-bottom: 7px; }
.sect.ended:hover { color: var(--oc-fg); }
.sect.morelink { font-weight: 400; text-transform: none; letter-spacing: 0; padding: 2px 6px 6px; }
.sect.morelink:hover { color: var(--oc-fg); }

.waitblock { margin: 0 0 8px; padding: 0 0 4px; border-radius: var(--oc-radius); background: color-mix(in srgb, var(--oc-warning) 6%, transparent); }
.waitblock > .sect { top: 37px; background: color-mix(in srgb, var(--oc-warning) 6%, var(--oc-bg)); }
.nowait { display: flex; align-items: center; gap: 6px; padding: 2px 6px 8px; font-size: 11px; color: var(--oc-muted); }
.nowait .tick { color: var(--oc-success-text); display: grid; place-items: center; }

/* ---------- panel row (48px) ---------- */
.cr-row {
  position: relative; display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  column-gap: 8px; align-items: center;
  padding: 7px 6px; border-radius: 4px; cursor: pointer;
  transition: background .6s ease-out;
}
.cr-row:hover, .cr-row:focus-visible { background: var(--oc-hover); }
.cr-row:active { background: var(--oc-active); }
.cr-row.cr-fresh { background: color-mix(in srgb, var(--oc-warning) 8%, transparent); }
.cr-main { min-width: 0; }
.cr-title { display: block; font-size: 12px; font-weight: 400; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cr-row[data-state="permission"] .cr-title,
.cr-row[data-state="question"] .cr-title { font-weight: 500; }
.cr-row[data-state="done"] .cr-title,
.cr-row[data-state="idle"] .cr-title,
.cr-row[data-state="unknown"] .cr-title { color: color-mix(in srgb, var(--oc-fg) 74%, transparent); }
.cr-sub { display: flex; align-items: center; gap: 5px; min-width: 0; margin-top: 1px; font-size: 11px; line-height: 1.35; color: var(--oc-muted); }
.cr-meta {
  font-family: var(--oc-mono); font-size: 10.5px; color: var(--oc-muted);
  font-variant-numeric: tabular-nums; white-space: nowrap;
  transition: opacity .12s ease; padding-right: 2px;
}
.cr-wait { color: var(--oc-warning-text); }
.cr-wait[data-age="1"] { font-weight: 600; }
.cr-more {
  position: absolute; right: 3px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border-radius: 4px; display: grid;
  place-items: center; color: var(--oc-muted); opacity: 0;
  transition: opacity .12s ease, background .12s ease; background: transparent;
}
.cr-row:hover .cr-more, .cr-row:focus-within .cr-more { opacity: 1; }
.cr-row:hover .cr-meta, .cr-row:focus-within .cr-meta { opacity: 0; }
.cr-more:hover, .cr-more:focus-visible { background: var(--oc-active); color: var(--oc-fg); }

/* group header: the official twist, on the row's trailing edge */
.cr-row[data-group="true"] .cr-meta { padding-right: 26px; }
.cr-row[data-group="true"] .cr-more { right: 29px; }
.cr-twist {
  position: absolute; right: 2px; top: 50%; transform: translateY(-50%);
  width: 24px; height: 24px; border-radius: 4px; display: grid; place-items: center;
  color: var(--oc-muted);
}
.cr-twist:hover, .cr-twist:focus-visible { background: var(--oc-active); color: var(--oc-fg); }
.cr-twist .tri { border-left-width: 4px; border-top-width: 3.5px; border-bottom-width: 3.5px; }

/* child rows: indented, behind the official 2px group rail */
.cr-children { margin: 0 0 0 10px; padding-left: 8px; border-left: 2px solid color-mix(in srgb, var(--oc-fg) 40%, transparent); }
.cr-child { padding-left: 4px; }

.endedbox { padding-bottom: 2px; }

.pfoot {
  font-variant-numeric: tabular-nums;
  margin-top: 2px; padding: 9px 12px 10px; border-top: 1px solid var(--oc-border);
  font-size: 10.5px; color: var(--oc-muted); line-height: 1.6;
}
.pfoot .row2 { display: flex; gap: 8px; align-items: baseline; }
.pfoot .grow { flex: 1; }
.emptylist { padding: 14px 8px; text-align: center; font-size: 11px; color: var(--oc-muted); }

/* good news: one quiet ring, two lines */
.goodnews { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 5px; padding: 18px 14px 12px; }
.goodnews h4 { margin: 0; font-size: 12px; font-weight: 600; }
.goodnews p { margin: 0; font-size: 11px; color: var(--oc-muted); line-height: 1.6; max-width: none; }
.goodnews .endedline { font-size: 10.5px; color: var(--oc-muted); margin-top: 2px; font-family: var(--oc-mono); }

.banner-slot { padding: 0 12px 8px; }
.empty-slot { padding: 4px 12px 8px; }

/* row menu (desktop) and action sheet (touch) */
.rowmenu {
  position: fixed; z-index: 40; min-width: 156px; padding: 4px; border-radius: 6px;
  display: flex; flex-direction: column; gap: 1px;
}
.rowmenu button {
  display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 8px;
  border-radius: 4px; font-size: 11px; text-align: left; white-space: nowrap;
}
.rowmenu button:hover, .rowmenu button:focus-visible { background: var(--oc-hover); }
.rowmenu svg { color: var(--oc-muted); flex: none; }

.sheet-layer { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; justify-content: flex-end; }
.sheet-scrim { position: absolute; inset: 0; background: rgb(0 0 0 / .42); }
:root[data-oc-theme="light"] .sheet-scrim { background: rgb(0 0 0 / .3); }
.sheet {
  position: relative; border-radius: 12px 12px 0 0;
  padding: 5px 8px calc(12px + var(--safe-bottom, 0px));
  animation: cr-sheet .24s ease-out;
}
@keyframes cr-sheet { from { transform: translateY(24px); opacity: .6 } to { transform: none; opacity: 1 } }
.grab { width: 36px; height: 4px; border-radius: 2px; background: color-mix(in srgb, var(--oc-fg) 14%, transparent); margin: 3px auto 9px; }
.sheet-title { padding: 0 8px 7px; font-size: 10.5px; color: var(--oc-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sact { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 8px; font-size: 12px; width: 100%; text-align: left; border-radius: 4px; }
.sact + .sact { border-top: 1px solid var(--oc-border); }
.sact:hover, .sact:focus-visible { background: var(--oc-hover); }
.sact svg { color: var(--oc-muted); flex: none; }

/* ---------- touch / narrow ---------- */
:root[data-pointer="coarse"] .cr-row { min-height: 52px; }
:root[data-pointer="coarse"] .cr-title { font-size: 13px; }
:root[data-pointer="coarse"] .cr-sub { font-size: 11.5px; }
:root[data-pointer="coarse"] .cr-meta { font-size: 11px; padding-right: 30px; }
:root[data-pointer="coarse"] .cr-branch, :root[data-pointer="coarse"] .cr-sub .cr-sep { display: none; }
:root[data-pointer="coarse"] .cr-more { opacity: 1; width: 44px; height: 44px; right: -4px; }
:root[data-pointer="coarse"] .cr-row .cr-meta { opacity: 1; }
:root[data-pointer="coarse"] .searchrow input { height: 40px; }
:root[data-pointer="coarse"] .pfoot { padding-bottom: calc(10px + var(--safe-bottom, 0px)); }

@media (pointer: coarse) {
  .cr-row { min-height: 52px; }
  .cr-title { font-size: 13px; }
  .cr-sub { font-size: 11.5px; }
  .cr-meta { font-size: 11px; padding-right: 30px; }
  .cr-branch, .cr-sub .cr-sep { display: none; }
  .cr-more { opacity: 1; width: 44px; height: 44px; right: -4px; }
  .cr-row .cr-meta { opacity: 1; }
  .searchrow input { height: 40px; }
  .pfoot { padding-bottom: calc(10px + var(--safe-bottom, 0px)); }
}
@media (max-width: 340px) {
  .cr-proj { max-width: 96px; overflow: hidden; text-overflow: ellipsis; }
}
`;

export const PAGE_STYLE = String.raw`
#root.page-root { padding: 16px 20px calc(28px + var(--safe-bottom, 0px)); max-width: 1480px; margin: 0 auto; }

.pghead { display: flex; align-items: baseline; gap: 8px; }
.pgtitle { font-size: 14px; font-weight: 600; letter-spacing: -.005em; flex: 1; min-width: 0; }
.pgupd { font-family: var(--oc-mono); font-size: 10.5px; color: var(--oc-muted); }
.pgsum { margin-top: 3px; font-size: 11px; color: var(--oc-muted); }
.pgsum b { font-weight: 500; font-variant-numeric: tabular-nums; }

.pgtools { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.pgtools .searchslot { margin-left: auto; min-width: 200px; }
.pgtools .searchslot input { height: 30px; }

.railcards {
  display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x proximity;
  margin: 12px -20px 0; padding: 1px 20px 6px;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 44px), transparent 100%);
  mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 44px), transparent 100%);
}
.railcards::-webkit-scrollbar { display: none; }
.railcards.few { -webkit-mask-image: none; mask-image: none; }
.ncard {
  flex: 0 0 292px; scroll-snap-align: start; position: relative; min-width: 0;
  padding: 8px 12px 9px 12px; border-radius: var(--oc-radius);
  background: color-mix(in srgb, var(--oc-fg) 4%, transparent);
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--tone, var(--oc-fg)) 40%, transparent);
  transition: background .15s ease; cursor: pointer;
}
.ncard:hover, .ncard:focus-visible { background: color-mix(in srgb, var(--oc-fg) 6%, transparent); }
.nc-top { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--oc-muted); }
.nc-proj { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nc-wait { margin-left: auto; font-family: var(--oc-mono); color: var(--tone-text); font-variant-numeric: tabular-nums; white-space: nowrap; }
.nc-title {
  margin-top: 4px; font-size: 13px; font-weight: 600; line-height: 1.4; letter-spacing: -.005em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.nc-bot { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 10.5px; color: var(--oc-muted); min-width: 0; }
.nc-branch { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--oc-mono); }
.nc-open { margin-left: auto; color: color-mix(in srgb, var(--oc-fg) 82%, transparent); white-space: nowrap; }
.ncard:hover .nc-open { color: var(--oc-fg); }

.boardhead { display: flex; align-items: baseline; gap: 8px; margin-top: 16px; }
.boardhead h3 { margin: 0; font-size: 11px; font-weight: 600; color: var(--oc-muted); letter-spacing: .02em; text-transform: uppercase; }
.boardhead .meta { margin-left: auto; font-size: 10.5px; color: var(--oc-muted); font-family: var(--oc-mono); }

.board { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 10px; margin-top: 8px; align-items: start; }
.pcard { background: color-mix(in srgb, var(--oc-fg) 4%, transparent); border-radius: var(--oc-radius); padding: 10px 10px 4px; min-width: 0; }
.pchead { display: flex; align-items: center; gap: 5px; padding: 2px 4px 5px; width: 100%; text-align: left; }
.pname { flex: 1; min-width: 0; font-size: 12px; font-weight: 600; letter-spacing: -.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pchead .tri { margin-left: 2px; color: var(--oc-muted); }
.chipb {
  flex: none; font-size: 10px; font-weight: 500; line-height: 16px; padding: 0 5px;
  border-radius: 4px; background: color-mix(in srgb, var(--tone, var(--oc-fg)) 14%, transparent);
  color: var(--tone-text, var(--oc-muted)); font-variant-numeric: tabular-nums;
}
.pcard .skelhead { padding: 2px 4px 8px; }
.pcard[data-collapsed="true"] .pcardbody, .pcard[data-collapsed="true"] .pcfoot { display: none; }

.brow {
  display: grid; grid-template-columns: 11px minmax(0, 1fr) auto auto;
  column-gap: 6px; align-items: center; height: 28px; padding: 0 4px; border-radius: 4px;
  cursor: pointer;
}
.b-twist { width: 24px; height: 24px; border-radius: 4px; display: grid; place-items: center; color: var(--oc-muted); }
.b-twist:hover, .b-twist:focus-visible { background: var(--oc-active); color: var(--oc-fg); }
.bchildren { margin-left: 12px; padding-left: 6px; border-left: 2px solid color-mix(in srgb, var(--oc-fg) 40%, transparent); }
.brow:hover, .brow:focus-visible { background: var(--oc-hover); }
.bdot { width: 6px; height: 6px; }
.bdot[data-state="permission"], .bdot[data-state="question"] { background: var(--oc-warning); }
.bdot[data-state="failed"] { border-radius: 1.5px; background: var(--oc-error); }
.bdot[data-state="running"], .bdot[data-state="retrying"] { background: var(--oc-info); }
.bdot[data-state="retrying"]::after {
  content: ""; position: absolute; inset: -2px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--oc-info) 80%, transparent);
  border-right-color: transparent; animation: cr-spin 3s linear infinite;
}
.bdot[data-state="done"] { background: transparent; border: 1px solid var(--oc-success); }
.bdot[data-state="idle"], .bdot[data-state="unknown"] { background: transparent; border: 1px solid color-mix(in srgb, var(--oc-muted) 65%, transparent); }
.bdot[data-state="unknown"] { border-style: dashed; }
.bdot[data-state="archived"] { background: transparent; border: 1px solid var(--oc-muted); opacity: .7; }
.btitle {
  font-size: 11.5px; line-height: 1.3; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.btitle .child-mark { color: var(--oc-muted); margin-right: 3px; }
.brow[data-state="failed"] .btitle { color: color-mix(in srgb, var(--oc-fg) 90%, transparent); }
.brow[data-state="done"] .btitle, .brow[data-state="idle"] .btitle, .brow[data-state="unknown"] .btitle { color: color-mix(in srgb, var(--oc-fg) 74%, transparent); }
.brow[data-archived="true"] { opacity: .6; }
.bmeta { font-family: var(--oc-mono); font-size: 10px; color: var(--oc-muted); font-variant-numeric: tabular-nums; }
.bmeta.wait { color: var(--oc-warning-text); }

.pcfoot { display: flex; align-items: center; gap: 6px; padding: 3px 4px 6px; font-size: 10px; color: var(--oc-muted); }
.pcfoot .link { color: var(--oc-muted); font-size: 10px; }
.pcfoot .link:hover, .pcfoot .link:focus-visible { color: var(--oc-fg); }
.pcfoot .sep-dot { opacity: .5; }
.pcfoot .grow { flex: 1; }
.pcard .project-error { padding: 6px 4px 8px; font-size: 11px; color: var(--oc-muted); }
.pcard .project-error button { color: var(--oc-warning-text); font-size: 11px; }
.pcard .project-error button:hover { text-decoration: underline; }

.boardfoot {
  display: flex; align-items: center; gap: 10px; margin-top: 12px;
  padding: 9px 4px 2px; border-top: 1px solid var(--oc-border);
  font-size: 11px; color: var(--oc-muted); flex-wrap: wrap;
}
.boardfoot .link { color: color-mix(in srgb, var(--oc-fg) 80%, transparent); }
.boardfoot .link:hover, .boardfoot .link:focus-visible { color: var(--oc-fg); }
.boardfoot .grow { flex: 1; }
.boardfoot .tri { margin-left: 5px; color: currentColor; display: inline-block; vertical-align: middle; }

.others { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px 12px; margin: 8px 0 2px; padding: 8px 2px 0; border-top: 1px solid var(--oc-border); }
.orow { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 10.5px; color: var(--oc-muted); min-width: 0; }
.orow b { font-weight: 500; color: color-mix(in srgb, var(--oc-fg) 80%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.orow span { flex: none; font-family: var(--oc-mono); font-size: 9.5px; }
.orow button { flex: none; font-size: 10px; color: var(--oc-info-text); }
.orow button:disabled { color: var(--oc-muted); cursor: default; opacity: .6; }

.unconnected { margin-top: 6px; }
.unconnected .orow { border-top: 1px solid var(--oc-border); padding: 6px 0; }
.unconnected .orow:first-child { border-top: 0; }

@media (pointer: coarse), (max-width: 640px) {
  #root.page-root { padding: 14px 14px calc(24px + var(--safe-bottom, 0px)); }
  .railcards { flex-direction: column; overflow: visible; margin: 12px -14px 0; padding: 1px 14px 6px; -webkit-mask-image: none; mask-image: none; scroll-snap-type: none; }
  .ncard { flex: none; width: 100%; }
  .board { grid-template-columns: minmax(0, 1fr); }
  .others { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pgtools .searchslot { width: 100%; margin-left: 0; }
  .brow { height: 34px; }
}
`;

export const STATUS_STYLE = String.raw`
#root.status-root { padding: 0; }
.strip {
  display: grid; grid-template-columns: 12px minmax(0, 1fr) auto;
  grid-template-areas: "dot title action" "dot sub sub";
  align-items: center; column-gap: 8px; row-gap: 2px;
  height: 76px; padding: 10px 12px 12px; border-radius: var(--oc-radius);
  text-align: left; width: 100%; cursor: pointer; background: transparent;
}
.strip:hover, .strip:focus-visible { background: var(--oc-hover); }
.strip[data-tone="warn"] { background: color-mix(in srgb, var(--oc-warning) 6%, transparent); }
.strip[data-tone="warn"]:hover, .strip[data-tone="warn"]:focus-visible { background: color-mix(in srgb, var(--oc-warning) 6%, var(--oc-hover)); }
.strip .dot-slot { grid-area: dot; align-self: start; margin-top: 6px; display: grid; place-items: center; }
.strip-main { display: contents; }
.strip-title .sk { display: block; }
.strip-title { grid-area: title; font-variant-numeric: tabular-nums; font-size: 12px; font-weight: 600; letter-spacing: -.005em; line-height: 1.4; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.strip-title .b-warn { color: var(--oc-warning-text); font-variant-numeric: tabular-nums; }
.strip-sub { grid-area: sub; font-variant-numeric: tabular-nums; font-size: 11px; color: var(--oc-muted); line-height: 1.4; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.strip-sub .b-err { color: var(--oc-error-text); }
.strip-sub .b-ok { color: var(--oc-success); }
.strip-open { grid-area: action; font-size: 11px; color: var(--oc-muted); white-space: nowrap; pointer-events: none; }
.strip:hover .strip-open, .strip:focus-visible .strip-open { color: var(--oc-fg); }
.strip[aria-busy="true"] { cursor: default; }
.strip[aria-busy="true"] .strip-main { display: flex; flex-direction: column; gap: 6px; grid-column: 2 / 3; grid-row: 1 / 3; }
.strip[aria-busy="true"] .strip-open { color: var(--oc-muted); }
.strip[data-tone="warn"] .strip-open { color: var(--oc-warning-text); }
`;
