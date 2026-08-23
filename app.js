const STORAGE_KEY = "CALIBRE_CLEAN_V7";

const defaultState = {
  streak: 1,
  lastActiveDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  dailyHistory: {}, // { 'YYYY-MM-DD': minutes }
  targetExamDate: "2027-01-20",
  totalQuestionGoal: 3000,
  dailySubjectGoal: 20,
  weeklyFocusVolume: [3.5, 4.0, 5.0, 3.0, 4.5, 0, 0],
  completedBlocks: [],
  onboarded: false,
  subjects: {
    Physics: { solved: 14, target: 20, correct: 12 },
    Chemistry: { solved: 18, target: 20, correct: 16 },
    Mathematics: { solved: 10, target: 20, correct: 7 }
  },
  tasks: [
    { id: 1, text: "Solve 15 Rotational Dynamics PyQs", slot: "Morning", done: false },
    { id: 2, text: "Revise Thermodynamics formulas", slot: "Afternoon", done: false }
  ],
  mistakes: [
    {
      id: 1,
      topic: "Parallel Axis Theorem Constraint",
      subject: "Physics",
      category: "Concept Misunderstanding",
      takeaway: "I_cm must pass through the exact Center of Mass before shifting by Md^2.",
      stage: 3,
      date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0]
    }
  ],
  paceLogs: [],
  mocks: [
    { id: 1, name: "Major Mock Test 01", date: "2026-08-15", phy: 68, chem: 72, math: 54, score: 194, total: 300, neg: 12, accuracy: 82 }
  ]
};

// Demo state snapshot
const demoState = {
  ...defaultState,
  streak: 14,
  focusMinutesToday: 180,
  dailyHistory: generateMockHeatmapHistory(),
  completedBlocks: ["50m Block (Physics)", "50m Block (Math)", "50m Block (Chem)"],
  subjects: {
    Physics: { solved: 22, target: 20, correct: 19 },
    Chemistry: { solved: 20, target: 20, correct: 18 },
    Mathematics: { solved: 18, target: 20, correct: 15 }
  },
  mocks: [
    { id: 1, name: "Allen Major Diagnostic 04", date: "2026-08-20", phy: 84, chem: 88, math: 76, score: 248, total: 300, neg: 4, accuracy: 94 },
    { id: 2, name: "Full Mock Test 03", date: "2026-08-12", phy: 78, chem: 80, math: 70, score: 228, total: 300, neg: 8, accuracy: 89 }
  ]
};

function generateMockHeatmapHistory() {
  const map = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const iso = d.toISOString().split("T")[0];
    map[iso] = Math.floor(Math.random() * 320) + 60;
  }
  return map;
}

let appState;
let isDemoMode = false;
let realAppStateBackup = null;

try {
  appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState;
} catch (e) {
  appState = defaultState;
}

function saveState() {
  if (!isDemoMode) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }
  renderAll();
}

// Midnight Reset Checker
const todayDateStr = new Date().toISOString().split("T")[0];
if (appState.lastActiveDate !== todayDateStr) {
  appState.focusMinutesToday = 0;
  appState.completedBlocks = [];
  appState.lastActiveDate = todayDateStr;
  appState.streak += 1;
  saveState();
}

// --- ONBOARDING GOAL PRESETS ---
function checkOnboarding() {
  if (!appState.onboarded) {
    document.getElementById("onboardingModal").classList.add("active");
  }
}

function applyGoalPreset(type) {
  if (type === "stem") {
    appState.subjects = {
      Physics: { solved: 0, target: 20, correct: 0 },
      Chemistry: { solved: 0, target: 20, correct: 0 },
      Mathematics: { solved: 0, target: 20, correct: 0 }
    };
    appState.dailySubjectGoal = 20;
  } else if (type === "college") {
    appState.subjects = {
      "Algorithms / DSA": { solved: 0, target: 10, correct: 0 },
      "System Design": { solved: 0, target: 10, correct: 0 },
      "Projects / Dev": { solved: 0, target: 10, correct: 0 }
    };
    appState.dailySubjectGoal = 10;
  } else {
    appState.subjects = {
      Science: { solved: 0, target: 15, correct: 0 },
      Mathematics: { solved: 0, target: 15, correct: 0 },
      Humanities: { solved: 0, target: 15, correct: 0 }
    };
    appState.dailySubjectGoal = 15;
  }

  appState.onboarded = true;
  closeOnboardingModal();
  saveState();
}

