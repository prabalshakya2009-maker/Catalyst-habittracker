const STORAGE_KEY = "CALIBRE_OS_STATE_PRO";

const initialState = {
  streak: 1,
  lastActiveDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  overallSyllabusPercent: 40,
  dailyQuestionTarget: 20,
  completedSessions: [],
  subjects: {
    Physics: { solved: 0, target: 20, correct: 0 },
    Chemistry: { solved: 0, target: 20, correct: 0 },
    Mathematics: { solved: 0, target: 20, correct: 0 }
  },
  directives: [
    { id: 1, text: "Revise Electromagnetism formulas", slot: "Morning", done: false },
    { id: 2, text: "Solve 15 Definite Integration PyQs", slot: "Afternoon", done: false }
  ],
  errors: []
};

let appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialState;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  renderAll();
}

// --- TAB ROUTING ---
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));

    btn.classList.add("active");
    const target = document.getElementById(`view-${btn.dataset.tab}`);
    if (target) target.classList.add("active");

    if (btn.dataset.tab === "analytics") {
      updateCharts();
    }
  });
});

// --- AUDIO SYNTHESIZER (NATIVE WEB AUDIO NOISE GENERATOR) ---
let audioCtx = null;
let noiseNode = null;
let isAudioPlaying = false;

const btnToggleNoise = document.getElementById("btnToggleNoise");
const audioNoiseType = document.getElementById("audioNoiseType");

function createNoiseBuffer(type) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === "brown") {
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain adjustment
    } else {
      // Pink approximation
      data[i] = (lastOut + (0.05 * white)) / 1.05;
      lastOut = data[i];
      data[i] *= 2.0;
    }
  }
  return buffer;
}

function startAudioNoise() {
  const type = audioNoiseType.value;
  if (type === "none") return stopAudioNoise();

  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (noiseNode) noiseNode.stop();

  const buffer = createNoiseBuffer(type);
  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = buffer;
  noiseNode.loop = true;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.15; // Safe default volume
  noiseNode.connect(gain);
  gain.connect(audioCtx.destination);

  noiseNode.start();
  isAudioPlaying = true;
  btnToggleNoise.textContent = "Stop";
}

function stopAudioNoise() {
  if (noiseNode) {
    noiseNode.stop();
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

// --- DEEP WORK TIMER ---
let timerInterval = null;
let timerSeconds = 50 * 60;
let isTimerActive = false;

const timerDisplay = document.getElementById("timerDisplay");
const timerPreset = document.getElementById("timerPreset");
const btnTimerToggle = document.getElementById("btnTimerToggle");
const btnTimerReset = document.getElementById("btnTimerReset");

function formatTime(s) {
  const mins = Math.floor(s / 60).toString().padStart(2, "0");
  const secs = (s % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

timerPreset.addEventListener("change", (e) => {
  if (!isTimerActive) {
    timerSeconds = parseInt(e.target.value) * 60;
    timerDisplay.textContent = formatTime(timerSeconds);
  }
});

btnTimerToggle.addEventListener("click", () => {
  if (isTimerActive) {
    clearInterval(timerInterval);
    btnTimerToggle.textContent = "Resume Session";
    isTimerActive = false;
  } else {
    isTimerActive = true;
    btnTimerToggle.textContent = "Pause";
    timerInterval = setInterval(() => {
      timerSeconds--;
      timerDisplay.textContent = formatTime(timerSeconds);

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        isTimerActive = false;
        const mins = parseInt(timerPreset.value);
        appState.focusMinutesToday += mins;
        appState.completedSessions.push(`${mins}m Focus Block`);
        btnTimerToggle.textContent = "Start Session";
        timerSeconds = mins * 60;
        timerDisplay.textContent = formatTime(timerSeconds);
        saveState();
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerActive = false;
  btnTimerToggle.textContent = "Start Session";
  timerSeconds = parseInt(timerPreset.value) * 60;
  timerDisplay.textContent = formatTime(timerSeconds);
});

// --- DIRECTIVES ROUTING ---
document.getElementById("directiveForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("directiveInput");
  const slot = document.getElementById("directiveSlot").value;
  if (!input.value.trim()) return;

  appState.directives.push({
    id: Date.now(),
    text: input.value.trim(),
    slot,
    done: false
  });
  input.value = "";
  saveState();
});

function toggleDirective(id) {
  const item = appState.directives.find(d => d.id === id);
  if (item) {
    item.done = !item.done;
    saveState();
  }
}

function removeDirective(id) {
  appState.directives = appState.directives.filter(d => d.id !== id);
  saveState();
}

// --- PROBLEM CALIBRATION (GRINDER) ---
function incrementSubject(subKey, change) {
  const sub = appState.subjects[subKey];
  if (!sub) return;
  sub.solved = Math.max(0, sub.solved + change);
  if (change > 0) sub.correct = Math.max(0, sub.correct + change);
  saveState();
}

// --- ERROR LOGGING & SPACED REPETITION ENGINE ---
document.getElementById("errorLogForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const topic = document.getElementById("errTopic").value.trim();
  const subject = document.getElementById("errSubject").value;
  const type = document.getElementById("errType").value;
  const note = document.getElementById("errNote").value.trim();

  appState.errors.unshift({
    id: Date.now(),
    topic,
    subject,
    type,
    note,
    date: new Date().toISOString().split("T")[0]
  });

  if (appState.subjects[subject]) {
    appState.subjects[subject].solved += 1; // Logged as an attempt
  }

  document.getElementById("errTopic").value = "";
  document.getElementById("errNote").value = "";
  saveState();
});

function calculateRepetitionStatus(isoDate) {
  const logged = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now - logged) / (1000 * 60 * 60 * 24));

  if (diffDays >= 21) return `<span class="badge due">Review Due (Day 21)</span>`;
  if (diffDays >= 7) return `<span class="badge due">Review Due (Day 7)</span>`;
  if (diffDays >= 3) return `<span class="badge due">Review Due (Day 3)</span>`;
  return `<span class="badge fresh">Fresh (${diffDays}d ago)</span>`;
}

function resolveError(id) {
  appState.errors = appState.errors.filter(e => e.id !== id);
  saveState();
}

// --- BACKUP & JSON EXPORT/IMPORT ---
document.getElementById("btnExportJSON").addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `calibre_state_${new Date().toISOString().split("T")[0]}.json`);
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
        alert("State successfully restored!");
      }
    } catch (err) {
      alert("Invalid JSON configuration file.");
    }
  };
  reader.readAsText(e.target.files[0]);
});

