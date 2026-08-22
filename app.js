const DB_VERSION_KEY = "CALIBRE_OS_PRO_STATE_V5";

const defaultAppState = {
  streak: 1,
  lastDateStr: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  targetExamDate: "2027-01-20",
  totalTargetQuestions: 3000,
  dailyTargetPerSubject: 20,
  weeklyFocusStats: [3.5, 4.0, 5.0, 3.0, 4.5, 0, 0],
  completedBlocks: [],
  subjects: {
    Physics: { solved: 14, target: 20, correct: 12 },
    Chemistry: { solved: 18, target: 20, correct: 16 },
    Mathematics: { solved: 10, target: 20, correct: 7 }
  },
  directives: [
    { id: 1, text: "Solve 15 Rotational Dynamics PyQs", slot: "Morning", done: false },
    { id: 2, text: "Revise Thermodynamics formulas", slot: "Afternoon", done: false }
  ],
  errors: [
    {
      id: 1,
      topic: "Parallel Axis Theorem Constraint",
      subject: "Physics",
      category: "Conceptual Breakdown",
      takeaway: "I_cm must pass through the exact Center of Mass before shifting by Md^2.",
      stage: 3,
      date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0]
    }
  ],
  paceLogs: [],
  mocks: [
    { id: 1, name: "Major Diagnostic 01", date: "2026-08-15", phy: 68, chem: 72, math: 54, score: 194, total: 300, neg: 12, accuracy: 82 }
  ]
};

// Safe load & migration
let appState = JSON.parse(localStorage.getItem(DB_VERSION_KEY)) || defaultAppState;

function saveState() {
  localStorage.setItem(DB_VERSION_KEY, JSON.stringify(appState));
  renderAll();
}

// Midnight Reset Checker
const todayIso = new Date().toISOString().split("T")[0];
if (appState.lastDateStr !== todayIso) {
  appState.focusMinutesToday = 0;
  appState.completedBlocks = [];
  appState.lastDateStr = todayIso;
  appState.streak += 1;
  saveState();
}

// --- TAB ROUTING ---
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));

    btn.classList.add("active");
    const target = document.getElementById(`view-${btn.dataset.tab}`);
    if (target) target.classList.add("active");

    if (btn.dataset.tab === "dashboard" || btn.dataset.tab === "mocks") {
      updateCharts();
    }
  });
});

// --- SYNTHESIZED BINAURAL AUDIO ENGINE ---
let audioCtx = null;
let oscLeft = null;
let oscRight = null;
let noiseBufferNode = null;
let isAudioActive = false;

function startBinauralBeat(diffHz) {
  stopAudio();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  oscLeft = audioCtx.createOscillator();
  oscRight = audioCtx.createOscillator();
  const carrier = 220;

  oscLeft.frequency.value = carrier;
  oscRight.frequency.value = carrier + diffHz;

  const merger = audioCtx.createChannelMerger(2);
  const gain = audioCtx.createGain();
  gain.gain.value = 0.08;

  oscLeft.connect(merger, 0, 0);
  oscRight.connect(merger, 0, 1);
  merger.connect(gain);
  gain.connect(audioCtx.destination);

  oscLeft.start();
  oscRight.start();
  setAudioStatus(true);
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

  noiseBufferNode = audioCtx.createBufferSource();
  noiseBufferNode.buffer = buffer;
  noiseBufferNode.loop = true;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.12;
  noiseBufferNode.connect(gain);
  gain.connect(audioCtx.destination);

  noiseBufferNode.start();
  setAudioStatus(true);
}

function stopAudio() {
  if (oscLeft) { oscLeft.stop(); oscLeft = null; }
  if (oscRight) { oscRight.stop(); oscRight = null; }
  if (noiseBufferNode) { noiseBufferNode.stop(); noiseBufferNode = null; }
  setAudioStatus(false);
}

function setAudioStatus(active) {
  isAudioActive = active;
  document.getElementById("btnAudioToggle").textContent = active ? "Stop" : "Play";
  document.getElementById("audioIndicator").classList.toggle("active", active);
}

document.getElementById("btnAudioToggle").addEventListener("click", () => {
  if (isAudioActive) {
    stopAudio();
  } else {
    const val = document.getElementById("audioPreset").value;
    if (val === "gamma") startBinauralBeat(40);
    else if (val === "alpha") startBinauralBeat(10);
    else if (val === "brown") startBrownNoise();
  }
});

