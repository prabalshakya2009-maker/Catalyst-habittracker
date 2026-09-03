/* =============================================================
   CALIBRE DAILY TRACKER — app.js
   Improved version: streak fix, toasts, export/import, fullscreen,
   pace alerts, keyboard shortcuts, chart update fix, demo guard.
   ============================================================= */

const STORAGE_KEY = "CALIBRE_V8";

// ─── DEFAULT STATE ────────────────────────────────────────────
const defaultState = {
  version: 8,
  streak: 1,
  lastActiveDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  dailyFocusGoalHours: 5,
  dailyHistory: {},           // { 'YYYY-MM-DD': minutes }
  targetExamDate: "",
  totalQuestionGoal: 3000,
  dailySubjectGoal: 20,
  weeklyFocusVolume: [0, 0, 0, 0, 0, 0, 0],
  completedBlocks: [],
  onboarded: false,
  subjects: {
    Physics:     { solved: 0, target: 20, correct: 0 },
    Chemistry:   { solved: 0, target: 20, correct: 0 },
    Mathematics: { solved: 0, target: 20, correct: 0 }
  },
  tasks: [],
  mistakes: [],
  paceLogs: [],
  mocks: []
};

// ─── DEMO STATE ───────────────────────────────────────────────
function generateMockHeatmapHistory() {
  const map = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    map[d.toISOString().split("T")[0]] = Math.floor(Math.random() * 320) + 60;
  }
  return map;
}

const demoState = {
  ...defaultState,
  streak: 14,
  focusMinutesToday: 180,
  dailyFocusGoalHours: 5,
  dailyHistory: generateMockHeatmapHistory(),
  onboarded: true,
  targetExamDate: "2027-01-20",
  completedBlocks: ["50m Block (Physics)", "50m Block (Math)", "50m Block (Chem)"],
  subjects: {
    Physics:     { solved: 22, target: 20, correct: 19 },
    Chemistry:   { solved: 20, target: 20, correct: 18 },
    Mathematics: { solved: 18, target: 20, correct: 15 }
  },
  tasks: [
    { id: 1, text: "Solve 15 Rotational Dynamics PyQs", slot: "Morning",   done: true  },
    { id: 2, text: "Revise Thermodynamics formulas",    slot: "Afternoon", done: false }
  ],
  mistakes: [
    {
      id: 1, topic: "Parallel Axis Theorem Constraint", subject: "Physics",
      category: "Concept Misunderstanding",
      takeaway: "I_cm must pass through the exact Center of Mass before shifting by Md².",
      stage: 3, date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0]
    }
  ],
  paceLogs: [],
  mocks: [
    { id: 1, name: "Allen Major Diagnostic 04", date: "2026-08-20", phy: 84, chem: 88, math: 76, score: 248, total: 300, neg: 4,  accuracy: 94 },
    { id: 2, name: "Full Mock Test 03",          date: "2026-08-12", phy: 78, chem: 80, math: 70, score: 228, total: 300, neg: 8,  accuracy: 89 },
    { id: 3, name: "Allen Minor Test 02",         date: "2026-08-01", phy: 70, chem: 76, math: 60, score: 206, total: 300, neg: 10, accuracy: 85 }
  ],
  weeklyFocusVolume: [3.5, 4.0, 5.0, 3.0, 4.5, 2.5, 1.0]
};

// ─── LOAD STATE ───────────────────────────────────────────────
let appState;
let isDemoMode = false;
let realAppStateBackup = null;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  appState = raw ? JSON.parse(raw) : { ...defaultState };
} catch (e) {
  console.warn("[Calibre] State parse error, using defaults:", e);
  appState = { ...defaultState };
}

// ─── SAVE STATE ───────────────────────────────────────────────
function saveState() {
  if (!isDemoMode) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      showToast("⚠ Storage full — could not save. Consider exporting your data.", "warning");
    }
  }
  renderAll();
}

// ─── STREAK LOGIC (FIXED) ─────────────────────────────────────
// Correctly handles: same day (no change), yesterday (increment),
// multiple missed days (reset to 1).
const todayDateStr = new Date().toISOString().split("T")[0];
const yesterdayDate = new Date();
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
const yesterdayDateStr = yesterdayDate.toISOString().split("T")[0];