function closeOnboardingModal() {
  document.getElementById("onboardingModal").classList.remove("active");
}

// --- SAMPLE DATA PREVIEW TOGGLE ---
function toggleDemoData() {
  isDemoMode = !isDemoMode;
  const label = isDemoMode ? "Exit Sample Data" : "Preview Sample Data";
  document.getElementById("btnDemoToggleDesktop").textContent = label;
  document.getElementById("btnDemoToggleMobile").textContent = isDemoMode ? "Live" : "Sample";

  if (isDemoMode) {
    realAppStateBackup = JSON.parse(JSON.stringify(appState));
    appState = demoState;
  } else {
    appState = realAppStateBackup || defaultState;
  }
  renderAll();
  initCharts();
}

document.getElementById("btnDemoToggleDesktop").addEventListener("click", toggleDemoData);
document.getElementById("btnDemoToggleMobile").addEventListener("click", toggleDemoData);

// --- TAB SWITCHING ---
document.querySelectorAll(".nav-link").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    const target = document.getElementById(`view-${btn.dataset.tab}`);
    if (target) target.classList.add("active");

    const mobileIndicator = document.getElementById("mobileTabIndicator");
    if (mobileIndicator && btn.dataset.label) {
      mobileIndicator.textContent = btn.dataset.label;
    }

    if (btn.dataset.tab === "dashboard" || btn.dataset.tab === "mocks") {
      updateCharts();
    }
  });
});

// --- TIMER, AUDIO & AUTO-BREAK ENGINE ---
let timerMins = 50;
let timerSeconds = 50 * 60;
let timerInterval = null;
let isTimerActive = false;
let isBreakSession = false;
let activeBoundTask = null;

const timerClock = document.getElementById("timerClock");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerReset = document.getElementById("btnTimerReset");

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (isTimerActive) return;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    timerMins = parseInt(btn.dataset.time);
    timerSeconds = timerMins * 60;
    timerClock.textContent = formatTime(timerSeconds);
    isBreakSession = false;
    document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
  });
});

function playCompletionChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {}
}