// --- SETTINGS PREFERENCES ---
document.getElementById("btnSaveSettings").addEventListener("click", () => {
  const target = parseInt(document.getElementById("settingDailyTarget").value);
  const syl = parseInt(document.getElementById("settingSyllabus").value);
  
  appState.dailyQuestionTarget = target;
  appState.overallSyllabusPercent = syl;
  Object.keys(appState.subjects).forEach(k => appState.subjects[k].target = target);
  saveState();
  alert("Settings saved.");
});

document.getElementById("settingSyllabus").addEventListener("input", (e) => {
  document.getElementById("syllabusValDisplay").textContent = `${e.target.value}%`;
});

// --- VIRAL DAILY REPORT GENERATOR (HTML5 CANVAS) ---
document.getElementById("btnDownloadCard").addEventListener("click", () => {
  const canvas = document.getElementById("shareCanvas");
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, 1080, 1080);

  // Decorative Border
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, 1000, 1000);

  // App Brand
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 44px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("CALIBRE OS", 100, 140);

  ctx.fillStyle = "#64748b";
  ctx.font = "28px 'JetBrains Mono', monospace";
  ctx.fillText(new Date().toDateString().toUpperCase(), 100, 190);

  // Metric Section 1: Focus Hours
  ctx.fillStyle = "#121824";
  ctx.fillRect(100, 260, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "30px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("DEEP FOCUS TIME", 140, 320);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${(appState.focusMinutesToday / 60).toFixed(1)} Hours`, 140, 410);

  // Metric Section 2: Problems Solved
  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  ctx.fillStyle = "#121824";
  ctx.fillRect(100, 500, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "30px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("PROBLEMS CALIBRATED", 140, 560);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${totalSolved} Questions`, 140, 650);

  // Metric Section 3: Streak & Rating
  ctx.fillStyle = "#121824";
  ctx.fillRect(100, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "26px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("CONSISTENCY", 140, 800);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 52px 'JetBrains Mono', monospace";
  ctx.fillText(`${appState.streak} Days 🔥`, 140, 870);

  ctx.fillStyle = "#121824";
  ctx.fillRect(560, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "26px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("TARGET AIR", 600, 800);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 52px 'JetBrains Mono', monospace";
  ctx.fillText("Top 5,000", 600, 870);

  // Download Trigger
  const link = document.createElement("a");
  link.download = `calibre_daily_${new Date().toISOString().split("T")[0]}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// --- ANALYTICS ENGINES ---
let radarChartInstance = null;
let barChartInstance = null;

function computeSubjectScore(subKey) {
  const data = appState.subjects[subKey];
  if (!data || data.solved === 0) return 40;
  const accuracy = (data.correct / data.solved) * 100;
  return Math.min(100, Math.round((0.6 * accuracy) + (0.4 * appState.overallSyllabusPercent)));
}

function initCharts() {
  const radarCtx = document.getElementById("radarChart").getContext("2d");
  radarChartInstance = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: ["Physics", "Chemistry", "Mathematics"],
      datasets: [{
        label: "Mastery Index",
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
          pointLabels: { color: "#94a3b8", font: { size: 12 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  const barCtx = document.getElementById("weeklyBarChart").getContext("2d");
  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [{
        data: [3.5, 4.0, 2.5, 5.0, 3.0, (appState.focusMinutesToday / 60).toFixed(1), 0],
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
  if (radarChartInstance) {
    radarChartInstance.data.datasets[0].data = [
      computeSubjectScore("Physics"),
      computeSubjectScore("Chemistry"),
      computeSubjectScore("Mathematics")
    ];
    radarChartInstance.update();
  }
}

// --- RENDER DOM ENGINE ---
function renderAll() {
  document.getElementById("topStreak").textContent = `${appState.streak} Days`;
  document.getElementById("topHours").textContent = `${(appState.focusMinutesToday / 60).toFixed(1)}h`;

  const totalTasks = appState.directives.length;
  const doneTasks = appState.directives.filter(d => d.done).length;
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  document.getElementById("topDiscipline").textContent = `${taskPct}%`;
  document.getElementById("directivesCount").textContent = `${doneTasks} / ${totalTasks}`;

  const blocksList = document.getElementById("completedBlocksList");
  blocksList.innerHTML = appState.completedSessions.length === 0 
    ? `<span class="empty-hint">No sessions completed yet today.</span>`
    : appState.completedSessions.map(s => `<span class="chip">${s}</span>`).join("");

  ["Morning", "Afternoon", "Evening"].forEach(slot => {
    const container = document.getElementById(`slot${slot}`);
    const items = appState.directives.filter(d => d.slot === slot);
    container.innerHTML = items.length === 0 
      ? `<span class="empty-hint">No ${slot.toLowerCase()} directives.</span>`
      : items.map(d => `
        <div class="task-item ${d.done ? 'done' : ''}">
          <div class="task-item-left">
            <input type="checkbox" ${d.done ? 'checked' : ''} onclick="toggleDirective(${d.id})">
            <span>${d.text}</span>
          </div>
          <button class="btn btn-tiny" style="background:none;color:#64748b;" onclick="removeDirective(${d.id})">✕</button>
        </div>
      `).join("");
  });

  const grinderContainer = document.getElementById("grinderList");
  grinderContainer.innerHTML = Object.keys(appState.subjects).map(subKey => {
    const sub = appState.subjects[subKey];
    const pct = Math.min(100, Math.round((sub.solved / sub.target) * 100));
    return `
      <div class="grinder-item">
        <div class="grinder-info">
          <span>${subKey}</span>
          <span>${sub.solved} / ${sub.target} Qs (${pct}%)</span>
        </div>
        <div class="grinder-controls">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
          <button class="btn btn-secondary btn-small" onclick="incrementSubject('${subKey}', -1)">-</button>
          <button class="btn btn-primary btn-small" onclick="incrementSubject('${subKey}', 1)">+1</button>
        </div>
      </div>
    `;
  }).join("");

  const tableBody = document.getElementById("errorLogBody");
  tableBody.innerHTML = appState.errors.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:#64748b;">No logged errors. Flawless execution.</td></tr>`
    : appState.errors.map(err => `
      <tr>
        <td><strong>${err.topic}</strong></td>
        <td>${err.subject}</td>
        <td><span class="badge">${err.type}</span></td>
        <td>${err.note}</td>
        <td>${calculateRepetitionStatus(err.date)}</td>
        <td><button class="btn btn-secondary btn-small" onclick="resolveError(${err.id})">Resolved</button></td>
      </tr>
    `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  initCharts();
});