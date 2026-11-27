"use strict";
(() => {
  // node_modules/@openchamber/sdk/dist/api-version.js
  var OPENCHAMBER_SDK_CHANNEL = "openchamber.sdk";
  var OPENCHAMBER_SDK_API_VERSION = 1;

  // node_modules/@openchamber/sdk/dist/scrollbar-style.js
  var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
  var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
  function installGuestScrollbarActivity(doc) {
    const root2 = doc.documentElement;
    if (root2.hasAttribute("data-oc-scrollbar-activity"))
      return;
    root2.setAttribute("data-oc-scrollbar-activity", "");
    const timers = /* @__PURE__ */ new WeakMap();
    doc.addEventListener("scroll", (event) => {
      const target = event.target === doc ? root2 : event.target;
      if (!(target instanceof Element))
        return;
      if (!target.hasAttribute("data-oc-scrolling"))
        target.setAttribute("data-oc-scrolling", "");
      const pending = timers.get(target);
      if (pending !== void 0)
        clearTimeout(pending);
      timers.set(target, setTimeout(() => {
        timers.delete(target);
        target.removeAttribute("data-oc-scrolling");
      }, 1e3));
    }, { capture: true, passive: true });
  }
  var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;

  // node_modules/@openchamber/sdk/dist/workspace.js
  var GUEST_STORAGE_KEY_MAX = 128;
  var GUEST_STORAGE_VALUE_BYTES = 65536;

  // node_modules/@openchamber/sdk/dist/shells.js
  var GUEST_SHELL_ID_MAX = 128;
  var GUEST_SHELL_OUTPUT_TAIL_MAX = 65536;

  // node_modules/@openchamber/sdk/dist/microphone.js
  var GUEST_MICROPHONE_SAMPLE_RATE_MIN = 8e3;
  var GUEST_MICROPHONE_SAMPLE_RATE_MAX = 192e3;
  var GUEST_MICROPHONE_OPEN_TIMEOUT_MS = 12e4;
  var createSampleQueue = (capacity) => {
    const chunks = [];
    let offset = 0;
    let queued = 0;
    return {
      push: (samples) => {
        chunks.push(samples);
        queued += samples.length;
        while (queued - offset > capacity && chunks.length > 1) {
          const dropped = chunks.shift();
          queued -= dropped?.length ?? 0;
          offset = 0;
        }
      },
      pull: (out) => {
        let written = 0;
        while (written < out.length && chunks.length > 0) {
          const head = chunks[0];
          const count = Math.min(out.length - written, head.length - offset);
          out.set(head.subarray(offset, offset + count), written);
          written += count;
          offset += count;
          if (offset >= head.length) {
            chunks.shift();
            queued -= head.length;
            offset = 0;
          }
        }
        out.fill(0, written);
      },
      clear: () => {
        chunks.length = 0;
        offset = 0;
        queued = 0;
      },
      get size() {
        return queued - offset;
      }
    };
  };

  // node_modules/@openchamber/sdk/dist/status-controls.js
  var GUEST_STATUS_CONTROLS_MAX = 4;
  var GUEST_STATUS_CONTROL_ID = /^[a-z][a-z0-9-]{0,39}$/;
  var GUEST_STATUS_CONTROL_LABEL_MAX = 60;
  var GUEST_STATUS_CONTROL_OPTIONS_MAX = 16;
  var GUEST_STATUS_CONTROL_VALUE_MAX = 80;
  var isControlObject = (value) => Object(value) === value && !Array.isArray(value);
  var hasOnlyKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key));
  var isLabel = (value) => String(value) === value && value.length >= 1 && value.length <= GUEST_STATUS_CONTROL_LABEL_MAX;
  var isValue = (value) => String(value) === value && value.length >= 1 && value.length <= GUEST_STATUS_CONTROL_VALUE_MAX;
  var isGuestStatusControls = (controls) => {
    if (!Array.isArray(controls) || controls.length > GUEST_STATUS_CONTROLS_MAX)
      return false;
    const ids = /* @__PURE__ */ new Set();
    for (const control of controls) {
      if (!isControlObject(control) || !GUEST_STATUS_CONTROL_ID.test(control.id) || !isLabel(control.label))
        return false;
      if (control.disabled !== void 0 && control.disabled !== true && control.disabled !== false)
        return false;
      if (ids.has(control.id))
        return false;
      ids.add(control.id);
      if (control.kind === "button") {
        if (!hasOnlyKeys(control, ["kind", "id", "label", "disabled"]))
          return false;
        continue;
      }
      if (control.kind !== "select" || !hasOnlyKeys(control, ["kind", "id", "label", "value", "options", "disabled"]))
        return false;
      if (!isValue(control.value) || !Array.isArray(control.options) || control.options.length < 1 || control.options.length > GUEST_STATUS_CONTROL_OPTIONS_MAX)
        return false;
      const values = /* @__PURE__ */ new Set();
      for (const option of control.options) {
        if (!isControlObject(option) || !hasOnlyKeys(option, ["value", "label"]) || !isValue(option.value) || !isLabel(option.label) || values.has(option.value))
          return false;
        values.add(option.value);
      }
      if (!values.has(control.value))
        return false;
    }
    return true;
  };

  // node_modules/@openchamber/sdk/dist/manifest.js
  var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
  var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
  var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);

  // node_modules/@openchamber/sdk/dist/session-events.js
  var GUEST_SESSION_EVENT_TYPES = [
    "turn-finished",
    "turn-failed",
    "permission-asked",
    "question-asked",
    "turn-started",
    "session-created",
    "session-archived",
    "session-deleted"
  ];
  var SESSION_EVENTS_IDLE_MS = 10 * 6e4;
  var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);

  // node_modules/@openchamber/sdk/dist/service-host.js
  var SERVICE_SCHEDULE_IDLE_MS = 10 * 6e4;
  var MENTIONS_IDLE_MS = 10 * 6e4;

  // node_modules/@openchamber/sdk/dist/file-editor.js
  var GUEST_FILE_EDITOR_CONTENT_MAX = 2e7;
  var GUEST_FILE_EDITOR_VERSION_MAX = 256;
  var fileEditorPayloadSize = (value) => "bytes" in value ? value.bytes.byteLength : value.content.length;
  var sameFileEditorDocument = (left, right) => {
    if (left.path !== right.path || left.readOnly !== right.readOnly)
      return false;
    if (left.encoding === "text" || right.encoding === "text") {
      return left.encoding === "text" && right.encoding === "text" && left.content === right.content;
    }
    if (left.bytes.byteLength !== right.bytes.byteLength)
      return false;
    for (let index = 0; index < left.bytes.byteLength; index += 1) {
      if (left.bytes[index] !== right.bytes[index])
        return false;
    }
    return true;
  };

  // node_modules/@openchamber/sdk/dist/popover.js
  var GUEST_POPOVER_ID = /^[A-Za-z0-9_-]{1,80}$/;
  var GUEST_POPOVER_COORDINATE_MAX = 1e5;
  var GUEST_POPOVER_WIDTH_MIN = 160;
  var GUEST_POPOVER_WIDTH_MAX = 640;
  var GUEST_POPOVER_HEIGHT_MIN = 48;
  var GUEST_POPOVER_HEIGHT_MAX = 480;
  var GUEST_POPOVER_DATA_MAX = 16e3;
  var GUEST_POPOVER_DATA_DEPTH_MAX = 32;
  var GUEST_POPOVER_SIDES = ["left", "right", "top", "bottom"];
  var hasBoundedJsonTree = (value, depth = 0, budget = { remaining: GUEST_POPOVER_DATA_MAX }) => {
    if (--budget.remaining < 0 || depth >= GUEST_POPOVER_DATA_DEPTH_MAX)
      return false;
    if (value === null)
      return true;
    const children = Array.isArray(value) ? value : Object(value) === value ? Object.values(value) : [];
    for (const item of children) {
      if (!hasBoundedJsonTree(item, depth + 1, budget))
        return false;
    }
    return true;
  };
  var isFiniteJson = (value) => {
    if (value === null || value === true || value === false)
      return true;
    if (Array.isArray(value))
      return Object.keys(value).every((key) => /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length) && value.every(isFiniteJson);
    if (Object(value) === value) {
      const prototype = Object.getPrototypeOf(value);
      return (prototype === null || prototype === Object.prototype) && Object.values(value).every(isFiniteJson);
    }
    return String(value) === value || Number.isFinite(value);
  };
  var isGuestPopoverRequest = (request) => {
    try {
      if (String(request.id) !== request.id || !GUEST_POPOVER_ID.test(request.id) || !Number.isFinite(request.anchor.x) || Math.abs(request.anchor.x) > GUEST_POPOVER_COORDINATE_MAX || !Number.isFinite(request.anchor.y) || Math.abs(request.anchor.y) > GUEST_POPOVER_COORDINATE_MAX || !Number.isFinite(request.anchor.width) || !Number.isFinite(request.anchor.height) || request.anchor.width <= 0 || request.anchor.height <= 0 || request.anchor.width > GUEST_POPOVER_COORDINATE_MAX || request.anchor.height > GUEST_POPOVER_COORDINATE_MAX || !Number.isInteger(request.width) || request.width < GUEST_POPOVER_WIDTH_MIN || request.width > GUEST_POPOVER_WIDTH_MAX || !Number.isInteger(request.height) || request.height < GUEST_POPOVER_HEIGHT_MIN || request.height > GUEST_POPOVER_HEIGHT_MAX || request.side !== void 0 && !GUEST_POPOVER_SIDES.includes(request.side) || request.focus !== void 0 && request.focus !== true && request.focus !== false || !hasBoundedJsonTree(request.data) || !isFiniteJson(request.data))
        return false;
      return JSON.stringify(request.data).length <= GUEST_POPOVER_DATA_MAX;
    } catch {
      return false;
    }
  };

  // node_modules/@openchamber/sdk/dist/contract.js
  var GUEST_BLOCK_ANSWER_MAX = 2e3;
  var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
  var isStartSessionResult = (value) => Boolean(value && "sessionId" in value);
  var isPromptResult = (value) => Boolean(value && "sent" in value && !("sessionId" in value));
  var GUEST_COMMIT_SHA = /^[0-9a-f]{7,64}$/i;
  var isGuestCommitSha = (value) => GUEST_COMMIT_SHA.test(value);
  var GUEST_TOAST_MAX = 500;
  var GUEST_CLIPBOARD_TEXT_MAX = 32e3;
  var GUEST_COMPOSE_TEXT_MAX = 16e3;
  var GUEST_ATTACH_ID_MAX = 128;
  var GUEST_ATTACH_TITLE_MAX = 200;
  var GUEST_ATTACH_URL_MAX = 2e3;
  var GUEST_ATTACH_TEXT_MAX = 16e3;
  var GUEST_ATTACH_AUTHOR_MAX = 80;
  var GUEST_ATTACH_BRANCH_MAX = 200;
  var GUEST_ATTACH_DATA_MAX = 16e3;
  var GUEST_REQUEST_PATH_MAX = 2e3;
  var GUEST_REQUEST_TIMEOUT_MS = 2e4;
  var GUEST_FILE_PATH_MAX = 1024;
  var GUEST_FILE_CONTENT_MAX = 2e6;
  var GUEST_GENERATE_PROMPT_MAX = 64e3;
  var GUEST_GENERATE_SYSTEM_MAX = 8e3;
  var GUEST_GENERATE_OUTPUT_TOKENS_MAX = 4e3;
  var GUEST_GENERATE_TIMEOUT_MS = 96e4;
  var GUEST_GENERATE_LATE_KEEP_MS = 60 * 6e4;
  var GUEST_BADGE_MAX = 999;
  var GUEST_FRAME_HEIGHT_MAX = 1e4;
  var GUEST_RESOLVE_ERROR_MAX = 500;
  var HOST_REQUEST_ERROR_CODES = [
    "HOST_UNAVAILABLE",
    "HOST_TIMEOUT",
    "HOST_REJECTED",
    "DISCONNECTED",
    "DISABLED",
    "BAD_PATH",
    "NO_INTEGRATION",
    "NO_SERVICE",
    "SERVICE_FAILED",
    "REQUEST_FAILED",
    "RESPONSE_TOO_LARGE",
    "NO_SESSION",
    "SESSION_BUSY",
    "NOT_GRANTED",
    "NO_DIRECTORY",
    "NOT_FOUND",
    "FILE_TOO_LARGE",
    "DENIED",
    "NO_MODEL",
    "MODEL_FAILED",
    "UNSUPPORTED"
  ];
  var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
  var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
  var isHostRequestErrorCode = (value) => hostRequestErrorCodeSet.has(value);
  var resolveHostRequestErrorCode = (value) => value && isHostRequestErrorCode(value) ? value : "HOST_REJECTED";
  var isJsonValue = (value) => {
    if (value === void 0)
      return false;
    if (value === null || value === true || value === false)
      return true;
    if (String(value) === value)
      return true;
    if (Number(value) === value)
      return Number.isFinite(value);
    if (Array.isArray(value))
      return value.every(isJsonValue);
    if (Object(value) === value)
      return Object.values(value).every(isJsonValue);
    return false;
  };
  var isAttachData = (value) => isJsonValue(value) && JSON.stringify(value).length <= GUEST_ATTACH_DATA_MAX;
  var clampBranch = (value) => value?.trim().slice(0, GUEST_ATTACH_BRANCH_MAX) ?? "";
  var clampAttachRequest = (request) => {
    const id = request.id.trim().slice(0, GUEST_ATTACH_ID_MAX);
    const title = request.title.trim().slice(0, GUEST_ATTACH_TITLE_MAX);
    const url = request.url.trim().slice(0, GUEST_ATTACH_URL_MAX);
    const text = request.text?.trim().slice(0, GUEST_ATTACH_TEXT_MAX);
    const author = request.author?.trim().slice(0, GUEST_ATTACH_AUTHOR_MAX);
    const kind = request.kind === "pull" ? "pull" : "issue";
    const next = {
      providerId: request.providerId.trim(),
      id,
      title: title || id,
      url,
      kind
    };
    if (text) {
      next.text = text;
    }
    if (author) {
      next.author = author;
    }
    if (kind === "pull") {
      const head = clampBranch(request.branches?.head);
      const base = clampBranch(request.branches?.base);
      if (head && base) {
        next.branches = { head, base };
      }
    }
    if (isAttachData(request.data)) {
      next.data = request.data;
    }
    return next;
  };
  var clampStartSessionRequest = (request) => {
    const next = clampAttachRequest(request);
    if (request.projectId)
      next.projectId = request.projectId;
    if (request.navigation)
      next.navigation = request.navigation;
    if (request.worktree) {
      next.worktree = request.worktree;
    }
    return next;
  };
  var clampPromptRequest = (request) => {
    const next = {
      text: request.text.trim().slice(0, GUEST_COMPOSE_TEXT_MAX)
    };
    if (request.send) {
      next.send = true;
    }
    return next;
  };
  var clampBadgeCount = (count) => {
    if (count === null || !Number.isFinite(count))
      return null;
    return Math.min(GUEST_BADGE_MAX, Math.max(0, Math.round(count)));
  };
  var clampFrameHeight = (height) => {
    if (!Number.isFinite(height))
      return 0;
    return Math.min(GUEST_FRAME_HEIGHT_MAX, Math.max(0, Math.ceil(height)));
  };
  var isGuestFilePath = (value) => value.length > 0 && value.length <= GUEST_FILE_PATH_MAX && !value.includes("\0") && !value.includes("\\");
  var isGuestRequestPath = (value) => {
    if (!value.startsWith("/") || value.includes("\0") || value.includes("\\") || value.includes("://")) {
      return false;
    }
    if (value.length > GUEST_REQUEST_PATH_MAX) {
      return false;
    }
    const segments = value.split("/");
    return !segments.some((segment) => segment === "." || segment === "..");
  };
  var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
  var isServiceStatusResult = (value) => Boolean(value && "status" in value && serviceStatusSet.has(String(value.status)) && !("body" in value));
  var isGuestRequestResult = (value) => Boolean(value && "status" in value && "body" in value && Number.isInteger(value.status));
  var isFileReadResult = (value) => Boolean(value && "content" in value && String(value.content) === value.content);
  var isFileWriteResult = (value) => Boolean(value && "written" in value && value.written === true);
  var isFileListResult = (value) => Boolean(value && "entries" in value && Array.isArray(value.entries));
  var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
  var isFileStatResult = (value) => Boolean(value && "kind" in value && "size" in value && fileStatKindSet.has(String(value.kind)) && Number.isFinite(value.size));
  var isGenerateResult = (value) => Boolean(value && "text" in value && String(value.text) === value.text && !("status" in value));
  var HOST_PUSH_TYPES = /* @__PURE__ */ new Set([
    "workspace",
    "shells",
    "ready",
    "directory",
    "session",
    "connection",
    "settings",
    "session-lifecycle",
    "item",
    "resolve",
    "action",
    "service-event",
    "status-control-event",
    "popover-closed",
    "file-open",
    "file-snapshot",
    "file-saved",
    "generate-late",
    "microphone-audio",
    "microphone-ended"
  ]);
  var asWireRecord = (data) => Object(data) === data ? data : null;
  var isNonEmptyString = (value) => String(value) === value && value.length > 0;
  var readResultMessage = (wire) => {
    if (!isNonEmptyString(wire.id))
      return null;
    if (wire.ok === true) {
      const message = {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: true
      };
      if (Object(wire.payload) === wire.payload) {
        message.payload = wire.payload;
      }
      return message;
    }
    if (wire.ok === false && isNonEmptyString(wire.error)) {
      return {
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "result",
        id: wire.id,
        ok: false,
        error: wire.error,
        code: resolveHostRequestErrorCode(isNonEmptyString(wire.code) ? wire.code : void 0)
      };
    }
    return null;
  };
  var readHostMessage = (data) => {
    const wire = asWireRecord(data);
    if (!wire || wire.channel !== OPENCHAMBER_SDK_CHANNEL || wire.v !== OPENCHAMBER_SDK_API_VERSION)
      return null;
    if (wire.type === "result")
      return readResultMessage(wire);
    if (!HOST_PUSH_TYPES.has(String(wire.type)) || Object(wire.payload) !== wire.payload)
      return null;
    return wire;
  };

  // node_modules/@openchamber/sdk/dist/host.js
  var isKeyEvent = (event) => "key" in event && "metaKey" in event && "ctrlKey" in event;
  var isSaveShortcut = (event) => (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s";
  var HostRequestError = class extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "HostRequestError";
      this.code = code;
    }
  };
  var rejectBadPath = () => Promise.reject(new HostRequestError("BAD_PATH", 'Request path must start with "/" and stay on the declared origin.'));
  var rejectBadFilePath = () => Promise.reject(new HostRequestError("BAD_PATH", `File path must be 1 to ${GUEST_FILE_PATH_MAX} characters without NUL or backslash.`));
  var deviceStorageScope = (options) => {
    if (options === void 0)
      return void 0;
    if (Object(options) !== options || Array.isArray(options) || options.scope !== void 0 && options.scope !== "instance" && options.scope !== "device") {
      throw new HostRequestError("HOST_REJECTED", 'Storage scope must be "instance" or "device".');
    }
    return options.scope === "device" ? "device" : void 0;
  };
  var nextId = (n) => {
    n.value += 1;
    return `oc-${n.value}`;
  };
  var connectHost = (options = {}) => {
    const target = options.target ?? ("window" in globalThis ? window : null);
    if (!target) {
      throw new HostRequestError("HOST_UNAVAILABLE", "No window. connectHost runs in a browser frame.");
    }
    const acceptSource = options.acceptSource ?? ((source) => source === target.parent);
    const requestTimeoutMs = options.requestTimeoutMs ?? GUEST_REQUEST_TIMEOUT_MS;
    const readyListeners = /* @__PURE__ */ new Set();
    const directoryListeners = /* @__PURE__ */ new Set();
    const sessionListeners = /* @__PURE__ */ new Set();
    const lifecycleListeners = /* @__PURE__ */ new Set();
    const connectionListeners = /* @__PURE__ */ new Set();
    const settingsListeners = /* @__PURE__ */ new Set();
    const itemListeners = /* @__PURE__ */ new Set();
    const blockListeners = /* @__PURE__ */ new Set();
    const serviceEventListeners = /* @__PURE__ */ new Set();
    const statusControlListeners = /* @__PURE__ */ new Set();
    const popoverClosedListeners = /* @__PURE__ */ new Set();
    const lateGenerateListeners = /* @__PURE__ */ new Set();
    const unclaimedLateGenerate = [];
    let resolveHandler = null;
    let actionHandler = null;
    const fileOpenListeners = /* @__PURE__ */ new Set();
    const fileSavedListeners = /* @__PURE__ */ new Set();
    let fileSnapshotHandler = null;
    let lastFile = null;
    let saveShortcutInstalled = false;
    const pending = /* @__PURE__ */ new Map();
    const workspaceListeners = /* @__PURE__ */ new Map();
    const shellsListeners = /* @__PURE__ */ new Map();
    let disposed = false;
    const ids = { value: 0 };
    let lastReady = null;
    let lastLifecycle = null;
    let popoverPointerActive = false;
    let popoverFocusActive = false;
    let popoverActivityReported = null;
    let microphone = null;
    const lifecycleFromSession = (session) => {
      if (!session)
        return null;
      return {
        sessionId: session.id,
        phase: session.busy ? "started" : "completed"
      };
    };
    const post = (message) => {
      target.parent.postMessage(message, "*");
    };
    const listenForLateGenerate = () => {
      if (disposed || target.parent === target || lateGenerateListeners.size === 0 || lastReady?.features?.lateGenerateResults !== true)
        return;
      post({ channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION, type: "generate-late-listen" });
    };
    const emit = (listeners, value) => {
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (error) {
          console.error(error);
        }
      }
    };
    const onMessage = (event) => {
      if (!(event instanceof MessageEvent))
        return;
      if (!acceptSource(event.source))
        return;
      const message = readHostMessage(event.data);
      if (!message)
        return;
      if (message.type === "workspace") {
        const listener = workspaceListeners.get(message.payload.subscriptionId);
        if (listener)
          emit([listener], message.payload.snapshot);
        return;
      }
      if (message.type === "shells") {
        const listener = shellsListeners.get(message.payload.subscriptionId);
        if (listener)
          emit([listener], message.payload.snapshot);
        return;
      }
      if (message.type === "microphone-audio") {
        microphone?.queue.push(message.payload.samples);
        return;
      }
      if (message.type === "microphone-ended") {
        const open = microphone;
        if (!open)
          return;
        microphone = null;
        open.release();
        emit(open.endedListeners, message.payload.reason);
        return;
      }
      if (message.type === "ready") {
        lastReady = message.payload;
        lastLifecycle = lifecycleFromSession(message.payload.session);
        emit(readyListeners, message.payload);
        emit(directoryListeners, message.payload.directory);
        emit(sessionListeners, message.payload.session);
        if (lastLifecycle) {
          emit(lifecycleListeners, lastLifecycle);
        }
        emit(connectionListeners, message.payload.connection);
        emit(settingsListeners, message.payload.settings);
        emit(itemListeners, message.payload.item);
        if (message.payload.block)
          emit(blockListeners, message.payload.block);
        listenForLateGenerate();
        return;
      }
      if (message.type === "service-event") {
        emit(serviceEventListeners, message.payload);
        return;
      }
      if (message.type === "generate-late") {
        if (lateGenerateListeners.size === 0)
          unclaimedLateGenerate.push(message.payload);
        else
          emit(lateGenerateListeners, message.payload);
        return;
      }
      if (message.type === "directory") {
        if (lastReady) {
          lastReady = { ...lastReady, directory: message.payload.directory };
        }
        emit(directoryListeners, message.payload.directory);
        return;
      }
      if (message.type === "session") {
        if (lastReady) {
          lastReady = { ...lastReady, session: message.payload.session };
        }
        if (!message.payload.session) {
          lastLifecycle = null;
        } else if (lastLifecycle?.sessionId !== message.payload.session.id) {
          lastLifecycle = lifecycleFromSession(message.payload.session);
        }
        emit(sessionListeners, message.payload.session);
        return;
      }
      if (message.type === "session-lifecycle") {
        lastLifecycle = message.payload;
        emit(lifecycleListeners, message.payload);
        return;
      }
      if (message.type === "connection") {
        if (lastReady) {
          lastReady = { ...lastReady, connection: message.payload.connection };
        }
        emit(connectionListeners, message.payload.connection);
        return;
      }
      if (message.type === "settings") {
        if (lastReady) {
          lastReady = { ...lastReady, settings: message.payload.settings };
        }
        emit(settingsListeners, message.payload.settings);
        return;
      }
      if (message.type === "item") {
        if (lastReady) {
          lastReady = { ...lastReady, item: message.payload.item };
        }
        emit(itemListeners, message.payload.item);
        return;
      }
      if (message.type === "status-control-event") {
        emit(statusControlListeners, message.payload);
        return;
      }
      if (message.type === "popover-closed") {
        emit(popoverClosedListeners, message.payload);
        return;
      }
      if (message.type === "action") {
        const answer = (payload) => {
          if (!disposed)
            post({
              channel: OPENCHAMBER_SDK_CHANNEL,
              v: OPENCHAMBER_SDK_API_VERSION,
              type: "action-result",
              id: message.id,
              payload
            });
        };
        const handler = actionHandler;
        if (!handler) {
          answer({ ok: false, error: "This extension does not handle background actions." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then(() => answer({ ok: true }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ ok: false, error: (text || "Action failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      if (message.type === "file-open") {
        const next = message.payload;
        if (lastFile && sameFileEditorDocument(lastFile, next))
          return;
        lastFile = next;
        emit(fileOpenListeners, message.payload);
        return;
      }
      if (message.type === "file-saved") {
        emit(fileSavedListeners, message.payload.version);
        return;
      }
      if (message.type === "file-snapshot") {
        const answer = (payload) => {
          if (!disposed)
            post({
              channel: OPENCHAMBER_SDK_CHANNEL,
              v: OPENCHAMBER_SDK_API_VERSION,
              type: "file-snapshot-result",
              id: message.id,
              payload
            });
        };
        const fail = (text) => answer({ error: (text.trim() || "Could not read the edited file.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        const handler = fileSnapshotHandler;
        if (!handler) {
          fail("This extension does not edit files.");
          return;
        }
        Promise.resolve().then(() => handler(message.payload.purpose)).then((snapshot) => {
          if (fileEditorPayloadSize(snapshot) > GUEST_FILE_EDITOR_CONTENT_MAX) {
            fail(`The file is over ${GUEST_FILE_EDITOR_CONTENT_MAX} ${"bytes" in snapshot ? "bytes" : "characters"}.`);
            return;
          }
          if (snapshot.version.length > GUEST_FILE_EDITOR_VERSION_MAX) {
            fail(`The snapshot version is over ${GUEST_FILE_EDITOR_VERSION_MAX} characters.`);
            return;
          }
          answer({ snapshot: "bytes" in snapshot ? { bytes: snapshot.bytes, version: snapshot.version } : { content: snapshot.content, version: snapshot.version } });
        }, (error) => fail(error instanceof Error ? error.message : String(error)));
        return;
      }
      if (message.type === "resolve") {
        const answer = (payload) => {
          post({
            channel: OPENCHAMBER_SDK_CHANNEL,
            v: OPENCHAMBER_SDK_API_VERSION,
            type: "resolve-result",
            id: message.id,
            payload
          });
        };
        const handler = resolveHandler;
        if (!handler) {
          answer({ error: "This extension does not resolve commands." });
          return;
        }
        Promise.resolve().then(() => handler(message.payload)).then((item) => answer({ item: item ? clampAttachRequest(item) : null }), (error) => {
          const text = (error instanceof Error ? error.message : String(error)).trim();
          answer({ error: (text || "Command failed.").slice(0, GUEST_RESOLVE_ERROR_MAX) });
        });
        return;
      }
      const waiter = pending.get(message.id);
      if (!waiter)
        return;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.ok) {
        waiter.resolve(message.payload);
        return;
      }
      waiter.reject(new HostRequestError(message.code, message.error));
    };
    target.addEventListener("message", onMessage);
    post({
      channel: OPENCHAMBER_SDK_CHANNEL,
      v: OPENCHAMBER_SDK_API_VERSION,
      type: "hello"
    });
    const send = (message, timeoutMs = requestTimeoutMs) => {
      if (disposed || target.parent === target) {
        return Promise.reject(new HostRequestError("HOST_UNAVAILABLE", "No host frame. This page is not in an iframe."));
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(message.id);
          reject(new HostRequestError("HOST_TIMEOUT", "Host did not answer in time."));
        }, timeoutMs);
        pending.set(message.id, { resolve, reject, timer });
        post(message);
      });
    };
    const request = (message) => send(message).then(() => void 0);
    const envelope = { channel: OPENCHAMBER_SDK_CHANNEL, v: OPENCHAMBER_SDK_API_VERSION };
    const notify = (message) => {
      if (!disposed && target.parent !== target)
        post(message);
    };
    const requestFileSave = () => notify({ ...envelope, type: "file-save" });
    const postMicrophoneClose = () => {
      if (!disposed && target.parent !== target)
        post({ ...envelope, type: "microphone-close", id: nextId(ids) });
    };
    const openMicrophone = async () => {
      if (microphone)
        throw new HostRequestError("HOST_REJECTED", "The microphone is already open in this frame.");
      if (lastReady?.features?.microphone !== true) {
        throw new HostRequestError("UNSUPPORTED", "This OpenChamber cannot share the microphone with extensions.");
      }
      const AudioContextCtor = globalThis.AudioContext;
      if (typeof AudioContextCtor !== "function")
        throw new HostRequestError("UNSUPPORTED", "This frame has no Web Audio.");
      const context = new AudioContextCtor();
      if (context.sampleRate < GUEST_MICROPHONE_SAMPLE_RATE_MIN || context.sampleRate > GUEST_MICROPHONE_SAMPLE_RATE_MAX) {
        void context.close().catch(() => void 0);
        throw new HostRequestError("UNSUPPORTED", `Audio at ${context.sampleRate} Hz is not supported.`);
      }
      const resumed = context.state === "suspended" ? context.resume().catch(() => void 0) : void 0;
      const queue = createSampleQueue(Math.round(context.sampleRate / 4));
      const processor = context.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (event) => queue.pull(event.outputBuffer.getChannelData(0));
      const destination = context.createMediaStreamDestination();
      processor.connect(destination);
      const endedListeners = /* @__PURE__ */ new Set();
      const open = {
        queue,
        endedListeners,
        release: () => {
          processor.onaudioprocess = null;
          processor.disconnect();
          queue.clear();
          for (const track of destination.stream.getTracks())
            track.stop();
          void context.close().catch(() => void 0);
        }
      };
      microphone = open;
      try {
        const result = await send({ ...envelope, type: "microphone-open", id: nextId(ids), payload: { sampleRate: context.sampleRate } }, GUEST_MICROPHONE_OPEN_TIMEOUT_MS);
        if (!result || !("opened" in result) || result.opened !== true) {
          throw new HostRequestError("HOST_REJECTED", "Host did not open the microphone.");
        }
        await resumed;
        if (microphone !== open)
          throw new HostRequestError("DISCONNECTED", "The microphone closed while it was opening.");
      } catch (error) {
        if (microphone === open)
          microphone = null;
        open.release();
        postMicrophoneClose();
        throw error;
      }
      return {
        stream: destination.stream,
        close: () => {
          if (microphone !== open)
            return;
          microphone = null;
          open.release();
          postMicrophoneClose();
        },
        onEnded: (listener) => {
          endedListeners.add(listener);
          return () => {
            endedListeners.delete(listener);
          };
        }
      };
    };
    const onSaveShortcut = (event) => {
      if (!isKeyEvent(event) || !isSaveShortcut(event))
        return;
      event.preventDefault();
      requestFileSave();
    };
    const onPopoverEscape = (event) => {
      if (!isKeyEvent(event) || event.key !== "Escape" || lastReady?.surface !== "popover" || !lastReady.popover)
        return;
      event.preventDefault();
      void closePopover(lastReady.popover.id, "escape").catch(() => void 0);
    };
    const reportPopoverActivity = () => {
      const popover = lastReady?.surface === "popover" ? lastReady.popover : void 0;
      if (!popover)
        return;
      const active2 = popoverPointerActive || popoverFocusActive;
      if (popoverActivityReported === active2)
        return;
      popoverActivityReported = active2;
      void setPopoverAnchorActive(popover.id, active2).catch(() => void 0);
    };
    const onPopoverPointerOver = () => {
      if (lastReady?.surface !== "popover" || popoverPointerActive)
        return;
      popoverPointerActive = true;
      reportPopoverActivity();
    };
    const onPopoverPointerOut = (event) => {
      if (lastReady?.surface !== "popover" || event.relatedTarget !== null || !popoverPointerActive)
        return;
      popoverPointerActive = false;
      reportPopoverActivity();
    };
    const onPopoverFocus = () => {
      if (lastReady?.surface !== "popover" || popoverFocusActive)
        return;
      popoverFocusActive = true;
      reportPopoverActivity();
    };
    const onPopoverBlur = () => {
      if (lastReady?.surface !== "popover" || !popoverFocusActive)
        return;
      popoverFocusActive = false;
      reportPopoverActivity();
    };
    const requireIdentity = (value, maximum = 1024) => {
      if (!value.trim() || value.length > maximum)
        throw new HostRequestError("HOST_REJECTED", `Identity must contain 1 to ${maximum} characters.`);
    };
    const readWorkspace = async (query) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const result = await send({ ...envelope, type: "workspace-read", id: nextId(ids), payload: query });
      if (!result || !("kind" in result) || !("state" in result) || result.kind !== query.kind) {
        throw new HostRequestError("HOST_REJECTED", "Host did not return workspace data.");
      }
      return result;
    };
    const subscribeWorkspace = async (query, listener) => {
      if (query.kind !== "projects")
        requireIdentity(query.projectId);
      const subscriptionId = nextId(ids);
      workspaceListeners.set(subscriptionId, listener);
      try {
        await request({ ...envelope, type: "workspace-subscribe", id: nextId(ids), payload: { subscriptionId, query } });
      } catch (error) {
        workspaceListeners.delete(subscriptionId);
        if (!disposed)
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        throw error;
      }
      return () => {
        if (!workspaceListeners.delete(subscriptionId) || disposed)
          return;
        post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
      };
    };
    const subscribeShells = async (scope, listener) => {
      if (scope.kind === "session")
        requireIdentity(scope.sessionId);
      if (scope.kind === "project")
        requireIdentity(scope.projectId);
      const subscriptionId = nextId(ids);
      shellsListeners.set(subscriptionId, listener);
      try {
        await request({ ...envelope, type: "shells-subscribe", id: nextId(ids), payload: { subscriptionId, scope } });
      } catch (error) {
        shellsListeners.delete(subscriptionId);
        if (!disposed)
          post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        throw error;
      }
      return () => {
        if (!shellsListeners.delete(subscriptionId) || disposed)
          return;
        post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
      };
    };
    const storage = async (payload) => {
      if ("key" in payload && (payload.key.length === 0 || payload.key.length > GUEST_STORAGE_KEY_MAX)) {
        throw new HostRequestError("HOST_REJECTED", "Storage key must contain 1 to 128 characters.");
      }
      if (payload.op === "set" && !isJsonValue(payload.value)) {
        throw new HostRequestError("HOST_REJECTED", "Storage values must be JSON.");
      }
      if (payload.op === "set" && new TextEncoder().encode(JSON.stringify(payload.value)).length > GUEST_STORAGE_VALUE_BYTES) {
        throw new HostRequestError("HOST_REJECTED", "Storage value exceeds 64 KiB.");
      }
      if (payload.scope === "device" && lastReady?.features?.deviceStorage !== true) {
        throw new HostRequestError("UNSUPPORTED", "This host does not support device storage.");
      }
      const result = await send({ ...envelope, type: "storage", id: nextId(ids), payload });
      if (!result || !("storage" in result) || result.op !== payload.op)
        throw new HostRequestError("HOST_REJECTED", "Host did not return storage data.");
      return result;
    };
    const closePopover = (id, reason) => lastReady?.features?.popovers !== true && !(lastReady?.surface === "popover" && lastReady.popover?.id === id) ? Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers.")) : request({ ...envelope, type: "popover-close", id: nextId(ids), payload: reason ? { id, reason } : { id } });
    const setPopoverAnchorActive = (id, active2) => lastReady?.features?.popovers !== true && !(lastReady?.surface === "popover" && lastReady.popover?.id === id) ? Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers.")) : request({ ...envelope, type: "popover-anchor", id: nextId(ids), payload: { id, active: active2 } });
    target.addEventListener("keydown", onPopoverEscape, true);
    target.addEventListener("pointerover", onPopoverPointerOver);
    target.addEventListener("pointermove", onPopoverPointerOver);
    target.addEventListener("pointerout", onPopoverPointerOut);
    target.addEventListener("focus", onPopoverFocus);
    target.addEventListener("blur", onPopoverBlur);
    return {
      onAction: (handler) => {
        actionHandler = handler;
        return () => {
          if (actionHandler === handler)
            actionHandler = null;
        };
      },
      listProjects: async () => {
        const result = await readWorkspace({ kind: "projects" });
        if (result.kind !== "projects")
          throw new HostRequestError("HOST_REJECTED", "Expected projects.");
        return result;
      },
      listWorktrees: async (projectId) => {
        const result = await readWorkspace({ kind: "worktrees", projectId });
        if (result.kind !== "worktrees")
          throw new HostRequestError("HOST_REJECTED", "Expected worktrees.");
        return result;
      },
      listSessions: async (projectId) => {
        const result = await readWorkspace({ kind: "sessions", projectId });
        if (result.kind !== "sessions")
          throw new HostRequestError("HOST_REJECTED", "Expected sessions.");
        return result;
      },
      onProjects: (listener) => subscribeWorkspace({ kind: "projects" }, (snapshot) => {
        if (snapshot.kind === "projects")
          listener(snapshot);
      }),
      onWorktrees: (projectId, listener) => subscribeWorkspace({ kind: "worktrees", projectId }, (snapshot) => {
        if (snapshot.kind === "worktrees")
          listener(snapshot);
      }),
      onSessions: (projectId, listener) => subscribeWorkspace({ kind: "sessions", projectId }, (snapshot) => {
        if (snapshot.kind === "sessions")
          listener(snapshot);
      }),
      onRunningShells: (scope, listener) => subscribeShells(scope, listener),
      readShellOutput: async (shellId, options2) => {
        requireIdentity(shellId, GUEST_SHELL_ID_MAX);
        const cursor = options2?.cursor;
        if (cursor !== void 0 && (!Number.isInteger(cursor) || cursor < 0)) {
          throw new HostRequestError("HOST_REJECTED", "Shell output cursor must be a non-negative integer.");
        }
        const tailBytes = options2?.tailBytes;
        if (tailBytes !== void 0 && (!Number.isInteger(tailBytes) || tailBytes < 1 || tailBytes > GUEST_SHELL_OUTPUT_TAIL_MAX)) {
          throw new HostRequestError("HOST_REJECTED", `Shell output tailBytes must be an integer between 1 and ${GUEST_SHELL_OUTPUT_TAIL_MAX}.`);
        }
        const result = await send({ ...envelope, type: "shell-output", id: nextId(ids), payload: { shellId, cursor, tailBytes } });
        const output = result;
        if (!output || typeof output.output !== "string" || !Number.isFinite(output.cursor)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return shell output.");
        }
        return output;
      },
      stopShell: async (shellId) => {
        requireIdentity(shellId, GUEST_SHELL_ID_MAX);
        const result = await send({ ...envelope, type: "shell-stop", id: nextId(ids), payload: { shellId } });
        if (result?.stopped !== true)
          throw new HostRequestError("HOST_REJECTED", "Host did not stop the shell.");
        return { stopped: true };
      },
      openSession: async (sessionId) => {
        requireIdentity(sessionId);
        await request({ ...envelope, type: "open-session", id: nextId(ids), payload: { sessionId } });
      },
      storage: {
        get: async (key, options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "get", key };
          if (scope)
            payload.scope = scope;
          const result = await storage(payload);
          return result.op === "get" && result.found ? result.value : void 0;
        },
        set: async (key, value, options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "set", key, value };
          if (scope)
            payload.scope = scope;
          await storage(payload);
        },
        delete: async (key, options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "delete", key };
          if (scope)
            payload.scope = scope;
          await storage(payload);
        },
        keys: async (options2) => {
          const scope = deviceStorageScope(options2);
          const payload = { op: "keys" };
          if (scope)
            payload.scope = scope;
          const result = await storage(payload);
          if (result.op !== "keys")
            throw new HostRequestError("HOST_REJECTED", "Expected storage keys.");
          return result.keys;
        }
      },
      onReady: (listener) => {
        readyListeners.add(listener);
        if (lastReady)
          listener(lastReady);
        return () => {
          readyListeners.delete(listener);
        };
      },
      onDirectory: (listener) => {
        directoryListeners.add(listener);
        if (lastReady)
          listener(lastReady.directory);
        return () => {
          directoryListeners.delete(listener);
        };
      },
      onSession: (listener) => {
        sessionListeners.add(listener);
        if (lastReady)
          listener(lastReady.session);
        return () => {
          sessionListeners.delete(listener);
        };
      },
      onSessionLifecycle: (listener) => {
        lifecycleListeners.add(listener);
        if (lastLifecycle)
          listener(lastLifecycle);
        return () => {
          lifecycleListeners.delete(listener);
        };
      },
      onConnection: (listener) => {
        connectionListeners.add(listener);
        if (lastReady)
          listener(lastReady.connection);
        return () => {
          connectionListeners.delete(listener);
        };
      },
      onSettings: (listener) => {
        settingsListeners.add(listener);
        if (lastReady)
          listener(lastReady.settings);
        return () => {
          settingsListeners.delete(listener);
        };
      },
      onItem: (listener) => {
        itemListeners.add(listener);
        if (lastReady)
          listener(lastReady.item);
        return () => {
          itemListeners.delete(listener);
        };
      },
      onBlock: (listener) => {
        blockListeners.add(listener);
        if (lastReady?.block)
          listener(lastReady.block);
        return () => {
          blockListeners.delete(listener);
        };
      },
      onServiceEvent: (listener) => {
        serviceEventListeners.add(listener);
        return () => {
          serviceEventListeners.delete(listener);
        };
      },
      onStatusControl: (listener) => {
        statusControlListeners.add(listener);
        return () => {
          statusControlListeners.delete(listener);
        };
      },
      onPopoverClosed: (listener) => {
        popoverClosedListeners.add(listener);
        return () => {
          popoverClosedListeners.delete(listener);
        };
      },
      setStatusControls: (controls) => {
        if (lastReady?.features?.statusControls !== true) {
          return Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support status controls."));
        }
        if (!isGuestStatusControls(controls)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "Status controls must have unique bounded ids and valid selected options."));
        }
        return request({ ...envelope, type: "status-controls", id: nextId(ids), payload: { controls } });
      },
      openPopover: (payload) => {
        if (lastReady?.features?.popovers !== true) {
          return Promise.reject(new HostRequestError("UNSUPPORTED", "This host does not support popovers."));
        }
        if (!isGuestPopoverRequest(payload)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "Popover requests need bounded geometry and JSON data."));
        }
        return request({ ...envelope, type: "popover-open", id: nextId(ids), payload });
      },
      closePopover,
      setPopoverAnchorActive,
      onResolve: (handler) => {
        resolveHandler = handler;
        return () => {
          if (resolveHandler === handler)
            resolveHandler = null;
        };
      },
      toast: (payload) => {
        const message = payload.message.trim();
        if (!message || message.length > GUEST_TOAST_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast message must contain 1 to ${GUEST_TOAST_MAX} characters.`));
        }
        if (payload.copy && payload.copy !== true && (!payload.copy.text.length || payload.copy.text.length > GUEST_CLIPBOARD_TEXT_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Toast copy text must contain 1 to ${GUEST_CLIPBOARD_TEXT_MAX} characters.`));
        }
        return request({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "toast",
          id: nextId(ids),
          payload: { ...payload, message }
        });
      },
      openUrl: (url) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-url",
        id: nextId(ids),
        payload: { url }
      }),
      openCommit: (sha) => isGuestCommitSha(sha) ? request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-commit",
        id: nextId(ids),
        payload: { sha }
      }) : Promise.reject(new HostRequestError("HOST_REJECTED", "Commit id must be 7 to 64 hex characters.")),
      answerBlock: (text) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "block-answer",
        id: nextId(ids),
        payload: { text: text.trim().slice(0, GUEST_BLOCK_ANSWER_MAX) }
      }),
      openSurface: (surfaceId) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "open-surface",
        id: nextId(ids),
        payload: { surfaceId }
      }),
      writeClipboard: (text) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "clipboard-write",
        id: nextId(ids),
        payload: { text }
      }),
      compose: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "compose",
        id: nextId(ids),
        payload
      }),
      attach: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "attach",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      startSession: async (payload) => {
        if (payload.projectId !== void 0)
          requireIdentity(payload.projectId);
        const worktree = payload.worktree;
        if (worktree && worktree !== true) {
          if (worktree.kind === "existing")
            requireIdentity(worktree.directory);
          else {
            if (worktree.name !== void 0)
              requireIdentity(worktree.name, 200);
            if (worktree.baseBranch !== void 0)
              requireIdentity(worktree.baseBranch, 200);
          }
        }
        const result = await send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "start-session",
          id: nextId(ids),
          payload: clampStartSessionRequest(payload)
        }, options.requestTimeoutMs ?? 18e4);
        if (!isStartSessionResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a session.");
        }
        return result;
      },
      prompt: (payload) => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "prompt",
        id: nextId(ids),
        payload: clampPromptRequest(payload)
      }).then((result) => {
        if (!isPromptResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return a prompt result.");
        }
        return result;
      }),
      sessionLink: (payload) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "session-link",
        id: nextId(ids),
        payload: clampAttachRequest(payload)
      }),
      close: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "close",
        id: nextId(ids)
      }),
      oauthStart: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-start",
        id: nextId(ids)
      }),
      oauthDisconnect: () => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "oauth-disconnect",
        id: nextId(ids)
      }),
      request: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host request result was empty.");
        }
        return result;
      }),
      serviceRequest: (payload) => (isGuestRequestPath(payload.path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-request",
        id: nextId(ids),
        payload
      }) : rejectBadPath()).then((result) => {
        if (!isGuestRequestResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host service request result was empty.");
        }
        return result;
      }),
      serviceStatus: () => send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "service-status",
        id: nextId(ids)
      }).then((result) => {
        if (!isServiceStatusResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return service status.");
        }
        return result;
      }),
      readFile: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-read",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileReadResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file content.");
        }
        return result;
      }),
      writeFile: (path, content) => {
        if (!isGuestFilePath(path)) {
          return rejectBadFilePath();
        }
        if (content.length > GUEST_FILE_CONTENT_MAX) {
          return Promise.reject(new HostRequestError("FILE_TOO_LARGE", `Content is over ${GUEST_FILE_CONTENT_MAX} characters.`));
        }
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "file-write",
          id: nextId(ids),
          payload: { path, content }
        }).then((result) => {
          if (!isFileWriteResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not confirm the write.");
          }
          return result;
        });
      },
      listDir: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-list",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileListResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return directory entries.");
        }
        return result;
      }),
      stat: (path) => (isGuestFilePath(path) ? send({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "file-stat",
        id: nextId(ids),
        payload: { path }
      }) : rejectBadFilePath()).then((result) => {
        if (!isFileStatResult(result)) {
          throw new HostRequestError("HOST_REJECTED", "Host did not return file status.");
        }
        return result;
      }),
      generate: (input) => {
        const prompt = input.prompt.trim();
        const system = input.system?.trim();
        if (prompt.length === 0 || prompt.length > GUEST_GENERATE_PROMPT_MAX) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `Prompt must be 1 to ${GUEST_GENERATE_PROMPT_MAX} characters.`));
        }
        if (system !== void 0 && (system.length === 0 || system.length > GUEST_GENERATE_SYSTEM_MAX)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", `System prompt must be 1 to ${GUEST_GENERATE_SYSTEM_MAX} characters.`));
        }
        const maxOutputTokens = input.maxOutputTokens === void 0 ? void 0 : Math.min(GUEST_GENERATE_OUTPUT_TOKENS_MAX, Math.max(1, Math.floor(input.maxOutputTokens)));
        if (maxOutputTokens !== void 0 && !Number.isFinite(maxOutputTokens)) {
          return Promise.reject(new HostRequestError("HOST_REJECTED", "maxOutputTokens must be a number."));
        }
        const payload = { prompt };
        if (system !== void 0)
          payload.system = system;
        if (maxOutputTokens !== void 0)
          payload.maxOutputTokens = maxOutputTokens;
        return send({
          channel: OPENCHAMBER_SDK_CHANNEL,
          v: OPENCHAMBER_SDK_API_VERSION,
          type: "generate",
          id: nextId(ids),
          payload
        }, options.requestTimeoutMs ?? GUEST_GENERATE_TIMEOUT_MS).then((result) => {
          if (!isGenerateResult(result)) {
            throw new HostRequestError("HOST_REJECTED", "Host did not return generated text.");
          }
          return result;
        });
      },
      onLateGenerateResult: (listener) => {
        lateGenerateListeners.add(listener);
        for (const result of unclaimedLateGenerate.splice(0))
          emit([listener], result);
        listenForLateGenerate();
        return () => {
          lateGenerateListeners.delete(listener);
        };
      },
      openMicrophone,
      setBadge: (count) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "badge",
        id: nextId(ids),
        payload: { count: clampBadgeCount(count) }
      }),
      setHeight: (height) => request({
        channel: OPENCHAMBER_SDK_CHANNEL,
        v: OPENCHAMBER_SDK_API_VERSION,
        type: "resize",
        id: nextId(ids),
        payload: { height: clampFrameHeight(height) }
      }),
      onFileOpen: (listener) => {
        fileOpenListeners.add(listener);
        if (!saveShortcutInstalled) {
          saveShortcutInstalled = true;
          target.addEventListener("keydown", onSaveShortcut, true);
        }
        if (lastFile)
          listener(lastFile);
        return () => {
          fileOpenListeners.delete(listener);
        };
      },
      onFileSnapshot: (handler) => {
        fileSnapshotHandler = handler;
        return () => {
          if (fileSnapshotHandler === handler)
            fileSnapshotHandler = null;
        };
      },
      onFileSaved: (listener) => {
        fileSavedListeners.add(listener);
        return () => {
          fileSavedListeners.delete(listener);
        };
      },
      reportFileChange: (change) => notify({ ...envelope, type: "file-change", payload: { dirty: change.dirty, edited: change.edited } }),
      requestFileSave,
      reportFileUnsupported: () => notify({ ...envelope, type: "file-unsupported" }),
      dispose: () => {
        for (const subscriptionId of workspaceListeners.keys()) {
          post({ ...envelope, type: "workspace-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        }
        workspaceListeners.clear();
        for (const subscriptionId of shellsListeners.keys()) {
          post({ ...envelope, type: "shells-unsubscribe", id: nextId(ids), payload: { subscriptionId } });
        }
        shellsListeners.clear();
        if (microphone) {
          postMicrophoneClose();
          microphone.release();
          microphone = null;
        }
        disposed = true;
        resolveHandler = null;
        actionHandler = null;
        fileSnapshotHandler = null;
        fileOpenListeners.clear();
        fileSavedListeners.clear();
        if (saveShortcutInstalled)
          target.removeEventListener("keydown", onSaveShortcut, true);
        target.removeEventListener("message", onMessage);
        target.removeEventListener("keydown", onPopoverEscape, true);
        target.removeEventListener("pointerover", onPopoverPointerOver);
        target.removeEventListener("pointermove", onPopoverPointerOver);
        target.removeEventListener("pointerout", onPopoverPointerOut);
        target.removeEventListener("focus", onPopoverFocus);
        target.removeEventListener("blur", onPopoverBlur);
        for (const waiter of pending.values()) {
          clearTimeout(waiter.timer);
          waiter.reject(new HostRequestError("HOST_UNAVAILABLE", "Host client was disposed."));
        }
        pending.clear();
        readyListeners.clear();
        directoryListeners.clear();
        sessionListeners.clear();
        lifecycleListeners.clear();
        connectionListeners.clear();
        settingsListeners.clear();
        itemListeners.clear();
        blockListeners.clear();
        serviceEventListeners.clear();
        statusControlListeners.clear();
        popoverClosedListeners.clear();
        lateGenerateListeners.clear();
        unclaimedLateGenerate.length = 0;
      }
    };
  };

  // node_modules/@openchamber/sdk/dist/service-providers.js
  var BROWSER_CONTROL_ACTIONS = [
    "browser.open",
    "browser.snapshot",
    "browser.click",
    "browser.type",
    "browser.select",
    "browser.scroll",
    "browser.back",
    "browser.forward",
    "browser.inspect",
    "browser.capture",
    "browser.resize",
    "browser.close"
  ];
  var BROWSER_PROVIDER_IDLE_MS = 10 * 6e4;
  var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
  var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 6e4;
  var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 6e4;
  var TRACKER_PROVIDER_IDLE_MS = 10 * 6e4;
  var QUOTA_PROVIDER_IDLE_MS = 10 * 6e4;

  // node_modules/@openchamber/sdk/dist/service-surface.js
  var SURFACE_CONTROLLERS = ["none", "agent", "user"];
  var CONTROLLERS = new Set(SURFACE_CONTROLLERS);

  // node_modules/@openchamber/sdk/dist/ui/theme.js
  var TOKEN_VARS = [
    ["--oc-bg", "background"],
    ["--oc-elevated", "elevated"],
    ["--oc-fg", "foreground"],
    ["--oc-muted", "muted"],
    ["--oc-subtle", "subtle"],
    ["--oc-border", "border"],
    ["--oc-hover", "hover"],
    ["--oc-selection", "selection"],
    ["--oc-focus", "focus"],
    ["--oc-primary", "primary"],
    ["--oc-muted-surface", "mutedSurface"],
    ["--oc-elevated-fg", "elevatedForeground"],
    ["--oc-active", "active"],
    ["--oc-selection-fg", "selectionForeground"],
    ["--oc-primary-fg", "primaryForeground"],
    ["--oc-primary-text", "primaryText"],
    ["--oc-success-text", "successText"],
    ["--oc-warning-text", "warningText"],
    ["--oc-error-text", "errorText"],
    ["--oc-info-text", "infoText"],
    ["--oc-success", "success"],
    ["--oc-warning", "warning"],
    ["--oc-error", "error"],
    ["--oc-info", "info"],
    ["--oc-font", "font"],
    ["--oc-mono", "mono"],
    ["--oc-radius", "radius"],
    ["--surface-background", "background"],
    ["--surface-elevated", "elevated"],
    ["--surface-foreground", "foreground"],
    ["--surface-muted-foreground", "muted"],
    ["--surface-subtle", "subtle"],
    ["--interactive-border", "border"],
    ["--interactive-hover", "hover"],
    ["--interactive-selection", "selection"],
    ["--interactive-focus-ring", "focus"],
    ["--primary", "primary"],
    ["--surface-muted", "mutedSurface"],
    ["--surface-elevated-foreground", "elevatedForeground"],
    ["--interactive-active", "active"],
    ["--interactive-selection-foreground", "selectionForeground"],
    ["--primary-foreground", "primaryForeground"],
    ["--primary-text", "primaryText"],
    ["--success-text", "successText"],
    ["--warning-text", "warningText"],
    ["--error-text", "errorText"],
    ["--info-text", "infoText"],
    ["--status-success", "success"],
    ["--status-warning", "warning"],
    ["--status-error", "error"],
    ["--status-info", "info"],
    ["--font-sans", "font"],
    ["--font-mono", "mono"],
    ["--radius", "radius"]
  ];
  var SYNTAX_TOKEN_VARS = [
    ["--oc-syntax-keyword", "--syntax-keyword", "syntaxKeyword"],
    ["--oc-syntax-string", "--syntax-string", "syntaxString"],
    ["--oc-syntax-number", "--syntax-number", "syntaxNumber"],
    ["--oc-syntax-function", "--syntax-function", "syntaxFunction"],
    ["--oc-syntax-type", "--syntax-type", "syntaxType"],
    ["--oc-syntax-comment", "--syntax-comment", "syntaxComment"],
    ["--oc-syntax-variable", "--syntax-variable", "syntaxVariable"],
    ["--oc-syntax-operator", "--syntax-operator", "syntaxOperator"]
  ];
  var applyHostTheme = (theme, root2) => {
    root2.style.colorScheme = theme.mode;
    for (const [name, key] of TOKEN_VARS) {
      root2.style.setProperty(name, theme.tokens[key]);
    }
    for (const [alias, hostName, key] of SYNTAX_TOKEN_VARS) {
      const value = theme.tokens[key] ?? "";
      root2.style.setProperty(alias, value);
      root2.style.setProperty(hostName, value);
    }
    root2.style.setProperty("font-family", theme.tokens.font);
    root2.style.setProperty("font-size", theme.tokens.fontSize ?? "0.875rem");
    root2.style.setProperty("line-height", "1.45");
    root2.style.setProperty("color", theme.tokens.foreground);
  };
  var applyHostReady = (ctx, root2) => {
    applyHostTheme(ctx.theme, root2);
    if (root2.dataset) {
      root2.dataset.ocSurface = ctx.surface;
      root2.dataset.ocTheme = ctx.theme.mode;
    }
  };

  // node_modules/@openchamber/sdk/dist/ui/style.js
  var OC_ALIAS = {
    "surface-background": "bg",
    "surface-elevated": "elevated",
    "surface-elevated-foreground": "elevated-fg",
    "surface-foreground": "fg",
    "surface-muted-foreground": "muted",
    "surface-muted": "muted-surface",
    "surface-subtle": "subtle",
    "interactive-border": "border",
    "interactive-hover": "hover",
    "interactive-active": "active",
    "interactive-selection": "selection",
    "interactive-selection-foreground": "selection-fg",
    "interactive-focus-ring": "focus",
    "primary": "primary",
    "primary-foreground": "primary-fg",
    "primary-text": "primary-text",
    "success-text": "success-text",
    "warning-text": "warning-text",
    "error-text": "error-text",
    "info-text": "info-text",
    "status-success": "success",
    "status-warning": "warning",
    "status-error": "error",
    "status-info": "info",
    "font-sans": "font",
    "font-mono": "mono",
    "radius": "radius"
  };
  var v = (name, fallback) => `var(--${name}, var(--oc-${OC_ALIAS[name]}, ${fallback}))`;
  var bg = v("surface-background", "transparent");
  var elevated = v("surface-elevated", "transparent");
  var elevatedFg = v("surface-elevated-foreground", "inherit");
  var fg = v("surface-foreground", "inherit");
  var muted = v("surface-muted-foreground", "gray");
  var secondary = v("surface-muted", "transparent");
  var border = v("interactive-border", "currentColor");
  var hover = v("interactive-hover", "transparent");
  var active = v("interactive-active", "transparent");
  var selection = v("interactive-selection", "transparent");
  var selectionFg = v("interactive-selection-foreground", "inherit");
  var primary = v("primary", "currentColor");
  var primaryText = v("primary-text", "inherit");
  var errorText = v("error-text", "inherit");
  var font = v("font-sans", "inherit");
  var mono = v("font-mono", "monospace");
  var radius = v("radius", "9px");
  var controlRadius = `calc(${radius} - 2px)`;
  var smallRadius = `calc(${radius} - 4px)`;
  var mix = (color, pct, base = "transparent") => `color-mix(in srgb, ${color} ${pct}%, ${base})`;
  var focusFill = `background-image: linear-gradient(${hover}, ${hover});`;
  var field = (edge, width = "0.5px") => `box-shadow: inset 0 0 0 ${width} ${edge}, var(--oc-sdk-field-lift);`;
  var raised = "border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);";
  var litButton = "box-shadow: var(--oc-sdk-lit);";
  var darkLift = `inset 0 0.5px 0 0 ${mix(fg, 8)}, 0 1px 2px 0 rgb(0 0 0 / 0.4)`;
  var THEME_VARS = `
:root {
  --oc-sdk-edge: ${mix(fg, 16)};
  --oc-sdk-field-bg: ${elevated};
  --oc-sdk-raised-bg: ${bg};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 1.5px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 1px 1.5px 0 rgb(0 0 0 / 0.1);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.14);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.7), 0 1px 2px -0.5px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.06);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${mix(fg, 14)};
  --oc-sdk-field-bg: ${mix(bg, 50, elevated)};
  --oc-sdk-raised-bg: ${elevated};
  --oc-sdk-field-lift: ${darkLift};
  --oc-sdk-raised-lift: ${darkLift};
  --oc-sdk-lit: ${darkLift};
  --oc-sdk-float-edge: rgb(0 0 0 / 0.55);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.04), inset 0 0 0 0.5px rgb(255 255 255 / 0.08), 0 8px 16px 0 rgb(0 0 0 / 0.25), 0 4px 8px 0 rgb(0 0 0 / 0.25);
}`;
  var tone = (name) => {
    const color = v(`status-${name}`, "currentColor");
    return `
.oc-sdk[data-tone="${name}"], .oc-sdk [data-tone="${name}"] { --oc-sdk-tone: ${color}; --oc-sdk-tone-text: ${v(`${name}-text`, "inherit")}; }`;
  };
  var len = (px) => `calc(${px}rem / 14)`;
  var UI_SIZE_CSS = `
.oc-sdk { box-sizing: border-box; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: ${len(8)}; height: ${len(32)}; padding: 0 ${len(12)}; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.oc-sdk-btn[data-size="sm"] { gap: ${len(6)}; height: ${len(28)}; padding: 0 ${len(10)}; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { gap: ${len(4)}; height: ${len(24)}; padding: 0 ${len(8)}; font-size: 0.75rem; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: ${len(14)}; height: ${len(14)}; }

.oc-sdk-field { display: flex; flex-direction: column; gap: ${len(4)}; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: ${len(32)}; padding: 0 ${len(10)}; border: 0; font-size: 0.875rem; line-height: 1.45; appearance: none; }
textarea.oc-sdk-input { height: auto; padding: ${len(8)} ${len(10)}; resize: vertical; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: ${len(34)}; padding-right: ${len(34)}; }
.oc-sdk-search-icon { position: absolute; left: ${len(11)}; top: 50%; transform: translateY(-50%); pointer-events: none; }
.oc-sdk-search-clear { position: absolute; right: ${len(6)}; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: ${len(24)}; height: ${len(24)}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: ${len(4)}; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: ${len(6)}; align-self: flex-start; width: auto; max-width: 100%; min-width: 0; height: ${len(28)}; padding: 0 ${len(10)}; border: 1px solid transparent; font-size: 0.8125rem; text-align: left; }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; }
.oc-sdk-popup { position: fixed; z-index: 50; display: flex; flex-direction: column; gap: ${len(2)}; min-width: ${len(160)}; max-width: calc(100vw - ${len(16)}); max-height: min(${len(320)}, calc(100vh - ${len(16)})); overflow: auto; padding: ${len(4)}; border: 1px solid transparent; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: ${len(2)} ${len(2)} ${len(4)}; }
.oc-sdk-popup-search .oc-sdk-input { height: ${len(28)}; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: ${len(8)}; width: 100%; padding: ${len(6)} ${len(8)}; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; }
.oc-sdk-option-check { flex: 0 0 auto; display: inline-flex; width: ${len(14)}; visibility: hidden; }
.oc-sdk-option[aria-selected="true"] > .oc-sdk-option-check { visibility: visible; }
.oc-sdk-popup-empty { padding: ${len(8)}; font-size: 0.8125rem; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: ${len(8)}; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: ${len(14)}; height: ${len(14)}; margin-top: ${len(3)}; border: 1px solid transparent; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: ${len(36)}; height: ${len(20)}; --oc-sdk-thumb-travel: ${len(16)}; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: ${len(2)}; left: ${len(2)}; width: ${len(16)}; height: ${len(16)}; }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; }

.oc-sdk-tabs { display: inline-flex; gap: ${len(2)}; padding: ${len(2)}; max-width: 100%; overflow: auto; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: ${len(6)}; height: ${len(28)}; padding: 0 ${len(10)}; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 500; white-space: nowrap; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: ${len(1)} ${len(6)}; font-size: ${len(11)}; font-weight: 500; line-height: ${len(16)}; white-space: nowrap; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: ${len(8)}; width: 100%; padding: ${len(6)} ${len(8)}; text-align: left; }
.oc-sdk-row-lead { flex: 0 0 auto; width: ${len(64)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-list-empty { padding: ${len(16)} ${len(8)}; text-align: center; font-size: 0.8125rem; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${len(4)}; padding: ${len(40)} ${len(16)}; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; }
.oc-sdk-empty-action { margin-top: ${len(12)}; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: ${len(8)}; font-size: 0.8125rem; }
.oc-sdk-spinner-ring { width: ${len(16)}; height: ${len(16)}; border: 2px solid transparent; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: ${len(12)}; height: ${len(12)}; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: ${len(12)}; padding: ${len(8)} ${len(12)}; border: 1px solid transparent; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: ${len(2)}; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-banner-body { font-size: 0.8125rem; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: ${len(8)}; width: 100%; margin: ${len(8)} 0; font-size: 0.75rem; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: ${len(4)} 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: ${len(4)}; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: ${len(6)}; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; transform-origin: left; transition: transform 200ms ease-out; }
.oc-sdk-progress-value { display: inline-flex; align-items: center; gap: ${len(2)}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { font-weight: 600; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text img { display: block; max-width: 100%; margin: ${len(8)} 0; }

/* Under a finger the controls reach the app's touch sizes: rows and options 44px like its sheets, every other
   control at least 36px. Inputs keep 16px text, below which iOS zooms the page on focus. */
@media (pointer: coarse) {
  .oc-sdk-btn, .oc-sdk-input { height: ${len(40)}; }
  .oc-sdk-btn[data-size="sm"], .oc-sdk-btn[data-size="xs"], .oc-sdk-trigger, .oc-sdk-tab, .oc-sdk-popup-search .oc-sdk-input { height: ${len(36)}; }
  .oc-sdk-input, .oc-sdk-popup-search .oc-sdk-input { font-size: max(16px, 0.875rem); }
  .oc-sdk-search-clear { width: ${len(36)}; height: ${len(36)}; right: 0; }
  .oc-sdk-row, .oc-sdk-option { min-height: ${len(44)}; }
  .oc-sdk-check { min-height: ${len(36)}; padding: ${len(8)} 0; }
}
`;
  var GUEST_UI_LOOK_CSS = `${THEME_VARS}
.oc-sdk { color: ${fg}; font-family: ${font}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${focusFill} }
.oc-sdk-mono { font-family: ${mono}; }
.oc-sdk-muted { color: ${muted}; }
${tone("success")}${tone("warning")}${tone("error")}${tone("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${primary}; --oc-sdk-tone-text: ${primaryText}; }

.oc-sdk-btn { border-radius: ${controlRadius}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${smallRadius}; }
.oc-sdk-btn[data-variant="default"] { color: ${primaryText}; background: ${mix(primary, 10, bg)}; border-color: ${mix(primary, 12)}; ${litButton} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${mix(primary, 16, bg)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${mix(primary, 22, bg)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${secondary}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${active}, ${active}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${elevatedFg}; ${raised} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${active}, ${active}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${hover}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${active}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${v("status-error", "red")}; color: ${errorText}; background: ${mix("var(--oc-sdk-tone)", 7, bg)}; border-color: ${mix("var(--oc-sdk-tone)", 12)}; ${litButton} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${mix("var(--oc-sdk-tone)", 9, bg)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${mix("var(--oc-sdk-tone)", 11, bg)}; box-shadow: none; }

.oc-sdk-field-note { color: ${muted}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${errorText}; }
.oc-sdk-input { border-radius: ${controlRadius}; background: var(--oc-sdk-field-bg); color: ${elevatedFg}; ${field("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${muted}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${field(mix(fg, 26), "1px")} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${field(v("status-error", "red"), "1px")} }
.oc-sdk-input[data-mono="true"] { font-family: ${mono}; }

.oc-sdk-search-icon { color: ${muted}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${primary}; }
.oc-sdk-search-clear { border-radius: ${smallRadius}; color: ${muted}; }
.oc-sdk-search-clear:hover { background: ${hover}; color: ${fg}; }

.oc-sdk-trigger { border-radius: ${controlRadius}; background: var(--oc-sdk-raised-bg); color: ${elevatedFg}; ${raised} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${hover}, ${hover}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${active}, ${active}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${muted}; }
.oc-sdk-trigger-chevron { color: ${muted}; }
/* The app's floating level: the glass edge (a hairline ring and a lit top line, dark outside and light inside in dark themes) over soft shadows. The outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${elevatedFg}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${elevated}; background-clip: padding-box; color: ${elevatedFg}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${hover}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${selection}; color: ${selectionFg}; }
.oc-sdk-option-check { color: ${fg}; }
.oc-sdk-option[data-destructive="true"] { color: ${errorText}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${mix(v("status-error", "red"), 10)}; }
.oc-sdk-option-hint { color: ${muted}; }
.oc-sdk-popup-empty { color: ${muted}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${border}; border-radius: 4px; color: ${fg}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${mix(fg, 60, border)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${border}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${bg}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${primary}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(var(--oc-sdk-thumb-travel, 16px)); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${focusFill} }
.oc-sdk-check-desc { color: ${muted}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${mix(fg, 4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${muted}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${fg}; }
.oc-sdk-tab[aria-selected="true"] { color: ${selectionFg}; background: ${selection}; border-color: ${border}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${elevatedFg}; background: var(--oc-sdk-raised-bg); ${raised} }
.oc-sdk-tab-count { color: ${muted}; }

/* The app's neutral badge: a step of the text colour, the same in every theme. */
.oc-sdk-badge { border-radius: 9999px; background: ${mix(fg, 6)}; color: ${muted}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${mix("var(--oc-sdk-tone)", 15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${hover}; }
.oc-sdk-row[aria-selected="true"] { background: ${selection}; color: ${selectionFg}; }
.oc-sdk-row-lead { font-family: ${mono}; color: ${muted}; }
.oc-sdk-row-sub { color: ${muted}; }
.oc-sdk-row-meta { color: ${muted}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${muted}; }

.oc-sdk-empty-body { color: ${muted}; }

.oc-sdk-spinner { color: ${muted}; }
.oc-sdk-spinner-ring { border-color: ${border}; border-top-color: ${primary}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${mix("var(--oc-sdk-tone)", 10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${muted}; }

.oc-sdk-separator { color: ${muted}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${mix(border, 40)}; }

.oc-sdk-progress-label { color: ${muted}; }
/* The app's progress: a groove a step of the text colour, green once done. Older bundles mark done only through aria-valuenow. */
.oc-sdk-progress-track { border-radius: 9999px; background: ${mix(fg, 6)}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${primary}); }
.oc-sdk-progress-track[aria-valuenow="100"] > .oc-sdk-progress-fill:not([data-tone]) { background: ${v("status-success", "currentColor")}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { color: ${v("success-text", "inherit")}; }

.oc-sdk-text a { color: ${primaryText}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${mix(border, 60)}; }
`;
  var UI_CSS = `
${GUEST_SCROLLBAR_CSS}
${UI_SIZE_CSS}
${GUEST_UI_LOOK_CSS}`;

  // node_modules/@openchamber/sdk/dist/ui/dom.js
  var STYLE_ID = "oc-sdk-ui-style";
  var ensureStyle = (css) => {
    const existing = document.getElementById(STYLE_ID);
    if (existing instanceof HTMLStyleElement) {
      if (existing.textContent !== css) {
        existing.textContent = css;
      }
      return;
    }
    installGuestScrollbarActivity(document);
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  };
  var el = (tag, className) => {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    return node;
  };
  var button = (className) => {
    const node = el("button", className);
    node.type = "button";
    return node;
  };
  var setText = (node, text) => {
    const next = text ?? "";
    if (node.textContent !== next) {
      node.textContent = next;
    }
  };
  var setAttr = (node, name, value) => {
    if (value === void 0 || value === null || value === "") {
      node.removeAttribute(name);
    } else if (node.getAttribute(name) !== value) {
      node.setAttribute(name, value);
    }
  };

  // node_modules/@openchamber/sdk/dist/ui/button.js
  var ring = () => {
    const spinner = document.createElement("span");
    spinner.className = "oc-sdk-spinner-ring";
    spinner.setAttribute("aria-hidden", "true");
    return spinner;
  };
  var mountButton = (root2, initial) => {
    ensureStyle(UI_CSS);
    let props = initial;
    const node = button("oc-sdk oc-sdk-btn");
    const spinner = ring();
    const label = document.createElement("span");
    node.append(label);
    root2.append(node);
    const paint = () => {
      node.dataset.variant = props.variant ?? "default";
      node.dataset.size = props.size ?? "default";
      node.disabled = Boolean(props.disabled) || Boolean(props.loading);
      node.dataset.loading = props.loading ? "true" : "false";
      node.setAttribute("aria-busy", props.loading ? "true" : "false");
      if (props.loading && spinner.parentNode !== node) {
        node.prepend(spinner);
      } else if (!props.loading && spinner.parentNode === node) {
        spinner.remove();
      }
      setText(label, props.label);
    };
    const onClick = () => {
      if (props.disabled || props.loading) {
        return;
      }
      props.onClick();
    };
    node.addEventListener("click", onClick);
    paint();
    return {
      update: (next) => {
        props = { ...props, ...next };
        paint();
      },
      dispose: () => {
        node.removeEventListener("click", onClick);
        node.remove();
      }
    };
  };

  // node_modules/@openchamber/sdk/dist/ui/icons.js
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICON_PATH = {
    search: "M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z",
    chevron: "M12 13.172l4.95-4.95 1.414 1.414L12 16 5.636 9.636 7.05 8.222z",
    check: "M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z",
    close: "M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z"
  };
  var icon = (name, size, className) => {
    const node = document.createElementNS(SVG_NS, "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("width", String(size));
    node.setAttribute("height", String(size));
    node.style.width = len(size);
    node.style.height = len(size);
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("fill", "currentColor");
    if (className) {
      node.setAttribute("class", className);
    }
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", ICON_PATH[name]);
    node.append(path);
    return node;
  };

  // node_modules/@openchamber/sdk/dist/ui/search.js
  var mountSearchField = (root2, initial) => {
    ensureStyle(UI_CSS);
    let props = initial;
    const wrap = el("div", "oc-sdk oc-sdk-search");
    const input = el("input", "oc-sdk-input");
    input.type = "text";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("role", "searchbox");
    const clear = button("oc-sdk-search-clear");
    clear.append(icon("close", 14));
    clear.tabIndex = -1;
    wrap.append(icon("search", 16, "oc-sdk-search-icon"), input, clear);
    root2.append(wrap);
    const paint = () => {
      const placeholder = props.placeholder ?? "Search";
      setAttr(input, "placeholder", placeholder);
      input.setAttribute("aria-label", props.label ?? placeholder);
      clear.setAttribute("aria-label", "Clear search");
      if (input.value !== props.value) {
        input.value = props.value;
      }
      wrap.dataset.active = props.value.trim() === "" ? "false" : "true";
    };
    const clearValue = () => {
      if (props.value !== "") {
        props.onChange("");
      }
      input.focus();
    };
    const onInput = () => {
      props.onChange(input.value);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape" && input.value !== "") {
        event.preventDefault();
        clearValue();
      }
    };
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeyDown);
    clear.addEventListener("click", clearValue);
    paint();
    if (props.autofocus) {
      input.focus();
    }
    return {
      update: (next) => {
        props = { ...props, ...next };
        paint();
      },
      dispose: () => {
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKeyDown);
        clear.removeEventListener("click", clearValue);
        wrap.remove();
      }
    };
  };

  // node_modules/@openchamber/sdk/dist/ui/empty.js
  var mountEmpty = (root2, initial) => {
    ensureStyle(UI_CSS);
    let props = initial;
    const shell = el("div", "oc-sdk oc-sdk-empty");
    const title = el("h2", "oc-sdk-empty-title");
    const body = el("p", "oc-sdk-empty-body");
    const slot = el("div", "oc-sdk-empty-action");
    shell.append(title, body, slot);
    root2.append(shell);
    let action = null;
    const paint = () => {
      setText(title, props.title);
      setText(body, props.body);
      body.hidden = !props.body;
      slot.hidden = !props.action;
      if (!props.action) {
        action?.dispose();
        action = null;
        return;
      }
      const next = { label: props.action.label, onClick: props.action.onClick };
      if (action) {
        action.update(next);
      } else {
        action = mountButton(slot, { ...next, variant: "outline", size: "sm" });
      }
    };
    paint();
    return {
      update: (next) => {
        props = { ...props, ...next };
        paint();
      },
      dispose: () => {
        action?.dispose();
        action = null;
        shell.remove();
      }
    };
  };

  // node_modules/@openchamber/sdk/dist/ui/banner.js
  var mountBanner = (root2, initial) => {
    ensureStyle(UI_CSS);
    let props = initial;
    const node = el("div", "oc-sdk oc-sdk-banner");
    const text = el("div", "oc-sdk-banner-text");
    const title = el("div", "oc-sdk-banner-title");
    const body = el("div", "oc-sdk-banner-body");
    const slot = el("div", "oc-sdk-banner-action");
    text.append(title, body);
    node.append(text, slot);
    root2.append(node);
    let action = null;
    const paint = () => {
      node.dataset.tone = props.tone;
      node.setAttribute("role", props.tone === "error" || props.tone === "warning" ? "alert" : "status");
      setText(title, props.title);
      setText(body, props.body);
      body.hidden = !props.body;
      slot.hidden = !props.action;
      if (!props.action) {
        action?.dispose();
        action = null;
        return;
      }
      const next = { label: props.action.label, onClick: props.action.onClick };
      if (action) {
        action.update(next);
      } else {
        action = mountButton(slot, { ...next, variant: "outline", size: "xs" });
      }
    };
    paint();
    return {
      update: (next) => {
        props = { ...props, ...next };
        paint();
      },
      dispose: () => {
        action?.dispose();
        action = null;
        node.remove();
      }
    };
  };

  // panel/src/store.ts
  var MAX_SUBSCRIPTIONS = 31;
  var WAIT_ESCALATION_MS = 15 * 6e4;
  var SEEN_KEY = "cr.seen";
  var SEEN_LIMIT = 200;
  var SUBS_KEY = "cr.subs";
  var COLLAPSED_KEY = "cr.collapsed";
  var BOARD_KEY = "cr.board";
  var isBlockedState = (state) => state === "permission" || state === "question";
  var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  var stringList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  var errorCode = (error) => {
    if (isRecord(error) && typeof error.code === "string") return error.code;
    return "";
  };
  function stateOf(session) {
    if (session.archivedAt != null) return "archived";
    const activity = session.activity;
    if (activity === "waiting-permission") return "permission";
    if (activity === "waiting-question") return "question";
    if (activity !== "running" && activity !== "retrying" && session.outcome === "failed") return "failed";
    if (activity === "retrying") return "retrying";
    if (activity === "running") return "running";
    if (activity === "idle" && session.outcome === "completed") return "done";
    if (activity === "idle") return "idle";
    return "unknown";
  }
  var branchOf = (session) => {
    const worktree = session.worktree;
    if (!worktree) return null;
    return worktree.branch || worktree.name || null;
  };
  var byUpdatedAsc = (a, b) => a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  var byUpdatedDesc = (a, b) => -byUpdatedAsc(a, b);
  var waitingRank = (row) => row.state === "permission" ? 0 : 1;
  var runningRank = (row) => row.state === "retrying" ? 0 : 1;
  var sortWaiting = (rows) => [...rows].sort((a, b) => waitingRank(a) - waitingRank(b) || byUpdatedAsc(a, b));
  var sortFailed = (rows) => [...rows].sort(byUpdatedDesc);
  var sortRunning = (rows) => [...rows].sort((a, b) => runningRank(a) - runningRank(b) || byUpdatedDesc(a, b));
  var sortEnded = (rows) => [...rows].sort(byUpdatedDesc);
  var ControlRoomStore = class {
    constructor(host2, surface) {
      this.host = host2;
      this.surface = surface;
    }
    host;
    surface;
    entries = /* @__PURE__ */ new Map();
    subs = /* @__PURE__ */ new Map();
    pending = /* @__PURE__ */ new Set();
    unsubProjects = null;
    projects = [];
    projectsState = "loading";
    fatal = null;
    dropped = /* @__PURE__ */ new Set();
    preferred = [];
    seen = /* @__PURE__ */ new Set();
    blockedSince = /* @__PURE__ */ new Map();
    previousStates = /* @__PURE__ */ new Map();
    freshIds = /* @__PURE__ */ new Set();
    lastReadyAt = 0;
    lastSeenRead = 0;
    initialComplete = false;
    currentBlocked = [];
    started = false;
    hydrated = false;
    disposed = false;
    collapsed = { ended: false, projects: [], groups: [] };
    board = { tab: "all", query: "", others: false };
    changeHandler = null;
    onChange(handler) {
      this.changeHandler = handler;
    }
    /** Storage (board filter, search, folds) has been read. */
    isHydrated() {
      return this.hydrated;
    }
    changed() {
      this.changeHandler?.();
    }
    // ----- storage -----
    write(key, value) {
      void this.host.storage.set(key, value).catch(() => void 0);
    }
    async loadStorage() {
      const [seen, subs, collapsed, board] = await Promise.allSettled([
        this.host.storage.get(SEEN_KEY),
        this.host.storage.get(SUBS_KEY),
        this.host.storage.get(COLLAPSED_KEY),
        this.host.storage.get(BOARD_KEY)
      ]);
      if (seen.status === "fulfilled" && isRecord(seen.value)) {
        this.seen = new Set(stringList(seen.value.ids).slice(-SEEN_LIMIT));
      }
      if (subs.status === "fulfilled" && isRecord(subs.value)) {
        this.dropped = new Set(stringList(subs.value.dropped).slice(0, 200));
      }
      if (collapsed.status === "fulfilled" && isRecord(collapsed.value)) {
        const value = collapsed.value;
        this.collapsed = {
          ended: value.ended === true,
          projects: stringList(value.projects).slice(0, 400),
          groups: stringList(value.groups).slice(0, 200)
        };
      }
      if (board.status === "fulfilled" && isRecord(board.value)) {
        const value = board.value;
        this.board = {
          tab: typeof value.tab === "string" ? value.tab : "all",
          query: typeof value.query === "string" ? value.query.slice(0, 200) : "",
          others: value.others === true
        };
      }
    }
    getCollapsed() {
      return this.collapsed;
    }
    setEndedCollapsed(ended) {
      this.collapsed.ended = ended;
      this.write(COLLAPSED_KEY, this.collapsed);
    }
    /** Blocked groups are always open; everything else opens only when listed. */
    isGroupExpanded(group) {
      return group.blocked.length > 0 || this.collapsed.groups.includes(group.head.id);
    }
    toggleGroupExpanded(group) {
      if (group.blocked.length > 0) return;
      const set = new Set(this.collapsed.groups);
      if (set.has(group.head.id)) set.delete(group.head.id);
      else set.add(group.head.id);
      this.collapsed.groups = [...set].slice(0, 200);
      this.write(COLLAPSED_KEY, this.collapsed);
    }
    toggleProjectCollapsed(projectId) {
      const set = new Set(this.collapsed.projects);
      if (set.has(projectId)) set.delete(projectId);
      else set.add(projectId);
      this.collapsed.projects = [...set].slice(0, 400);
      this.write(COLLAPSED_KEY, this.collapsed);
    }
    getBoard() {
      return this.board;
    }
    setBoard(next) {
      this.board = { ...this.board, ...next };
      this.write(BOARD_KEY, this.board);
    }
    // ----- subscriptions -----
    async start() {
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
        this.projectsState = "error";
        this.changed();
      }
    }
    fatalFrom(error) {
      const code = errorCode(error);
      if (code === "NOT_GRANTED" || code === "DISABLED" || code === "HOST_TIMEOUT" || code === "HOST_REJECTED") {
        return code;
      }
      if (code === "HOST_UNAVAILABLE") return "HOST_REJECTED";
      return code ? "HOST_REJECTED" : null;
    }
    applyProjects(snapshot) {
      this.projectsState = snapshot.state;
      if (snapshot.state === "ready") {
        this.projects = snapshot.projects;
        this.lastReadyAt = Date.now();
      } else if (snapshot.state === "loading" && snapshot.projects.length > 0) {
        this.projects = snapshot.projects;
      }
      void this.ensureSubscriptions();
      this.changed();
    }
    signalIds() {
      const ids = /* @__PURE__ */ new Set();
      for (const entry of this.entries.values()) {
        if (!entry.connected) continue;
        for (const session of entry.sessions) {
          const state = stateOf(session);
          if (isBlockedState(state) || state === "failed") ids.add(entry.project.id);
        }
      }
      return ids;
    }
    /** Blocked/failed first, then swapped-in projects, then by name; 31 at most. */
    selectProjects() {
      const signal = this.signalIds();
      const preferredRank = new Map(this.preferred.map((id, index) => [id, index]));
      const byName = (a, b) => a.name.localeCompare(b.name);
      const available = this.projects.filter(
        (project) => !this.dropped.has(project.id) || preferredRank.has(project.id)
      );
      const must = available.filter((project) => signal.has(project.id)).sort(byName);
      const rest = available.filter((project) => !signal.has(project.id)).sort((a, b) => {
        const ra = preferredRank.get(a.id);
        const rb = preferredRank.get(b.id);
        if (ra !== void 0 || rb !== void 0) return (ra ?? 1e9) - (rb ?? 1e9);
        return byName(a, b);
      });
      return [...must, ...rest].slice(0, MAX_SUBSCRIPTIONS);
    }
    async ensureSubscriptions() {
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
          entry.state = "error";
          entry.error = true;
          if (this.fatalFrom(error) === "NOT_GRANTED") this.fatal = "NOT_GRANTED";
          this.changed();
        }
      }
    }
    entryFor(project) {
      const existing = this.entries.get(project.id);
      if (existing) {
        existing.project = project;
        return existing;
      }
      const entry = {
        project,
        sessions: [],
        state: "loading",
        error: false,
        connected: true,
        unsub: null
      };
      this.entries.set(project.id, entry);
      return entry;
    }
    applySessions(projectId, snapshot) {
      const project = this.projects.find((item) => item.id === projectId);
      const entry = project ? this.entryFor(project) : this.entries.get(projectId);
      if (!entry) return;
      entry.state = snapshot.state;
      if (snapshot.state !== "error") entry.sessions = snapshot.sessions;
      entry.error = snapshot.state === "error";
      this.changed();
    }
    async retry() {
      if (!this.started) return;
      try {
        const snapshot = await this.host.listProjects();
        this.applyProjects(snapshot);
      } catch (error) {
        this.fatal = this.fatalFrom(error);
        this.projectsState = "error";
        this.changed();
      }
      for (const [projectId, unsub] of [...this.subs]) {
        const entry = this.entries.get(projectId);
        if (!entry?.error) continue;
        this.subs.delete(projectId);
        try {
          unsub();
        } catch {
        }
        entry.connected = false;
        this.pending.delete(projectId);
      }
      await this.ensureSubscriptions();
      this.changed();
    }
    /** Swaps an unconnected project in; refuses when every connected one is blocked. */
    connect(projectId) {
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
    markSeen(ids) {
      const next = new Set(ids.slice(-SEEN_LIMIT));
      let same = next.size === this.seen.size;
      if (same) {
        for (const id of next) if (!this.seen.has(id)) {
          same = false;
          break;
        }
      }
      this.seen = next;
      if (!same) this.write(SEEN_KEY, { ids: [...next], at: Date.now() });
    }
    /** Another surface (the panel) may have marked waits as seen; read before counting. */
    async refreshSeen() {
      if (Date.now() - this.lastSeenRead < 5e3) return;
      this.lastSeenRead = Date.now();
      try {
        const value = await this.host.storage.get(SEEN_KEY);
        if (isRecord(value)) this.seen = new Set(stringList(value.ids).slice(-SEEN_LIMIT));
      } catch {
      }
    }
    updateBadge(view) {
      if (this.fatal || view.phase !== "ready" || !view.hasData) return;
      const blockedIds = this.currentBlocked;
      const visible = typeof document !== "undefined" && document.visibilityState === "visible";
      if (this.surface !== "status" && visible) {
        this.markSeen(blockedIds);
        void this.host.setBadge(null).catch(() => void 0);
        return;
      }
      const count = () => blockedIds.filter((id) => !this.seen.has(id)).length;
      const fresh = count();
      if (this.surface === "status" && fresh > 0) {
        void this.refreshSeen().then(() => {
          const next = this.currentBlocked.filter((id) => !this.seen.has(id)).length;
          void this.host.setBadge(next > 0 ? Math.min(next, 999) : null).catch(() => void 0);
        });
        return;
      }
      void this.host.setBadge(fresh > 0 ? Math.min(fresh, 999) : null).catch(() => void 0);
    }
    // ----- derive -----
    run() {
      const now = Date.now();
      const raw = [];
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
            child: false
          });
        }
      }
      const rawIds = new Set(raw.map((row) => row.id));
      for (const row of raw) row.child = row.parentId != null && rawIds.has(row.parentId);
      const blockedNow = /* @__PURE__ */ new Set();
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
      const fresh = [];
      if (this.initialComplete && this.surface !== "status") {
        for (const id of blockedNow) {
          if (!isBlockedState(this.previousStates.get(id))) fresh.push(id);
        }
      }
      this.previousStates = new Map(raw.map((row) => [row.id, row.state]));
      this.freshIds = new Set(fresh);
      if (this.entries.size > 0 && [...this.entries.values()].every((entry) => entry.state !== "loading")) {
        this.initialComplete = true;
      }
      const activeRows = raw.filter((row) => row.state !== "archived");
      const archived = sortEnded(raw.filter((row) => row.state === "archived"));
      const waiting = sortWaiting(activeRows.filter((row) => isBlockedState(row.state)));
      const childrenByParent = /* @__PURE__ */ new Map();
      for (const row of activeRows) {
        if (!row.child || !row.parentId) continue;
        const list = childrenByParent.get(row.parentId);
        if (list) list.push(row);
        else childrenByParent.set(row.parentId, [row]);
      }
      const sortMembers = (rows) => [
        ...sortWaiting(rows.filter((row) => isBlockedState(row.state))),
        ...sortFailed(rows.filter((row) => row.state === "failed")),
        ...sortRunning(rows.filter((row) => row.state === "running" || row.state === "retrying")),
        ...sortEnded(rows.filter((row) => row.state === "done")),
        ...sortEnded(rows.filter((row) => row.state === "idle" || row.state === "unknown"))
      ];
      const groups = [];
      for (const head of activeRows) {
        if (head.child) continue;
        const children = sortMembers(childrenByParent.get(head.id) ?? []);
        const members = [head, ...children];
        const blocked = members.filter((row) => isBlockedState(row.state));
        const state = blocked.length > 0 ? blocked.some((row) => row.state === "permission") ? "permission" : "question" : head.state;
        groups.push({ head, children, members, state, blocked });
      }
      const groupRank = (group) => group.state === "permission" ? 0 : group.state === "question" ? 1 : group.state === "failed" ? 2 : group.state === "retrying" || group.state === "running" ? 3 : group.state === "done" ? 4 : 5;
      const oldestBlock = (group) => Math.min(...group.blocked.map((row) => row.updatedAt));
      const newestMember = (group) => Math.max(...group.members.map((row) => row.updatedAt));
      groups.sort((a, b) => {
        const rankA = groupRank(a);
        const rankB = groupRank(b);
        if (rankA !== rankB) return rankA - rankB;
        if (rankA <= 1) return oldestBlock(a) - oldestBlock(b) || a.head.id.localeCompare(b.head.id);
        if (rankA === 2) return newestMember(b) - newestMember(a) || a.head.id.localeCompare(b.head.id);
        if (rankA === 3) {
          const runningA = a.state === "retrying" ? 0 : 1;
          const runningB = b.state === "retrying" ? 0 : 1;
          return runningA - runningB || b.head.updatedAt - a.head.updatedAt || a.head.id.localeCompare(b.head.id);
        }
        return b.head.updatedAt - a.head.updatedAt || a.head.id.localeCompare(b.head.id);
      });
      const headsIn = (...states) => groups.filter((group) => states.includes(group.state)).map((group) => group.head);
      const failed = headsIn("failed");
      const running = headsIn("running", "retrying");
      const ended = headsIn("done");
      const idle = headsIn("idle");
      const flatRows = [
        ...waiting,
        ...sortFailed(activeRows.filter((row) => row.state === "failed")),
        ...sortRunning(activeRows.filter((row) => row.state === "running" || row.state === "retrying")),
        ...sortEnded(activeRows.filter((row) => row.state === "done")),
        ...sortEnded(activeRows.filter((row) => row.state === "idle" || row.state === "unknown"))
      ];
      this.currentBlocked = waiting.map((row) => row.id);
      const connectedIds = /* @__PURE__ */ new Set([...this.subs.keys()]);
      for (const project of this.projects) {
        const entry = this.entries.get(project.id);
        if (entry?.connected) connectedIds.add(project.id);
      }
      const connected = this.projects.filter((project) => connectedIds.has(project.id));
      const unconnected = this.projects.filter((project) => !connectedIds.has(project.id));
      const errorProjects = this.projects.filter((project) => this.entries.get(project.id)?.error).map((project) => project.name);
      const counts = {
        blocked: waiting.length,
        failed: failed.length,
        inflight: running.length,
        ended: ended.length,
        idle: idle.length,
        archived: archived.length,
        sessions,
        projects: this.projects.length,
        permissions: waiting.filter((row) => row.state === "permission").length,
        questions: waiting.filter((row) => row.state === "question").length
      };
      const view = {
        phase: this.fatal ? "error" : this.projectsState,
        hasData: this.lastReadyAt > 0,
        sessionsLoaded: this.projects.length === 0 || this.entries.size > 0 && [...this.entries.values()].every((entry) => entry.state !== "loading"),
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
        fresh
      };
      this.updateBadge(view);
      return view;
    }
    isUnconnected(projectId) {
      return !this.subs.has(projectId);
    }
    hasSignal(projectId) {
      return this.signalIds().has(projectId);
    }
    allProjects() {
      return this.projects;
    }
    dispose() {
      this.disposed = true;
      this.unsubProjects?.();
      this.unsubProjects = null;
      for (const unsub of this.subs.values()) {
        try {
          unsub();
        } catch {
        }
      }
      this.subs.clear();
    }
  };

  // panel/src/strings.ts
  var zh = {
    lang: "zh",
    join: "\uFF0C",
    sep: "\xB7",
    unit: { blocked: "\u4E2A\u5728\u7B49\u4F60", running: "\u4E2A\u5728\u8FD0\u884C", failed: "\u4E2A\u5931\u8D25", sessions: "\u4E2A\u4F1A\u8BDD", projects: "\u4E2A\u9879\u76EE" },
    state: {
      permission: "\u6743\u9650",
      question: "\u63D0\u95EE",
      failed: "\u5931\u8D25",
      retrying: "\u91CD\u8BD5\u4E2D",
      running: "\u8FD0\u884C\u4E2D",
      done: "\u5DF2\u5B8C\u6210",
      idle: "\u7A7A\u95F2",
      unknown: "\u672A\u77E5",
      archived: "\u5DF2\u5F52\u6863"
    },
    panel: {
      title: "\u9700\u8981\u4F60",
      summary: {
        blocked: (n) => `${n} \u4E2A\u5728\u7B49\u4F60`,
        running: (n) => `${n} \u4E2A\u5728\u8FD0\u884C`,
        failed: (n) => `${n} \u4E2A\u5931\u8D25`,
        loading: "\u6B63\u5728\u8BFB\u53D6\u2026"
      },
      search: {
        open: "\u641C\u7D22\u4F1A\u8BDD",
        placeholder: "\u641C\u7D22\u4F1A\u8BDD\u6216\u9879\u76EE",
        results: (query, n) => `\u641C\u7D22\u300C${query}\u300D\xB7 ${n} \u4E2A\u7ED3\u679C`,
        empty: "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD"
      },
      more: "\u66F4\u591A\u64CD\u4F5C",
      expandGroup: "\u5C55\u5F00\u5B50\u4F1A\u8BDD",
      collapseGroup: "\u6536\u8D77\u5B50\u4F1A\u8BDD",
      clearWaiting: "\u6CA1\u6709\u4F1A\u8BDD\u5728\u7B49\u4F60",
      goodNews: {
        title: "\u6CA1\u6709\u4F1A\u8BDD\u9700\u8981\u4F60",
        body: (running) => `${running} \u4E2A\u4F1A\u8BDD\u5728\u540E\u53F0\u8FD0\u884C\uFF0C\u6709\u7ED3\u679C\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002`,
        quiet: "\u6CA1\u6709\u6B63\u5728\u8FD0\u884C\u7684\u4F1A\u8BDD\u3002",
        ended: (n, time) => `${n} \u4E2A\u5DF2\u5B8C\u6210 \xB7 ${time}`
      },
      live: (title, state) => `\u65B0\u7684\u7B49\u5F85\uFF1A${title}\uFF0C${state}`
    },
    section: {
      waiting: "\u7B49\u4F60",
      failed: "\u5931\u8D25",
      running: "\u8FDB\u884C\u4E2D",
      ended: "\u5DF2\u7ED3\u675F",
      archived: "\u5DF2\u5F52\u6863",
      more: (n) => `\u8FD8\u6709 ${n} \u6761`,
      endedToggle: (n) => `\u5DF2\u7ED3\u675F ${n}`
    },
    footer: {
      idle: (n) => `\u53E6\u6709 ${n} \u4E2A\u7A7A\u95F2\u4F1A\u8BDD`,
      totals: (projects, sessions) => `${projects} \u4E2A\u9879\u76EE \xB7 ${sessions} \u4E2A\u4F1A\u8BDD`,
      updated: (time) => `\u66F4\u65B0\u4E8E ${time}`,
      updating: "\u6B63\u5728\u66F4\u65B0",
      stale: (time) => `\u663E\u793A\u7684\u662F ${time} \u7684\u7ED3\u679C`
    },
    time: {
      now: "\u521A\u521A",
      minutes: (n) => `${n} \u5206`,
      hours: (n) => `${n} \u5C0F\u65F6`,
      days: (n) => `${n} \u5929`,
      waiting: (duration) => `\u7B49\u4E86 ${duration}`
    },
    aria: {
      row: (title, state, project, waited) => `${title}\uFF0C${state}\uFF0C\u9879\u76EE ${project}${waited ? `\uFF0C\u5DF2\u7B49\u5F85 ${waited}` : ""}`,
      section: (label, n) => `${label}\uFF0C${n} \u4E2A\u4F1A\u8BDD`
    },
    board: {
      heading: "\u4F1A\u8BDD\u770B\u677F",
      updated: (time) => `\u66F4\u65B0\u4E8E ${time}`,
      updating: "\u66F4\u65B0\u4E2D\u2026",
      summary: (blocked, failed, running, sessions) => `${blocked} \u4E2A\u5728\u7B49\u4F60 \xB7 ${failed} \u4E2A\u5931\u8D25 \xB7 ${running} \u4E2A\u5728\u8FD0\u884C \xB7 ${sessions} \u4E2A\u4F1A\u8BDD`,
      needsYou: (n) => `\u9700\u8981\u4F60 ${n}`,
      needsMeta: (blocked, failed) => `${blocked} \u4E2A\u5728\u7B49\u4F60 \xB7 ${failed} \u4E2A\u5931\u8D25`,
      meta: (sessions, projects) => `${sessions} \u4E2A\u4F1A\u8BDD \xB7 ${projects} \u4E2A\u9879\u76EE`,
      column: (n) => `${n} \u4E2A\u4F1A\u8BDD`,
      otherProjects: (projects, sessions) => `\u5176\u4ED6 ${projects} \u4E2A\u9879\u76EE \xB7 ${sessions} \u4E2A\u4F1A\u8BDD`,
      archived: (n) => `\u5DF2\u5F52\u6863 ${n}`,
      projectEmpty: "\u8FD9\u4E2A\u9879\u76EE\u6CA1\u6709\u4F1A\u8BDD",
      projectError: "\u8BFB\u53D6\u5931\u8D25",
      noMatch: "\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD",
      clearFilter: "\u6E05\u9664\u7B5B\u9009",
      openSession: "\u6253\u5F00 \u2192",
      filters: { all: "\u5168\u90E8", needs: "\u9700\u8981\u4F60", running: "\u8FDB\u884C\u4E2D", ended: "\u5DF2\u7ED3\u675F", archived: "\u5DF2\u5F52\u6863" },
      search: "\u641C\u7D22\u4F1A\u8BDD\u6216\u9879\u76EE",
      hideArchived: "\u5F52\u6863\u4F1A\u8BDD\u4E0D\u8FDB\u5165\u961F\u5217",
      chip: { blocked: (n) => `\u7B49\u4F60 ${n}`, failed: (n) => `\u5931\u8D25 ${n}`, running: (n) => `\u8FD0\u884C ${n}` },
      archivedLink: (n) => `\u5DF2\u5F52\u6863 ${n}`,
      moreSessions: (n) => `\u8FD8\u6709 ${n} \u4E2A\u4F1A\u8BDD`,
      moreRows: (n) => `\u8FD8\u6709 ${n} \u4E2A`,
      showAll: "\u663E\u793A\u5168\u90E8",
      fewerSessions: "\u6536\u8D77"
    },
    action: {
      open: "\u6253\u5F00\u4F1A\u8BDD",
      copyTitle: "\u590D\u5236\u6807\u9898",
      copyPath: "\u590D\u5236\u9879\u76EE\u8DEF\u5F84",
      copyDone: "\u5DF2\u590D\u5236",
      sheetTitle: "\u66F4\u591A\u64CD\u4F5C"
    },
    status: {
      blocked: (n) => `${n} \u4E2A\u4F1A\u8BDD\u5728\u7B49\u4F60`,
      detail: (counts) => [
        counts.permissions ? `${counts.permissions} \u4E2A\u6743\u9650` : "",
        counts.questions ? `${counts.questions} \u4E2A\u63D0\u95EE` : "",
        counts.inflight ? `${counts.inflight} \u4E2A\u8FD0\u884C\u4E2D` : "",
        counts.failed ? `${counts.failed} \u4E2A\u5931\u8D25` : ""
      ].filter(Boolean).join(" \xB7 "),
      clear: "\u6CA1\u6709\u4F1A\u8BDD\u5728\u7B49\u4F60",
      clearDetail: (running, failed) => [running ? `${running} \u4E2A\u8FD0\u884C\u4E2D` : "", failed ? `${failed} \u4E2A\u5931\u8D25` : ""].filter(Boolean).join(" \xB7 "),
      runningCount: (n) => `${n} \u4E2A\u8FD0\u884C\u4E2D`,
      failedCount: (n) => `${n} \u4E2A\u5931\u8D25`,
      empty: "\u8FD8\u6CA1\u6709\u4F1A\u8BDD",
      open: "\u6253\u5F00\u63A7\u5236\u5BA4 \u2192",
      partial: (n) => `\xB7 ${n} \u4E2A\u9879\u76EE\u672A\u8BFB\u5230`,
      reading: "\u6B63\u5728\u8BFB\u53D6\u2026",
      error: "\u8BFB\u4E0D\u5230\u4F1A\u8BDD\u72B6\u6001"
    },
    error: {
      partialTitle: (n) => `${n} \u4E2A\u9879\u76EE\u8BFB\u53D6\u5931\u8D25`,
      partialBody: "\u53EF\u80FD\u6F0F\u6389\u7B49\u5F85\u4E2D\u7684\u4F1A\u8BDD\uFF0C\u5176\u4F59\u9879\u76EE\u4ECD\u662F\u6700\u65B0\u3002",
      allTitle: "\u8BFB\u4E0D\u5230\u4F1A\u8BDD\u72B6\u6001",
      allBody: "\u663E\u793A\u7684\u662F\u4E0A\u6B21\u7ED3\u679C\u3002",
      retry: "\u91CD\u8BD5",
      stale: (time) => `\u66F4\u65B0\u4E8E ${time} \xB7 \u8BFB\u53D6\u5931\u8D25`,
      notGrantedTitle: "\u6269\u5C55\u6743\u9650\u672A\u6279\u51C6",
      notGrantedBody: "\u8FD9\u4E2A\u6269\u5C55\u53EA\u7533\u8BF7 sessions \u80FD\u529B\u3002\u8BF7\u5728 \u8BBE\u7F6E \u2192 \u6269\u5C55 \u91CC\u91CD\u65B0\u6279\u51C6\u540E\u6253\u5F00\u3002",
      disabledTitle: "\u6269\u5C55\u5DF2\u6682\u505C",
      disabledBody: "\u5728 \u8BBE\u7F6E \u2192 \u6269\u5C55 \u91CC\u91CD\u65B0\u542F\u7528\u5B83\uFF0C\u961F\u5217\u5C31\u4F1A\u7EE7\u7EED\u66F4\u65B0\u3002",
      unavailableTitle: "\u8FDE\u4E0D\u4E0A OpenChamber",
      unavailableBody: "\u8FD9\u4E2A\u754C\u9762\u9700\u8981\u8FD0\u884C\u5728 OpenChamber \u7684 web \u6216\u684C\u9762\u7AEF\u91CC\u3002"
    },
    overflow: {
      title: (n) => `\u8FD8\u6709 ${n} \u4E2A\u9879\u76EE\u672A\u8FDE\u63A5`,
      body: "\u4E00\u6B21\u6700\u591A\u8FDE\u63A5 31 \u4E2A\u9879\u76EE\uFF0C\u6362\u4E00\u4E2A\u4E0A\u6765\u3002",
      manage: "\u7BA1\u7406",
      blocked: "\u5148\u5904\u7406\u5B8C\u7B49\u5F85\u4E2D\u7684\u4F1A\u8BDD\u518D\u6362\u51FA",
      unconnected: (n) => `${n} \u4E2A\u9879\u76EE\u672A\u8FDE\u63A5`,
      connect: "\u6362\u5165",
      connected: "\u5DF2\u8FDE\u63A5"
    },
    empty: {
      noProjectsTitle: "\u8FD8\u6CA1\u6709\u9879\u76EE",
      noProjectsBody: "\u5728 OpenChamber \u91CC\u6253\u5F00\u4E00\u4E2A\u9879\u76EE\uFF0C\u4F1A\u8BDD\u5C31\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002",
      noSessionsTitle: "\u8FD8\u6CA1\u6709\u4F1A\u8BDD",
      noSessionsBody: "\u5728\u4EFB\u610F\u9879\u76EE\u91CC\u5F00\u59CB\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u5B83\u5C31\u4F1A\u51FA\u73B0\u5728\u8FD9\u6761\u961F\u5217\u91CC\u3002"
    },
    misc: { wt: "wt", retry: "\u91CD\u8BD5", updated: "\u66F4\u65B0\u4E8E" }
  };
  var en = {
    lang: "en",
    join: ", ",
    sep: "\xB7",
    unit: { blocked: "waiting on you", running: "running", failed: "failed", sessions: "sessions", projects: "projects" },
    state: {
      permission: "Permission",
      question: "Question",
      failed: "Failed",
      retrying: "Retrying",
      running: "Running",
      done: "Done",
      idle: "Idle",
      unknown: "Unknown",
      archived: "Archived"
    },
    panel: {
      title: "Needs You",
      summary: {
        blocked: (n) => `${n} waiting on you`,
        running: (n) => `${n} running`,
        failed: (n) => `${n} failed`,
        loading: "Reading\u2026"
      },
      search: {
        open: "Search sessions",
        placeholder: "Search sessions or projects",
        results: (query, n) => `\u201C${query}\u201D \xB7 ${n} results`,
        empty: "No matching sessions"
      },
      more: "More actions",
      expandGroup: "Expand sub-sessions",
      collapseGroup: "Collapse sub-sessions",
      clearWaiting: "Nothing is waiting on you",
      goodNews: {
        title: "Nothing needs you",
        body: (running) => `${running} sessions are running in the background. Results land here.`,
        quiet: "Nothing is running right now.",
        ended: (n, time) => `${n} done \xB7 ${time}`
      },
      live: (title, state) => `New wait: ${title}, ${state}`
    },
    section: {
      waiting: "Waiting on you",
      failed: "Failed",
      running: "In flight",
      ended: "Ended",
      archived: "Archived",
      more: (n) => `${n} more`,
      endedToggle: (n) => `Ended ${n}`
    },
    footer: {
      idle: (n) => `${n} idle sessions`,
      totals: (projects, sessions) => `${projects} projects \xB7 ${sessions} sessions`,
      updated: (time) => `Updated ${time}`,
      updating: "updating",
      stale: (time) => `Showing the ${time} result`
    },
    time: {
      now: "now",
      minutes: (n) => `${n}m`,
      hours: (n) => `${n}h`,
      days: (n) => `${n}d`,
      waiting: (duration) => `waiting ${duration}`
    },
    aria: {
      row: (title, state, project, waited) => `${title}, ${state}, project ${project}${waited ? `, waiting for ${waited}` : ""}`,
      section: (label, n) => `${label}, ${n} sessions`
    },
    board: {
      heading: "Session board",
      updated: (time) => `Updated ${time}`,
      updating: "updating\u2026",
      summary: (blocked, failed, running, sessions) => `${blocked} waiting \xB7 ${failed} failed \xB7 ${running} running \xB7 ${sessions} sessions`,
      needsYou: (n) => `Needs you ${n}`,
      needsMeta: (blocked, failed) => `${blocked} waiting \xB7 ${failed} failed`,
      meta: (sessions, projects) => `${sessions} sessions \xB7 ${projects} projects`,
      column: (n) => `${n} sessions`,
      otherProjects: (projects, sessions) => `${projects} more projects \xB7 ${sessions} sessions`,
      archived: (n) => `${n} archived`,
      projectEmpty: "No sessions in this project",
      projectError: "Could not read",
      noMatch: "No matching sessions",
      clearFilter: "Clear filters",
      openSession: "Open \u2192",
      filters: { all: "All", needs: "Needs you", running: "In flight", ended: "Ended", archived: "Archived" },
      search: "Search sessions or projects",
      hideArchived: "Archived sessions stay out of the queue",
      chip: { blocked: (n) => `${n} waiting`, failed: (n) => `${n} failed`, running: (n) => `${n} running` },
      archivedLink: (n) => `${n} archived`,
      moreSessions: (n) => `${n} more sessions`,
      moreRows: (n) => `${n} more`,
      showAll: "Show all",
      fewerSessions: "Show fewer"
    },
    action: {
      open: "Open session",
      copyTitle: "Copy title",
      copyPath: "Copy project path",
      copyDone: "Copied",
      sheetTitle: "More actions"
    },
    status: {
      blocked: (n) => `${n} ${n === 1 ? "session" : "sessions"} waiting on you`,
      detail: (counts) => [
        counts.permissions ? `${counts.permissions} permission` : "",
        counts.questions ? `${counts.questions} question` : "",
        counts.inflight ? `${counts.inflight} running` : "",
        counts.failed ? `${counts.failed} failed` : ""
      ].filter(Boolean).join(" \xB7 "),
      clear: "Nothing is waiting on you",
      clearDetail: (running, failed) => [running ? `${running} running` : "", failed ? `${failed} failed` : ""].filter(Boolean).join(" \xB7 "),
      runningCount: (n) => `${n} running`,
      failedCount: (n) => `${n} failed`,
      empty: "No sessions yet",
      open: "Open control room \u2192",
      partial: (n) => `\xB7 ${n} projects unread`,
      reading: "Reading\u2026",
      error: "Cannot read session state"
    },
    error: {
      partialTitle: (n) => `Could not read ${n} projects`,
      partialBody: "Some waits may be missing. The rest is up to date.",
      allTitle: "Cannot read session state",
      allBody: "Showing the last result.",
      retry: "Retry",
      stale: (time) => `Updated ${time} \xB7 read failed`,
      notGrantedTitle: "Sessions permission is not approved",
      notGrantedBody: "This extension asks for sessions only. Approve it again in Settings \u2192 Extensions.",
      disabledTitle: "Extension paused",
      disabledBody: "Enable it again in Settings \u2192 Extensions and the queue resumes.",
      unavailableTitle: "Cannot reach OpenChamber",
      unavailableBody: "This view runs inside OpenChamber on web or desktop."
    },
    overflow: {
      title: (n) => `${n} more projects not connected`,
      body: "Up to 31 projects at a time. Swap one in.",
      manage: "Manage",
      blocked: "Clear waiting sessions first",
      unconnected: (n) => `${n} projects not connected`,
      connect: "Swap in",
      connected: "Connected"
    },
    empty: {
      noProjectsTitle: "No projects yet",
      noProjectsBody: "Open a project in OpenChamber and its sessions show up here.",
      noSessionsTitle: "No sessions yet",
      noSessionsBody: "Start a session in any project and it lands in this queue."
    },
    misc: { wt: "wt", retry: "Retry", updated: "Updated" }
  };
  var TABLE = { zh, en };
  var current = en;
  var currentLang = "en";
  function setLocale(locale) {
    const next = (locale ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
    current = TABLE[next];
    currentLang = next;
    return next;
  }
  var t = () => current;
  function formatDuration(ms) {
    const strings = t().time;
    const minutes = Math.floor(Math.max(0, ms) / 6e4);
    if (minutes < 1) return strings.now;
    if (minutes < 60) return strings.minutes(minutes);
    if (minutes < 1440) return strings.hours(Math.floor(minutes / 60));
    return strings.days(Math.floor(minutes / 1440));
  }
  function formatWait(ms) {
    return t().time.waiting(formatDuration(ms));
  }
  var pad = (n) => String(n).padStart(2, "0");
  function formatClock(timestamp) {
    const date = new Date(timestamp);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function metaFor(state, waitedMs, updatedAt, archivedAt) {
    if (state === "permission" || state === "question") return formatWait(waitedMs);
    if (state === "archived") return formatDate(archivedAt ?? updatedAt);
    if (state === "running" || state === "retrying") return formatDuration(Date.now() - updatedAt);
    return formatClock(updatedAt);
  }

  // panel/src/dom.ts
  var el2 = (tag, className = "", text = "", children = []) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    if (children.length > 0) node.append(...children);
    return node;
  };
  var setText2 = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };
  var svg = (size, body, stroke = false) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("width", String(size));
    node.setAttribute("height", String(size));
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("aria-hidden", "true");
    if (stroke) {
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "currentColor");
      node.setAttribute("stroke-width", "1.7");
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
    } else {
      node.setAttribute("fill", "currentColor");
    }
    node.innerHTML = body;
    return node;
  };
  var DOTS = '<circle cx="5" cy="12" r="1.55"/><circle cx="12" cy="12" r="1.55"/><circle cx="19" cy="12" r="1.55"/>';
  var SEARCH = '<path d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z"/>';
  var COPY = '<path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h10A1.5 1.5 0 0 1 20 4.5v10a1.5 1.5 0 0 1-1.5 1.5H17v3.5A1.5 1.5 0 0 1 15.5 21h-10A1.5 1.5 0 0 1 4 19.5v-10A1.5 1.5 0 0 1 5.5 8H7zm2 0h5.5A1.5 1.5 0 0 1 16 7.5v7h2V4.5H9V6zM6 8.5v10h9v-10H6z"/>';
  var OPEN = '<path d="M7.5 16.5 16.5 7.5M9.5 7.5h7v7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';
  var CHECK = '<path d="M5 12.5 9.5 17 19 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';
  var dotsIcon = (size = 14) => svg(size, DOTS);
  var searchIcon = (size = 14) => svg(size, SEARCH);
  var copyIcon = (size = 14) => svg(size, COPY);
  var openIcon = (size = 16) => svg(size, OPEN);
  var checkIcon = (size = 14) => svg(size, CHECK);
  var toneOf = (state) => {
    if (state === "permission" || state === "question") return "warning";
    if (state === "failed") return "error";
    if (state === "running" || state === "retrying") return "info";
    if (state === "done") return "success";
    return null;
  };
  var toneVars = (tone2, node) => {
    node.style.setProperty("--tone", `var(--oc-${tone2})`);
    node.style.setProperty("--tone-text", `var(--oc-${tone2}-text)`);
  };
  var MONO_TONES = ["primary", "success", "info"];
  var projectTone = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = hash * 31 + name.charCodeAt(i) >>> 0;
    return MONO_TONES[hash % MONO_TONES.length] ?? "primary";
  };
  var monogram = (name) => {
    const first = name.trim().charAt(0);
    return first ? first.toLocaleUpperCase() : "#";
  };
  var metaText = (row) => metaFor(row.state, row.waitedMs, row.updatedAt, row.archivedAt);
  var waitAge = (row) => row.waitedMs >= WAIT_ESCALATION_MS;
  var paintMeta = (node, row) => {
    const blocked = row.state === "permission" || row.state === "question";
    node.className = blocked ? "cr-wait" : "";
    if (blocked) node.dataset.age = waitAge(row) ? "1" : "0";
    else delete node.dataset.age;
    setText2(node, metaText(row));
  };
  function createPanelRow(row, freshIds, onFreshPaint, opts = {}) {
    const strings = t();
    const element = el2("div", opts.child ? "cr-row cr-child" : "cr-row");
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    const dot = el2("span", "cr-dot");
    dot.setAttribute("aria-hidden", "true");
    const title = el2("span", "cr-title");
    const sub = el2("span", "cr-sub");
    const metaWrap = el2("span", "cr-meta");
    const meta = el2("span");
    metaWrap.append(meta);
    const main = el2("span", "cr-main", "", [title, sub]);
    const more = el2("button", "cr-more");
    more.type = "button";
    more.tabIndex = 0;
    more.append(dotsIcon());
    element.append(dot, main, metaWrap, more);
    let twist = null;
    if (opts.group) {
      element.dataset.group = "true";
      twist = el2("button", "cr-twist");
      twist.type = "button";
      twist.append(el2("i", "tri"));
      twist.addEventListener("click", (event) => {
        event.stopPropagation();
        opts.onToggle?.(row.id);
      });
      twist.addEventListener("keydown", (event) => event.stopPropagation());
      element.append(twist);
    }
    const paint = (item) => {
      element.dataset.id = item.id;
      element.dataset.state = item.state;
      element.title = item.title;
      dot.dataset.state = item.state;
      const hotWait = (item.state === "permission" || item.state === "question") && item.waitedMs >= WAIT_ESCALATION_MS;
      if (hotWait) dot.dataset.hot = "1";
      else delete dot.dataset.hot;
      title.textContent = "";
      if (opts.search && item.child) title.append(el2("span", "child-mark", "\u21B3"));
      title.append(document.createTextNode(item.title));
      const blocked = item.state === "permission" || item.state === "question";
      sub.textContent = "";
      if (blocked || item.state === "failed") {
        const tone2 = toneOf(item.state) ?? "warning";
        const pill = el2("span", "cr-pill", strings.state[item.state]);
        toneVars(tone2, pill);
        sub.append(pill);
      } else {
        sub.append(el2("span", "cr-lbl", strings.state[item.state]));
      }
      sub.append(el2("span", "cr-proj", item.projectName));
      if (item.branch) {
        sub.append(el2("span", "cr-sep", strings.sep));
        sub.append(el2("span", "cr-branch", `${item.worktree ? "wt/" : ""}${item.branch}`));
      }
      paintMeta(meta, item);
      const waited = blocked ? formatDuration(item.waitedMs) : null;
      element.setAttribute("aria-label", strings.aria.row(item.title, strings.state[item.state], item.projectName, waited));
      more.setAttribute("aria-label", strings.panel.more);
      if (twist) {
        twist.setAttribute("aria-expanded", opts.expanded ? "true" : "false");
        twist.setAttribute("aria-label", opts.expanded ? strings.panel.collapseGroup : strings.panel.expandGroup);
        twist.title = opts.expanded ? strings.panel.collapseGroup : strings.panel.expandGroup;
      }
      if (freshIds.has(item.id)) onFreshPaint(item.id, element);
    };
    paint(row);
    return { element, update: paint };
  }
  function createBoardRow(row, opts = {}) {
    const strings = t();
    const element = el2("div", opts.child ? "brow bchild" : "brow");
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    if (opts.group) element.dataset.group = "true";
    const dot = el2("span", "bdot");
    dot.setAttribute("aria-hidden", "true");
    const title = el2("span", "btitle");
    const meta = el2("span", "bmeta");
    element.append(dot, title);
    let twist = null;
    if (opts.group) {
      twist = el2("button", "b-twist");
      twist.type = "button";
      twist.append(el2("i", "tri"));
      twist.addEventListener("click", (event) => {
        event.stopPropagation();
        opts.onToggle?.(row.id);
      });
      twist.addEventListener("keydown", (event) => event.stopPropagation());
      element.append(twist);
    }
    element.append(meta);
    const paint = (item) => {
      element.dataset.id = item.id;
      element.dataset.state = item.state;
      if (item.archivedAt != null) element.dataset.archived = "true";
      else delete element.dataset.archived;
      element.title = item.title;
      dot.dataset.state = item.state;
      title.textContent = "";
      title.append(document.createTextNode(item.title));
      if (item.worktree) title.append(document.createTextNode(" "), el2("i", "wt", strings.misc.wt));
      const blocked = item.state === "permission" || item.state === "question";
      meta.className = blocked ? "bmeta wait" : "bmeta";
      setText2(meta, metaText(item));
      const waited = blocked ? formatDuration(item.waitedMs) : null;
      element.setAttribute("aria-label", strings.aria.row(item.title, strings.state[item.state], item.projectName, waited));
      if (twist) {
        twist.setAttribute("aria-expanded", opts.expanded ? "true" : "false");
        twist.setAttribute("aria-label", opts.expanded ? strings.panel.collapseGroup : strings.panel.expandGroup);
        twist.title = opts.expanded ? strings.panel.collapseGroup : strings.panel.expandGroup;
      }
    };
    paint(row);
    return { element, update: paint };
  }
  function createNeedCard(row) {
    const strings = t();
    const tone2 = toneOf(row.state) ?? "warning";
    const element = el2("div", "ncard");
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    element.dataset.id = row.id;
    element.dataset.key = row.id;
    element.title = row.title;
    if ((row.state === "permission" || row.state === "question") && row.waitedMs >= WAIT_ESCALATION_MS) {
      element.dataset.hot = "1";
    }
    toneVars(tone2, element);
    const pill = el2("span", "cr-pill", strings.state[row.state]);
    toneVars(tone2, pill);
    const blocked = row.state === "permission" || row.state === "question";
    const top = el2("div", "nc-top", "", [pill, el2("span", "nc-proj", row.projectName)]);
    if (blocked) top.append(el2("span", "nc-wait", formatWait(row.waitedMs)));
    const title = el2("div", "nc-title", row.title);
    const bottom = el2("div", "nc-bot");
    if (row.worktree) bottom.append(el2("i", "wt", strings.misc.wt));
    if (row.branch) bottom.append(el2("span", "nc-branch", row.branch));
    if (!blocked) bottom.append(el2("span", "nc-wait", formatClock(row.updatedAt)));
    bottom.append(el2("span", "nc-open", strings.board.openSession));
    const halo = el2("span", "halo");
    halo.setAttribute("aria-hidden", "true");
    element.append(top, title, bottom, halo);
    const waited = row.state === "permission" || row.state === "question" ? formatDuration(row.waitedMs) : null;
    element.setAttribute("aria-label", strings.aria.row(row.title, strings.state[row.state], row.projectName, waited));
    return { element };
  }
  function createProjectCard(input) {
    const strings = t();
    const { project } = input;
    const section = el2("section", "pcard");
    section.dataset.projectId = project.id;
    section.dataset.collapsed = input.collapsed ? "true" : "false";
    const head = el2("div", "pchead");
    head.setAttribute("role", "button");
    head.tabIndex = 0;
    head.setAttribute("aria-expanded", input.collapsed ? "false" : "true");
    head.dataset.card = project.id;
    const mono2 = el2("span", "pmono", monogram(project.name));
    toneVars(projectTone(project.name), mono2);
    head.append(mono2);
    head.append(el2("span", "pname", project.name));
    if (input.counts.blocked) {
      const chip = el2("span", "chipb", strings.board.chip.blocked(input.counts.blocked));
      chip.dataset.chip = `${project.id}:blocked`;
      toneVars("warning", chip);
      head.append(chip);
    }
    if (input.counts.failed) {
      const chip = el2("span", "chipb", strings.board.chip.failed(input.counts.failed));
      chip.dataset.chip = `${project.id}:failed`;
      toneVars("error", chip);
      head.append(chip);
    }
    if (input.counts.running) {
      const chip = el2("span", "chipb", strings.board.chip.running(input.counts.running));
      chip.dataset.chip = `${project.id}:running`;
      toneVars("info", chip);
      head.append(chip);
    }
    head.append(el2("i", "tri"));
    section.append(head);
    const body = el2("div", "pcardbody");
    body.dataset.collapsed = input.collapsed ? "true" : "false";
    const bodyInner = el2("div", "pcardbody-inner");
    if (input.error) {
      const error = el2("div", "project-error");
      error.append(el2("span", "", `${strings.board.projectError} \xB7 `));
      const retry = el2("button", "", strings.error.retry);
      retry.type = "button";
      retry.dataset.retry = project.id;
      error.append(retry);
      bodyInner.append(error);
    } else if (input.items.length === 0) {
      bodyInner.append(el2("div", "project-error", strings.board.projectEmpty));
    } else {
      let childrenRail = null;
      for (const item of input.items) {
        if (item.group) {
          childrenRail = null;
          bodyInner.append(
            createBoardRow(item.row, {
              group: item.collapsible,
              expanded: item.expanded,
              onToggle: input.onToggleGroup
            }).element
          );
        } else if (item.child) {
          if (!childrenRail) {
            childrenRail = el2("div", "bchildren");
            bodyInner.append(childrenRail);
          }
          childrenRail.append(createBoardRow(item.row, { child: true }).element);
        } else {
          childrenRail = null;
          bodyInner.append(createBoardRow(item.row).element);
        }
      }
    }
    body.append(bodyInner);
    section.append(body);
    const foot = el2("div", "pcfoot");
    foot.append(el2("span", "grow"));
    if (!input.error && (input.hiddenRows > 0 || input.showAll)) {
      const more = el2("button", "link");
      more.type = "button";
      more.dataset.cardMore = project.id;
      more.textContent = input.showAll ? strings.board.fewerSessions : `${strings.board.moreRows(input.hiddenRows)} \xB7 ${strings.board.showAll}`;
      foot.append(more);
    }
    if (input.counts.archived && input.items.length > 0) {
      const link = el2("button", "link", strings.board.archivedLink(input.counts.archived));
      link.type = "button";
      link.dataset.archivedLink = project.id;
      if (foot.childElementCount > 1) foot.append(el2("span", "sep-dot", strings.sep));
      foot.append(link);
    }
    const hasFoot = foot.childElementCount > 1;
    if (hasFoot) bodyInner.append(foot);
    const used = input.items.length * 28 + (hasFoot ? 22 : 0);
    const filler = el2("div", "pfiller");
    filler.setAttribute("aria-hidden", "true");
    filler.style.height = `${Math.max(0, 6 * 28 + 25 - used)}px`;
    bodyInner.append(filler);
    return section;
  }
  function createRowMenu(actions, onPick) {
    const strings = t();
    const menu = el2("div", "rowmenu float");
    menu.setAttribute("role", "menu");
    const labels = {
      open: strings.action.open,
      copyTitle: strings.action.copyTitle,
      copyPath: strings.action.copyPath
    };
    for (const action of actions) {
      const button2 = el2("button");
      button2.type = "button";
      button2.setAttribute("role", "menuitem");
      button2.dataset.action = action;
      button2.append(action === "open" ? openIcon() : copyIcon(), el2("span", "", labels[action]));
      button2.addEventListener("click", () => onPick(action));
      menu.append(button2);
    }
    return menu;
  }
  function createSheet(title, onPick, onClose) {
    const strings = t();
    const layer = el2("div", "sheet-layer");
    const scrim = el2("div", "sheet-scrim");
    scrim.addEventListener("click", onClose);
    const sheet = el2("div", "sheet float");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", strings.action.sheetTitle);
    const head = el2("div", "grab");
    const titleEl = el2("div", "sheet-title", title);
    sheet.append(head, titleEl);
    const actions = [
      ["open", strings.action.open, openIcon()],
      ["copyTitle", strings.action.copyTitle, copyIcon()],
      ["copyPath", strings.action.copyPath, copyIcon()]
    ];
    for (const [action, label, icon2] of actions) {
      const button2 = el2("button", "sact");
      button2.type = "button";
      button2.dataset.action = action;
      button2.append(icon2, el2("span", "", label));
      button2.addEventListener("click", () => onPick(action));
      sheet.append(button2);
    }
    layer.append(scrim, sheet);
    return { layer };
  }
  function skeletonRows(count) {
    const box = el2("div");
    for (let index = 0; index < count; index += 1) {
      const row = el2("div", "skelrow");
      row.append(
        el2("span", "sk dot"),
        el2("div", "", "", [el2("div", "sk t1"), el2("div", "sk t2")]),
        el2("span", "sk m")
      );
      box.append(row);
    }
    return box;
  }
  function summaryParts(view) {
    const strings = t();
    const wrap = el2("span");
    const parts = [
      [view.counts.blocked, "b-warn", strings.unit.blocked],
      [view.counts.inflight, "b-info", strings.unit.running],
      [view.counts.failed, "b-err", strings.unit.failed]
    ];
    parts.forEach(([value, tone2, label], index) => {
      if (index > 0) wrap.append(el2("span", "dot-sep", strings.sep));
      wrap.append(el2("b", tone2, String(value)), el2("span", "", ` ${label}`));
    });
    return wrap;
  }

  // panel/src/motion.ts
  var EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  var reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var keyOf = (element, attribute) => element.getAttribute(attribute);
  function snap(scope, selector, attribute) {
    const map = /* @__PURE__ */ new Map();
    for (const element of scope.querySelectorAll(selector)) {
      const key = keyOf(element, attribute);
      if (key) map.set(key, element.getBoundingClientRect());
    }
    return map;
  }
  function flip(scope, selector, attribute, before, duration) {
    if (reducedMotion()) return;
    for (const element of scope.querySelectorAll(selector)) {
      const key = keyOf(element, attribute);
      if (!key) continue;
      const previous = before.get(key);
      if (!previous) continue;
      const next = element.getBoundingClientRect();
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (!dx && !dy) continue;
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration, easing: EASE }
      );
    }
  }
  function makeFlyer(title, project, from) {
    const element = document.createElement("div");
    element.className = "flyer float";
    element.setAttribute("aria-hidden", "true");
    element.dataset.crFlyer = "1";
    element.style.left = `${from.left}px`;
    element.style.top = `${from.top}px`;
    element.style.width = `${Math.min(Math.max(from.width, 180), 300)}px`;
    const dot = document.createElement("span");
    dot.className = "fdot";
    const text = document.createElement("span");
    text.className = "ft";
    text.textContent = title;
    const proj = document.createElement("span");
    proj.className = "fproj";
    proj.textContent = project;
    element.append(dot, text, proj);
    document.body.append(element);
    return element;
  }
  function flyTo(element, from, to, duration, arc) {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const animation = element.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${dx * 0.6}px, ${dy * 0.6 + arc}px) scale(.985)`,
          opacity: 0.96,
          offset: 0.55
        },
        { transform: `translate(${dx}px, ${dy}px) scale(.9)`, opacity: 0 }
      ],
      { duration, easing: EASE }
    );
    const remove = () => element.remove();
    animation.finished.then(remove, remove);
    window.setTimeout(remove, duration + 120);
  }
  function pulse(element, soft) {
    const halo = element.querySelector(".halo");
    if (!halo) return;
    halo.classList.remove("run", "soft");
    void halo.offsetWidth;
    if (soft) halo.classList.add("soft");
    halo.classList.add("run");
    window.setTimeout(() => halo.classList.remove("run", "soft"), 1e3);
  }
  var countTokens = /* @__PURE__ */ new WeakMap();
  function countTo(element, to, from) {
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
    const step = (time) => {
      if (countTokens.get(element) !== token) return;
      const progress = Math.min(1, (time - t0) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(start + (to - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function popChip(chip) {
    if (!chip || reducedMotion()) return;
    chip.classList.remove("pop");
    void chip.offsetWidth;
    chip.classList.add("pop");
    window.setTimeout(() => chip.classList.remove("pop"), 300);
  }
  function land(element, soft) {
    if (!element) return;
    element.classList.remove("land");
    void element.offsetWidth;
    if (soft) element.classList.add("land-soft");
    element.classList.add("land");
    window.setTimeout(() => element.classList.remove("land", "land-soft"), 560);
  }
  function fadeIn(element, duration) {
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE });
  }
  function removeFlyers() {
    for (const element of document.querySelectorAll("[data-cr-flyer]")) element.remove();
  }

  // panel/src/style.ts
  var BASE_STYLE = String.raw`
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
/* waiting past the one threshold: a slower, quieter ring than the fresh halo */
.cr-dot[data-hot="1"]::after { animation: none; opacity: .25; }
.cr-dot[data-hot="1"]::before {
  content: ""; position: absolute; inset: -4px; border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--oc-warning) 38%, transparent);
  animation: cr-waitpulse 3.4s ease-in-out infinite;
}
@keyframes cr-waitpulse {
  0%, 100% { opacity: .18; transform: scale(.96) }
  50% { opacity: .55; transform: scale(1.08) }
}

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
  var PANEL_STYLE = String.raw`
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
  var PAGE_STYLE = String.raw`
