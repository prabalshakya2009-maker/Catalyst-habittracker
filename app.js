const STORAGE_KEY = "CALIBRE_CLEAN_V7";
const LEGACY_KEYS = ["CALIBRE_CLEAN_V6"];
const SRS_INTERVALS = [1, 3, 7, 21];

const emptySubjects = () => ({
  Physics: { solved: 0, correct: 0, todaySolved: 0, todayCorrect: 0, target: 20 },
  Chemistry: { solved: 0, correct: 0, todaySolved: 0, todayCorrect: 0, target: 20 },
  Mathematics: { solved: 0, correct: 0, todaySolved: 0, todayCorrect: 0, target: 20 }
});

const defaultState = {
  streak: 0,
  lastOpenDate: localDateStr(),
  lastStudyDate: "",
  focusMinutesToday: 0,
  dailyHoursGoal: 5,
  targetExamDate: "2027-01-20",
  totalQuestionGoal: 3000,
  dailySubjectGoal: 20,
  focusByDate: {},
  completedBlocks: [],
  subjects: emptySubjects(),
  tasks: [],
  mistakes: [],
  paceLogs: [],
  mocks: [],
  timerSession: null,
  mistakeFilter: "due"
};

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
}

function daysBetween(fromStr, toStr) {
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function mergeSubjects(raw) {
  const base = emptySubjects();
  if (!raw) return base;
  Object.keys(base).forEach((k) => {
    const s = raw[k] || {};
    base[k] = {
      solved: Number(s.solved) || 0,
      correct: Number(s.correct) || 0,
      todaySolved: Number(s.todaySolved) || 0,
      todayCorrect: Number(s.todayCorrect) || 0,
      target: Number(s.target) || 20
    };
  });
  return base;
}

function loadState() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    parsed = null;
  }
  if (!parsed) {
    for (const key of LEGACY_KEYS) {
      try {
        parsed = JSON.parse(localStorage.getItem(key));
        if (parsed) break;
      } catch (e) {}
    }
  }
  if (!parsed) return structuredClone(defaultState);

  const merged = {
    ...structuredClone(defaultState),
    ...parsed,
    subjects: mergeSubjects(parsed.subjects),
    focusByDate: parsed.focusByDate || {},
    completedBlocks: parsed.completedBlocks || [],
    tasks: parsed.tasks || [],
    mistakes: (parsed.mistakes || []).map(normalizeMistake),
    paceLogs: parsed.paceLogs || [],
    mocks: parsed.mocks || [],
    dailyHoursGoal: parsed.dailyHoursGoal ?? 5,
    lastOpenDate: parsed.lastOpenDate || parsed.lastActiveDate || localDateStr(),
    lastStudyDate: parsed.lastStudyDate || "",
    streak: Number(parsed.streak) || 0
  };
  return merged;
}

function normalizeMistake(m) {
  const date = (m.date || localDateStr()).slice(0, 10);
  const nextReview = m.nextReview || addDays(date, m.stage || 1);
  return {
    id: m.id,
    topic: m.topic || "",
    subject: m.subject || "Physics",
    category: m.category || "Concept Misunderstanding",
    takeaway: m.takeaway || "",
    date,
    srsStep: Number.isFinite(m.srsStep) ? m.srsStep : 0,
    nextReview,
    mastered: Boolean(m.mastered)
  };
}

let appState = loadState();
let renderQueued = false;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function saveState() {
  persist();
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    renderAll();
  });
}

function rollDayIfNeeded() {
  const today = localDateStr();
  if (appState.lastOpenDate === today) return;

  if (appState.focusMinutesToday > 0) {
    appState.focusByDate[appState.lastOpenDate] = appState.focusMinutesToday;
  }

  if (appState.lastStudyDate && daysBetween(appState.lastStudyDate, today) > 1) {
    appState.streak = 0;
  }

  appState.focusMinutesToday = 0;
  appState.completedBlocks = [];
  Object.values(appState.subjects).forEach((s) => {
    s.todaySolved = 0;
    s.todayCorrect = 0;
  });
  appState.tasks = appState.tasks.filter((t) => !t.done);
  appState.paceLogs = [];
  appState.lastOpenDate = today;
}

rollDayIfNeeded();
persist();

function markStudiedToday() {
  const today = localDateStr();
  if (appState.lastStudyDate === today) return;
  if (appState.lastStudyDate === addDays(today, -1)) appState.streak += 1;
  else appState.streak = 1;
  appState.lastStudyDate = today;
}