btnTimerStart.addEventListener("click", () => {
  btnTimerStart.classList.remove("pulse-btn");

  if (isTimerActive) {
    clearInterval(timerInterval);
    isTimerActive = false;
    btnTimerStart.textContent = "Resume Session";
  } else {
    isTimerActive = true;
    btnTimerStart.textContent = "Pause";
    timerInterval = setInterval(() => {
      timerSeconds--;
      timerClock.textContent = formatTime(timerSeconds);

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        isTimerActive = false;
        playCompletionChime();

        if (!isBreakSession) {
          // Work session complete -> Log & start 5m break
          appState.focusMinutesToday += timerMins;
          appState.dailyHistory[todayDateStr] = (appState.dailyHistory[todayDateStr] || 0) + timerMins;
          const label = activeBoundTask ? `${timerMins}m (${activeBoundTask})` : `${timerMins}m Focus Block`;
          appState.completedBlocks.push(label);

          isBreakSession = true;
          timerSeconds = 5 * 60;
          timerClock.textContent = "05:00";
          document.getElementById("timerTag").textContent = "☕ 5m Rest Break (Hydrate & Stretch)";
          btnTimerStart.textContent = "Start Break";
          saveState();
          alert("Focus sprint complete! Take a 5-minute break.");
        } else {
          // Break complete -> Reset
          isBreakSession = false;
          timerSeconds = timerMins * 60;
          timerClock.textContent = formatTime(timerSeconds);
          document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
          btnTimerStart.textContent = "Start Session";
          alert("Break is over! Ready for your next focus sprint?");
        }
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerActive = false;
  isBreakSession = false;
  btnTimerStart.textContent = "Start Session";
  timerSeconds = timerMins * 60;
  timerClock.textContent = formatTime(timerSeconds);
  document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
});

// --- AUDIO SYNTHESIZER ---
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
  if (oscL) { try { oscL.stop(); } catch(e){} oscL = null; }
  if (oscR) { try { oscR.stop(); } catch(e){} oscR = null; }
  if (noiseNode) { try { noiseNode.stop(); } catch(e){} noiseNode = null; }
  setAudioButton(false);
}

function setAudioButton(active) {
  isAudioRunning = active;
  document.getElementById("btnAudioToggle").textContent = active ? "Stop" : "Play";
}

document.getElementById("btnAudioToggle").addEventListener("click", () => {
  if (isAudioRunning) stopAudio();
  else {
    const mode = document.getElementById("audioSelect").value;
    if (mode === "gamma") startBinauralAudio(40);
    else if (mode === "alpha") startBinauralAudio(10);
    else if (mode === "brown") startBrownNoise();
  }
});

// --- INLINE TASK TIMER BINDING ---
function bindTaskToTimer(taskText) {
  activeBoundTask = taskText;
  document.getElementById("activeTaskLabel").textContent = taskText;
  document.getElementById("activeTaskBanner").style.display = "flex";

  // Switch to Dashboard tab
  document.querySelector('[data-tab="dashboard"]').click();
}

document.getElementById("btnClearActiveTask").addEventListener("click", () => {
  activeBoundTask = null;
  document.getElementById("activeTaskBanner").style.display = "none";
});

// --- 30-DAY HEATMAP RENDERER ---
function renderHeatmap() {
  const container = document.getElementById("consistencyHeatmap");
  if (!container) return;

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split("T")[0];
  });

  container.innerHTML = days.map(day => {
    const mins = appState.dailyHistory?.[day] || 0;
    const hours = (mins / 60).toFixed(1);

    let lvClass = "lv0";
    if (mins >= 300) lvClass = "lv3";
    else if (mins >= 180) lvClass = "lv2";
    else if (mins > 0) lvClass = "lv1";

    return `<div class="heatmap-cell legend-cell ${lvClass}" title="${day}: ${hours}h studied"></div>`;
  }).join("");
}

// --- CUSTOM SUBJECT MANAGER ---
document.getElementById("btnOpenAddSubjectModal").addEventListener("click", () => {
  document.getElementById("customSubjectModal").classList.add("active");
});

function closeCustomSubjectModal() {
  document.getElementById("customSubjectModal").classList.remove("active");
}

document.getElementById("addSubjectForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("newSubjectName").value.trim();
  const target = parseInt(document.getElementById("newSubjectTarget").value);

  if (name && !appState.subjects[name]) {
    appState.subjects[name] = { solved: 0, target: target || 20, correct: 0 };
    document.getElementById("newSubjectName").value = "";
    closeCustomSubjectModal();
    saveState();
  }
});

// --- QUESTION STOPWATCH & FLOATING SPEED BAR ---
let paceSeconds = 0;
let paceInterval = null;
let isPaceActive = false;

const paceTimerDisplay = document.getElementById("paceTimerDisplay");
const btnPaceToggle = document.getElementById("btnPaceToggle");

btnPaceToggle.addEventListener("click", () => {
  if (isPaceActive) {
    clearInterval(paceInterval);
    isPaceActive = false;
    btnPaceToggle.textContent = "Start Question";
  } else {
    paceSeconds = 0;
    isPaceActive = true;
    btnPaceToggle.textContent = "Pause";
    paceInterval = setInterval(() => {
      paceSeconds++;
      paceTimerDisplay.textContent = formatTime(paceSeconds);
    }, 1000);
  }
});