#root.page-root {
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --d-feedback: 120ms;
  --d-state: 200ms;
  --d-layout: 320ms;
  --d-authored: 520ms;
  position: relative; overflow: hidden;
  padding: 16px 20px calc(28px + var(--safe-bottom, 0px));
  max-width: 1480px; margin: 0 auto;
}

.pghead { display: flex; align-items: baseline; gap: 8px; }
.pgtitle { font-size: 14px; font-weight: 600; letter-spacing: -.005em; flex: 1; min-width: 0; }
.pgupd { font-family: var(--oc-mono); font-size: 10.5px; color: var(--oc-muted); font-variant-numeric: tabular-nums; }

/* ---------- tools: underline tabs + sliding indicator ---------- */
.pgtools {
  display: flex; align-items: center; gap: 14px; min-width: 0;
  margin-top: 12px; border-bottom: 1px solid var(--oc-border);
}
.tabs { position: relative; display: flex; gap: 16px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab {
  height: 30px; padding: 0 1px; white-space: nowrap;
  font-size: 11px; color: var(--oc-muted);
  transition: color var(--d-feedback) var(--ease);
}
.tab:hover, .tab:focus-visible { color: var(--oc-fg); }
.tab[aria-selected="true"] { color: var(--oc-fg); }
.tab .n {
  margin-left: 5px; font-family: var(--oc-mono); font-size: 10px;
  color: var(--oc-muted); font-variant-numeric: tabular-nums;
}
.tab-ind {
  position: absolute; left: 0; bottom: -1px; width: 1px; height: 2px;
  background: var(--oc-fg); opacity: .75; border-radius: 1px;
  transform-origin: 0 50%; pointer-events: none;
}
.pgtools .searchslot { margin-left: auto; flex: none; width: 208px; min-width: 0; }
.page-root .tab, .page-root .pchead, .page-root .pcfoot .link, .page-root .boardfoot .link {
  transition: color var(--d-feedback) var(--ease), background var(--d-feedback) var(--ease),
    transform var(--d-feedback) var(--ease);
}
.page-root .tab:active, .page-root .pchead:active, .page-root .pcfoot .link:active, .page-root .boardfoot .link:active {
  transform: scale(.97);
}
#root .pgtools .searchslot input { height: 26px; }

/* ---------- section line ---------- */
.sectline {
  display: flex; align-items: baseline; gap: 6px;
  font-size: 11px; font-weight: 600; letter-spacing: .02em;
  text-transform: uppercase; color: var(--oc-muted);
}
.sectline .n {
  font-family: var(--oc-mono); font-size: 10.5px; font-weight: 400;
  letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums;
}
.sectline .sm { margin-left: auto; font-size: 10.5px; font-weight: 400; letter-spacing: 0; text-transform: none; }

/* ---------- needs-you rail: folds with grid-rows ---------- */
.needs { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 300ms var(--ease); margin-top: 12px; }
.needs[data-collapsed="true"] { grid-template-rows: 0fr; }
.needs-inner { min-height: 0; overflow: hidden; }
.railcards {
  display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x proximity;
  margin: 2px -20px 0; padding: 2px 36px 8px 20px;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 36px), transparent 100%);
  mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 36px), transparent 100%);
}
.railcards::-webkit-scrollbar { display: none; }
.railcards.few { -webkit-mask-image: none; mask-image: none; }
.ncard {
  flex: 0 0 292px; scroll-snap-align: start; position: relative; min-width: 0;
  padding: 8px 12px 9px 12px; border-radius: var(--oc-radius);
  background: color-mix(in srgb, var(--oc-fg) 4%, transparent);
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--tone, var(--oc-fg)) 40%, transparent);
  transition: background 150ms var(--ease), box-shadow 200ms var(--ease);
  cursor: pointer;
}
.ncard:hover, .ncard:focus-visible {
  background: color-mix(in srgb, var(--oc-fg) 6%, transparent);
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--tone, var(--oc-fg)) 62%, transparent);
}
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
.ncard:hover .nc-open, .ncard:focus-visible .nc-open { color: var(--oc-fg); }
.ncard[data-hot="1"] .nc-wait { color: var(--oc-warning-text); font-weight: 600; }
.ncard[data-hot="1"]::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--oc-warning) 32%, transparent);
  animation: cr-cardwait 3.4s ease-in-out infinite;
}
@keyframes cr-cardwait {
  0%, 100% { opacity: .22 }
  50% { opacity: .58 }
}
.railcards .calm { font-size: 11px; color: var(--oc-muted); padding: 8px 2px 12px; }