function showToast(message, action) {
  const stack = document.getElementById("toastStack");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  if (action) {
    const btn = document.createElement("button");
    btn.className = "btn btn-tiny btn-primary";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      action.onClick();
      el.remove();
    });
    el.appendChild(btn);
  }
  stack.appendChild(el);
  setTimeout(() => el.remove(), action ? 8000 : 3200);
}

function switchTab(tab) {
  document.querySelectorAll(".nav-link").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
  const target = document.getElementById(`view-${tab}`);
  if (target) target.classList.add("active");

  const mobileIndicator = document.getElementById("mobileTabIndicator");
  const btn = document.querySelector(`.nav-link[data-tab="${tab}"]`);
  if (mobileIndicator && btn?.dataset.label) mobileIndicator.textContent = btn.dataset.label;

  if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
  if (tab === "dashboard" || tab === "mocks") updateCharts();
}

document.querySelectorAll(".nav-link").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

window.addEventListener("hashchange", () => {
  const tab = location.hash.replace("#", "");
  if (document.getElementById(`view-${tab}`)) switchTab(tab);
});

document.getElementById("btnOpenDueReviews").addEventListener("click", () => {
  appState.mistakeFilter = "due";
  switchTab("mistakes");
  saveState();
});

document.querySelectorAll("[data-mistake-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    appState.mistakeFilter = btn.dataset.mistakeFilter;
    saveState();
  });
});

// --- AUDIO ---
let audioCtx = null;
let oscL = null;
let oscR = null;
let noiseNode = null;
let isAudioRunning = false;

function startBinauralAudio(freqDiff) {
  stopAudio();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  oscL = audioCtx.createOscillator();
  oscR = audioCtx.createOscillator();
  oscL.frequency.value = 220;
  oscR.frequency.value = 220 + freqDiff;
  const merger = audioCtx.createChannelMerger(2);
  const gain = audioCtx.createGain();
  gain.gain.value = 0.08;
  oscL.connect(merger, 0, 0);
  oscR.connect(merger, 0, 1);
  merger.connect(gain);
  gain.connect(audioCtx.destination);
  oscL.start();
  oscR.start();
  setAudioButton(true);
}

function startBrownNoise() {
  stopAudio();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5;
  }
  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = buffer;
  noiseNode.loop = true;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.12;
  noiseNode.connect(gain);
  gain.connect(audioCtx.destination);
  noiseNode.start();
  setAudioButton(true);
}

function stopAudio() {
  if (oscL) { try { oscL.stop(); } catch (e) {} oscL = null; }
  if (oscR) { try { oscR.stop(); } catch (e) {} oscR = null; }
  if (noiseNode) { try { noiseNode.stop(); } catch (e) {} noiseNode = null; }
  setAudioButton(false);
}

function setAudioButton(active) {
  isAudioRunning = active;
  document.getElementById("btnAudioToggle").textContent = active ? "Stop" : "Play";
}

document.getElementById("btnAudioToggle").addEventListener("click", () => {
  if (isAudioRunning) {
    stopAudio();
    return;
  }
  const mode = document.getElementById("audioSelect").value;
  if (mode === "gamma") startBinauralAudio(40);
  else if (mode === "alpha") startBinauralAudio(10);
  else if (mode === "brown") startBrownNoise();
  else showToast("Pick a sound first, or keep silence.");
});

// --- FOCUS TIMER (wall-clock, survives tab sleep / refresh) ---
const timerClock = document.getElementById("timerClock");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerReset = document.getElementById("btnTimerReset");
const btnTimerSave = document.getElementById("btnTimerSave");
let timerInterval = null;
let wakeLock = null;
let timerMins = appState.timerSession?.durationMins || 50;

function remainingSeconds() {
  const t = appState.timerSession;
  if (!t) return timerMins * 60;
  if (t.running && t.endsAt) return Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
  return Math.max(0, Math.round((t.remainingMs || 0) / 1000));
}

function elapsedMinutes() {
  const t = appState.timerSession;
  if (!t) return 0;
  const planned = (t.durationMins || timerMins) * 60;
  const left = remainingSeconds();
  return Math.max(1, Math.round((planned - left) / 60));
}

function paintTimer() {
  const sec = remainingSeconds();
  timerClock.textContent = formatTime(sec);
  const t = appState.timerSession;
  if (t?.running) {
    btnTimerStart.textContent = "Pause";
    document.getElementById("timerTag").textContent = "In session — phone lock is OK";
    document.title = `${formatTime(sec)} · Calibre`;
  } else if (t && t.remainingMs > 0 && t.remainingMs < t.durationMins * 60000) {
    btnTimerStart.textContent = "Resume";
    document.getElementById("timerTag").textContent = "Paused";
    document.title = "Calibre — JEE Study Workspace";
  } else {
    btnTimerStart.textContent = "Start Session";
    document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
    document.title = "Calibre — JEE Study Workspace";
  }
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
  } catch (e) {}
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

