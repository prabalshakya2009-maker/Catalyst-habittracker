const STORAGE_KEY = "CALIBRE_CLEAN_V6";

const defaultState = {
  streak: 1,
  lastActiveDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  targetExamDate: "2027-01-20",
  totalQuestionGoal: 3000,
  dailySubjectGoal: 20,
  weeklyFocusVolume: [3.5, 4.0, 5.0, 3.0, 4.5, 0, 0],
  completedBlocks: [],
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

let appState;
try {
  appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState;
} catch (e) {
  appState = defaultState;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  renderAll();
}

// Midnight reset check
const todayDateStr = new Date().toISOString().split("T")[0];
if (appState.lastActiveDate !== todayDateStr) {
  appState.focusMinutesToday = 0;
  appState.completedBlocks = [];
  appState.lastActiveDate = todayDateStr;
  appState.streak += 1;
  saveState();
}

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

// --- AUDIO GENERATOR (NATIVE WEB AUDIO API) ---
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
  if (isAudioRunning) {
    stopAudio();
  } else {
    const mode = document.getElementById("audioSelect").value;
    if (mode === "gamma") startBinauralAudio(40);
    else if (mode === "alpha") startBinauralAudio(10);
    else if (mode === "brown") startBrownNoise();
  }
});

// --- FOCUS TIMER ---
let timerMins = 50;
let timerSeconds = 50 * 60;
let timerInterval = null;
let isTimerActive = false;

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
    document.getElementById("timerTag").textContent = `${timerMins}m Focus Block`;
  });
});

btnTimerStart.addEventListener("click", () => {
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
        appState.focusMinutesToday += timerMins;
        appState.completedBlocks.push(`${timerMins}m Block`);
        btnTimerStart.textContent = "Start Session";
        timerSeconds = timerMins * 60;
        timerClock.textContent = formatTime(timerSeconds);
        saveState();
        alert("Focus session complete!");
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerActive = false;
  btnTimerStart.textContent = "Start Session";
  timerSeconds = timerMins * 60;
  timerClock.textContent = formatTime(timerSeconds);
});

// --- QUESTION PACE STOPWATCH ---
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

// --- TODAY'S PLAN (TASKS) ---
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

function adjustSubjectQuestions(subKey, change) {
  const sub = appState.subjects[subKey];
  if (!sub) return;
  sub.solved = Math.max(0, sub.solved + change);
  if (change > 0) sub.correct = Math.max(0, sub.correct + change);
  saveState();
}

// --- MISTAKE NOTEBOOK & SOCRATIC AI PROMPT ---
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

  const promptText = `I made an academic error while solving a ${item.subject} problem.
- Topic / Concept: ${item.topic}
- Mistake Category: ${item.category}
- My Reflection Note: "${item.takeaway}"

Act as a strict Socratic academic tutor:
1. Ask 2 diagnostic questions to test why my original derivation broke down.
2. Clearly state the exact physical/mathematical law.
3. Provide 1 challenging practice problem with an edge-case constraint to verify that I've mastered this concept.`;

  navigator.clipboard.writeText(promptText).then(() => {
    alert("Socratic AI prompt copied to clipboard! Paste it into your AI chat.");
  });
}

function resolveMistake(errId) {
  appState.mistakes = appState.mistakes.filter(m => m.id !== errId);
  saveState();
}

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

// --- SETTINGS & DATA PORTABILITY ---
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

// --- SHAREABLE DAILY CARD GENERATOR (CANVAS) ---
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

  // Focus Box
  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 260, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Inter', sans-serif";
  ctx.fillText("FOCUS TIME COMPLETED", 140, 320);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${(appState.focusMinutesToday / 60).toFixed(1)} Hours`, 140, 410);

  // Questions Box
  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  ctx.fillStyle = "#141e33";
  ctx.fillRect(100, 500, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Inter', sans-serif";
  ctx.fillText("QUESTIONS SOLVED TODAY", 140, 560);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${totalSolved} Questions`, 140, 650);

  // Footer Box
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
  const radarCtx = document.getElementById("subjectRadarChart").getContext("2d");
  radarChart = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: ["Physics", "Chemistry", "Mathematics"],
      datasets: [{
        label: "Accuracy %",
        data: [computeSubjectAccuracy("Physics"), computeSubjectAccuracy("Chemistry"), computeSubjectAccuracy("Mathematics")],
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

  const barCtx = document.getElementById("weeklyHoursChart").getContext("2d");
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
  if (radarChart) {
    radarChart.data.datasets[0].data = [
      computeSubjectAccuracy("Physics"),
      computeSubjectAccuracy("Chemistry"),
      computeSubjectAccuracy("Mathematics")
    ];
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

// --- RENDER DOM ELEMENTS ---
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
        <button class="btn btn-tiny" style="background:none;color:#64748b;" onclick="deleteTask(${d.id})">✕</button>
      </div>
    `).join("");
  });

  const counterContainer = document.getElementById("subjectCountersContainer");
  counterContainer.innerHTML = Object.keys(appState.subjects).map(subKey => {
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
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  initCharts();
});