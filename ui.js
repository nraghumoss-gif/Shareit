// extension/content/ui.js
// Chat-style panel UI + existing automation/log/steps/result functionality.

import { MSG } from "../common/messages.js";

function mdToHtml(mdText) {
  let html = (mdText || "");
  html = html
    .replace(/^### (.*)$/gim, "<h3>$1</h3>")
    .replace(/^## (.*)$/gim, "<h2>$1</h2>")
    .replace(/^# (.*)$/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\n\n\n+/g, "\n\n")
    .replace(/\n/g, "<br/>");
  return html;
}

let _hostEl = null;
let _shadow = null;

export function mountPanel() {
  if (document.getElementById("commet-root-host")) {
    ensurePanelVisible();
    return { shadowRoot: _shadow };
  }

  const PANEL_WIDTH = "380px";

  _hostEl = document.createElement("div");
  _hostEl.id = "commet-root-host";
  _hostEl.style.position = "fixed";
  _hostEl.style.top = "0";
  _hostEl.style.right = "0";
  _hostEl.style.width = PANEL_WIDTH;
  _hostEl.style.height = "100%";
  _hostEl.style.zIndex = "2147483647";
  document.body.appendChild(_hostEl);

  document.body.style.paddingRight = PANEL_WIDTH;

  _shadow = _hostEl.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    .wrap { height: 100%; display:flex; flex-direction:column; background:#fff; border-left:1px solid #e6e6e6; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#3f6efb; color:#fff; font-weight:700; }
    .header .icons { display:flex; gap:8px; }
    .header button { border:0; background:transparent; cursor:pointer; color:#fff; font-size:16px; }
    .chat-body { flex:1; padding:12px; overflow:auto; font-size:14px; }
    .chat-msg { margin:6px 0; padding:8px 12px; border-radius:12px; max-width:80%; }
    .chat-msg.user { background:#e6f0ff; margin-left:auto; }
    .chat-msg.ai { background:#f5f5f5; margin-right:auto; }
    .chat-input { display:flex; align-items:center; padding:10px; border-top:1px solid #eee; }
    .chat-input textarea { flex:1; resize:none; height:40px; border:1px solid #d8d8d8; border-radius:10px; padding:8px; outline:none; font-size:14px; }
    .chat-input button { margin-left:8px; padding:8px 14px; border-radius:10px; border:0; background:#3f6efb; color:#fff; font-weight:600; cursor:pointer; }
    .quick-start { padding:10px; border-top:1px solid #eee; }
    .qs-card { display:block; padding:10px; margin:6px 0; border:1px solid #e6e6e6; border-radius:12px; background:#fafafa; cursor:pointer; font-weight:600; }
    .qs-card:hover { background:#f2f6ff; }
    /* Tabs for logs/results/steps */
    .tabs { display:flex; gap:8px; padding:6px 10px; border-top:1px solid #eee; }
    .tab { padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; }
    .tab.active { background:#f2f6ff; border:1px solid #b9d1ff; color:#3f6efb; }
    .panel { display:none; padding:10px; height:150px; overflow:auto; font-size:12.5px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; border-top:1px solid #eee; }
    .panel.active { display:block; }
    .muted { color:#666; }
    .ok { color:#209361; }
    .err { color:#c62828; }
    .log-line { margin: 3px 0; }
  `;

  const root = document.createElement("div");
  root.className = "wrap";
  root.innerHTML = `
    <div class="header" id="commet-drag">
      <div>AnyAct: AI Web Agent & Automation</div>
      <div class="icons">
        <button title="New">➕</button>
        <button title="Refresh">🔄</button>
        <button title="Settings">⚙️</button>
        <button class="close" id="commet-close" title="Close">✖</button>
      </div>
    </div>

    <div class="chat-body" id="chat-body">
      <div class="muted">What can I help you with?</div>
    </div>

    <div class="chat-input">
      <textarea id="task" placeholder="Ask me something…"></textarea>
      <button id="btn-send">Send</button>
    </div>

    <div class="quick-start">
      <div class="qs-card" id="btn-auto">⚡ Run Automation</div>
      <div class="qs-card" id="btn-sum">📝 Summarize</div>
      <select id="bookmark" style="width:100%; margin-top:6px;">
        <option value="">-- Select a bookmark --</option>
        <option value="create_change_request">Create Change Request</option>
        <option value="list_incidents">List Incidents (this month)</option>
        <option value="raise_ticket">Raise Ticket</option>
      </select>
      <div class="qs-card" id="btn-bm">🔖 Run Bookmark</div>
    </div>

    <div class="tabs">
      <div class="tab active" data-tab="log">Log</div>
      <div class="tab" data-tab="result">Result</div>
      <div class="tab" data-tab="steps">Steps</div>
    </div>
    <div class="panel active" id="panel-log"><div class="muted">Logs & diagnostics will appear here…</div></div>
    <div class="panel" id="panel-result"></div>
    <div class="panel" id="panel-steps"></div>
  `;

  _shadow.append(style, root);

  // Stop page hotkeys stealing focus
  ["keydown","keypress","keyup"].forEach(type => {
    _shadow.addEventListener(type, (e) => { if (e.isTrusted) e.stopPropagation(); }, { capture: true });
  });

  // Tabs
  const panels = {
    log: _shadow.getElementById("panel-log"),
    result: _shadow.getElementById("panel-result"),
    steps: _shadow.getElementById("panel-steps"),
  };
  function switchTab(name) {
    _shadow.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    Object.keys(panels).forEach(k => panels[k].classList.toggle("active", k === name));
  }
  _shadow.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));

  // ------- persistence helpers (debounced) -------
  let saveTimer = null;
  const saveSoon = (patch) => {
    clearTimeout(saveTimer);
    const merged = patch;
    saveTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ type: MSG.SET_STATE, patch: merged }, () => {});
    }, 200);
  };

  // logging
  function appendLogHTML(html, cls="") {
    const div = document.createElement("div");
    div.className = `log-line ${cls}`.trim();
    div.innerHTML = html;
    panels.log.appendChild(div);
    panels.log.scrollTop = panels.log.scrollHeight;
    saveSoon({ logHTML: panels.log.innerHTML });
  }

  function setResultMarkdown(mdText) {
    panels.result.innerHTML = mdToHtml(mdText);
    switchTab("result");
  }

  function setSteps(stepsArr) {
    if (!Array.isArray(stepsArr)) stepsArr = [];
    const pretty = stepsArr.map((s, i) => {
      const q = s.query ? ` {role:${s.query.role||"-"}, name:${s.query.name||"-"}}` : "";
      const t = s.text ? ` "${s.text}"` : "";
      if (s.action === "type") return `${i+1}. type${t}${q}`;
      if (s.action === "click") return `${i+1}. click${q}`;
      if (s.action === "navigate") return `${i+1}. navigate to ${s.url||""}`;
      if (s.action === "pressEnter") return `${i+1}. press Enter`;
      if (s.action === "waitForText") return `${i+1}. waitForText "${s.text||""}"`;
      if (s.action === "scroll") return `${i+1}. scroll ${s.direction||"down"}`;
      if (s.action === "done") return `${i+1}. done`;
      return `${i+1}. ${s.action}`;
    }).join("\n");
    panels.steps.textContent = pretty;
    try { saveSoon({ stepsJSON: JSON.stringify(stepsArr) }); } catch {}
  }

  // Listen for streaming events from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === MSG.AUTOMATION_EVENT) {
      if (msg.html) appendLogHTML(msg.html, msg.cls || "");
      else if (msg.text) appendLogHTML(msg.text, msg.cls || "");
    }
    if (msg?.type === MSG.AUTOMATION_STEPS) {
      setSteps(msg.steps || []);
    }
  });

  const taskEl = _shadow.getElementById("task");
  const bookmarkEl = _shadow.getElementById("bookmark");
  const chatBody = _shadow.getElementById("chat-body");

  // append chat message
  function addChatMessage(text, who="user") {
    const div = document.createElement("div");
    div.className = `chat-msg ${who}`;
    div.textContent = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // send handler
  _shadow.getElementById("btn-send").addEventListener("click", () => {
    const txt = taskEl.value.trim();
    if (!txt) return;
    addChatMessage(txt, "user");
    chrome.runtime.sendMessage({ type: MSG.SET_STATE, patch: { prompt: txt } }, () => {});
    taskEl.value = "";
  });

  // Close button
  _shadow.getElementById("commet-close").addEventListener("click", async () => {
    _hostEl.style.display = "none";
    document.body.style.paddingRight = "";
    chrome.runtime.sendMessage({ type: MSG.SET_OPEN_FLAG, value: false }, () => {});
  });

  // Simple vertical drag
  (() => {
    const header = _shadow.getElementById("commet-drag");
    let startY = 0, startTop = 0, dragging = false;
    header.style.cursor = "grab";
    header.addEventListener("mousedown", (e) => {
      dragging = true; startY = e.clientY; startTop = parseInt(_hostEl.style.top || "0", 10);
      header.style.cursor = "grabbing"; e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      _hostEl.style.top = `${Math.max(0, startTop + dy)}px`;
    });
    window.addEventListener("mouseup", () => { dragging = false; header.style.cursor = "grab"; });
  })();

  return {
    shadowRoot: _shadow,
    elements: { taskEl, bookmarkEl, panels, chatBody },
    api: { appendLogHTML, setResultMarkdown, setSteps, switchTab, addChatMessage }
  };
}

export function ensurePanelVisible() {
  const host = document.getElementById("commet-root-host");
  if (host) {
    host.style.display = "block";
    host.scrollIntoView({ block: "start" });
  } else {
    mountPanel();
  }
}

export function restoreStateIntoUI(shadowRoot, st) {
  if (!shadowRoot || !st) return;
  const taskEl = shadowRoot.getElementById("task");
  const bookmarkEl = shadowRoot.getElementById("bookmark");
  const logEl = shadowRoot.getElementById("panel-log");
  const resEl = shadowRoot.getElementById("panel-result");
  const stepsEl = shadowRoot.getElementById("panel-steps");

  if (typeof st.prompt === "string") taskEl.value = st.prompt;
  if (typeof st.bookmark === "string") bookmarkEl.value = st.bookmark;
  if (typeof st.logHTML === "string") logEl.innerHTML = st.logHTML;
  if (typeof st.resultHTML === "string") resEl.innerHTML = st.resultHTML;

  if (typeof st.stepsJSON === "string" && st.stepsJSON) {
    try {
      const arr = JSON.parse(st.stepsJSON);
      stepsEl.textContent = arr.map((s, i) => {
        const q = s.query ? ` {role:${s.query.role||"-"}, name:${s.query.name||"-"}}` : "";
        const t = s.text ? ` "${s.text}"` : "";
        if (s.action === "type") return `${i+1}. type${t}${q}`;
        if (s.action === "click") return `${i+1}. click${q}`;
        if (s.action === "navigate") return `${i+1}. navigate to ${s.url||""}`;
        if (s.action === "pressEnter") return `${i+1}. press Enter`;
        if (s.action === "waitForText") return `${i+1}. waitForText "${s.text||""}"`;
        if (s.action === "scroll") return `${i+1}. scroll ${s.direction||"down"}`;
        if (s.action === "done") return `${i+1}. done`;
        return `${i+1}. ${s.action}`;
      }).join("\n");
    } catch {
      stepsEl.textContent = st.stepsJSON || "";
    }
  }
}