function completeTimer(mins, label) {
  clearInterval(timerInterval);
  timerInterval = null;
  appState.timerSession = null;
  appState.focusMinutesToday += mins;
  appState.completedBlocks.push(label);
  markStudiedToday();
  btnTimerStart.textContent = "Start Session";
  timerMins = mins > 0 ? (document.querySelector(".preset-btn.active") ? parseInt(document.querySelector(".preset-btn.active").dataset.time) : 50) : timerMins;
  persist();
  paintTimer();
  releaseWakeLock();
  showToast(`${mins}m saved to today's focus.`);
  if (Notification.permission === "granted") {
    try { new Notification("Focus block done", { body: `${mins} minutes logged.` }); } catch (e) {}
  }
  renderAll();
}

function tickTimer() {
  if (!appState.timerSession) return;
  if (appState.timerSession.running && remainingSeconds() <= 0) {
    const mins = appState.timerSession.durationMins;
    completeTimer(mins, `${mins}m Block`);
    return;
  }
  paintTimer();
}

function startTimerLoop() {
  clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 250);
  tickTimer();
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (appState.timerSession?.running) return;
    document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    timerMins = parseInt(btn.dataset.time, 10);
    appState.timerSession = null;
    persist();
    paintTimer();
  });
});

btnTimerStart.addEventListener("click", async () => {
  const t = appState.timerSession;
  if (t?.running) {
    t.running = false;
    t.remainingMs = remainingSeconds() * 1000;
    t.endsAt = null;
    persist();
    releaseWakeLock();
    paintTimer();
    return;
  }
  const remainingMs = t?.remainingMs > 0 ? t.remainingMs : timerMins * 60 * 1000;
  const durationMins = t?.durationMins || timerMins;
  appState.timerSession = {
    running: true,
    endsAt: Date.now() + remainingMs,
    remainingMs,
    durationMins
  };
  persist();
  if (Notification.permission === "default") Notification.requestPermission().catch(() => {});
  await requestWakeLock();
  startTimerLoop();
});

btnTimerSave.addEventListener("click", () => {
  if (!appState.timerSession) {
    showToast("Start a session first.");
    return;
  }
  const mins = elapsedMinutes();
  completeTimer(mins, `${mins}m (stopped early)`);
});

btnTimerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  appState.timerSession = null;
  persist();
  releaseWakeLock();
  paintTimer();
  showToast("Session discarded — nothing logged.");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    tickTimer();
    if (appState.timerSession?.running) requestWakeLock();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (appState.timerSession?.running) {
    e.preventDefault();
    e.returnValue = "";
  }
});

if (appState.timerSession?.running) startTimerLoop();
else paintTimer();

// --- QUESTION LOG ---
function logQuestions(subKey, attempted, correct) {
  const sub = appState.subjects[subKey];
  if (!sub || attempted <= 0) return;
  const ok = Math.min(correct, attempted);
  sub.solved += attempted;
  sub.correct += ok;
  sub.todaySolved += attempted;
  sub.todayCorrect += ok;
  markStudiedToday();
  saveState();
}

function undoQuestion(subKey) {
  const sub = appState.subjects[subKey];
  if (!sub || sub.todaySolved <= 0) return;
  sub.solved = Math.max(0, sub.solved - 1);
  sub.todaySolved = Math.max(0, sub.todaySolved - 1);
  if (sub.todayCorrect > sub.todaySolved) {
    sub.todayCorrect -= 1;
    sub.correct = Math.max(0, sub.correct - 1);
  }
  saveState();
}

document.getElementById("setLogForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const sub = document.getElementById("setLogSubject").value;
  const attempted = parseInt(document.getElementById("setLogAttempted").value, 10);
  const wrong = parseInt(document.getElementById("setLogWrong").value, 10) || 0;
  if (!attempted || wrong > attempted) {
    showToast("Wrong cannot exceed attempted.");
    return;
  }
  logQuestions(sub, attempted, attempted - wrong);
  e.target.reset();
  document.getElementById("setLogWrong").value = "0";
  document.getElementById("setLogSubject").value = sub;
  showToast(`Logged ${attempted} ${sub} (${wrong} wrong).`);
});