// --- PRECISION TIMER ENGINE ---
let timerMins = 50;
let timerSeconds = 50 * 60;
let timerInterval = null;
let isTimerRunning = false;

const timerClock = document.getElementById("timerClock");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerReset = document.getElementById("btnTimerReset");

function formatTimeDisplay(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (isTimerRunning) return;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    timerMins = parseInt(btn.dataset.time);
    timerSeconds = timerMins * 60;
    timerClock.textContent = formatTimeDisplay(timerSeconds);
    document.getElementById("timerModeTag").textContent = `${timerMins}m Block`;
  });
});

btnTimerStart.addEventListener("click", () => {
  if (isTimerRunning) {
    clearInterval(timerInterval);
    isTimerRunning = false;
    btnTimerStart.textContent = "Resume Session";
  } else {
    isTimerRunning = true;
    btnTimerStart.textContent = "Pause";
    timerInterval = setInterval(() => {
      timerSeconds--;
      timerClock.textContent = formatTimeDisplay(timerSeconds);

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        appState.focusMinutesToday += timerMins;
        appState.completedBlocks.push(`${timerMins}m Monotask Sprint`);
        btnTimerStart.textContent = "Start Session";
        timerSeconds = timerMins * 60;
        timerClock.textContent = formatTimeDisplay(timerSeconds);
        saveState();
        alert("Focus Sprint Complete!");
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerRunning = false;
  btnTimerStart.textContent = "Start Session";
  timerSeconds = timerMins * 60;
  timerClock.textContent = formatTimeDisplay(timerSeconds);
});

// --- QUESTION PACE STOPWATCH ENGINE ---
let paceSeconds = 0;
let paceInterval = null;
let isPaceRunning = false;

const paceDigital = document.getElementById("paceDigital");
const btnPaceStart = document.getElementById("btnPaceStart");

btnPaceStart.addEventListener("click", () => {
  if (isPaceRunning) {
    clearInterval(paceInterval);
    isPaceRunning = false;
    btnPaceStart.textContent = "Start Question";
  } else {
    paceSeconds = 0;
    isPaceRunning = true;
    btnPaceStart.textContent = "Pause / Stop";
    paceInterval = setInterval(() => {
      paceSeconds++;
      paceDigital.textContent = formatTimeDisplay(paceSeconds);
    }, 1000);
  }
});

function recordPaceLap(isCorrect) {
  if (paceSeconds === 0) return;
  clearInterval(paceInterval);
  isPaceRunning = false;
  btnPaceStart.textContent = "Start Question";

  const sub = document.getElementById("paceSubjectSelect").value;
  appState.paceLogs.unshift({
    subject: sub,
    timeSec: paceSeconds,
    correct: isCorrect,
    timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  if (appState.subjects[sub]) {
    appState.subjects[sub].solved += 1;
    if (isCorrect) appState.subjects[sub].correct += 1;
  }

  paceSeconds = 0;
  paceDigital.textContent = "00:00";
  saveState();
}

document.getElementById("btnPaceCorrect").addEventListener("click", () => recordPaceLap(true));
document.getElementById("btnPaceIncorrect").addEventListener("click", () => recordPaceLap(false));

// --- DIRECTIVES ROUTING ---
document.getElementById("directiveForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("directiveTextInput");
  const slot = document.getElementById("directiveTimeSlot").value;
  if (!input.value.trim()) return;

  appState.directives.push({ id: Date.now(), text: input.value.trim(), slot, done: false });
  input.value = "";
  saveState();
});

function toggleDirective(id) {
  const item = appState.directives.find(d => d.id === id);
  if (item) { item.done = !item.done; saveState(); }
}

function removeDirective(id) {
  appState.directives = appState.directives.filter(d => d.id !== id);
  saveState();
}

function adjustSubjectCount(subKey, delta) {
  const sub = appState.subjects[subKey];
  if (!sub) return;
  sub.solved = Math.max(0, sub.solved + delta);
  if (delta > 0) sub.correct = Math.max(0, sub.correct + delta);
  saveState();
}

// --- ERROR CALIBRATION & SOCRATIC AI PROMPT ---
document.getElementById("errorEntryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const topic = document.getElementById("errChapter").value.trim();
  const sub = document.getElementById("errSubject").value;
  const cat = document.getElementById("errCategory").value;
  const takeaway = document.getElementById("errTakeaway").value.trim();

  appState.errors.unshift({
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

function copySocraticAI(errId) {
  const err = appState.errors.find(e => e.id === errId);
  if (!err) return;

  const promptText = `I made an analytical error during a problem-solving session in ${err.subject}.
- Concept / Chapter: ${err.topic}
- Classification: ${err.category}
- My Derivation Takeaway: "${err.takeaway}"

Act as an elite academic mentor:
1. Formulate 2 diagnostic Socratic questions targeting the exact boundary conditions where my derivation broke down.
2. Outline the core physical/mathematical theorem cleanly.
3. Supply 1 advanced exam-level variation problem to test my mastery.`;

  navigator.clipboard.writeText(promptText).then(() => {
    alert("Socratic AI prompt copied to clipboard! Paste directly into your AI chat.");
  });
}

function resolveError(errId) {
  appState.errors = appState.errors.filter(e => e.id !== errId);
  saveState();
}

// --- MOCK TEST LOGGING & EMPIRICAL AIR PREDICTOR ---
document.getElementById("mockInputForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("mockNameInput").value;
  const date = document.getElementById("mockDateInput").value;
  const phy = parseFloat(document.getElementById("mockPhyInput").value);
  const chem = parseFloat(document.getElementById("mockChemInput").value);
  const math = parseFloat(document.getElementById("mockMathInput").value);
  const total = parseFloat(document.getElementById("mockTotalInput").value);
  const neg = parseFloat(document.getElementById("mockNegInput").value);

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

function predictAIR() {
  if (!appState.mocks.length) return "Top 5,000";
  const recent = appState.mocks.slice(0, 3);
  const avgPct = recent.reduce((s, m) => s + (m.score / m.total), 0) / recent.length * 100;

  if (avgPct >= 80) return "Top 800";
  if (avgPct >= 68) return "Top 2,500";
  if (avgPct >= 55) return "Top 6,000";
  if (avgPct >= 42) return "Top 15,000";
  return "25,000+";
}

// --- REPORT CARD CANVAS EXPORT ---
document.getElementById("btnGenerateReport").addEventListener("click", () => {
  const canvas = document.getElementById("shareReportCanvas");
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#080c14";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, 1000, 1000);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 44px 'Inter', sans-serif";
  ctx.fillText("CALIBRE OS", 100, 140);
  ctx.fillStyle = "#64748b";
  ctx.font = "26px 'JetBrains Mono', monospace";
  ctx.fillText(new Date().toDateString().toUpperCase(), 100, 190);

  // Focus Box
  ctx.fillStyle = "#111827";
  ctx.fillRect(100, 260, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Inter', sans-serif";
  ctx.fillText("DEEP FOCUS TIME", 140, 320);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${(appState.focusMinutesToday / 60).toFixed(1)} Hours`, 140, 410);

  // Solved Box
  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  ctx.fillStyle = "#111827";
  ctx.fillRect(100, 500, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Inter', sans-serif";
  ctx.fillText("PROBLEMS SOLVED TODAY", 140, 560);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${totalSolved} Questions`, 140, 650);

  // Footer Stats
  ctx.fillStyle = "#111827";
  ctx.fillRect(100, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px 'Inter', sans-serif";
  ctx.fillText("STREAK", 140, 800);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 52px 'JetBrains Mono', monospace";
  ctx.fillText(`${appState.streak} Days 🔥`, 140, 870);

  ctx.fillStyle = "#111827";
  ctx.fillRect(560, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px 'Inter', sans-serif";
  ctx.fillText("ESTIMATED AIR", 600, 800);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 48px 'JetBrains Mono', monospace";
  ctx.fillText(predictAIR(), 600, 870);

  const link = document.createElement("a");
  link.download = `calibre_daily_${todayIso}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// --- SETTINGS CONFIG & JSON BACKUP ---
document.getElementById("btnSaveConfig").addEventListener("click", () => {
  appState.targetExamDate = document.getElementById("settingExamDate").value;
  appState.totalTargetQuestions = parseInt(document.getElementById("settingTargetQuestions").value);
  appState.dailyTargetPerSubject = parseInt(document.getElementById("settingDailySubjectTarget").value);
  Object.keys(appState.subjects).forEach(k => appState.subjects[k].target = appState.dailyTargetPerSubject);
  saveState();
  alert("Settings saved successfully.");
});

document.getElementById("btnExportJSON").addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `calibre_backup_${todayIso}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.subjects && parsed.directives) {
        appState = parsed;
        saveState();
        alert("State successfully restored from JSON backup!");
      }
    } catch (err) { alert("Invalid backup JSON format."); }
  };
  reader.readAsText(e.target.files[0]);
});

// --- CHARTS (CHART.JS) ---
let radarInstance = null;
let barInstance = null;

function computeSubjectScore(subKey) {
  const d = appState.subjects[subKey];
  if (!d || d.solved === 0) return 45;
  const acc = (d.correct / d.solved) * 100;
  return Math.min(100, Math.round(acc));
}

function initCharts() {
  const radarCtx = document.getElementById("miniRadarChart").getContext("2d");
  radarInstance = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: ["Physics", "Chemistry", "Mathematics"],
      datasets: [{
        label: "Accuracy Index",
        data: [computeSubjectScore("Physics"), computeSubjectScore("Chemistry"), computeSubjectScore("Mathematics")],
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
          grid: { color: "#1e293b" },
          angleLines: { color: "#1e293b" },
          pointLabels: { color: "#94a3b8", font: { size: 11, weight: 600 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  const barCtx = document.getElementById("weeklyBarChart").getContext("2d");
  barInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [{
        data: [...appState.weeklyFocusStats.slice(0, 6), +(appState.focusMinutesToday / 60).toFixed(1)],
        backgroundColor: "#1e293b",
        hoverBackgroundColor: "#38bdf8",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "#1e293b" }, ticks: { color: "#64748b" } },
        x: { grid: { display: false }, ticks: { color: "#64748b" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateCharts() {
  if (radarInstance) {
    radarInstance.data.datasets[0].data = [
      computeSubjectScore("Physics"),
      computeSubjectScore("Chemistry"),
      computeSubjectScore("Mathematics")
    ];
    radarInstance.update();
  }
  if (barInstance) {
    barInstance.data.datasets[0].data = [
      ...appState.weeklyFocusStats.slice(0, 6),
      +(appState.focusMinutesToday / 60).toFixed(1)
    ];
    barInstance.update();
  }
}

// --- RENDER ALL DOM ELEMENTS ---
function renderAll() {
  document.getElementById("topStreak").textContent = appState.streak;
  document.getElementById("topHours").textContent = (appState.focusMinutesToday / 60).toFixed(1);
  document.getElementById("topRank").textContent = predictAIR();

  // Pace Run-Rate
  const diffDays = Math.max(1, Math.ceil((new Date(appState.targetExamDate) - new Date()) / 86400000));
  document.getElementById("examDaysLeft").textContent = `${diffDays} Days until Exam`;
  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  const remaining = Math.max(0, appState.totalTargetQuestions - totalSolved);
  document.getElementById("topPace").textContent = (remaining / diffDays).toFixed(1);

  // Settings inputs
  document.getElementById("settingExamDate").value = appState.targetExamDate;
  document.getElementById("settingTargetQuestions").value = appState.totalTargetQuestions;
  document.getElementById("settingDailySubjectTarget").value = appState.dailyTargetPerSubject;

  // Directives
  const doneDirectives = appState.directives.filter(d => d.done).length;
  document.getElementById("directiveCounter").textContent = `${doneDirectives}/${appState.directives.length} Done`;

  ["Morning", "Afternoon", "Evening"].forEach(slot => {
    const container = document.getElementById(`tasks${slot}`);
    const items = appState.directives.filter(d => d.slot === slot);
    container.innerHTML = items.length === 0 ? `<span class="empty-state">No ${slot.toLowerCase()} targets.</span>` : items.map(d => `
      <div class="task-item ${d.done ? 'done' : ''}">
        <div class="task-left">
          <input type="checkbox" ${d.done ? 'checked' : ''} onclick="toggleDirective(${d.id})">
          <span>${d.text}</span>
        </div>
        <button class="btn btn-tiny" style="background:none;color:#64748b;" onclick="removeDirective(${d.id})">✕</button>
      </div>
    `).join("");
  });

  // Problem Calibration Engine Grinder
  const grinderContainer = document.getElementById("grinderSubjectStack");
  grinderContainer.innerHTML = Object.keys(appState.subjects).map(subKey => {
    const sub = appState.subjects[subKey];
    const pct = Math.min(100, Math.round((sub.solved / sub.target) * 100));
    return `
      <div class="grinder-card">
        <div class="grinder-card-top">
          <span>${subKey}</span>
          <span>${sub.solved} / ${sub.target} Qs (${pct}%)</span>
        </div>
        <div class="grinder-meter-bg">
          <div class="grinder-meter-fill" style="width: ${pct}%"></div>
        </div>
        <div class="grinder-actions">
          <button class="btn btn-secondary btn-tiny" onclick="adjustSubjectCount('${subKey}', -1)">-1</button>
          <button class="btn btn-primary btn-tiny" onclick="adjustSubjectCount('${subKey}', 1)">+1 Question</button>
        </div>
      </div>
    `;
  }).join("");

  // Pace Stopwatch Laps
  const avgPace = appState.paceLogs.length > 0 
    ? (appState.paceLogs.reduce((a, b) => a + b.timeSec, 0) / appState.paceLogs.length / 60).toFixed(1)
    : "--";
  document.getElementById("avgPaceBadge").textContent = `Avg: ${avgPace} min/Q`;
  document.getElementById("paceLapsFeed").innerHTML = appState.paceLogs.slice(0, 4).map(p => `
    <div class="pace-lap-card">
      <span><strong>${p.subject}</strong>: ${(p.timeSec / 60).toFixed(1)}m</span>
      <span style="color:${p.correct ? 'var(--accent-emerald)' : 'var(--accent-rose)'}">${p.correct ? '✓ Correct' : '✗ Mistake'}</span>
    </div>
  `).join("") || `<span class="empty-state">No pace laps recorded.</span>`;

  // Error Board Table
  const now = new Date();
  const dueErrors = appState.errors.filter(e => Math.floor((now - new Date(e.date)) / 86400000) >= (e.stage || 3));
  document.getElementById("activeErrorsDue").textContent = `${dueErrors.length} Due for Review`;

  document.getElementById("errorRegisterTable").innerHTML = appState.errors.map(err => `
    <tr>
      <td><strong>${err.topic}</strong></td>
      <td>${err.subject}</td>
      <td><span class="badge">${err.category}</span></td>
      <td>${err.takeaway}</td>
      <td><span class="badge ${dueErrors.some(d => d.id === err.id) ? 'badge-warn' : ''}">Stage ${err.stage}d</span></td>
      <td>
        <button class="btn btn-secondary btn-tiny" onclick="copySocraticAI(${err.id})">Socratic AI</button>
        <button class="btn btn-secondary btn-tiny" onclick="resolveError(${err.id})">Resolve</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" style="text-align:center;color:#64748b;">No logged errors recorded.</td></tr>`;

  // Mock Table
  document.getElementById("mockHistoryTable").innerHTML = appState.mocks.map(m => `
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
  `).join("") || `<tr><td colspan="8" style="text-align:center;color:#64748b;">No diagnostic mocks logged yet.</td></tr>`;

  // Focus Blocks Chips
  document.getElementById("completedSessionsLog").innerHTML = appState.completedBlocks.map(b => `<span class="chip">${b}</span>`).join("") || `<span class="empty-state">No focus blocks recorded today.</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  initCharts();
});
// --- PWA LIFECYCLE & INSTALLATION ENGINE ---
let deferredPrompt = null;

// 1. Register Service Worker with error handling
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("New version available. Hard reload recommended.");
              }
            };
          }
        };
      })
      .catch((error) => console.error("Service Worker Registration Failed:", error));
  });
}

// 2. Capture native install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // If you have an install button in Settings, make it visible
  const installBtn = document.getElementById("btnInstallPWA");
  if (installBtn) {
    installBtn.style.display = "inline-flex";
    installBtn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          installBtn.style.display = "none";
        }
        deferredPrompt = null;
      }
    });
  }
});

// 3. Connectivity Status Toasts
window.addEventListener("online", () => {
  document.body.classList.remove("is-offline");
});

window.addEventListener("offline", () => {
  document.body.classList.add("is-offline");
});