function logPaceLap(isCorrect) {
  if (paceSeconds === 0) return;
  clearInterval(paceInterval);
  isPaceActive = false;
  btnPaceToggle.textContent = "Start Question";

  const sub = document.getElementById("paceSubject").value;
  appState.paceLogs.unshift({
    subject: sub,
    timeSec: paceSeconds,
    correct: isCorrect,
    timeText: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  if (appState.subjects[sub]) {
    appState.subjects[sub].solved += 1;
    if (isCorrect) appState.subjects[sub].correct += 1;
  }

  paceSeconds = 0;
  paceTimerDisplay.textContent = "00:00";
  saveState();
}

document.getElementById("btnPaceCorrect").addEventListener("click", () => logPaceLap(true));
document.getElementById("btnPaceMistake").addEventListener("click", () => logPaceLap(false));

function adjustSubjectQuestions(subKey, change) {
  const sub = appState.subjects[subKey];
  if (!sub) return;
  sub.solved = Math.max(0, sub.solved + change);
  if (change > 0) sub.correct = Math.max(0, sub.correct + change);
  saveState();
}

// --- TASKS, MISTAKES & QUICK TAGS ---
document.getElementById("todoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("todoInput");
  const slot = document.getElementById("todoSlot").value;
  if (!input.value.trim()) return;

  appState.tasks.push({ id: Date.now(), text: input.value.trim(), slot, done: false });
  input.value = "";
  saveState();
});

function toggleTask(id) {
  const item = appState.tasks.find(t => t.id === id);
  if (item) { item.done = !item.done; saveState(); }
}

function deleteTask(id) {
  appState.tasks = appState.tasks.filter(t => t.id !== id);
  saveState();
}

// Tag pill insertion
document.querySelectorAll(".tag-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    const input = document.getElementById("errTakeaway");
    input.value = `${input.value} ${pill.dataset.tag}`.trim();
  });
});

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
    stage: 3,
    date: new Date().toISOString().split("T")[0]
  });

  if (appState.subjects[sub]) appState.subjects[sub].solved += 1;
  e.target.reset();
  saveState();
});

function copySocraticPrompt(errId) {
  const item = appState.mistakes.find(m => m.id === errId);
  if (!item) return;

  const promptText = `I made an error in ${item.subject}.
- Topic: ${item.topic}
- Mistake Type: ${item.category}
- My Reflection: "${item.takeaway}"

Act as a strict Socratic academic tutor:
1. Ask 2 diagnostic questions to uncover where my derivation logic broke down.
2. Outline the core formula and physical/mathematical law.
3. Supply 1 advanced problem with an edge-case constraint to verify my understanding.`;

  navigator.clipboard.writeText(promptText).then(() => {
    alert("Socratic AI prompt copied! Paste into ChatGPT or Gemini.");
  });
}

function resolveMistake(errId) {
  appState.mistakes = appState.mistakes.filter(m => m.id !== errId);
  saveState();
}

// --- QUICK MISTAKE MODAL (Alt+M) ---
function openQuickMistakeModal() {
  document.getElementById("quickMistakeModal").classList.add("active");
}

function closeQuickMistakeModal() {
  document.getElementById("quickMistakeModal").classList.remove("active");
}

document.getElementById("quickMistakeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const topic = document.getElementById("quickErrTopic").value.trim();
  const sub = document.getElementById("quickErrSubject").value;
  const cat = document.getElementById("quickErrCategory").value;
  const takeaway = document.getElementById("quickErrTakeaway").value.trim();

  appState.mistakes.unshift({
    id: Date.now(),
    topic,
    subject: sub,
    category: cat,
    takeaway,
    stage: 3,
    date: new Date().toISOString().split("T")[0]
  });

  if (appState.subjects[sub]) appState.subjects[sub].solved += 1;
  e.target.reset();
  closeQuickMistakeModal();
  saveState();
});

// --- KEYBOARD SHORTCUTS ENGINE ---
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

  if (e.code === "Space") {
    e.preventDefault();
    btnTimerStart.click();
  } else if (e.altKey && e.key.toLowerCase() === "q") {
    e.preventDefault();
    const firstSub = Object.keys(appState.subjects)[0];
    if (firstSub) adjustSubjectQuestions(firstSub, 1);
  } else if (e.altKey && e.key.toLowerCase() === "m") {
    e.preventDefault();
    openQuickMistakeModal();
  }
});