document.getElementById("subjectCountersContainer").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-q]");
  if (!btn) return;
  const sub = btn.dataset.sub;
  const action = btn.dataset.q;
  if (action === "ok") logQuestions(sub, 1, 1);
  else if (action === "bad") {
    logQuestions(sub, 1, 0);
    showToast(`Wrong ${sub} logged.`, {
      label: "Add to notebook",
      onClick: () => {
        document.getElementById("errSubject").value = sub;
        switchTab("mistakes");
        document.getElementById("errChapter").focus();
      }
    });
  } else if (action === "plus5") logQuestions(sub, 5, 5);
  else if (action === "undo") undoQuestion(sub);
});

// --- PACE STOPWATCH ---
let paceSeconds = 0;
let paceInterval = null;
let isPaceActive = false;
let paceStartedAt = 0;

const paceTimerDisplay = document.getElementById("paceTimerDisplay");
const btnPaceToggle = document.getElementById("btnPaceToggle");

function paceNow() {
  if (!isPaceActive) return paceSeconds;
  return Math.floor((Date.now() - paceStartedAt) / 1000) + paceSeconds;
}

btnPaceToggle.addEventListener("click", () => {
  if (isPaceActive) {
    paceSeconds = paceNow();
    isPaceActive = false;
    clearInterval(paceInterval);
    btnPaceToggle.textContent = "Resume";
  } else {
    paceStartedAt = Date.now();
    isPaceActive = true;
    btnPaceToggle.textContent = "Pause";
    paceInterval = setInterval(() => {
      paceTimerDisplay.textContent = formatTime(paceNow());
    }, 250);
  }
});

function logPaceLap(isCorrect) {
  const elapsed = paceNow();
  clearInterval(paceInterval);
  isPaceActive = false;
  const sub = document.getElementById("paceSubject").value;
  appState.paceLogs.unshift({
    subject: sub,
    timeSec: elapsed,
    correct: isCorrect,
    timeText: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  });
  appState.paceLogs = appState.paceLogs.slice(0, 40);
  logQuestions(sub, 1, isCorrect ? 1 : 0);

  paceSeconds = 0;
  paceTimerDisplay.textContent = "00:00";
  btnPaceToggle.textContent = "Start Question";

  if (!isCorrect) {
    showToast("Wrong logged.", {
      label: "Add to notebook",
      onClick: () => {
        document.getElementById("errSubject").value = sub;
        switchTab("mistakes");
        document.getElementById("errChapter").focus();
      }
    });
  }

  if (document.getElementById("paceAutoNext").checked) {
    paceStartedAt = Date.now();
    isPaceActive = true;
    btnPaceToggle.textContent = "Pause";
    paceInterval = setInterval(() => {
      paceTimerDisplay.textContent = formatTime(paceNow());
    }, 250);
  }
}

document.getElementById("btnPaceCorrect").addEventListener("click", () => logPaceLap(true));
document.getElementById("btnPaceMistake").addEventListener("click", () => logPaceLap(false));

// --- TASKS ---
document.getElementById("todoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("todoInput");
  const slot = document.getElementById("todoSlot").value;
  if (!input.value.trim()) return;
  appState.tasks.push({ id: Date.now(), text: input.value.trim(), slot, done: false });
  input.value = "";
  saveState();
});

document.querySelector(".task-slots-container").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del-task]");
  if (del) {
    appState.tasks = appState.tasks.filter((t) => t.id !== Number(del.dataset.delTask));
    saveState();
    return;
  }
});

document.querySelector(".task-slots-container").addEventListener("change", (e) => {
  const box = e.target.closest("[data-toggle-task]");
  if (!box) return;
  const item = appState.tasks.find((t) => t.id === Number(box.dataset.toggleTask));
  if (item) {
    item.done = box.checked;
    if (item.done) markStudiedToday();
    saveState();
  }
});

// --- MISTAKES ---
function dueMistakes() {
  const today = localDateStr();
  return appState.mistakes.filter((m) => !m.mastered && m.nextReview <= today);
}

function filteredMistakes() {
  const today = localDateStr();
  if (appState.mistakeFilter === "due") return dueMistakes();
  if (appState.mistakeFilter === "open") return appState.mistakes.filter((m) => !m.mastered);
  return appState.mistakes;
}

document.getElementById("mistakeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const topic = document.getElementById("errChapter").value.trim();
  const sub = document.getElementById("errSubject").value;
  const cat = document.getElementById("errCategory").value;
  const takeaway = document.getElementById("errTakeaway").value.trim();
  appState.mistakes.unshift({
    id: Date.now(),
    topic,
    subject: sub,
    category: cat,
    takeaway,
    date: localDateStr(),
    srsStep: 0,
    nextReview: addDays(localDateStr(), 1),
    mastered: false
  });
  e.target.reset();
  document.getElementById("errSubject").value = sub;
  showToast("Saved. Due tomorrow unless you review tonight.");
  saveState();
});