/* ---------- board ---------- */
.boardsec { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.board { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 10px; align-items: start; }
.board-extra { margin-top: 10px; }
.pcard {
  min-width: 0; border-radius: var(--oc-radius); padding: 10px 10px 4px;
  background: color-mix(in srgb, var(--oc-fg) 4%, transparent);
  transition: background 150ms var(--ease);
}
.pcard:hover { background: color-mix(in srgb, var(--oc-fg) 4.8%, transparent); }
.pchead { display: flex; align-items: center; gap: 5px; padding: 2px 4px 5px; width: 100%; text-align: left; cursor: pointer; border-radius: 4px; }
.pchead:focus-visible { background: var(--oc-hover); }
.pname { flex: 1; min-width: 0; font-size: 12px; font-weight: 600; letter-spacing: -.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pmono {
  flex: none; width: 20px; height: 20px; border-radius: 5px;
  display: grid; place-items: center; user-select: none;
  font-size: 10px; font-weight: 600;
  background: color-mix(in srgb, var(--tone, var(--oc-fg)) 14%, transparent);
  color: var(--tone-text, var(--oc-fg));
}
.pchead .tri { margin-left: 2px; color: var(--oc-muted); transition: transform 200ms var(--ease); }
.pchead[aria-expanded="true"] .tri { transform: rotate(90deg); }
.chipb {
  flex: none; font-size: 10px; font-weight: 500; line-height: 16px; padding: 0 5px;
  border-radius: 4px; background: color-mix(in srgb, var(--tone, var(--oc-fg)) 14%, transparent);
  color: var(--tone-text, var(--oc-muted)); font-variant-numeric: tabular-nums;
}

/* fold with 1fr ↔ 0fr, never height */
.pcardbody { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 280ms var(--ease); }
.pcardbody[data-collapsed="true"] { grid-template-rows: 0fr; }
.pcardbody-inner { min-height: 0; overflow: hidden; }
.pfiller { pointer-events: none; }
.pcard .skelhead { padding: 2px 4px 8px; }

.brow {
  display: grid; grid-template-columns: 11px minmax(0, 1fr) auto auto;
  column-gap: 6px; align-items: center; height: 28px; padding: 0 4px; border-radius: 4px;
  cursor: pointer; transition: background var(--d-feedback) var(--ease);
}
.brow:hover, .brow:focus-visible { background: var(--oc-hover); }
.b-twist { width: 24px; height: 24px; border-radius: 4px; display: grid; place-items: center; color: var(--oc-muted); }
.b-twist:hover, .b-twist:focus-visible { background: var(--oc-active); color: var(--oc-fg); }
.bchildren { margin-left: 12px; padding-left: 6px; border-left: 2px solid color-mix(in srgb, var(--oc-fg) 40%, transparent); }
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
.btitle { font-size: 11.5px; line-height: 1.3; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btitle .child-mark { color: var(--oc-muted); margin-right: 3px; }
.brow[data-state="failed"] .btitle { color: color-mix(in srgb, var(--oc-fg) 90%, transparent); }
.brow[data-state="done"] .btitle, .brow[data-state="idle"] .btitle, .brow[data-state="unknown"] .btitle { color: color-mix(in srgb, var(--oc-fg) 74%, transparent); }
.brow[data-archived="true"] { opacity: .6; }
.bmeta { font-family: var(--oc-mono); font-size: 10px; color: var(--oc-muted); font-variant-numeric: tabular-nums; }
.bmeta.wait { color: var(--oc-warning-text); }

.pcfoot { display: flex; align-items: center; gap: 6px; padding: 3px 4px 6px; font-size: 10px; color: var(--oc-muted); min-height: 22px; }
.pcfoot .link { color: var(--oc-muted); font-size: 10px; }
.pcfoot .link:hover, .pcfoot .link:focus-visible { color: var(--oc-fg); }
.pcfoot .sep-dot { opacity: .5; }
.pcfoot .grow { flex: 1; }
.pcard .project-error { padding: 6px 4px 8px; font-size: 11px; color: var(--oc-muted); }
.pcard .project-error button { color: var(--oc-warning-text); font-size: 11px; }
.pcard .project-error button:hover { text-decoration: underline; }

.boardfoot {
  display: flex; align-items: center; gap: 10px;
  padding-top: 9px; border-top: 1px solid var(--oc-border);
  font-size: 11px; color: var(--oc-muted); flex-wrap: wrap;
}
.boardfoot .link { color: color-mix(in srgb, var(--oc-fg) 80%, transparent); }
.boardfoot .link:hover, .boardfoot .link:focus-visible { color: var(--oc-fg); }
.boardfoot .grow { flex: 1; }
.boardfoot .tri { margin-left: 5px; color: currentColor; display: inline-block; vertical-align: middle; }

/* other projects: same fold primitive */
.others { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 240ms var(--ease); }
.others[data-open="true"] { grid-template-rows: 1fr; }
.others-inner { min-height: 0; overflow: hidden; }

.unconnected { margin-top: 6px; }
.unconnected .orow { border-top: 1px solid var(--oc-border); padding: 6px 0; display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--oc-muted); }
.unconnected .orow:first-child { border-top: 0; }
.unconnected .orow b { flex: 1; min-width: 0; font-weight: 500; color: color-mix(in srgb, var(--oc-fg) 80%, transparent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unconnected .orow button { flex: none; font-size: 10px; color: var(--oc-info-text); }

/* ---------- the authored moment ---------- */
.halo {
  position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--tone, var(--oc-warning)) 65%, transparent);
  opacity: 0;
}
.halo.run { animation: haloBloom 900ms var(--ease) forwards; }
@keyframes haloBloom {
  0% { opacity: .5; transform: scale(1) }
  70% { opacity: .12 }
  100% { opacity: 0; transform: scale(1.035) }
}
.halo.run.soft { animation: haloFade 600ms ease-out forwards; }
@keyframes haloFade { 0% { opacity: .34 } 100% { opacity: 0 } }

.flyer {
  position: fixed; left: 0; top: 0; z-index: 40; pointer-events: none;
  display: flex; align-items: center; gap: 7px;
  padding: 6px 9px; border-radius: 6px;
  background: var(--oc-elevated); color: var(--oc-elevated-fg);
  white-space: nowrap; will-change: transform, opacity;
}
.flyer .fdot { width: 6px; height: 6px; border-radius: 50%; flex: none; background: var(--oc-warning); }
.flyer .ft { font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; }
.flyer .fproj { font-size: 10.5px; color: var(--oc-muted); }

@keyframes chipPop { 0% { transform: scale(.82); opacity: .4 } 60% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
.chipb.pop { animation: chipPop 260ms var(--ease); }

@keyframes landPulse { 0% { background: color-mix(in srgb, var(--oc-info) 9%, transparent) } 100% { background: transparent } }
.brow.land { animation: landPulse 520ms var(--ease); }

/* first paint: only the needs-you rail (and the board block) is choreographed */
.page-root.boot .ncard { animation: railIn var(--d-authored) var(--ease) both; animation-delay: calc(var(--i, 0) * 40ms); }
.page-root.boot .board { animation: boardFade 300ms var(--ease) both; }
@keyframes railIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes boardFade { from { opacity: 0 } to { opacity: 1 } }

/* loading: opaque skeleton over the page, dissolves out */
.page-skel {
  position: absolute; inset: 0; z-index: 8;
  padding: 18px 20px 24px;
  background: var(--oc-bg); opacity: 0; pointer-events: none;
  transition: opacity 300ms var(--ease);
  display: flex; flex-direction: column; gap: 10px;
}
.page-root.is-loading .page-skel { opacity: 1; transition: none; }
.page-root.is-loading > :not(.page-skel) { pointer-events: none; }
.skrail { display: flex; gap: 10px; }
.skrail i, .skgrid i { display: block; border-radius: var(--oc-radius); background: color-mix(in srgb, var(--oc-fg) 4%, transparent); }
.skrail i { flex: 0 0 292px; height: 104px; }
.skgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 10px; }
.skgrid i { height: 112px; }
.skbar { height: 9px; border-radius: 4px; background: color-mix(in srgb, var(--oc-fg) 8%, transparent); }
.skhead { display: flex; gap: 8px; align-items: center; }
.skhead .skbar:nth-child(1) { width: 88px; }
.skhead .skbar:nth-child(2) { width: 150px; opacity: .6; }

.page-root.is-paused .bdot[data-state="retrying"]::after { animation-play-state: paused; }

@media (pointer: coarse), (max-width: 640px) {
  #root.page-root { padding: 14px 14px calc(24px + var(--safe-bottom, 0px)); }
  .railcards { flex-direction: column; overflow: visible; margin: 2px 0 0; padding: 2px 0 6px; -webkit-mask-image: none; mask-image: none; scroll-snap-type: none; }
  .ncard { flex: none; width: 100%; }
  .board { grid-template-columns: minmax(0, 1fr); }
  .pgtools { gap: 8px; }
  .pgtools .searchslot { width: 140px; }
  .tab { height: 28px; }
  .brow { height: 34px; }
}

@media (prefers-reduced-motion: reduce) {
  .needs, .pcardbody, .pchead .tri, .others { transition: none; }
  .page-root .tab:active, .page-root .pchead:active, .page-root .pcfoot .link:active, .page-root .boardfoot .link:active { transform: none; }
  .page-skel { transition-duration: 160ms; }
  .page-root.boot .ncard, .page-root.boot .board { animation: none; }
  .halo.run { animation: haloFade 600ms ease-out forwards; }
  .bdot[data-state="retrying"]::after { animation: none; opacity: .7; }
  .brow.land, .chipb.pop { animation: none; }
  .cr-dot[data-hot="1"]::before, .ncard[data-hot="1"]::after { animation: none; opacity: .45; }
}
`;
  var STATUS_STYLE = String.raw`
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

  // panel/src/main.ts
  var host = connectHost();
  var root = document.querySelector("#root");
  if (!root) throw new Error("Missing #root");
  var styleEl = document.createElement("style");
  styleEl.textContent = BASE_STYLE;
  document.head.append(styleEl);
  var DEBUG = false;
  var debug = (...args) => {
    if (DEBUG) console.debug("[control-room]", ...args);
  };
  var isTouch = () => document.documentElement.dataset.pointer === "coarse" || window.matchMedia("(pointer: coarse)").matches;
  var isBlocked = (state) => state === "permission" || state === "question";
  var openSession = (sessionId) => {
    void host.openSession(sessionId).catch((error) => debug("openSession", error));
  };
  var copyText = async (text) => {
    try {
      await host.writeClipboard(text.slice(0, 32e3));
      void host.toast({ kind: "success", message: t().action.copyDone }).catch(() => void 0);
    } catch (error) {
      debug("clipboard", error);
    }
  };
  var toggleCollapsed = (store, projectId) => {
    store.toggleProjectCollapsed(projectId);
  };
  function startClock(onTick) {
    let timer = 0;
    const tick = () => {
      if (document.hidden) return;
      onTick();
    };
    const arm = () => {
      window.clearInterval(timer);
      timer = window.setInterval(tick, 3e4);
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        tick();
        arm();
      }
    });
    arm();
  }
  function refreshTimes(scope, store) {
    const view = store.run();
    const byId = new Map(view.rows.map((row) => [row.id, row]));
    for (const node of scope.querySelectorAll("[data-id]")) {
      const row = node.dataset.id ? byId.get(node.dataset.id) : void 0;
      if (!row) continue;
      const blocked = isBlocked(row.state);
      const meta = node.querySelector(".cr-wait, .bmeta") ?? node.querySelector(".nc-wait");
      if (meta) {
        const text = metaFor(row.state, row.waitedMs, row.updatedAt, row.archivedAt);
        if (meta.textContent !== text) meta.textContent = text;
        if (blocked && meta.classList.contains("cr-wait")) meta.dataset.age = row.waitedMs >= 30 * 6e4 ? "1" : "0";
      }
    }
  }
  function mountPanel() {
    styleEl.textContent = BASE_STYLE + PANEL_STYLE;
    root.className = "panel-root";
    const strings = t();
    const live = el2("div", "gone");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    const header = el2("div", "phead");
    const title = el2("div", "ptitle", strings.panel.title);
    const searchBtn = el2("button", "iconbtn");
    searchBtn.type = "button";
    searchBtn.setAttribute("aria-label", strings.panel.search.open);
    searchBtn.setAttribute("aria-expanded", "false");
    searchBtn.append(searchIcon(15));
    const summary = el2("div", "psum");
    const bannerSlot = el2("div", "banner-slot");
    bannerSlot.hidden = true;
    const searchRow = el2("div", "searchrow");
    searchRow.hidden = true;
    const manageSlot = el2("div", "unconnected");
    manageSlot.hidden = true;
    const queue = el2("div", "pqueue");
    const emptySlot = el2("div", "empty-slot");
    emptySlot.hidden = true;
    const foot = el2("div", "pfoot");
    header.append(title, searchBtn);
    root.append(header, summary, bannerSlot, searchRow, manageSlot, queue, emptySlot, foot, live);
    let query = "";
    const search = mountSearchField(searchRow, {
      value: "",
      placeholder: strings.panel.search.placeholder,
      label: strings.panel.search.open,
      onChange: (value) => {
        query = value;
        render();
      }
    });
    searchBtn.addEventListener("click", () => {
      const open = searchRow.hidden;
      searchRow.hidden = !open;
      searchBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        search.update({ placeholder: t().panel.search.placeholder, label: t().panel.search.open });
        searchRow.querySelector("input")?.focus();
      } else {
        query = "";
        search.update({ value: "" });
        render();
      }
    });
    searchRow.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      searchRow.hidden = true;
      searchBtn.setAttribute("aria-expanded", "false");
      query = "";
      search.update({ value: "" });
      render();
    });
    const store = new ControlRoomStore(host, "panel");
    const expanded = { waiting: false, failed: false, running: false };
    const rowCaches = /* @__PURE__ */ new Map();
    const cacheFor = (key) => {
      const existing = rowCaches.get(key);
      if (existing) return existing;
      const created = /* @__PURE__ */ new Map();
      rowCaches.set(key, created);
      return created;
    };
    let emptyHandle = null;
    let emptyKey = "";
    let bannerHandle = null;
    let menu = null;
    let lastLive = 0;
    let manageOpen = false;
    const freshIds = /* @__PURE__ */ new Set();
    const onFresh = (_id, node) => {
      if (node.dataset.fresh === "1") return;
      node.dataset.fresh = "1";
      node.classList.add("cr-fresh");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => node.classList.remove("cr-fresh"), reduce ? 1200 : 600);
    };
    const closeMenu = () => {
      if (menu) {
        menu.remove();
        menu = null;
      }
    };
    const openMenuFor = (row, anchor) => {
      closeMenu();
      const actions = isTouch() ? ["open", "copyTitle", "copyPath"] : ["copyTitle", "copyPath"];
      const pick = (action) => {
        closeMenu();
        if (action === "open") openSession(row.id);
        else if (action === "copyTitle") void copyText(row.title);
        else void copyText(row.projectDirectory);
      };
      if (isTouch()) {
        root.setAttribute("aria-hidden", "true");
        const sheet = createSheet(row.title, pick, () => close2());
        document.body.append(sheet.layer);
        const onKey = (event) => {
          if (event.key === "Escape") close2();
        };
        const close2 = () => {
          sheet.layer.remove();
          root.removeAttribute("aria-hidden");
          document.removeEventListener("keydown", onKey);
        };
        document.addEventListener("keydown", onKey);
        const first = sheet.layer.querySelector(".sact");
        first?.focus();
        let startY = 0;
        sheet.layer.addEventListener("touchstart", (event) => {
          startY = event.touches[0]?.clientY ?? 0;
        }, { passive: true });
        sheet.layer.addEventListener("touchend", (event) => {
          const endY = event.changedTouches[0]?.clientY ?? startY;
          if (endY - startY > 60) close2();
        }, { passive: true });
        return;
      }
      const element = createRowMenu(actions, pick);
      document.body.append(element);
      const rect = anchor.getBoundingClientRect();
      const width = Math.max(156, element.offsetWidth);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      let top = rect.bottom + 4;
      if (top + element.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - element.offsetHeight - 4);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      menu = element;
      const close = (event) => {
        if (event.type === "keydown" && event.key !== "Escape") return;
        if (event.type === "click" && element.contains(event.target)) return;
        closeMenu();
        document.removeEventListener("click", close, true);
        document.removeEventListener("keydown", close);
        window.removeEventListener("scroll", close, true);
      };
      document.addEventListener("click", close, true);
      document.addEventListener("keydown", close);
      window.addEventListener("scroll", close, true);
    };
    const rowById = /* @__PURE__ */ new Map();
    queue.addEventListener("click", (event) => {
      const target = event.target;
      const more = target.closest(".cr-more");
      if (more) {
        event.stopPropagation();
        const row2 = more.closest(".cr-row");
        const found = row2?.dataset.id ? rowById.get(row2.dataset.id) : void 0;
        if (found) openMenuFor(found, more);
        return;
      }
      const row = target.closest(".cr-row");
      if (row?.dataset.id) openSession(row.dataset.id);
    });
    queue.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target.closest(".cr-more")) return;
      const row = target.closest(".cr-row");
      if (!row) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (row.dataset.id) openSession(row.dataset.id);
        return;
      }
      const rows = [...queue.querySelectorAll(".cr-row")];
      const index = rows.indexOf(row);
      if (index < 0) return;
      let next = index;
      if (event.key === "ArrowDown") next = Math.min(rows.length - 1, index + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = rows.length - 1;
      else return;
      event.preventDefault();
      rows[next]?.focus();
    });
    const sectionHead = (label, count, opts = {}) => {
      const stringsNow = t();
      if (opts.ended) {
        const button2 = el2("button", "sect ended");
        button2.type = "button";
        button2.setAttribute("aria-expanded", opts.open ? "true" : "false");
        button2.setAttribute("aria-label", stringsNow.aria.section(label, count));
        button2.append(el2("span", "", `${label} `), el2("span", "n", String(count)), el2("span", "spacer"), el2("i", "tri"));
        button2.addEventListener("click", () => opts.onToggle?.());
        return button2;
      }
      const node = el2("div", "sect");
      if (opts.tone) node.dataset.tone = opts.tone;
      node.setAttribute("aria-label", stringsNow.aria.section(label, count));
      node.append(el2("span", "", `${label} `), el2("span", "n", String(count)));
      return node;
    };
    const moreLink = (label, onClick) => {
      const button2 = el2("button", "sect morelink");
      button2.type = "button";
      button2.textContent = label;
      button2.addEventListener("click", onClick);
      return button2;
    };
    const groupsById = /* @__PURE__ */ new Map();
    const toggleGroup = (id) => {
      const group = groupsById.get(id);
      if (!group) return;
      store.toggleGroupExpanded(group);
      render();
    };
    const rowElement = (row, opts = {}) => {
      const key = `${row.id}|${opts.group ? "g" : ""}${opts.child ? "c" : ""}${opts.search ? "s" : ""}|${opts.expanded ? 1 : 0}`;
      let entry = cacheFor("rows").get(key);
      if (!entry) {
        entry = createPanelRow(row, freshIds, onFresh, { ...opts, onToggle: toggleGroup });
        cacheFor("rows").set(key, entry);
      } else {
        entry.update(row);
      }
      return entry.element;
    };
    const renderGroups = (container, groups) => {
      for (const group of groups) {
        const expanded2 = store.isGroupExpanded(group);
        const collapsible = group.children.length > 0 && group.blocked.length === 0;
        container.append(rowElement(group.head, { group: collapsible, expanded: expanded2 }));
        if (expanded2 && group.children.length > 0) {
          const rail = el2("div", "cr-children");
          for (const child of group.children) rail.append(rowElement(child, { child: true }));
          container.append(rail);
        }
      }
    };
    const showEmpty = (key, titleText, body, action) => {
      emptySlot.hidden = false;
      queue.hidden = true;
      if (emptyKey === key) return;
      emptyKey = key;
      emptyHandle?.dispose();
      emptySlot.textContent = "";
      emptyHandle = mountEmpty(emptySlot, { title: titleText, body, ...action ? { action } : {} });
    };
    const hideEmpty = () => {
      emptyKey = "";
      emptyHandle?.dispose();
      emptyHandle = null;
      emptySlot.textContent = "";
      emptySlot.hidden = true;
      queue.hidden = false;
    };
    const renderBanner = (view) => {
      const stringsNow = t();
      const retry = { label: stringsNow.error.retry, onClick: () => void store.retry() };
      let props = null;
      if (view.fatal) props = null;
      else if (view.phase === "error" && view.hasData) {
        props = { tone: "error", title: stringsNow.error.allTitle, body: stringsNow.error.allBody, action: retry };
      } else if (view.errorProjects.length > 0) {
        props = {
          tone: "warning",
          title: stringsNow.error.partialTitle(view.errorProjects.length),
          body: stringsNow.error.partialBody,
          action: retry
        };
      } else if (view.unconnected.length > 0) {
        props = {
          tone: "warning",
          title: stringsNow.overflow.title(view.unconnected.length),
          body: stringsNow.overflow.body,
          action: {
            label: stringsNow.overflow.manage,
            onClick: () => {
              manageOpen = !manageOpen;
              render();
            }
          }
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
    const renderManage = (view) => {
      const stringsNow = t();
      manageSlot.textContent = "";
      if (!manageOpen || view.unconnected.length === 0) {
        manageSlot.hidden = true;
        return;
      }
      manageSlot.hidden = false;
      for (const project of view.unconnected) {
        const row = el2("div", "orow");
        row.append(el2("b", "", project.name));
        const button2 = el2("button", "", stringsNow.overflow.connect);
        button2.type = "button";
        button2.addEventListener("click", () => {
          if (!store.connect(project.id)) {
            void host.toast({ kind: "info", message: stringsNow.overflow.blocked }).catch(() => void 0);
          } else {
            manageOpen = false;
            render();
          }
        });
        row.append(button2);
        manageSlot.append(row);
      }
    };
    const searchHits = (view) => {
      const needle = query.trim().toLowerCase();
      return view.flatRows.filter(
        (row) => `${row.title} ${row.projectName} ${row.branch ?? ""}`.toLowerCase().includes(needle)
      );
    };
    const renderQueue = (view) => {
      const stringsNow = t();
      queue.textContent = "";
      rowById.clear();
      for (const row of view.rows) rowById.set(row.id, row);
      groupsById.clear();
      for (const group of view.groups) groupsById.set(group.head.id, group);
      freshIds.clear();
      for (const id of view.fresh) freshIds.add(id);
      if (query.trim()) {
        const hits = searchHits(view);
        if (hits.length === 0) {
          queue.append(el2("div", "emptylist", stringsNow.panel.search.empty));
          return;
        }
        const box = el2("div");
        for (const row of hits) box.append(rowElement(row, { search: true }));
        queue.append(box);
        return;
      }
      if (view.waiting.length === 0 && view.failed.length === 0) {
        const news = el2("div", "goodnews");
        const ring2 = el2("span", "okring");
        ring2.append(checkIcon(14));
        news.append(ring2, el2("h4", "", stringsNow.panel.goodNews.title));
        news.append(
          el2("p", "", view.counts.inflight ? stringsNow.panel.goodNews.body(view.counts.inflight) : stringsNow.panel.goodNews.quiet)
        );
        if (view.ended.length > 0) {
          news.append(el2("div", "endedline", stringsNow.panel.goodNews.ended(view.ended.length, formatClock(view.ended[0].updatedAt))));
        }
        queue.append(news);
      } else if (view.waiting.length === 0) {
        const nowait = el2("div", "nowait");
        const tick = el2("span", "tick");
        tick.append(checkIcon(12));
        nowait.append(tick, el2("span", "", stringsNow.panel.clearWaiting));
        queue.append(nowait);
      }
      const sessionCount = (groups) => groups.reduce((total, group) => total + group.members.length, 0);
      const waitingGroups = view.groups.filter((group) => isBlocked(group.state));
      if (waitingGroups.length > 0 || view.failed.length > 0) {
        const block = el2("div", "waitblock");
        block.append(sectionHead(stringsNow.section.waiting, view.waiting.length, { tone: "warn" }));
        const list = el2("div");
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
            })
          );
        }
        queue.append(block);
      }
      const failedGroups = view.groups.filter((group) => group.state === "failed");
      if (failedGroups.length > 0) {
        queue.append(sectionHead(stringsNow.section.failed, view.failed.length, { tone: "err" }));
        const list = el2("div");
        const cap = expanded.failed ? failedGroups.length : 3;
        renderGroups(list, failedGroups.slice(0, cap));
        queue.append(list);
        const hidden = sessionCount(failedGroups.slice(cap));
        if (!expanded.failed && hidden > 0) {
          queue.append(
            moreLink(stringsNow.section.more(hidden), () => {
              expanded.failed = true;
              render();
            })
          );
        }
      }
      const runningGroups = view.groups.filter((group) => group.state === "running" || group.state === "retrying");
      if (runningGroups.length > 0) {
        queue.append(sectionHead(stringsNow.section.running, view.running.length));
        const list = el2("div");
        const cap = expanded.running ? runningGroups.length : 5;
        renderGroups(list, runningGroups.slice(0, cap));
        queue.append(list);
        const hidden = sessionCount(runningGroups.slice(cap));
        if (!expanded.running && hidden > 0) {
          queue.append(
            moreLink(stringsNow.section.more(hidden), () => {
              expanded.running = true;
              render();
            })
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
        }
      });
      if (view.ended.length === 0) {
        const button2 = endedHead;
        button2.disabled = true;
        button2.style.cursor = "default";
      }
      queue.append(endedHead);
      if (endedOpen && view.ended.length > 0) {
        const endedGroups = view.groups.filter((group) => group.state === "done");
        const list = el2("div", "endedbox");
        renderGroups(list, endedGroups.slice(0, 8));
        queue.append(list);
        const hidden = sessionCount(endedGroups.slice(8));
        if (hidden > 0) queue.append(el2("div", "emptylist", stringsNow.section.more(hidden)));
      }
    };
    const renderFoot = (view) => {
      const stringsNow = t();
      foot.textContent = "";
      const idle = view.counts.idle;
      if (idle > 0) {
        const first = el2("div", "row2");
        first.append(el2("span", "", stringsNow.footer.idle(idle)));
        foot.append(first);
      }
      const second = el2("div", "row2");
      second.append(el2("span", "", stringsNow.footer.totals(view.counts.projects, view.counts.sessions)));
      second.append(el2("span", "grow"));
      if (view.hasData) {
        if (view.phase === "error") second.append(el2("span", "", stringsNow.error.stale(formatClock(view.updatedAt))));
        else if (view.phase === "loading")
          second.append(el2("span", "", `${stringsNow.footer.updated(formatClock(view.updatedAt))} \xB7 ${stringsNow.footer.updating}`));
        else second.append(el2("span", "", stringsNow.footer.updated(formatClock(view.updatedAt))));
      }
      foot.append(second);
    };
    const render = () => {
      const stringsNow = t();
      const view = store.run();
      title.textContent = stringsNow.panel.title;
      searchBtn.setAttribute("aria-label", stringsNow.panel.search.open);
      summary.textContent = "";
      if (view.phase === "loading" && !view.hasData) {
        summary.append(el2("span", "", stringsNow.panel.summary.loading));
      } else if (query.trim()) {
        summary.append(el2("span", "", stringsNow.panel.search.results(query.trim(), searchHits(view).length)));
      } else {
        summary.append(summaryParts(view));
      }
      renderBanner(view);
      renderManage(view);
      if (view.fatal) {
        const copy = view.fatal === "NOT_GRANTED" ? [stringsNow.error.notGrantedTitle, stringsNow.error.notGrantedBody] : view.fatal === "DISABLED" ? [stringsNow.error.disabledTitle, stringsNow.error.disabledBody] : [stringsNow.error.unavailableTitle, stringsNow.error.unavailableBody];
        showEmpty(
          `fatal:${view.fatal}`,
          copy[0],
          copy[1],
          view.fatal === "NOT_GRANTED" ? void 0 : { label: stringsNow.error.retry, onClick: () => void store.retry() }
        );
        foot.hidden = true;
        summary.hidden = true;
        return;
      }
      foot.hidden = false;
      summary.hidden = false;
      if (view.phase === "error" && !view.hasData) {
        showEmpty("projects-error", stringsNow.error.allTitle, "", {
          label: stringsNow.error.retry,
          onClick: () => void store.retry()
        });
        foot.hidden = true;
        return;
      }
      if (!view.hasData || view.counts.sessions === 0 && !view.sessionsLoaded) {
        hideEmpty();
        queue.textContent = "";
        queue.append(skeletonRows(3));
        foot.hidden = true;
        return;
      }
      if (view.counts.projects === 0) {
        showEmpty("no-projects", stringsNow.empty.noProjectsTitle, stringsNow.empty.noProjectsBody);
        renderFoot(view);
        return;
      }
      if (view.counts.sessions === 0 && view.phase === "ready" && view.sessionsLoaded) {
        showEmpty("no-sessions", stringsNow.empty.noSessionsTitle, stringsNow.empty.noSessionsBody);
        renderFoot(view);
        return;
      }
      hideEmpty();
      renderQueue(view);
      renderFoot(view);
      if (view.fresh.length > 0 && Date.now() - lastLive > 3e4) {
        const first = view.rows.find((row) => row.id === view.fresh[0]);
        if (first) {
          lastLive = Date.now();
          const state = stringsNow.state[first.state];
          live.textContent = "";
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
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) store.run();
    });
    debug("panel mounted");
  }
  function mountPage() {
    styleEl.textContent = BASE_STYLE + PAGE_STYLE;
    root.className = "page-root";
    const page = root;
    const strings = t();
    const live = el2("div", "gone");
    live.setAttribute("aria-live", "polite");
    const head = el2("div", "pghead");
    const title = el2("div", "pgtitle", strings.panel.title);
    const updated = el2("div", "pgupd");
    head.append(title, updated);
    const tools = el2("div", "pgtools");
    const tabsBar = el2("div", "tabs");
    tabsBar.setAttribute("role", "tablist");
    const tabButtons = /* @__PURE__ */ new Map();
    const tabCounts = /* @__PURE__ */ new Map();
    const order = ["all", "needs", "running", "ended", "archived"];
    for (const id of order) {
      const button2 = el2("button", "tab");
      button2.type = "button";
      button2.setAttribute("role", "tab");
      button2.dataset.filter = id;
      const label = el2("span", "tab-label");
      const count = el2("span", "n");
      button2.append(label, count);
      tabsBar.append(button2);
      tabButtons.set(id, button2);
      tabCounts.set(id, count);
    }
    const indicator = el2("span", "tab-ind");
    indicator.setAttribute("aria-hidden", "true");
    tabsBar.append(indicator);
    const searchSlot = el2("div", "searchslot");
    tools.append(tabsBar, searchSlot);
    const bannerSlot = el2("div", "banner-slot");
    bannerSlot.hidden = true;
    const needs = el2("section", "needs");
    needs.setAttribute("aria-label", t().board.filters.needs);
    needs.dataset.collapsed = "false";
    const needsInner = el2("div", "needs-inner");
    const railLine = el2("div", "sectline");
    const railLabel = el2("span", "", t().board.filters.needs);
    const railCount = el2("span", "n", "0");
    const railMeta = el2("span", "sm");
    railLine.append(railLabel, railCount, railMeta);
    const rail = el2("div", "railcards");
    needsInner.append(railLine, rail);
    needs.append(needsInner);
    const boardSection = el2("section", "boardsec");
    const boardLine = el2("div", "sectline");
    const boardLabel = el2("span", "", strings.board.heading);
    const boardMeta = el2("span", "sm");
    boardLine.append(boardLabel, boardMeta);
    const board = el2("div", "board");
    const boardFoot = el2("div", "boardfoot");
    const othersWrap = el2("div", "others");
    othersWrap.dataset.open = "false";
    const othersInner = el2("div", "others-inner");
    const extraBoard = el2("div", "board board-extra");
    othersInner.append(extraBoard);
    othersWrap.append(othersInner);
    const unconnected = el2("div", "unconnected");
    unconnected.hidden = true;
    const emptySlot = el2("div", "empty-slot");
    emptySlot.hidden = true;
    const skel = el2("div", "page-skel");
    skel.setAttribute("aria-hidden", "true");
    const skHead = el2("div", "skhead");
    skHead.append(el2("i", "skbar"), el2("i", "skbar"));
    const skRail = el2("div", "skrail");
    for (let index = 0; index < 3; index += 1) skRail.append(el2("i"));
    const skGrid = el2("div", "skgrid");
    for (let index = 0; index < 6; index += 1) skGrid.append(el2("i"));
    const skFoot = el2("div", "skhead");
    skFoot.append(el2("i", "skbar"));
    skel.append(skHead, skRail, skGrid, skFoot);
    boardSection.append(boardLine, board, boardFoot, othersWrap);
    page.append(head, tools, bannerSlot, needs, boardSection, unconnected, emptySlot, live, skel);
    const store = new ControlRoomStore(host, "page");
    const saved = store.getBoard();
    let filter = order.includes(saved.tab) ? saved.tab : "all";
    let query = saved.query;
    let othersOpen = saved.others;
    let unconnectedOpen = false;
    let storageHydrated = false;
    const CARD_ROW_LIMIT = 6;
    const cardShowAll = /* @__PURE__ */ new Set();
    const pageGroups = /* @__PURE__ */ new Map();
    const pendingFlip = { cards: false };
    let pendingIndicator = false;
    let bootIndex = false;
    let contentReady = false;
    const pageStates = /* @__PURE__ */ new Map();
    const lastCounts = /* @__PURE__ */ new Map();
    const prevBlockedChips = /* @__PURE__ */ new Map();
    const flightTimers = [];
    const prefersReduced = () => reducedMotion();
    const findById = (selector, id) => {
      for (const element of page.querySelectorAll(selector)) {
        if (element.dataset.id === id) return element;
      }
      return null;
    };
    const clearFlights = () => {
      removeFlyers();
      for (const timer of flightTimers) window.clearTimeout(timer);
      flightTimers.length = 0;
      for (const element of page.querySelectorAll("[data-cr-ghost]")) {
        element.style.opacity = "";
        delete element.dataset.crGhost;
      }
    };
    const toggleBoardGroup = (id) => {
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
      }
    });
    let emptyHandle = null;
    let emptyKey = "";
    let bannerHandle = null;
    const showEmpty = (key, titleText, body, action) => {
      emptySlot.hidden = false;
      if (emptyKey === key) return;
      emptyKey = key;
      emptyHandle?.dispose();
      emptySlot.textContent = "";
      emptyHandle = mountEmpty(emptySlot, { title: titleText, body, ...action ? { action } : {} });
    };
    const hideEmpty = () => {
      emptyKey = "";
      emptyHandle?.dispose();
      emptyHandle = null;
      emptySlot.textContent = "";
      emptySlot.hidden = true;
    };
    const setSectionsVisible = (visible) => {
      needs.hidden = !visible;
      boardSection.hidden = !visible;
      unconnected.hidden = !visible;
    };
    const renderBanner = (view) => {
      const stringsNow = t();
      const retry = { label: stringsNow.error.retry, onClick: () => void store.retry() };
      let props = null;
      if (view.phase === "error" && view.hasData) {
        props = { tone: "error", title: stringsNow.error.allTitle, body: stringsNow.error.allBody, action: retry };
      } else if (view.errorProjects.length > 0) {
        props = {
          tone: "warning",
          title: stringsNow.error.partialTitle(view.errorProjects.length),
          body: stringsNow.error.partialBody,
          action: retry
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
    const matchesQuery = (row) => {
      if (!query.trim()) return true;
      const needle = query.trim().toLowerCase();
      return `${row.title} ${row.projectName} ${row.branch ?? ""}`.toLowerCase().includes(needle);
    };
    const rowsForTab = (view) => {
      const base = view.rows.filter((row) => filter === "archived" ? row.state === "archived" : row.state !== "archived");
      const rows = base.filter(matchesQuery);
      if (filter === "needs") return rows.filter((row) => isBlocked(row.state) || row.state === "failed");
      if (filter === "running") return rows.filter((row) => row.state === "running" || row.state === "retrying");
      if (filter === "ended") return rows.filter((row) => row.state === "done");
      return rows;
    };
    const sortForBoard = (rows) => {
      const groups = [
        rows.filter((row) => isBlocked(row.state)),
        rows.filter((row) => row.state === "failed"),
        rows.filter((row) => row.state === "retrying" || row.state === "running"),
        rows.filter((row) => row.state === "done"),
        rows.filter((row) => row.state === "idle" || row.state === "unknown"),
        rows.filter((row) => row.state === "archived")
      ];
      const byId = (a, b) => a.id.localeCompare(b.id);
      groups[0] = [...groups[0]].sort((a, b) => a.updatedAt - b.updatedAt || byId(a, b));
      for (let index = 1; index < groups.length; index += 1) {
        groups[index] = [...groups[index]].sort((a, b) => b.updatedAt - a.updatedAt || byId(a, b));
      }
      return groups.flat();
    };
    const hideBoard = () => {
      board.textContent = "";
      extraBoard.textContent = "";
      boardFoot.hidden = true;
      boardMeta.textContent = "";
    };
    const countsFor = (view, projectId) => {
      const counts = { blocked: 0, failed: 0, running: 0, done: 0, archived: 0 };
      for (const row of view.rows) {
        if (row.projectId !== projectId) continue;
        if (isBlocked(row.state)) counts.blocked += 1;
        else if (row.state === "failed") counts.failed += 1;
        else if (row.state === "running" || row.state === "retrying") counts.running += 1;
        else if (row.state === "done") counts.done += 1;
        else if (row.state === "archived") counts.archived += 1;
      }
      return counts;
    };
    const renderCards = (view, rows) => {
      const stringsNow = t();
      const projects = store.allProjects();
      const byProject = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const list = byProject.get(row.projectId);
        if (list) list.push(row);
        else byProject.set(row.projectId, [row]);
      }
      const visible = projects.filter((project) => (byProject.get(project.id)?.length ?? 0) > 0);
      const score = (project) => {
        const counts = countsFor(view, project.id);
        if (counts.blocked > 0) return 0;
        if (counts.failed > 0) return 1;
        if (counts.running > 0) return 2;
        return 3;
      };
      const latest = (project) => (byProject.get(project.id) ?? []).reduce((max, row) => Math.max(max, row.updatedAt), 0);
      visible.sort((a, b) => score(a) - score(b) || latest(b) - latest(a) || a.name.localeCompare(b.name));
      const primary2 = visible.slice(0, 16);
      const extra = visible.slice(16);
      pageGroups.clear();
      for (const group of view.groups) pageGroups.set(group.head.id, group);
      const tabMember = (row) => {
        if (filter === "needs") return isBlocked(row.state) || row.state === "failed";
        if (filter === "running") return row.state === "running" || row.state === "retrying";
        if (filter === "ended") return row.state === "done";
        if (filter === "archived") return row.state === "archived";
        return row.state !== "archived";
      };
      const buildItems = (project) => {
        const showAll = cardShowAll.has(project.id);
        if (filter === "archived") {
          const archivedRows = sortForBoard(byProject.get(project.id) ?? []);
          const items2 = archivedRows.map((row) => ({ row, child: row.child }));
          return { items: showAll ? items2 : items2.slice(0, CARD_ROW_LIMIT), total: items2.length };
        }
        const items = [];
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
            collapsible: group.children.length > 0 && group.blocked.length === 0
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
      const appendCard = (container, project) => {
        const built = buildItems(project);
        const showAll = cardShowAll.has(project.id);
        const counts = countsFor(view, project.id);
        container.append(
          createProjectCard({
            project,
            items: built.items,
            counts: {
              ...counts,
              archived: filter === "archived" ? 0 : counts.archived
            },
            collapsed: store.getCollapsed().projects.includes(project.id),
            error: view.errorProjects.includes(project.name),
            hiddenRows: Math.max(0, built.total - built.items.length),
            showAll,
            onToggleGroup: toggleBoardGroup
          })
        );
      };
      board.textContent = "";
      extraBoard.textContent = "";
      for (const project of primary2) appendCard(board, project);
      for (const project of extra) appendCard(extraBoard, project);
      if (contentReady) {
        for (const project of projects) {
          const current2 = countsFor(view, project.id).blocked;
          const previous = prevBlockedChips.get(project.id) ?? current2;
          if (previous === 0 && current2 > 0) {
            popChip(page.querySelector(`[data-chip="${project.id}:blocked"]`));
          }
          prevBlockedChips.set(project.id, current2);
        }
      } else {
        for (const project of projects) prevBlockedChips.set(project.id, countsFor(view, project.id).blocked);
      }
      const rest = projects.filter((project) => !primary2.some((card) => card.id === project.id));
      const restSessions = rest.reduce(
        (total, project) => total + view.rows.filter((row) => row.projectId === project.id).length,
        0
      );
      boardFoot.textContent = "";
      boardFoot.hidden = false;
      if (rest.length > 0) {
        const otherButton = el2("button", "link");
        otherButton.type = "button";
        otherButton.append(el2("span", "", stringsNow.board.otherProjects(rest.length, restSessions)), el2("i", "tri"));
        otherButton.addEventListener("click", () => {
          othersOpen = !othersOpen;
          store.setBoard({ others: othersOpen });
          render();
        });
        boardFoot.append(otherButton);
      }
      boardFoot.append(el2("span", "grow"));
      if (view.counts.archived > 0) {
        const archived = el2("button", "link", stringsNow.board.archived(view.counts.archived));
        archived.type = "button";
        archived.addEventListener("click", () => {
          filter = "archived";
          othersOpen = false;
          store.setBoard({ tab: "archived", others: false });
          pendingFlip.cards = true;
          pendingIndicator = true;
          render();
        });
        boardFoot.append(archived);
      }
      othersWrap.dataset.open = othersOpen ? "true" : "false";
      boardFoot.hidden = false;
    };
    const renderRail = (view) => {
      const stringsNow = t();
      const cards = [...view.waiting, ...view.failed].filter(matchesQuery);
      railLabel.textContent = stringsNow.board.filters.needs;
      railMeta.textContent = stringsNow.board.needsMeta(view.counts.blocked, view.counts.failed);
      rail.textContent = "";
      rail.classList.toggle("few", cards.length < 3);
      if (cards.length === 0) {
        rail.append(el2("div", "calm", stringsNow.panel.clearWaiting));
        return;
      }
      cards.forEach((row, index) => {
        const card = createNeedCard(row).element;
        if (bootIndex) card.style.setProperty("--i", String(index));
        rail.append(card);
      });
    };
    const renderUnconnected = (view) => {
      const stringsNow = t();
      unconnected.textContent = "";
      if (view.unconnected.length === 0) {
        unconnected.hidden = true;
        return;
      }
      unconnected.hidden = false;
      const button2 = el2("button", "link");
      button2.type = "button";
      button2.style.fontSize = "11px";
      button2.style.color = "var(--oc-muted)";
      button2.textContent = `${stringsNow.overflow.unconnected(view.unconnected.length)} ${stringsNow.overflow.manage}`;
      button2.addEventListener("click", () => {
        unconnectedOpen = !unconnectedOpen;
        render();
      });
      unconnected.append(button2);
      if (!unconnectedOpen) return;
      for (const project of view.unconnected) {
        const row = el2("div", "orow");
        row.append(el2("b", "", project.name));
        const connect = el2("button", "", stringsNow.overflow.connect);
        connect.type = "button";
        connect.addEventListener("click", () => {
          if (!store.connect(project.id)) {
            void host.toast({ kind: "info", message: stringsNow.overflow.blocked }).catch(() => void 0);
          } else {
            render();
          }
        });
        row.append(connect);
        unconnected.append(row);
      }
    };
    const indicatorPosition = { x: 0, w: 0 };
    const updateIndicator = (animate) => {
      const active2 = tabsBar.querySelector('.tab[aria-selected="true"]');
      if (!active2) return;
      const x = active2.offsetLeft;
      const w = active2.offsetWidth;
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
          { transform }
        ],
        { duration: 240, easing: EASE }
      );
      indicatorPosition.x = x;
      indicatorPosition.w = w;
    };
    const updateTabs = (view, animateCounts) => {
      const stringsNow = t();
      const counts = {
        all: view.rows.filter((row) => row.state !== "archived").length,
        needs: view.counts.blocked + view.counts.failed,
        running: view.counts.inflight,
        ended: view.counts.ended,
        archived: view.counts.archived
      };
      for (const id of order) {
        const button2 = tabButtons.get(id);
        const count = tabCounts.get(id);
        if (!button2 || !count) continue;
        button2.setAttribute("aria-selected", id === filter ? "true" : "false");
        const label = button2.querySelector(".tab-label");
        if (label) label.textContent = stringsNow.board.filters[id];
        const next = counts[id];
        const previous = lastCounts.get(id);
        if (animateCounts && previous !== void 0 && previous !== next) countTo(count, next, previous);
        else count.textContent = String(next);
        lastCounts.set(id, next);
      }
      const needsNext = counts.needs;
      const needsPrevious = lastCounts.get("needsSection");
      if (animateCounts && needsPrevious !== void 0 && needsPrevious !== needsNext) countTo(railCount, needsNext, needsPrevious);
      else railCount.textContent = String(needsNext);
      lastCounts.set("needsSection", needsNext);
    };
    const renderMigrations = (list) => {
      list.forEach((migration, index) => {
        const timer = window.setTimeout(() => {
          if (migration.direction === "in") {
            const card = findById(".ncard", migration.id);
            if (!card) return;
            if (prefersReduced()) {
              fadeIn(card, 220);
              pulse(card, true);
              return;
            }
            const to2 = card.getBoundingClientRect();
            card.dataset.crGhost = "1";
            card.style.opacity = "0";
            const flyer2 = makeFlyer(migration.row.title, migration.row.projectName, migration.from);
            flyTo(flyer2, migration.from, to2, 500, -10);
            window.setTimeout(() => {
              card.style.opacity = "";
              delete card.dataset.crGhost;
              card.animate(
                [
                  { opacity: 0, transform: "translateY(8px) scale(.98)" },
                  { opacity: 1, transform: "translateY(0) scale(1)" }
                ],
                { duration: 300, easing: EASE }
              );
              pulse(card, false);
            }, 240);
            return;
          }
          const rowElement = findById(".brow", migration.id);
          if (!rowElement) return;
          if (prefersReduced()) {
            fadeIn(rowElement, 180);
            land(rowElement, true);
            return;
          }
          const to = rowElement.getBoundingClientRect();
          rowElement.dataset.crGhost = "1";
          rowElement.style.opacity = "0";
          const flyer = makeFlyer(migration.row.title, migration.row.projectName, migration.from);
          flyTo(flyer, migration.from, to, 400, 6);
          window.setTimeout(() => {
            rowElement.style.opacity = "";
            delete rowElement.dataset.crGhost;
            rowElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE });
            land(rowElement, false);
          }, 260);
        }, index * 40);
        flightTimers.push(timer);
      });
    };
    const render = () => {
      const stringsNow = t();
      if (!storageHydrated && store.isHydrated()) {
        storageHydrated = true;
        const restored = store.getBoard();
        filter = order.includes(restored.tab) ? restored.tab : "all";
        query = restored.query;
        othersOpen = restored.others;
        search.update({ value: query });
      }
      const view = store.run();
      if (contentReady) page.classList.remove("boot");
      const previousStates = new Map(pageStates);
      pageStates.clear();
      for (const row of view.rows) pageStates.set(row.id, row.state);
      clearFlights();
      title.textContent = stringsNow.panel.title;
      boardLabel.textContent = stringsNow.board.heading;
      search.update({ placeholder: stringsNow.board.search, label: stringsNow.board.search });
      needs.setAttribute("aria-label", stringsNow.board.filters.needs);
      if (view.phase === "loading" && !view.hasData) updated.textContent = stringsNow.board.updating;
      else if (view.hasData) {
        updated.textContent = view.phase === "loading" ? stringsNow.board.updating : stringsNow.board.updated(formatClock(view.updatedAt));
      } else updated.textContent = "";
      renderBanner(view);
      const loading = !view.hasData || view.counts.sessions === 0 && !view.sessionsLoaded && view.phase !== "error";
      page.classList.toggle("is-loading", loading && !view.fatal);
      if (loading && !view.fatal) {
        page.setAttribute("aria-busy", "true");
        updateTabs(view, false);
        return;
      }
      page.classList.remove("is-loading");
      page.removeAttribute("aria-busy");
      const fatalCopy = view.fatal ? view.fatal === "NOT_GRANTED" ? [stringsNow.error.notGrantedTitle, stringsNow.error.notGrantedBody] : view.fatal === "DISABLED" ? [stringsNow.error.disabledTitle, stringsNow.error.disabledBody] : [stringsNow.error.unavailableTitle, stringsNow.error.unavailableBody] : null;
      if (fatalCopy) {
        hideBoard();
        setSectionsVisible(false);
        showEmpty(`fatal:${view.fatal}`, fatalCopy[0], fatalCopy[1]);
        updateTabs(view, false);
        return;
      }
      if (view.phase === "error" && !view.hasData) {
        hideBoard();
        setSectionsVisible(false);
        showEmpty("projects-error", stringsNow.error.allTitle, "", {
          label: stringsNow.error.retry,
          onClick: () => void store.retry()
        });
        updateTabs(view, false);
        return;
      }
      if (view.counts.projects === 0) {
        hideBoard();
        setSectionsVisible(false);
        showEmpty("no-projects", stringsNow.empty.noProjectsTitle, stringsNow.empty.noProjectsBody);
        updateTabs(view, false);
        return;
      }
      if (view.counts.sessions === 0 && view.phase === "ready" && view.sessionsLoaded) {
        hideBoard();
        setSectionsVisible(false);
        showEmpty("no-sessions", stringsNow.empty.noSessionsTitle, stringsNow.empty.noSessionsBody);
        updateTabs(view, false);
        return;
      }
      const rows = rowsForTab(view);
      if (rows.length === 0) {
        hideBoard();
        setSectionsVisible(false);
        showEmpty(
          "no-match",
          stringsNow.board.noMatch,
          filter === "archived" ? stringsNow.board.hideArchived : "",
          {
            label: stringsNow.board.clearFilter,
            onClick: () => {
              query = "";
              filter = "all";
              search.update({ value: "" });
              store.setBoard({ tab: "all", query: "" });
              pendingFlip.cards = true;
              pendingIndicator = true;
              render();
            }
          }
        );
        updateTabs(view, false);
        return;
      }
      hideEmpty();
      setSectionsVisible(true);
      renderUnconnected(view);
      const cardsBefore = pendingFlip.cards ? snap(board, ".pcard", "data-project-id") : null;
      const railBefore = pendingFlip.cards ? snap(rail, ".ncard", "data-id") : null;
      const migrations = [];
      if (previousStates.size > 0) {
        for (const row of view.rows) {
          const previous = previousStates.get(row.id);
          if (!previous) continue;
          const wasRunning = previous === "running" || previous === "retrying";
          const nowBlocked = row.state === "permission" || row.state === "question";
          const wasBlocked = previous === "permission" || previous === "question";
          const nowRunning = row.state === "running" || row.state === "retrying";
          if (wasRunning && nowBlocked) {
            const source = findById(".brow", row.id);
            if (source) migrations.push({ id: row.id, row, direction: "in", from: source.getBoundingClientRect() });
          } else if (wasBlocked && nowRunning) {
            const source = findById(".ncard", row.id);
            if (source) migrations.push({ id: row.id, row, direction: "out", from: source.getBoundingClientRect() });
          }
        }
      }
      const firstContent = !contentReady;
      if (firstContent) {
        bootIndex = true;
        page.classList.add("boot");
        window.setTimeout(() => page.classList.remove("boot"), 900);
      }
      needs.dataset.collapsed = filter === "ended" || filter === "archived" ? "true" : "false";
      renderRail(view);
      boardMeta.textContent = stringsNow.board.meta(view.counts.sessions - view.counts.archived, view.counts.projects);
      renderCards(view, rows);
      for (const migration of migrations) {
        const target = migration.direction === "in" ? findById(".ncard", migration.id) : findById(".brow", migration.id);
        if (!target) continue;
        target.dataset.crGhost = "1";
        target.style.opacity = "0";
      }
      updateTabs(view, !firstContent);
      updateIndicator(pendingIndicator);
      bootIndex = false;
      contentReady = true;
      if (pendingFlip.cards && cardsBefore && railBefore) {
        requestAnimationFrame(() => {
          flip(board, ".pcard", "data-project-id", cardsBefore, 340);
          flip(rail, ".ncard", "data-id", railBefore, 300);
        });
      }
      pendingFlip.cards = false;
      pendingIndicator = false;
      if (migrations.length > 0) requestAnimationFrame(() => renderMigrations(migrations));
      if (view.fresh.length > 0) {
        live.textContent = "";
      }
    };
    currentRender = render;
    store.onChange(render);
    render();
    void store.start();
    startClock(() => refreshTimes(root, store));
    const paused = () => {
      page.classList.toggle("is-paused", document.hidden);
    };
    document.addEventListener("visibilitychange", paused);
    paused();
    window.addEventListener("resize", () => updateIndicator(false));
    tabsBar.addEventListener("click", (event) => {
      const target = event.target.closest("[data-filter]");
      if (!target) return;
      const next = target.dataset.filter;
      if (next === filter) return;
      filter = next;
      store.setBoard({ tab: filter });
      pendingFlip.cards = true;
      pendingIndicator = true;
      render();
    });
    tabsBar.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = order.indexOf(filter);
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + order.length) % order.length;
      else if (event.key === "ArrowRight") next = (index + 1) % order.length;
      else if (event.key === "Home") next = 0;
      else next = order.length - 1;
      filter = order[next];
      store.setBoard({ tab: filter });
      pendingFlip.cards = true;
      pendingIndicator = true;
      render();
      tabButtons.get(filter)?.focus();
    });
    board.addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest(".b-twist")) return;
      const cardMore = target.closest("[data-card-more]");
      if (cardMore?.dataset.cardMore) {
        const id = cardMore.dataset.cardMore;
        if (cardShowAll.has(id)) cardShowAll.delete(id);
        else cardShowAll.add(id);
        render();
        return;
      }
      const cardHead = target.closest("[data-card]");
      if (cardHead?.dataset.card) {
        const id = cardHead.dataset.card;
        toggleCollapsed(store, id);
        const card = cardHead.closest(".pcard");
        const body = card?.querySelector(".pcardbody");
        const collapsed = store.getCollapsed().projects.includes(id);
        cardHead.setAttribute("aria-expanded", collapsed ? "false" : "true");
        if (body) body.dataset.collapsed = collapsed ? "true" : "false";
        if (card) card.dataset.collapsed = collapsed ? "true" : "false";
        return;
      }
      const archivedLink = target.closest("[data-archived-link]");
      if (archivedLink) {
        filter = "archived";
        store.setBoard({ tab: "archived" });
        pendingFlip.cards = true;
        pendingIndicator = true;
        render();
        return;
      }
      const retry = target.closest("[data-retry]");
      if (retry) {
        void store.retry();
        return;
      }
      const row = target.closest(".brow");
      if (row?.dataset.id) openSession(row.dataset.id);
    });
    board.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      const cardHead = target.closest("[data-card]");
      if (cardHead?.dataset.card) {
        event.preventDefault();
        const id = cardHead.dataset.card;
        toggleCollapsed(store, id);
        const card = cardHead.closest(".pcard");
        const body = card?.querySelector(".pcardbody");
        const collapsed = store.getCollapsed().projects.includes(id);
        cardHead.setAttribute("aria-expanded", collapsed ? "false" : "true");
        if (body) body.dataset.collapsed = collapsed ? "true" : "false";
        if (card) card.dataset.collapsed = collapsed ? "true" : "false";
        return;
      }
      const row = target.closest(".brow");
      if (!row) return;
      event.preventDefault();
      if (row.dataset.id) openSession(row.dataset.id);
    });
    rail.addEventListener("click", (event) => {
      const card = event.target.closest(".ncard");
      if (card?.dataset.id) openSession(card.dataset.id);
    });
    rail.addEventListener("keydown", (event) => {
      const card = event.target.closest(".ncard");
      if (!card) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (card.dataset.id) openSession(card.dataset.id);
      }
    });
    debug("page mounted");
  }
  var currentRender = null;
  var mountedSurface = null;
  host.onReady((ctx) => {
    applyHostReady(ctx, document.documentElement);
    setLocale((ctx.locale || "").trim() || navigator.language);
    const device = ctx.device;
    if (device) {
      document.documentElement.style.setProperty("--safe-bottom", `${Math.max(0, device.insets.bottom)}px`);
      document.documentElement.dataset.pointer = device.pointer;
      document.documentElement.dataset.form = device.formFactor;
      document.documentElement.dataset.keyboard = String(Math.max(0, device.keyboard));
    }
    const surface = ctx.surface === "page" ? "page" : "panel";
    if (mountedSurface) {
      if (surface === mountedSurface) currentRender?.();
      return;
    }
    mountedSurface = surface;
    if (surface === "page") mountPage();
    else mountPanel();
  });
})();