if (appState.lastActiveDate !== todayDateStr) {
  // Arrived on a new day
  if (appState.lastActiveDate === yesterdayDateStr) {
    // Studied yesterday → continue streak
    appState.streak = (appState.streak || 0) + 1;
  } else {
    // Missed one or more days → reset streak
    appState.streak = 1;
  }
  appState.focusMinutesToday = 0;
  appState.completedBlocks = [];
  appState.lastActiveDate = todayDateStr;
  saveState();
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const icons = { info: "ℹ", success: "✓", warning: "⚠", error: "✕" };
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[type] || "ℹ"}</span><span class="toast-msg">${message}</span><button class="toast-close" aria-label="Dismiss notification">✕</button>`;

  toast.querySelector(".toast-close").addEventListener("click", () => dismissToast(toast));
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
  return toast;
}

function dismissToast(toast) {
  toast.classList.remove("toast-visible");
  toast.addEventListener("transitionend", () => toast.remove(), { once: true });
}

// ═══════════════════════════════════════════════════════════════
//  CONFIRM DIALOG (replaces window.confirm)
// ═══════════════════════════════════════════════════════════════
function showConfirm(message, title = "Confirm Action") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    modal.classList.add("active");

    const ok = document.getElementById("confirmOk");
    const cancel = document.getElementById("confirmCancel");

    function cleanup(result) {
      modal.classList.remove("active");
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
      resolve(result);
    }

    document.getElementById("confirmOk").addEventListener("click", () => cleanup(true), { once: true });
    document.getElementById("confirmCancel").addEventListener("click", () => cleanup(false), { once: true });
  });
}

// ═══════════════════════════════════════════════════════════════
//  ONBOARDING
// ═══════════════════════════════════════════════════════════════
function checkOnboarding() {
  if (!appState.onboarded) {
    document.getElementById("onboardingModal").classList.add("active");
  }
}

function applyGoalPreset(type) {
  if (type === "stem") {
    appState.subjects = {
      Physics:     { solved: 0, target: 20, correct: 0 },
      Chemistry:   { solved: 0, target: 20, correct: 0 },
      Mathematics: { solved: 0, target: 20, correct: 0 }
    };
    appState.dailySubjectGoal = 20;
  } else if (type === "college") {
    appState.subjects = {
      "Algorithms / DSA":  { solved: 0, target: 10, correct: 0 },
      "System Design":     { solved: 0, target: 10, correct: 0 },
      "Projects / Dev":    { solved: 0, target: 10, correct: 0 }
    };
    appState.dailySubjectGoal = 10;
  } else {
    appState.subjects = {
      Science:     { solved: 0, target: 15, correct: 0 },
      Mathematics: { solved: 0, target: 15, correct: 0 },
      Humanities:  { solved: 0, target: 15, correct: 0 }
    };
    appState.dailySubjectGoal = 15;
  }
  appState.onboarded = true;
  closeOnboardingModal();
  saveState();
  showToast("Profile set! Your daily targets are configured.", "success");
}

function closeOnboardingModal() {
  document.getElementById("onboardingModal").classList.remove("active");
}

// ═══════════════════════════════════════════════════════════════
//  DEMO DATA TOGGLE
// ═══════════════════════════════════════════════════════════════
function toggleDemoData() {
  isDemoMode = !isDemoMode;

  document.getElementById("btnDemoToggleDesktop").textContent = isDemoMode ? "Exit Sample Data" : "Preview Sample Data";
  document.getElementById("btnDemoToggleMobile").textContent  = isDemoMode ? "Live" : "Sample";

  if (isDemoMode) {
    // Deep-clone real state before switching to demo
    realAppStateBackup = JSON.parse(JSON.stringify(appState));
    appState = JSON.parse(JSON.stringify(demoState));
    showToast("Showing sample data — your real data is safe.", "info");
  } else {
    // Restore real state (not demo mutations)
    appState = realAppStateBackup ? JSON.parse(JSON.stringify(realAppStateBackup)) : { ...defaultState };
    realAppStateBackup = null;
    showToast("Back to your live data.", "info");
  }

  renderAll();
  updateCharts();
}

document.getElementById("btnDemoToggleDesktop").addEventListener("click", toggleDemoData);
document.getElementById("btnDemoToggleMobile").addEventListener("click", toggleDemoData);

// ═══════════════════════════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════════════
function switchTab(tabName) {
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

  const btn = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
  const pane = document.getElementById(`view-${tabName}`);
  if (btn) btn.classList.add("active");
  if (pane) pane.classList.add("active");

  const mobileIndicator = document.getElementById("mobileTabIndicator");
  if (mobileIndicator && btn) mobileIndicator.textContent = btn.dataset.label || tabName;

  if (tabName === "dashboard" || tabName === "mocks") {
    updateCharts();
  }
}

document.querySelectorAll(".nav-link").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ═══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════
document.addEventListener("keydown", (e) => {
  // Ignore shortcuts when typing in inputs / textareas
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

  if (e.code === "Space" && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    document.getElementById("btnTimerStart").click();
  }
  if (e.altKey && e.key.toLowerCase() === "q") {
    e.preventDefault();
    switchTab("practice");
  }
  if (e.altKey && e.key.toLowerCase() === "m") {
    e.preventDefault();
    switchTab("mistakes");
  }
  if (e.altKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    toggleFullscreen();
  }
});

// ═══════════════════════════════════════════════════════════════
//  FULLSCREEN MODE
// ═══════════════════════════════════════════════════════════════
const btnFullscreen = document.getElementById("btnFullscreen");

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      showToast(`Fullscreen not available: ${err.message}`, "warning");
    });
  } else {
    document.exitFullscreen();
  }
}

btnFullscreen.addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", () => {
  const isFS = !!document.fullscreenElement;
  btnFullscreen.innerHTML = isFS
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="8 3 3 3 3 8"/><polyline points="21 8 21 3 16 3"/><polyline points="3 16 3 21 8 21"/><polyline points="16 21 21 21 21 16"/></svg> Exit Fullscreen`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Fullscreen`;
});

// ═══════════════════════════════════════════════════════════════
//  TIMER ENGINE (with toast, ring, demo guard)
// ═══════════════════════════════════════════════════════════════
let timerMins = 50;
let timerSeconds = 50 * 60;
let timerTotalSeconds = 50 * 60;
let timerInterval = null;
let isTimerActive = false;
let isBreakSession = false;
let activeBoundTask = null;

const timerClock   = document.getElementById("timerClock");
const timerRing    = document.getElementById("timerRing");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerReset = document.getElementById("btnTimerReset");

const RING_CIRCUMFERENCE = 2 * Math.PI * 54; // r=54 → 339.3

function formatTime(s) {
  const m   = Math.floor(Math.abs(s) / 60).toString().padStart(2, "0");
  const sec = (Math.abs(s) % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function updateRing(secondsLeft, totalSeconds) {
  if (!timerRing) return;
  const fraction = Math.max(0, secondsLeft / totalSeconds);
  timerRing.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
}

// Set document title to show timer when running
function syncDocTitle() {
  if (isTimerActive) {
    document.title = `${formatTime(timerSeconds)} — Calibre`;
  } else {
    document.title = "Calibre — Precision Study Workspace";
  }
}

// Preset buttons
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (isTimerActive) return;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    timerMins = parseInt(btn.dataset.time);
    timerSeconds = timerTotalSeconds = timerMins * 60;
    timerClock.textContent = formatTime(timerSeconds);
    updateRing(timerSeconds, timerTotalSeconds);
    isBreakSession = false;
    document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
  });
});

// Completion chime (non-blocking Web Audio)
function playCompletionChime() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    [[587.33, 0], [880, 0.15], [1046.5, 0.3]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 1.0);
    });
  } catch (_) {}
}

btnTimerStart.addEventListener("click", () => {
  btnTimerStart.classList.remove("pulse-btn");

  if (isTimerActive) {
    // Pause
    clearInterval(timerInterval);
    isTimerActive = false;
    btnTimerStart.textContent = "Resume Session";
    syncDocTitle();
  } else {
    // Start / Resume
    isTimerActive = true;
    btnTimerStart.textContent = "Pause";

    timerInterval = setInterval(() => {
      timerSeconds--;
      timerClock.textContent = formatTime(timerSeconds);
      updateRing(timerSeconds, timerTotalSeconds);
      syncDocTitle();

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        isTimerActive = false;
        playCompletionChime();
        syncDocTitle();

        if (!isBreakSession) {
          // Work session complete — only log to real state, not demo
          if (!isDemoMode) {
            appState.focusMinutesToday += timerMins;
            appState.dailyHistory[todayDateStr] = (appState.dailyHistory[todayDateStr] || 0) + timerMins;

            // Update weekly volume (today = index based on day-of-week)
            const dow = new Date().getDay(); // 0=Sun…6=Sat
            appState.weeklyFocusVolume[dow] = parseFloat(
              ((appState.dailyHistory[todayDateStr] || 0) / 60).toFixed(2)
            );

            const label = activeBoundTask
              ? `${timerMins}m (${activeBoundTask})`
              : `${timerMins}m Focus Block`;
            appState.completedBlocks.push(label);
            saveState();
          }

          // Start 5m break
          isBreakSession = true;
          timerSeconds = timerTotalSeconds = 5 * 60;
          timerClock.textContent = "05:00";
          updateRing(timerSeconds, timerTotalSeconds);
          document.getElementById("timerTag").textContent = "☕ 5m Rest Break";
          btnTimerStart.textContent = "Start Break";
          showToast(`🎯 ${timerMins}m sprint done! Take a 5-minute break.`, "success", 6000);

        } else {
          // Break complete → reset
          isBreakSession = false;
          timerSeconds = timerTotalSeconds = timerMins * 60;
          timerClock.textContent = formatTime(timerSeconds);
          updateRing(timerSeconds, timerTotalSeconds);
          document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
          btnTimerStart.textContent = "Start Session";
          showToast("Break over! Ready for your next focus sprint? 🚀", "info", 5000);
        }
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerActive = false;
  isBreakSession = false;
  timerSeconds = timerTotalSeconds = timerMins * 60;
  timerClock.textContent = formatTime(timerSeconds);
  updateRing(timerSeconds, timerTotalSeconds);
  btnTimerStart.textContent = "Start Session";
  document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
  syncDocTitle();
});

// Task bind dropdown
function refreshTimerTaskBind() {
  const sel = document.getElementById("timerTaskBind");
  sel.innerHTML = `<option value="">— Bind to task (optional) —</option>`;
  (appState.tasks || []).filter(t => !t.done).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.text;
    opt.textContent = t.text;
    sel.appendChild(opt);
  });
}
document.getElementById("timerTaskBind").addEventListener("change", e => {
  activeBoundTask = e.target.value || null;
});

// ═══════════════════════════════════════════════════════════════
//  TASK MANAGER
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnAddTask").addEventListener("click", addTask);
document.getElementById("taskInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addTask();
});

function addTask() {
  const input = document.getElementById("taskInput");
  const slot  = document.getElementById("taskSlotSelect").value;
  const text  = input.value.trim();
  if (!text) { input.focus(); return; }

  appState.tasks.push({
    id:   Date.now(),
    text: text,
    slot: slot,
    done: false
  });
  input.value = "";
  saveState();
  showToast("Task added.", "success", 2000);
}

function toggleTask(id) {
  const task = appState.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    saveState();
  }
}

function deleteTask(id) {
  appState.tasks = appState.tasks.filter(t => t.id !== id);
  saveState();
}

function renderTasks() {
  const list  = document.getElementById("taskList");
  const badge = document.getElementById("taskCompletionBadge");
  if (!list) return;

  const tasks = appState.tasks || [];
  const done  = tasks.filter(t => t.done).length;
  badge.textContent = `${done}/${tasks.length}`;
  badge.className = `badge ${done === tasks.length && tasks.length > 0 ? "badge-green" : ""}`;

  const slots = ["Morning", "Afternoon", "Evening"];
  list.innerHTML = "";

  slots.forEach(slot => {
    const slotTasks = tasks.filter(t => t.slot === slot);
    if (!slotTasks.length) return;

    const li = document.createElement("li");
    li.className = "task-slot-header";
    li.textContent = slot;
    li.setAttribute("role", "presentation");
    list.appendChild(li);

    slotTasks.forEach(task => {
      const item = document.createElement("li");
      item.className = `task-item ${task.done ? "done" : ""}`;
      item.setAttribute("role", "listitem");
      item.innerHTML = `
        <button class="task-check" aria-label="${task.done ? "Mark incomplete" : "Mark complete"}: ${task.text}" onclick="toggleTask(${task.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            ${task.done ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="9"/>'}
          </svg>
        </button>
        <span class="task-text">${escapeHtml(task.text)}</span>
        <span class="task-slot-tag">${task.slot}</span>
        <button class="task-delete" aria-label="Delete task: ${task.text}" onclick="deleteTask(${task.id})">✕</button>
      `;
      list.appendChild(item);
    });
  });

  refreshTimerTaskBind();
}

// ═══════════════════════════════════════════════════════════════
//  MISTAKES LOG
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnAddMistake").addEventListener("click", addMistake);

function addMistake() {
  const topic    = document.getElementById("mistakeTopic").value.trim();
  const subject  = document.getElementById("mistakeSubject").value;
  const category = document.getElementById("mistakeCategory").value;
  const takeaway = document.getElementById("mistakeTakeaway").value.trim();

  if (!topic) {
    showToast("Please enter a topic/concept.", "warning");
    document.getElementById("mistakeTopic").focus();
    return;
  }

  appState.mistakes.push({
    id:       Date.now(),
    topic:    topic,
    subject:  subject,
    category: category,
    takeaway: takeaway,
    stage:    1,
    date:     todayDateStr
  });

  document.getElementById("mistakeTopic").value    = "";
  document.getElementById("mistakeTakeaway").value = "";
  saveState();
  showToast("Mistake logged — review it tomorrow.", "success", 3000);
}

function advanceMistakeStage(id) {
  const m = appState.mistakes.find(m => m.id === id);
  if (m && m.stage < 5) {
    m.stage++;
    saveState();
  }
}

function deleteMistake(id) {
  appState.mistakes = appState.mistakes.filter(m => m.id !== id);
  saveState();
}

function renderMistakes() {
  const list  = document.getElementById("mistakeList");
  const badge = document.getElementById("mistakeCountBadge");
  if (!list) return;

  const mistakes = appState.mistakes || [];
  badge.textContent = `${mistakes.length} ${mistakes.length === 1 ? "entry" : "entries"}`;
  list.innerHTML = "";

  // Refresh mistake subject options
  const subjSelect = document.getElementById("mistakeSubject");
  subjSelect.innerHTML = "";
  Object.keys(appState.subjects || {}).forEach(s => {
    subjSelect.appendChild(new Option(s, s));
  });

  if (!mistakes.length) {
    list.innerHTML = `<li class="empty-state" role="listitem">No mistakes logged yet. Add errors here to build your revision list.</li>`;
    return;
  }

  // Sort newest first
  [...mistakes].sort((a, b) => b.id - a.id).forEach(m => {
    const stageDots = Array.from({ length: 5 }, (_, i) =>
      `<span class="stage-dot ${i < m.stage ? "active" : ""}" aria-hidden="true"></span>`
    ).join("");

    const li = document.createElement("li");
    li.className = "mistake-item";
    li.setAttribute("role", "listitem");
    li.innerHTML = `
      <div class="mistake-header">
        <div>
          <span class="mistake-topic">${escapeHtml(m.topic)}</span>
          <span class="badge badge-subject">${escapeHtml(m.subject)}</span>
          <span class="badge badge-category">${escapeHtml(m.category)}</span>
        </div>
        <span class="mistake-date">${m.date}</span>
      </div>
      ${m.takeaway ? `<p class="mistake-takeaway">${escapeHtml(m.takeaway)}</p>` : ""}
      <div class="mistake-footer">
        <div class="stage-row" aria-label="Review stage ${m.stage} of 5">${stageDots}</div>
        <div class="mistake-actions">
          <button class="btn btn-ghost btn-xs" onclick="advanceMistakeStage(${m.id})" ${m.stage >= 5 ? "disabled" : ""} aria-label="Advance review stage">
            ${m.stage >= 5 ? "✓ Mastered" : "Mark Reviewed →"}
          </button>
          <button class="btn btn-ghost btn-xs danger" onclick="deleteMistake(${m.id})" aria-label="Delete this mistake">✕</button>
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════════
//  PRACTICE — SUBJECT QUESTION LOG
// ═══════════════════════════════════════════════════════════════
function renderPractice() {
  const container = document.getElementById("practiceSubjectCards");
  const badge     = document.getElementById("practiceTotalBadge");
  if (!container) return;

  const subjects = appState.subjects || {};
  let totalSolved = 0;
  Object.values(subjects).forEach(s => totalSolved += (s.solved || 0));
  badge.textContent = `${totalSolved} solved`;

  container.innerHTML = "";
  Object.entries(subjects).forEach(([name, data]) => {
    const accuracy = data.solved > 0 ? Math.round((data.correct / data.solved) * 100) : 0;
    const progress = Math.min(100, Math.round((data.solved / (data.target || 1)) * 100));

    const card = document.createElement("div");
    card.className = "practice-subject-card";
    card.innerHTML = `
      <div class="practice-card-header">
        <span class="practice-subject-name">${escapeHtml(name)}</span>
        <span class="practice-stats">${data.solved}/${data.target} solved &nbsp;·&nbsp; <span class="accent">${accuracy}%</span> accuracy</span>
      </div>
      <div class="progress-bar-wrap" role="progressbar" aria-valuenow="${data.solved}" aria-valuemin="0" aria-valuemax="${data.target}" aria-label="${name} progress">
        <div class="progress-bar ${progress >= 100 ? "progress-bar-done" : ""}" style="width:${progress}%"></div>
      </div>
      <div class="practice-input-row">
        <div class="practice-input-group">
          <label class="field-label" for="inp-solved-${name}">Solved</label>
          <input class="input-control input-sm" id="inp-solved-${name}" type="number" min="0" value="${data.solved}" aria-label="${name} questions solved">
        </div>
        <div class="practice-input-group">
          <label class="field-label" for="inp-correct-${name}">Correct</label>
          <input class="input-control input-sm" id="inp-correct-${name}" type="number" min="0" max="${data.solved}" value="${data.correct}" aria-label="${name} questions correct">
        </div>
        <div class="practice-input-group">
          <label class="field-label" for="inp-target-${name}">Target</label>
          <input class="input-control input-sm" id="inp-target-${name}" type="number" min="1" value="${data.target}" aria-label="${name} daily target">
        </div>
        <button class="btn btn-primary btn-small" onclick="updateSubject('${name}')" aria-label="Save ${name} progress">Save</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateSubject(name) {
  const solved  = parseInt(document.getElementById(`inp-solved-${name}`).value)  || 0;
  const correct = parseInt(document.getElementById(`inp-correct-${name}`).value) || 0;
  const target  = parseInt(document.getElementById(`inp-target-${name}`).value)  || 20;

  if (correct > solved) {
    showToast(`Correct (${correct}) can't exceed Solved (${solved}).`, "warning");
    return;
  }

  appState.subjects[name] = { solved, correct: Math.min(correct, solved), target };
  saveState();
  showToast(`${name} updated.`, "success", 2000);
}

// ═══════════════════════════════════════════════════════════════
//  MOCKS
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnSaveMock").addEventListener("click", saveMock);

function saveMock() {
  const name  = document.getElementById("mockName").value.trim();
  const date  = document.getElementById("mockDate").value;
  const phy   = parseInt(document.getElementById("mockPhy").value)   || 0;
  const chem  = parseInt(document.getElementById("mockChem").value)  || 0;
  const math  = parseInt(document.getElementById("mockMath").value)  || 0;
  const total = parseInt(document.getElementById("mockTotal").value) || (phy + chem + math);
  const neg   = parseInt(document.getElementById("mockNeg").value)   || 0;
  const acc   = parseInt(document.getElementById("mockAcc").value)   || 0;

  if (!name || !date) {
    showToast("Please enter a test name and date.", "warning");
    return;
  }

  appState.mocks.push({ id: Date.now(), name, date, phy, chem, math, score: total, total: 300, neg, accuracy: acc });

  // Clear form
  ["mockName","mockDate","mockPhy","mockChem","mockMath","mockTotal","mockNeg","mockAcc"].forEach(id => {
    document.getElementById(id).value = "";
  });

  saveState();
  updateCharts();
  showToast("Mock result saved! 📊", "success");
}

function deleteMock(id) {
  appState.mocks = appState.mocks.filter(m => m.id !== id);
  saveState();
  updateCharts();
}

function renderMocks() {
  const list = document.getElementById("mockList");
  if (!list) return;
  list.innerHTML = "";

  const mocks = [...(appState.mocks || [])].sort((a, b) => b.date.localeCompare(a.date));

  if (!mocks.length) {
    list.innerHTML = `<li class="empty-state" role="listitem">No mock tests logged yet.</li>`;
    return;
  }

  mocks.forEach(m => {
    const li = document.createElement("li");
    li.className = "mock-item";
    li.setAttribute("role", "listitem");
    li.innerHTML = `
      <div class="mock-item-header">
        <span class="mock-name">${escapeHtml(m.name)}</span>
        <span class="mock-date">${m.date}</span>
      </div>
      <div class="mock-scores">
        <span class="mock-score-chip">PHY <strong>${m.phy}</strong></span>
        <span class="mock-score-chip">CHEM <strong>${m.chem}</strong></span>
        <span class="mock-score-chip">MATH <strong>${m.math}</strong></span>
        <span class="mock-score-chip accent">TOTAL <strong>${m.score}/300</strong></span>
        <span class="mock-score-chip">ACC <strong>${m.accuracy}%</strong></span>
        <span class="mock-score-chip rose">–ve <strong>${m.neg}</strong></span>
      </div>
      <button class="btn btn-ghost btn-xs danger mt-1" onclick="deleteMock(${m.id})" aria-label="Delete ${escapeHtml(m.name)}">Delete</button>
    `;
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnSaveSettings").addEventListener("click", () => {
  const examDate  = document.getElementById("settingExamDate").value;
  const dailyGoal = parseFloat(document.getElementById("settingDailyGoal").value)  || 5;
  const dailyQ    = parseInt(document.getElementById("settingDailyQGoal").value)   || 20;
  const totalQ    = parseInt(document.getElementById("settingTotalQGoal").value)   || 3000;

  appState.targetExamDate        = examDate;
  appState.dailyFocusGoalHours   = dailyGoal;
  appState.dailySubjectGoal      = dailyQ;
  appState.totalQuestionGoal     = totalQ;
  saveState();
  showToast("Settings saved.", "success", 2500);
});

function renderSettings() {
  const examEl   = document.getElementById("settingExamDate");
  const dailyEl  = document.getElementById("settingDailyGoal");
  const dailyQEl = document.getElementById("settingDailyQGoal");
  const totalQEl = document.getElementById("settingTotalQGoal");
  if (examEl)   examEl.value   = appState.targetExamDate || "";
  if (dailyEl)  dailyEl.value  = appState.dailyFocusGoalHours || 5;
  if (dailyQEl) dailyQEl.value = appState.dailySubjectGoal || 20;
  if (totalQEl) totalQEl.value = appState.totalQuestionGoal || 3000;
}

// ─── Clear Data ───────────────────────────────────────────────
document.getElementById("btnClearData").addEventListener("click", async () => {
  const confirmed = await showConfirm(
    "This will permanently delete ALL your study data — streaks, tasks, mistakes, mocks, and progress. This cannot be undone.",
    "⚠ Clear All Data?"
  );
  if (confirmed) {
    localStorage.removeItem(STORAGE_KEY);
    appState = { ...defaultState };
    saveState();
    showToast("All data cleared. Starting fresh.", "info");
  }
});

// ─── Export ───────────────────────────────────────────────────
document.getElementById("btnExportData").addEventListener("click", () => {
  if (isDemoMode) {
    showToast("Exit sample data mode before exporting.", "warning");
    return;
  }
  const blob = new Blob(
    [JSON.stringify(appState, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  const ts  = new Date().toISOString().split("T")[0];
  a.href     = url;
  a.download = `calibre-backup-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported successfully! 💾", "success");
});

// ─── Import ───────────────────────────────────────────────────
document.getElementById("importFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const confirmed = await showConfirm(
    "Importing will overwrite your current data with the backup file. Continue?",
    "Import Backup"
  );
  if (!confirmed) { e.target.value = ""; return; }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      // Basic validation
      if (typeof imported !== "object" || !imported.streak) {
        throw new Error("Not a valid Calibre backup.");
      }
      appState = { ...defaultState, ...imported };
      saveState();
      showToast("Backup imported successfully! Your data is restored. ✅", "success", 5000);
    } catch (err) {
      showToast(`Import failed: ${err.message}`, "error", 6000);
    }
  };
  reader.readAsText(file);
  e.target.value = ""; // Reset input
});

// ═══════════════════════════════════════════════════════════════
//  AMBIENT NOISE ENGINE
// ═══════════════════════════════════════════════════════════════
let audioCtx       = null;
let noiseNode      = null;
let noiseGainNode  = null;
let isAudioPlaying = false;

const btnToggleNoise = document.getElementById("btnToggleNoise");
const audioNoiseType = document.getElementById("audioNoiseType");
const noiseVolumeSlider = document.getElementById("noiseVolume");
const noiseVolumeLabel  = document.getElementById("noiseVolumeLabel");

noiseVolumeSlider.addEventListener("input", () => {
  const vol = parseInt(noiseVolumeSlider.value);
  noiseVolumeLabel.textContent = `${vol}%`;
  if (noiseGainNode) {
    noiseGainNode.gain.setTargetAtTime(vol / 1000, audioCtx.currentTime, 0.1);
  }
});

function createNoiseBuffer(type) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer     = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data       = buffer.getChannelData(0);
  let lastOut = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === "brown") {
      data[i]  = (lastOut + 0.02 * white) / 1.02;
      lastOut  = data[i];
      data[i] *= 3.5;
    } else {
      // Pink approximation
      data[i]  = (lastOut + 0.05 * white) / 1.05;
      lastOut  = data[i];
      data[i] *= 2.0;
    }
  }
  return buffer;
}

function startAudioNoise() {
  const type = audioNoiseType.value;
  if (type === "none") return stopAudioNoise();
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (noiseNode) { try { noiseNode.stop(); } catch (_) {} }

  noiseGainNode = audioCtx.createGain();
  noiseGainNode.gain.value = parseInt(noiseVolumeSlider.value) / 1000;
  noiseGainNode.connect(audioCtx.destination);

  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(type);
  noiseNode.loop   = true;
  noiseNode.connect(noiseGainNode);
  noiseNode.start();

  isAudioPlaying = true;
  btnToggleNoise.textContent = "Stop";
  showToast(`${type === "brown" ? "Brown" : "Pink"} noise playing 🎧`, "info", 2000);
}

function stopAudioNoise() {
  if (noiseNode) {
    try { noiseNode.stop(); } catch (_) {}
    noiseNode = null;
  }
  isAudioPlaying = false;
  btnToggleNoise.textContent = "Play";
}

btnToggleNoise.addEventListener("click", () => {
  if (isAudioPlaying) stopAudioNoise();
  else startAudioNoise();
});

audioNoiseType.addEventListener("change", () => {
  if (isAudioPlaying) startAudioNoise();
});

// ═══════════════════════════════════════════════════════════════
//  STATS RIBBON
// ═══════════════════════════════════════════════════════════════
function renderTopStats() {
  const state = appState;

  // Streak
  const streakEl = document.getElementById("topStreak");
  if (streakEl) streakEl.textContent = `${state.streak} ${state.streak === 1 ? "Day" : "Days"}`;

  // Focus Time
  const hours = (state.focusMinutesToday / 60).toFixed(1);
  const goal  = state.dailyFocusGoalHours || 5;
  document.getElementById("topFocusTime").textContent = `${hours}h`;
  document.getElementById("topFocusSub").textContent  = `Daily Goal: ${goal.toFixed(1)}h`;

  // Exam countdown
  const countdownEl     = document.getElementById("topCountdown");
  const paceEl          = document.getElementById("topPaceRequired");
  if (state.targetExamDate) {
    const diff = Math.ceil((new Date(state.targetExamDate) - new Date()) / 86400000);
    countdownEl.textContent = diff > 0 ? `${diff} Days` : "Exam Day!";

    const totalSolved = Object.values(state.subjects || {}).reduce((a, s) => a + s.solved, 0);
    const remaining   = Math.max(0, (state.totalQuestionGoal || 3000) - totalSolved);
    const pace        = diff > 0 ? Math.ceil(remaining / diff) : remaining;
    paceEl.textContent = diff > 0 ? `Need ${pace} Q/day to meet goal` : "Best of luck! 🎯";
  } else {
    countdownEl.textContent = "-- Days";
    paceEl.textContent = "Set exam date in Settings →";
  }

  // Rank prediction from last mock
  const rankEl = document.getElementById("topRankPrediction");
  const mocks  = state.mocks || [];
  if (mocks.length > 0) {
    const latest = [...mocks].sort((a, b) => b.date.localeCompare(a.date))[0];
    const pct    = (latest.score / (latest.total || 300)) * 100;
    let rank = "Top 50,000";
    if (pct >= 95) rank = "Top 500";
    else if (pct >= 90) rank = "Top 2,000";
    else if (pct >= 80) rank = "Top 5,000";
    else if (pct >= 70) rank = "Top 15,000";
    else if (pct >= 60) rank = "Top 30,000";
    if (rankEl) rankEl.textContent = rank;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUBJECT PROGRESS (Focus tab mini-rings)
// ═══════════════════════════════════════════════════════════════
function renderSubjectProgress() {
  const container = document.getElementById("subjectProgressList");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(appState.subjects || {}).forEach(([name, data]) => {
    const pct = Math.min(100, data.target > 0 ? Math.round((data.solved / data.target) * 100) : 0);
    const acc = data.solved > 0 ? Math.round((data.correct / data.solved) * 100) : 0;
    const row = document.createElement("div");
    row.className = "subject-progress-row";
    row.innerHTML = `
      <span class="subject-progress-name">${escapeHtml(name)}</span>
      <div class="progress-bar-wrap small" role="progressbar" aria-valuenow="${data.solved}" aria-valuemin="0" aria-valuemax="${data.target}" aria-label="${name}: ${pct}% complete">
        <div class="progress-bar ${pct >= 100 ? "progress-bar-done" : ""}" style="width:${pct}%"></div>
      </div>
      <span class="subject-progress-stat">${data.solved}/${data.target} · <span class="accent">${acc}%</span></span>
    `;
    container.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════════
//  COMPLETED BLOCKS
// ═══════════════════════════════════════════════════════════════
function renderCompletedBlocks() {
  const el = document.getElementById("completedBlocksList");
  if (!el) return;
  const blocks = appState.completedBlocks || [];
  if (!blocks.length) { el.innerHTML = ""; return; }

  el.innerHTML = `<div class="blocks-label">Today's sprints:</div>` +
    blocks.map(b => `<span class="block-chip">${escapeHtml(b)}</span>`).join("");
}

// ═══════════════════════════════════════════════════════════════
//  HEATMAP
// ═══════════════════════════════════════════════════════════════
function renderHeatmap() {
  const grid = document.getElementById("heatmapGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const history = appState.dailyHistory || {};
  const days    = 35; // 5 rows × 7 cols
  const today   = new Date();

  // Day labels
  ["Mo","Tu","We","Th","Fr","Sa","Su"].forEach(d => {
    const lbl = document.createElement("div");
    lbl.className = "heatmap-day-label";
    lbl.textContent = d;
    lbl.setAttribute("aria-hidden", "true");
    grid.appendChild(lbl);
  });

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso     = d.toISOString().split("T")[0];
    const minutes = history[iso] || 0;
    const level   = minutes === 0 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : minutes < 180 ? 3 : 4;
    const cell    = document.createElement("div");
    cell.className = `heatmap-cell level-${level}`;
    cell.title     = `${iso}: ${minutes ? Math.round(minutes) + "m" : "No study"}`;
    cell.setAttribute("aria-label", `${iso}: ${minutes ? Math.round(minutes) + " minutes" : "No study"}`);
    grid.appendChild(cell);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CHARTS (fixed: update existing instead of reinitialise)
// ═══════════════════════════════════════════════════════════════
let focusChartInst = null;
let mockChartInst  = null;

function initCharts() {
  // Focus weekly chart
  const fcCanvas = document.getElementById("focusChart");
  if (fcCanvas && !focusChartInst) {
    focusChartInst = new Chart(fcCanvas, {
      type: "bar",
      data: {
        labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
        datasets: [{
          label: "Focus (hrs)",
          data: appState.weeklyFocusVolume || [0,0,0,0,0,0,0],
          backgroundColor: "rgba(56,189,248,0.35)",
          borderColor: "#38bdf8",
          borderWidth: 2,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true, max: 10,
            ticks: { color: "#94a3b8", font: { family: "Inter" } },
            grid:  { color: "rgba(255,255,255,0.05)" }
          },
          x: {
            ticks: { color: "#94a3b8", font: { family: "Inter" } },
            grid:  { display: false }
          }
        }
      }
    });
  }

  // Mock trend chart
  const mcCanvas = document.getElementById("mockChart");
  if (mcCanvas && !mockChartInst) {
    mockChartInst = new Chart(mcCanvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Score /300",
          data: [],
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.15)",
          tension: 0.35,
          pointBackgroundColor: "#10b981",
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 0, max: 300,
            ticks: { color: "#94a3b8", font: { family: "Inter" } },
            grid:  { color: "rgba(255,255,255,0.05)" }
          },
          x: {
            ticks: { color: "#94a3b8", font: { family: "Inter" }, maxRotation: 30 },
            grid:  { display: false }
          }
        }
      }
    });
  }
}

function updateCharts() {
  if (!focusChartInst || !mockChartInst) {
    initCharts();
    return;
  }

  // Update focus chart data
  focusChartInst.data.datasets[0].data = appState.weeklyFocusVolume || [0,0,0,0,0,0,0];
  focusChartInst.update();

  // Update mock chart data
  const mocks = [...(appState.mocks || [])].sort((a, b) => a.date.localeCompare(b.date));
  mockChartInst.data.labels               = mocks.map(m => m.date);
  mockChartInst.data.datasets[0].data     = mocks.map(m => m.score);
  mockChartInst.update();
}

// ═══════════════════════════════════════════════════════════════
//  PACE ALERT BANNER
// ═══════════════════════════════════════════════════════════════
let paceBannerDismissed = false;

function checkPaceAlert() {
  if (paceBannerDismissed) return;
  const now  = new Date();
  const hour = now.getHours();
  // Show only after 8PM if focus is less than 50% of goal
  if (hour < 20) return;

  const goalMins  = (appState.dailyFocusGoalHours || 5) * 60;
  const doneMins  = appState.focusMinutesToday || 0;
  const pct       = goalMins > 0 ? (doneMins / goalMins) * 100 : 100;

  const banner = document.getElementById("paceBanner");
  const text   = document.getElementById("paceBannerText");

  if (pct < 50 && !isDemoMode) {
    text.textContent = `⏰ Evening check-in: You've completed ${Math.round(pct)}% of your ${appState.dailyFocusGoalHours}h goal today. A short session now keeps your streak alive!`;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

function dismissPaceBanner() {
  paceBannerDismissed = true;
  document.getElementById("paceBanner").classList.add("hidden");
}

// Check pace alert every minute
setInterval(checkPaceAlert, 60 * 1000);

// ═══════════════════════════════════════════════════════════════
//  RENDER ALL
// ═══════════════════════════════════════════════════════════════
function renderAll() {
  renderTopStats();
  renderTasks();
  renderSubjectProgress();
  renderCompletedBlocks();
  renderHeatmap();
  renderPractice();
  renderMistakes();
  renderMocks();
  renderSettings();
  checkPaceAlert();
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  initCharts();
  updateCharts();
  checkOnboarding();
  checkPaceAlert();
});