function copySocraticPrompt(errId) {
  const item = appState.mistakes.find((m) => m.id === errId);
  if (!item) return;
  const promptText = `I made an error while solving a JEE ${item.subject} problem.
- Topic / Concept: ${item.topic}
- Mistake Category: ${item.category}
- My note: "${item.takeaway || "not written yet"}"

Act as a strict JEE tutor:
1. Ask 2 diagnostic questions to find where my reasoning broke.
2. State the exact law / formula with the constraint I missed.
3. Give 1 exam-level follow-up with a trap option.`;
  navigator.clipboard.writeText(promptText).then(() => {
    showToast("Prompt copied — paste into ChatGPT or Gemini.");
  });
}

function reviewMistake(errId, remembered) {
  const item = appState.mistakes.find((m) => m.id === errId);
  if (!item) return;
  if (remembered === "master") {
    item.mastered = true;
    item.nextReview = localDateStr();
  } else if (remembered) {
    item.srsStep = Math.min(item.srsStep + 1, SRS_INTERVALS.length - 1);
    item.nextReview = addDays(localDateStr(), SRS_INTERVALS[item.srsStep]);
  } else {
    item.srsStep = 0;
    item.nextReview = addDays(localDateStr(), SRS_INTERVALS[0]);
  }
  saveState();
}

document.getElementById("view-mistakes").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-m-act]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const act = btn.dataset.mAct;
  if (act === "copy") copySocraticPrompt(id);
  else if (act === "ok") reviewMistake(id, true);
  else if (act === "again") reviewMistake(id, false);
  else if (act === "master") reviewMistake(id, "master");
});

// --- MOCKS ---
function mockScoreInputs() {
  return ["mockPhy", "mockChem", "mockMath", "mockTotal"].map((id) => document.getElementById(id));
}

function updateMockLiveTotal() {
  const phy = parseFloat(document.getElementById("mockPhy").value) || 0;
  const chem = parseFloat(document.getElementById("mockChem").value) || 0;
  const math = parseFloat(document.getElementById("mockMath").value) || 0;
  const total = parseFloat(document.getElementById("mockTotal").value) || 300;
  document.getElementById("mockLiveTotal").textContent = `Total: ${phy + chem + math} / ${total}`;
}

mockScoreInputs().forEach((el) => el.addEventListener("input", updateMockLiveTotal));
document.getElementById("mockExam").addEventListener("change", () => {
  if (document.getElementById("mockExam").value === "main") {
    document.getElementById("mockTotal").value = 300;
  }
  updateMockLiveTotal();
});

function estimateMainPercentile(score, total) {
  const scaled = total ? (score / total) * 300 : score;
  if (scaled >= 220) return "99.5+";
  if (scaled >= 190) return "99.0–99.5";
  if (scaled >= 165) return "98–99";
  if (scaled >= 140) return "96–98";
  if (scaled >= 110) return "93–96";
  if (scaled >= 85) return "88–93";
  if (scaled >= 60) return "75–88";
  return "Below 75";
}

function predictRankFromMocks() {
  if (!appState.mocks.length) return "No mocks yet";
  const recent = appState.mocks.slice(0, 3);
  const avgPct = recent.reduce((sum, m) => sum + m.score / (m.total || 300), 0) / recent.length * 100;
  if (avgPct >= 73) return "~99 %ile band";
  if (avgPct >= 62) return "~98 %ile band";
  if (avgPct >= 50) return "~96 %ile band";
  if (avgPct >= 37) return "~90 %ile band";
  return "Build more mocks";
}

document.getElementById("mockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const phy = parseFloat(document.getElementById("mockPhy").value);
  const chem = parseFloat(document.getElementById("mockChem").value);
  const math = parseFloat(document.getElementById("mockMath").value);
  const total = parseFloat(document.getElementById("mockTotal").value) || 300;
  const neg = parseFloat(document.getElementById("mockNegatives").value) || 0;
  const score = phy + chem + math;
  appState.mocks.unshift({
    id: Date.now(),
    name: document.getElementById("mockName").value.trim(),
    date: document.getElementById("mockDate").value,
    exam: document.getElementById("mockExam").value,
    phy, chem, math, score, total, neg,
    percentile: estimateMainPercentile(score, total)
  });
  e.target.reset();
  document.getElementById("mockTotal").value = "300";
  document.getElementById("mockNegatives").value = "0";
  document.getElementById("mockDate").value = localDateStr();
  updateMockLiveTotal();
  showToast("Mock saved. Rank band is indicative — NTA sessions vary.");
  saveState();
});