// --- MOCK TESTS & RANK PREDICTOR ---
document.getElementById("mockForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("mockName").value;
  const date = document.getElementById("mockDate").value;
  const phy = parseFloat(document.getElementById("mockPhy").value);
  const chem = parseFloat(document.getElementById("mockChem").value);
  const math = parseFloat(document.getElementById("mockMath").value);
  const total = parseFloat(document.getElementById("mockTotal").value);
  const neg = parseFloat(document.getElementById("mockNegatives").value);

  const score = phy + chem + math;
  const accuracy = Math.round(((score + neg) / (score + neg * 2 || 1)) * 100);

  appState.mocks.unshift({
    id: Date.now(),
    name,
    date,
    phy,
    chem,
    math,
    score,
    total,
    neg,
    accuracy: Math.min(100, Math.max(0, accuracy))
  });

  e.target.reset();
  saveState();
});

function predictRankFromMocks() {
  if (!appState.mocks.length) return "Top 5,000";
  const recent = appState.mocks.slice(0, 3);
  const avgPct = recent.reduce((sum, m) => sum + (m.score / m.total), 0) / recent.length * 100;

  if (avgPct >= 80) return "Top 800";
  if (avgPct >= 68) return "Top 2,500";
  if (avgPct >= 55) return "Top 6,000";
  if (avgPct >= 42) return "Top 15,000";
  return "25,000+";
}

// --- SETTINGS & DATA EXPORT ---
document.getElementById("btnSaveSettings").addEventListener("click", () => {
  appState.targetExamDate = document.getElementById("settingExamDate").value;
  appState.totalQuestionGoal = parseInt(document.getElementById("settingTotalGoal").value);
  appState.dailySubjectGoal = parseInt(document.getElementById("settingDailySubjectGoal").value);
  Object.keys(appState.subjects).forEach(k => appState.subjects[k].target = appState.dailySubjectGoal);
  saveState();
  alert("Settings saved successfully.");
});

document.getElementById("btnExportJSON").addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `calibre_backup_${todayDateStr}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.subjects && parsed.tasks) {
        appState = parsed;
        saveState();
        alert("Study data restored successfully!");
      }
    } catch (err) {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(e.target.files[0]);
});

// --- CANVAS SHAREABLE REPORT CARD ---
document.getElementById("btnExportDailyCard").addEventListener("click", () => {
  const canvas = document.getElementById("dailyCardCanvas");
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = "#1e2e4a";
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, 1000, 1000);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 44px 'Inter', sans-serif";
  ctx.fillText("CALIBRE", 100, 140);
  ctx.fillStyle = "#64748b";
  ctx.font = "26px 'JetBrains Mono', monospace";
  ctx.fillText(new Date().toDateString().toUpperCase(), 100, 190);

  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 260, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Inter', sans-serif";
  ctx.fillText("FOCUS TIME COMPLETED", 140, 320);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${(appState.focusMinutesToday / 60).toFixed(1)} Hours`, 140, 410);

  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 500, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Inter', sans-serif";
  ctx.fillText("QUESTIONS SOLVED TODAY", 140, 560);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${totalSolved} Questions`, 140, 650);

  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px 'Inter', sans-serif";
  ctx.fillText("STREAK", 140, 800);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 52px 'JetBrains Mono', monospace";
  ctx.fillText(`${appState.streak} ${appState.streak === 1 ? 'Day' : 'Days'} 🔥`, 140, 870);

  ctx.fillStyle = "#141e33";
  ctx.fillRect(560, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px 'Inter', sans-serif";
  ctx.fillText("TARGET AIR", 600, 800);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 48px 'JetBrains Mono', monospace";
  ctx.fillText(predictRankFromMocks(), 600, 870);

  const link = document.createElement("a");
  link.download = `calibre_${todayDateStr}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// --- CHARTS (CHART.JS) ---
let radarChart = null;
let barChart = null;

function computeSubjectAccuracy(subKey) {
  const d = appState.subjects[subKey];
  if (!d || d.solved === 0) return 50;
  return Math.min(100, Math.round((d.correct / d.solved) * 100));
}

