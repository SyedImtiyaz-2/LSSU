/**
 * Laker Chat Widget — LSSU Admissions Chatbot
 * Embed on any landing page with:
 *   <script src="laker-chat.js"
 *           data-page-slug="icp-nursing-student-10"
 *           data-api="https://api.lssu.edu"
 *           data-referral="google"></script>
 */
(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────
  const script      = document.currentScript;
  const PAGE_SLUG   = script?.getAttribute("data-page-slug") || "icp-traditional-student-1";
  const API_BASE    = (script?.getAttribute("data-api") || "http://localhost:8000").replace(/\/$/, "");
  const REFERRAL    = script?.getAttribute("data-referral") || "direct";
  const SESSION_ID  = "laker_" + Math.random().toString(36).slice(2) + Date.now();

  // Persistent visitor ID survives page reloads and new sessions
  function _getVisitorId() {
    const KEY = "laker_visitor_id";
    let vid = localStorage.getItem(KEY);
    if (!vid) {
      vid = "v_" + Math.random().toString(36).slice(2) + Date.now();
      localStorage.setItem(KEY, vid);
    }
    return vid;
  }
  const VISITOR_ID = _getVisitorId();

  // Voice agent phone number (update when provisioned)
  const VOICE_PHONE    = script?.getAttribute("data-voice-phone")  || "+1 (906) 555-0100";
  // Calendly / scheduling link for 15-min advisor call
  const SCHEDULE_URL   = script?.getAttribute("data-schedule-url") || "https://calendly.com/lssu-admissions/15min";

  const ICP_LABELS = {
    "icp-traditional-student-1":            "Traditional Student",
    "icp-transfer-student-2":               "Transfer Student",
    "icp-transfer-back-student-3":          "Transfer Back",
    "icp-canadian-cross-border-student-4":  "Canadian Student",
    "icp-charter-school-student-5":         "Charter School",
    "icp-indigenous-and-anishinaabe-scholar-6": "Indigenous Scholar",
    "icp-cannabis-business-and-chemistry-student-7": "Cannabis & Chemistry",
    "icp-fisheries-and-wildlife-student-8": "Fisheries & Wildlife",
    "icp-fire-science-student-9":           "Fire Science",
    "icp-nursing-student-10":               "Nursing",
    "icp-robotics-engineering-student-11":  "Robotics Engineering",
    "icp-collegiate-hockey-athlete-male-12":   "Hockey (Men's)",
    "icp-collegiate-hockey-athlete-female-13": "Hockey (Women's)",
  };

  const PROGRAM = ICP_LABELS[PAGE_SLUG] || "LSSU Programs";

  let history = [];
  let isOpen  = false;

  // ── Styles ────────────────────────────────────────────────────────────────
  const css = `
    #laker-chat-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 58px; height: 58px; border-radius: 50%;
      background: #003F6B; color: #fff; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,63,107,0.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; transition: transform 0.2s, background 0.2s;
    }
    #laker-chat-fab:hover { background: #C8992A; transform: scale(1.07); }

    #laker-chat-window {
      position: fixed; bottom: 96px; right: 24px; z-index: 9998;
      width: 360px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: flex; flex-direction: column; overflow: hidden;
      transform-origin: bottom right;
      transition: transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.2s;
    }
    #laker-chat-window.hidden {
      transform: scale(0.85) translateY(16px); opacity: 0; pointer-events: none;
    }

    #laker-chat-header {
      background: #003F6B; color: #fff; padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    #laker-chat-header .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #C8992A; display: flex; align-items: center;
      justify-content: center; font-size: 18px; font-weight: bold;
      flex-shrink: 0;
    }
    #laker-chat-header .info { flex: 1; }
    #laker-chat-header .name { font-weight: 600; font-size: 14px; }
    #laker-chat-header .status { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 1px; }
    #laker-chat-close {
      background: none; border: none; color: rgba(255,255,255,0.7);
      font-size: 20px; cursor: pointer; padding: 2px 6px; line-height: 1;
    }
    #laker-chat-close:hover { color: #fff; }

    #laker-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px 12px 4px;
      display: flex; flex-direction: column; gap: 8px;
      scroll-behavior: smooth;
    }
    .laker-msg { display: flex; gap: 8px; max-width: 88%; }
    .laker-msg.user { align-self: flex-end; flex-direction: row-reverse; }
    .laker-msg.assistant { align-self: flex-start; }
    .laker-bubble {
      padding: 9px 13px; border-radius: 16px; font-size: 13px;
      line-height: 1.5; white-space: pre-wrap; word-break: break-word;
    }
    .laker-msg.assistant .laker-bubble {
      background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px;
    }
    .laker-msg.user .laker-bubble {
      background: #003F6B; color: #fff; border-bottom-right-radius: 4px;
    }
    .laker-typing { display: flex; gap: 4px; padding: 10px 14px; }
    .laker-typing span {
      width: 7px; height: 7px; border-radius: 50%; background: #94a3b8;
      animation: bounce 1.1s infinite;
    }
    .laker-typing span:nth-child(2) { animation-delay: 0.18s; }
    .laker-typing span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes bounce {
      0%,80%,100% { transform: translateY(0); }
      40%          { transform: translateY(-6px); }
    }

    #laker-chat-input-area {
      padding: 10px 12px; border-top: 1px solid #e2e8f0;
      display: flex; gap: 8px; align-items: flex-end;
    }
    #laker-chat-input {
      flex: 1; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 9px 12px; font-size: 13px; resize: none;
      max-height: 100px; outline: none; font-family: inherit;
      transition: border-color 0.15s;
    }
    #laker-chat-input:focus { border-color: #003F6B; }
    #laker-chat-send {
      background: #003F6B; color: #fff; border: none; border-radius: 10px;
      width: 38px; height: 38px; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      transition: background 0.15s; flex-shrink: 0;
    }
    #laker-chat-send:hover { background: #C8992A; }
    #laker-chat-send:disabled { background: #94a3b8; cursor: not-allowed; }

    #laker-voice-banner {
      background: #002d4d; color: rgba(255,255,255,0.85);
      font-size: 11px; text-align: center;
      padding: 5px 12px; letter-spacing: 0.01em;
    }
    #laker-voice-banner a {
      color: #C8992A; font-weight: 600; text-decoration: none;
    }
    #laker-voice-banner a:hover { text-decoration: underline; }

    .laker-schedule-card {
      margin-top: 8px; padding: 10px 12px;
      background: #f0f9ff; border: 1px solid #bae6fd;
      border-radius: 10px; font-size: 12px; color: #0369a1;
    }
    .laker-schedule-card a {
      display: inline-block; margin-top: 6px;
      background: #003F6B; color: #fff; text-decoration: none;
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    }
    .laker-schedule-card a:hover { background: #C8992A; }

    #laker-validation-error {
      display: none; margin: 0 12px 6px;
      padding: 6px 10px; border-radius: 8px;
      background: #fef2f2; color: #dc2626;
      font-size: 12px; border: 1px solid #fecaca;
    }
    #laker-validation-error.show { display: block; }
  `;

  // ── DOM ───────────────────────────────────────────────────────────────────
  function inject() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    // FAB
    const fab = document.createElement("button");
    fab.id = "laker-chat-fab";
    fab.innerHTML = "💬";
    fab.title = "Chat with Laker";
    document.body.appendChild(fab);

    // Window
    const win = document.createElement("div");
    win.id = "laker-chat-window";
    win.className = "hidden";
    win.innerHTML = `
      <div id="laker-chat-header">
        <div class="avatar">L</div>
        <div class="info">
          <div class="name">Laker - LSSU Admissions</div>
          <div class="status">${PROGRAM}</div>
        </div>
        <button id="laker-chat-close" title="Close">✕</button>
      </div>
      <div id="laker-voice-banner">
        📞 Prefer to talk? Call our AI voice agent: <a href="tel:${VOICE_PHONE.replace(/\s/g,'')}">${VOICE_PHONE}</a>
      </div>
      <div id="laker-chat-messages"></div>
      <div id="laker-validation-error"></div>
      <div id="laker-chat-input-area">
        <textarea id="laker-chat-input" rows="1" placeholder="Ask Laker anything…"></textarea>
        <button id="laker-chat-send" title="Send">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"
               viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(win);

    fab.addEventListener("click", toggle);
    win.querySelector("#laker-chat-close").addEventListener("click", () => setOpen(false));

    const input = win.querySelector("#laker-chat-input");
    const send  = win.querySelector("#laker-chat-send");

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 100) + "px";
    });
    send.addEventListener("click", sendMessage);

    // Opening message
    const greeting = isAfterHours()
      ? `👋 Hi! I'm **Laker**, your LSSU admissions guide.\n\nOur admissions team is currently offline (Mon–Fri, 8am–5pm ET), but I'm here 24/7 — I can answer most questions right now.\n\nIf you'd prefer to speak with someone, call our AI voice line at **${VOICE_PHONE}** anytime, or leave your info and a recruiter will follow up first thing tomorrow morning.\n\nWhat can I help you with today?`
      : `👋 Hi! I'm **Laker**, your LSSU admissions guide.\nIt looks like you're interested in **${PROGRAM}** - you're in the right place!\nWhat questions can I help you with today?`;
    appendMessage("assistant", greeting);
  }

  // ── After-hours detection ─────────────────────────────────────────────────
  function isAfterHours() {
    // LSSU Admissions: Mon–Fri 8am–5pm ET
    const now = new Date();
    // Convert to US/Eastern (UTC-5 / UTC-4 during daylight saving)
    const etOffset = isDaylightSaving(now) ? -4 : -5;
    const et = new Date(now.getTime() + etOffset * 3600 * 1000);
    const day = et.getUTCDay();   // 0=Sun, 6=Sat
    const hour = et.getUTCHours();
    const isWeekend = day === 0 || day === 6;
    const isOutsideHours = hour < 8 || hour >= 17;
    return isWeekend || isOutsideHours;
  }

  function isDaylightSaving(date) {
    // Rough DST check: 2nd Sun March – 1st Sun Nov in US
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    return date.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  }

  // ── State ─────────────────────────────────────────────────────────────────
  function toggle() { setOpen(!isOpen); }
  function setOpen(val) {
    isOpen = val;
    const win = document.getElementById("laker-chat-window");
    const fab = document.getElementById("laker-chat-fab");
    win.classList.toggle("hidden", !isOpen);
    fab.innerHTML = isOpen ? "✕" : "💬";
    if (isOpen) document.getElementById("laker-chat-input")?.focus();
  }

  // ── Messages ──────────────────────────────────────────────────────────────
  function appendMessage(role, text) {
    const container = document.getElementById("laker-chat-messages");
    const wrap = document.createElement("div");
    wrap.className = `laker-msg ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "laker-bubble";
    // Very basic markdown: **bold**, *italic*, newlines
    bubble.innerHTML = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>");

    wrap.appendChild(bubble);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    return wrap;
  }

  function showTyping() {
    const container = document.getElementById("laker-chat-messages");
    const wrap = document.createElement("div");
    wrap.className = "laker-msg assistant";
    wrap.id = "laker-typing";
    wrap.innerHTML = `<div class="laker-bubble laker-typing"><span></span><span></span><span></span></div>`;
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    document.getElementById("laker-typing")?.remove();
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function showValidationError(msg) {
    const el = document.getElementById("laker-validation-error");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 4000);
  }

  function clearValidationError() {
    const el = document.getElementById("laker-validation-error");
    if (el) el.classList.remove("show");
  }

  // Returns true if text is primarily a phone number attempt (4+ digits, little else)
  function looksLikePhone(text) {
    const stripped = text.replace(/[\s\-\(\)\+\.]/g, "");
    return /^\d{4,15}$/.test(stripped);
  }

  // Returns true if text looks like an email attempt
  function looksLikeEmail(text) {
    return text.includes("@");
  }

  function isValidPhone(text) {
    const digits = text.replace(/\D/g, "");
    return digits.length === 10 || (digits.length === 11 && digits[0] === "1");
  }

  function isValidEmail(text) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
  }

  // Validate contact info if the message looks like one; returns null if OK, error string if not
  function validateContactInput(text) {
    const trimmed = text.trim();
    if (looksLikePhone(trimmed)) {
      if (!isValidPhone(trimmed)) {
        return "Please enter a valid 10-digit US phone number (e.g. 906-555-1234).";
      }
    }
    if (looksLikeEmail(trimmed)) {
      if (!isValidEmail(trimmed)) {
        return "That email doesn't look right. Please check the format (e.g. you@example.com).";
      }
    }
    return null;
  }

  // ── API call ──────────────────────────────────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById("laker-chat-input");
    const send  = document.getElementById("laker-chat-send");
    const text  = (input.value || "").trim();
    if (!text) return;

    const validationErr = validateContactInput(text);
    if (validationErr) {
      showValidationError(validationErr);
      return;
    }
    clearValidationError();

    input.value = "";
    input.style.height = "auto";
    input.disabled = true;
    send.disabled  = true;

    appendMessage("user", text);
    history.push({ role: "user", content: text });
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: SESSION_ID,
          visitor_id: VISITOR_ID,
          page_slug: PAGE_SLUG,
          message: text,
          history: history.slice(-10),   // last 10 turns
          referral_source: REFERRAL,
        }),
      });

      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      removeTyping();

      const reply = data.reply || "I'm having trouble connecting right now. Please try again in a moment.";
      const msgEl = appendMessage("assistant", reply);

      // If the backend flagged a human handoff, show the scheduling card
      if (data.human_handoff) {
        const card = document.createElement("div");
        card.className = "laker-schedule-card";
        card.innerHTML = `📅 Want to talk to an advisor directly?<br>
          <a href="${SCHEDULE_URL}" target="_blank" rel="noopener">Book a free 15-min call</a>`;
        msgEl.querySelector(".laker-bubble")?.appendChild(card);
      }

      history.push({ role: "assistant", content: reply });

    } catch (err) {
      removeTyping();
      appendMessage("assistant",
        "I'm having trouble connecting right now. Please try refreshing the page or reach us directly at lssu.edu."
      );
      console.error("[Laker]", err);
    } finally {
      input.disabled = false;
      send.disabled  = false;
      input.focus();
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