document.getElementById("mockTableBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del-mock]");
  if (!btn) return;
  appState.mocks = appState.mocks.filter((m) => m.id !== Number(btn.dataset.delMock));
  saveState();
});

// --- SETTINGS ---
document.getElementById("btnSaveSettings").addEventListener("click", () => {
  appState.targetExamDate = document.getElementById("settingExamDate").value;
  appState.totalQuestionGoal = parseInt(document.getElementById("settingTotalGoal").value, 10) || 3000;
  appState.dailySubjectGoal = parseInt(document.getElementById("settingDailySubjectGoal").value, 10) || 20;
  appState.dailyHoursGoal = parseFloat(document.getElementById("settingDailyHours").value) || 5;
  Object.keys(appState.subjects).forEach((k) => {
    appState.subjects[k].target = appState.dailySubjectGoal;
  });
  showToast("Preferences saved.");
  saveState();
});

document.getElementById("btnExportJSON").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `calibre_backup_${localDateStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed.subjects) throw new Error("bad");
      appState = {
        ...structuredClone(defaultState),
        ...parsed,
        subjects: mergeSubjects(parsed.subjects),
        mistakes: (parsed.mistakes || []).map(normalizeMistake)
      };
      rollDayIfNeeded();
      showToast("Study data restored.");
      saveState();
    } catch (err) {
      showToast("Invalid backup file.");
    }
  };
  reader.readAsText(file);
});

document.getElementById("btnExportDailyCard").addEventListener("click", () => {
  const canvas = document.getElementById("dailyCardCanvas");
  const ctx = canvas.getContext("2d");
  const todayQs = Object.values(appState.subjects).reduce((a, b) => a + b.todaySolved, 0);

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = "#1e2e4a";
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, 1000, 1000);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 44px Inter, sans-serif";
  ctx.fillText("CALIBRE", 100, 140);
  ctx.fillStyle = "#64748b";
  ctx.font = "26px JetBrains Mono, monospace";
  ctx.fillText(new Date().toDateString().toUpperCase(), 100, 190);

  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 260, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px Inter, sans-serif";
  ctx.fillText("FOCUS TIME TODAY", 140, 320);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 72px JetBrains Mono, monospace";
  ctx.fillText(`${(appState.focusMinutesToday / 60).toFixed(1)} Hours`, 140, 410);

  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 500, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px Inter, sans-serif";
  ctx.fillText("QUESTIONS TODAY", 140, 560);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 72px JetBrains Mono, monospace";
  ctx.fillText(`${todayQs} Questions`, 140, 650);

  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px Inter, sans-serif";
  ctx.fillText("STREAK", 140, 800);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 52px JetBrains Mono, monospace";
  ctx.fillText(`${appState.streak} ${appState.streak === 1 ? "Day" : "Days"}`, 140, 870);

  ctx.fillStyle = "#141e33";
  ctx.fillRect(560, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px Inter, sans-serif";
  ctx.fillText("MOCK BAND", 600, 800);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 36px JetBrains Mono, monospace";
  ctx.fillText(predictRankFromMocks(), 600, 870);

  const link = document.createElement("a");
  link.download = `calibre_${localDateStr()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// --- CHARTS ---
let radarChart = null;
let barChart = null;

function computeSubjectAccuracy(subKey) {
  const d = appState.subjects[subKey];
  if (!d || d.solved === 0) return 0;
  return Math.min(100, Math.round((d.correct / d.solved) * 100));
}

function last7DayHours() {
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(localDateStr(), -i);
    labels.push(["S", "M", "T", "W", "T", "F", "S"][new Date(day + "T12:00:00").getDay()]);
    const mins = day === localDateStr()
      ? appState.focusMinutesToday
      : (appState.focusByDate[day] || 0);
    data.push(+(mins / 60).toFixed(1));
  }
  return { labels, data };
}