function initCharts() {
  const subKeys = Object.keys(appState.subjects);
  const radarCtx = document.getElementById("subjectRadarChart").getContext("2d");
  if (radarChart) radarChart.destroy();

  radarChart = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: subKeys,
      datasets: [{
        label: "Accuracy %",
        data: subKeys.map(k => computeSubjectAccuracy(k)),
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
          pointLabels: { color: "#94a3b8", font: { size: 10, weight: 600 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  const barCtx = document.getElementById("weeklyHoursChart").getContext("2d");
  if (barChart) barChart.destroy();

  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [{
        data: [...appState.weeklyFocusVolume.slice(0, 6), +(appState.focusMinutesToday / 60).toFixed(1)],
        backgroundColor: "#1e2e4a",
        hoverBackgroundColor: "#38bdf8",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "#1e2e4a" }, ticks: { color: "#64748b" } },
        x: { grid: { display: false }, ticks: { color: "#64748b" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateCharts() {
  const subKeys = Object.keys(appState.subjects);
  if (radarChart) {
    radarChart.data.labels = subKeys;
    radarChart.data.datasets[0].data = subKeys.map(k => computeSubjectAccuracy(k));
    radarChart.update();
  }
  if (barChart) {
    barChart.data.datasets[0].data = [
      ...appState.weeklyFocusVolume.slice(0, 6),
      +(appState.focusMinutesToday / 60).toFixed(1)
    ];
    barChart.update();
  }
}

// --- RENDER ALL UI ELEMENTS ---
function renderAll() {
  document.getElementById("topStreak").textContent = `${appState.streak} ${appState.streak === 1 ? 'Day' : 'Days'}`;
  document.getElementById("topFocusTime").textContent = `${(appState.focusMinutesToday / 60).toFixed(1)}h`;
  document.getElementById("topRankPrediction").textContent = predictRankFromMocks();

  const diffDays = Math.max(1, Math.ceil((new Date(appState.targetExamDate) - new Date()) / 86400000));
  document.getElementById("topCountdown").textContent = `${diffDays} Days`;
  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  const remaining = Math.max(0, appState.totalQuestionGoal - totalSolved);
  const pace = (remaining / diffDays).toFixed(1);
  document.getElementById("topPaceRequired").textContent = `${pace} Qs/day required`;

  document.getElementById("settingExamDate").value = appState.targetExamDate;
  document.getElementById("settingTotalGoal").value = appState.totalQuestionGoal;
  document.getElementById("settingDailySubjectGoal").value = appState.dailySubjectGoal;

  // Render dropdown subjects
  const subKeys = Object.keys(appState.subjects);
  const optionsHtml = subKeys.map(s => `<option value="${s}">${s}</option>`).join("");
  document.getElementById("paceSubject").innerHTML = optionsHtml;
  document.getElementById("errSubject").innerHTML = optionsHtml;
  document.getElementById("quickErrSubject").innerHTML = optionsHtml;

  // Directives
  const doneTasks = appState.tasks.filter(t => t.done).length;
  document.getElementById("taskDoneCounter").textContent = `${doneTasks}/${appState.tasks.length} Done`;

  ["Morning", "Afternoon", "Evening"].forEach(slot => {
    const container = document.getElementById(`tasksList${slot}`);
    const items = appState.tasks.filter(t => t.slot === slot);
    container.innerHTML = items.length === 0 ? `<span class="empty-hint">No ${slot.toLowerCase()} targets.</span>` : items.map(d => `
      <div class="task-item ${d.done ? 'done' : ''}">
        <div class="task-left">
          <input type="checkbox" ${d.done ? 'checked' : ''} onclick="toggleTask(${d.id})">
          <span>${d.text}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="btn-task-bind" onclick="bindTaskToTimer('${d.text.replace(/'/g, "\\'")}')">▶ Focus</button>
          <button class="btn btn-tiny btn-ghost" onclick="deleteTask(${d.id})">✕</button>
        </div>
      </div>
    `).join("");
  });

  // Practice Counters
  const counterContainer = document.getElementById("subjectCountersContainer");
  counterContainer.innerHTML = subKeys.map(subKey => {
    const sub = appState.subjects[subKey];
    const pct = Math.min(100, Math.round((sub.solved / sub.target) * 100));
    return `
      <div class="counter-row">
        <div class="counter-header">
          <span>${subKey}</span>
          <span>${sub.solved} / ${sub.target} Qs (${pct}%)</span>
        </div>
        <div class="counter-progress-bar">
          <div class="counter-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="counter-actions">
          <button class="btn btn-secondary btn-small" onclick="adjustSubjectQuestions('${subKey}', -1)">-1</button>
          <button class="btn btn-primary btn-small" onclick="adjustSubjectQuestions('${subKey}', 1)">+1 Question</button>
        </div>
      </div>
    `;
  }).join("");

  // Floating Speed Bar Buttons
  document.getElementById("speedButtonsContainer").innerHTML = subKeys.map(k => `
    <button class="speed-btn" onclick="adjustSubjectQuestions('${k}', 1)">+1 ${k.slice(0, 4)}</button>
  `).join("");

  // Pace laps
  const avgPace = appState.paceLogs.length > 0 
    ? (appState.paceLogs.reduce((a, b) => a + b.timeSec, 0) / appState.paceLogs.length / 60).toFixed(1)
    : "--";
  document.getElementById("avgPaceText").textContent = `Avg: ${avgPace} min/Q`;
  document.getElementById("paceLapsList").innerHTML = appState.paceLogs.slice(0, 4).map(p => `
    <div class="lap-item">
      <span><strong>${p.subject}</strong>: ${(p.timeSec / 60).toFixed(1)}m</span>
      <span style="color:${p.correct ? 'var(--accent-green)' : 'var(--accent-rose)'}">${p.correct ? '✓ Correct' : '✗ Mistake'}</span>
    </div>
  `).join("") || `<span class="empty-hint">No questions timed today.</span>`;

  // Mistake Notebook Table
  const now = new Date();
  const dueMistakes = appState.mistakes.filter(m => Math.floor((now - new Date(m.date)) / 86400000) >= (m.stage || 3));
  document.getElementById("dueReviewCount").textContent = `${dueMistakes.length} Due for Review`;

  document.getElementById("mistakeTableBody").innerHTML = appState.mistakes.map(m => `
    <tr>
      <td><strong>${m.topic}</strong></td>
      <td>${m.subject}</td>
      <td><span class="badge">${m.category}</span></td>
      <td>${m.takeaway}</td>
      <td><span class="badge ${dueMistakes.some(d => d.id === m.id) ? 'badge-warn' : ''}">Stage ${m.stage}d</span></td>
      <td>
        <button class="btn btn-secondary btn-tiny" onclick="copySocraticPrompt(${m.id})">Copy AI Prompt</button>
        <button class="btn btn-secondary btn-tiny" onclick="resolveMistake(${m.id})">Resolve</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" style="text-align:center;color:#64748b;">No mistakes logged yet.</td></tr>`;

  // Mock Table
  document.getElementById("mockTableBody").innerHTML = appState.mocks.map(m => `
    <tr>
      <td><strong>${m.name}</strong></td>
      <td>${m.date}</td>
      <td>${m.phy}</td>
      <td>${m.chem}</td>
      <td>${m.math}</td>
      <td><strong>${m.score} / ${m.total}</strong></td>
      <td style="color:var(--accent-rose);">${m.neg}</td>
      <td><span class="badge">${m.accuracy}%</span></td>
    </tr>
  `).join("") || `<tr><td colspan="8" style="text-align:center;color:#64748b;">No mock tests logged yet.</td></tr>`;

  document.getElementById("completedBlocksList").innerHTML = appState.completedBlocks.map(b => `<span class="chip">${b}</span>`).join("") || `<span class="empty-hint">No focus blocks completed today.</span>`;

  renderHeatmap();
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  initCharts();
  checkOnboarding();
});