function initCharts() {
  const radarCtx = document.getElementById("subjectRadarChart").getContext("2d");
  radarChart = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: ["Physics", "Chemistry", "Mathematics"],
      datasets: [{
        label: "Accuracy %",
        data: ["Physics", "Chemistry", "Mathematics"].map(computeSubjectAccuracy),
        backgroundColor: "rgba(56, 189, 248, 0.15)",
        borderColor: "#38bdf8",
        borderWidth: 2,
        pointBackgroundColor: "#38bdf8"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false },
          grid: { color: "#1e2e4a" },
          angleLines: { color: "#1e2e4a" },
          pointLabels: { color: "#94a3b8", font: { size: 11, weight: 600 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  const week = last7DayHours();
  const barCtx = document.getElementById("weeklyHoursChart").getContext("2d");
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: week.labels,
      datasets: [{
        data: week.data,
        backgroundColor: "#1e2e4a",
        hoverBackgroundColor: "#38bdf8",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "#1e2e4a" }, ticks: { color: "#64748b" }, beginAtZero: true },
        x: { grid: { display: false }, ticks: { color: "#64748b" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateCharts() {
  if (radarChart) {
    radarChart.data.datasets[0].data = ["Physics", "Chemistry", "Mathematics"].map(computeSubjectAccuracy);
    radarChart.update();
  }
  if (barChart) {
    const week = last7DayHours();
    barChart.data.labels = week.labels;
    barChart.data.datasets[0].data = week.data;
    barChart.update();
  }
}

function mistakeRow(m, due) {
  const status = m.mastered
    ? "Mastered"
    : due
      ? `Due · ${SRS_INTERVALS[m.srsStep]}d`
      : `Next ${m.nextReview}`;
  const actions = `
    <button class="btn btn-secondary btn-tiny" data-m-act="copy" data-id="${m.id}">Copy prompt</button>
    ${m.mastered ? "" : `
      <button class="btn btn-success btn-tiny" data-m-act="ok" data-id="${m.id}">Got it</button>
      <button class="btn btn-danger btn-tiny" data-m-act="again" data-id="${m.id}">Still shaky</button>
      <button class="btn btn-secondary btn-tiny" data-m-act="master" data-id="${m.id}">Mastered</button>
    `}`;
  return { status, actions, due };
}

function renderAll() {
  const todayQs = Object.values(appState.subjects).reduce((a, b) => a + b.todaySolved, 0);
  const lifeQs = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  const due = dueMistakes();

  document.getElementById("topStreak").textContent = `${appState.streak} ${appState.streak === 1 ? "Day" : "Days"}`;
  document.getElementById("topFocusTime").textContent = `${(appState.focusMinutesToday / 60).toFixed(1)}h`;
  document.getElementById("topFocusGoal").textContent = `Daily Goal: ${appState.dailyHoursGoal}h`;
  document.getElementById("topRankPrediction").textContent = predictRankFromMocks();

  const exam = new Date(appState.targetExamDate + "T00:00:00");
  const diffDays = Math.max(0, Math.ceil((exam - new Date()) / 86400000));
  document.getElementById("topCountdown").textContent = `${diffDays} Days`;
  const remaining = Math.max(0, appState.totalQuestionGoal - lifeQs);
  const pace = diffDays > 0 ? (remaining / diffDays).toFixed(1) : "0";
  document.getElementById("topPaceRequired").textContent = `${pace} Qs/day to goal`;

  document.getElementById("settingExamDate").value = appState.targetExamDate;
  document.getElementById("settingTotalGoal").value = appState.totalQuestionGoal;
  document.getElementById("settingDailySubjectGoal").value = appState.dailySubjectGoal;
  document.getElementById("settingDailyHours").value = appState.dailyHoursGoal;

  const dueBanner = document.getElementById("dueBanner");
  dueBanner.hidden = due.length === 0;
  document.getElementById("dueBannerText").textContent =
    `${due.length} mistake${due.length === 1 ? "" : "s"} due for review`;

  const doneTasks = appState.tasks.filter((t) => t.done).length;
  document.getElementById("taskDoneCounter").textContent = `${doneTasks}/${appState.tasks.length} Done`;

  ["Morning", "Afternoon", "Evening"].forEach((slot) => {
    const container = document.getElementById(`tasksList${slot}`);
    const items = appState.tasks.filter((t) => t.slot === slot);
    container.innerHTML = items.length === 0
      ? `<span class="empty-hint">No ${slot.toLowerCase()} targets.</span>`
      : items.map((d) => `
        <div class="task-item ${d.done ? "done" : ""}">
          <div class="task-left">
            <input type="checkbox" data-toggle-task="${d.id}" ${d.done ? "checked" : ""}>
            <span>${escapeHtml(d.text)}</span>
          </div>
          <button class="btn btn-tiny" data-del-task="${d.id}" style="background:none;color:#64748b;">✕</button>
        </div>`).join("");
  });

  document.getElementById("todayQsBadge").textContent = `${todayQs} Qs today`;
  document.getElementById("subjectCountersContainer").innerHTML = Object.keys(appState.subjects).map((subKey) => {
    const sub = appState.subjects[subKey];
    const pct = Math.min(100, Math.round((sub.todaySolved / sub.target) * 100) || 0);
    const acc = sub.solved ? Math.round((sub.correct / sub.solved) * 100) : 0;
    return `
      <div class="counter-row">
        <div class="counter-header">
          <span>${subKey}</span>
          <span>${sub.todaySolved} / ${sub.target} today · ${sub.solved} lifetime (${acc}%)</span>
        </div>
        <div class="counter-progress-bar">
          <div class="counter-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="counter-actions">
          <button class="btn btn-success btn-small" data-q="ok" data-sub="${subKey}">+1 ✓</button>
          <button class="btn btn-danger btn-small" data-q="bad" data-sub="${subKey}">+1 ✗</button>
          <button class="btn btn-primary btn-small" data-q="plus5" data-sub="${subKey}">+5 ✓</button>
          <button class="btn btn-secondary btn-small" data-q="undo" data-sub="${subKey}">Undo</button>
        </div>
      </div>`;
  }).join("");

  const todayPace = appState.paceLogs;
  const avgPace = todayPace.length
    ? (todayPace.reduce((a, b) => a + b.timeSec, 0) / todayPace.length / 60).toFixed(1)
    : "--";
  document.getElementById("avgPaceText").textContent = `Avg: ${avgPace} min/Q · target 2.4`;
  document.getElementById("paceLapsList").innerHTML = todayPace.slice(0, 8).map((p) => `
    <div class="lap-item">
      <span><strong>${escapeHtml(p.subject)}</strong>: ${p.timeSec ? (p.timeSec / 60).toFixed(1) + "m" : "untimed"}</span>
      <span style="color:${p.correct ? "var(--accent-green)" : "var(--accent-rose)"}">${p.correct ? "✓ Correct" : "✗ Mistake"}</span>
    </div>
  `).join("") || `<span class="empty-hint">No questions timed today.</span>`;

  document.getElementById("dueReviewCount").textContent = `${due.length} Due for Review`;
  const list = filteredMistakes();
  const dueIds = new Set(due.map((d) => d.id));

  document.getElementById("mistakeTableBody").innerHTML = list.map((m) => {
    const { status, actions } = mistakeRow(m, dueIds.has(m.id));
    return `<tr>
      <td><strong>${escapeHtml(m.topic)}</strong></td>
      <td>${escapeHtml(m.subject)}</td>
      <td><span class="badge">${escapeHtml(m.category)}</span></td>
      <td>${escapeHtml(m.takeaway) || "—"}</td>
      <td><span class="badge ${dueIds.has(m.id) ? "badge-warn" : ""}">${status}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" style="text-align:center;color:#64748b;">Nothing in this filter.</td></tr>`;

  document.getElementById("mistakeCards").innerHTML = list.map((m) => {
    const { status, actions } = mistakeRow(m, dueIds.has(m.id));
    return `<article class="mistake-card">
      <header><strong>${escapeHtml(m.topic)}</strong><span class="badge ${dueIds.has(m.id) ? "badge-warn" : ""}">${status}</span></header>
      <p class="card-sub">${escapeHtml(m.subject)} · ${escapeHtml(m.category)}</p>
      <p>${escapeHtml(m.takeaway) || "No takeaway yet."}</p>
      <div class="counter-actions">${actions}</div>
    </article>`;
  }).join("") || `<span class="empty-hint">Nothing in this filter.</span>`;

  document.getElementById("mockTableBody").innerHTML = appState.mocks.map((m) => `
    <tr>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${escapeHtml(m.date)}</td>
      <td>${m.phy}</td>
      <td>${m.chem}</td>
      <td>${m.math}</td>
      <td><strong>${m.score} / ${m.total}</strong></td>
      <td style="color:var(--accent-rose);">${m.neg || 0}</td>
      <td><span class="badge">${escapeHtml(m.percentile || estimateMainPercentile(m.score, m.total))}</span></td>
      <td><button class="btn btn-tiny btn-secondary" data-del-mock="${m.id}">Delete</button></td>
    </tr>
  `).join("") || `<tr><td colspan="9" style="text-align:center;color:#64748b;">No mock tests logged yet.</td></tr>`;

  document.getElementById("completedBlocksList").innerHTML =
    appState.completedBlocks.map((b) => `<span class="chip">${escapeHtml(b)}</span>`).join("")
    || `<span class="empty-hint">No focus blocks completed today.</span>`;

  document.querySelectorAll("[data-mistake-filter]").forEach((btn) => {
    btn.classList.toggle("active-filter", btn.dataset.mistakeFilter === appState.mistakeFilter);
  });

  updateCharts();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("mockDate").value = localDateStr();
  const hash = location.hash.replace("#", "");
  if (document.getElementById(`view-${hash}`)) switchTab(hash);
  renderAll();
  initCharts();
  paintTimer();
});
