const STORAGE_KEY = "FOCUS_OS_STATE_V2";

const initialState = {
  streak: 0,
  lastActiveDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  overallSyllabusPercent: 35,
  dailyQuestionTarget: 20,
  completedSessions: [],
  subjects: {
    Physics: { solved: 0, target: 20, correct: 0 },
    Chemistry: { solved: 0, target: 20, correct: 0 },
    Mathematics: { solved: 0, target: 20, correct: 0 }
  },
  directives: [
    { id: 1, text: "Revise Thermodynamics formulas", slot: "Morning", done: false },
    { id: 2, text: "Solve 15 Definite Integration PyQs", slot: "Afternoon", done: false }
  ],
  errors: []
};

let appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialState;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  renderAll();
}

// --- TAB NAVIGATION ---
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

// --- TIMER ENGINE ---
let timerInterval = null;
let timerSecondsRemaining = 50 * 60;
let isTimerRunning = false;

const timerDisplay = document.getElementById("timerDisplay");
const timerPreset = document.getElementById("timerPreset");
const btnTimerToggle = document.getElementById("btnTimerToggle");
const btnTimerReset = document.getElementById("btnTimerReset");

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

timerPreset.addEventListener("change", (e) => {
  if (!isTimerRunning) {
    timerSecondsRemaining = parseInt(e.target.value) * 60;
    timerDisplay.textContent = formatTime(timerSecondsRemaining);
  }
});

btnTimerToggle.addEventListener("click", () => {
  if (isTimerRunning) {
    clearInterval(timerInterval);
    btnTimerToggle.textContent = "Resume";
    isTimerRunning = false;
  } else {
    isTimerRunning = true;
    btnTimerToggle.textContent = "Pause";
    timerInterval = setInterval(() => {
      timerSecondsRemaining--;
      timerDisplay.textContent = formatTime(timerSecondsRemaining);

      if (timerSecondsRemaining <= 0) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        const minsLogged = parseInt(timerPreset.value);
        appState.focusMinutesToday += minsLogged;
        appState.completedSessions.push(`${minsLogged}m Block`);
        btnTimerToggle.textContent = "Start Session";
        timerSecondsRemaining = minsLogged * 60;
        timerDisplay.textContent = formatTime(timerSecondsRemaining);
        saveState();
        alert("Focus session complete!");
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerRunning = false;
  btnTimerToggle.textContent = "Start Session";
  timerSecondsRemaining = parseInt(timerPreset.value) * 60;
  timerDisplay.textContent = formatTime(timerSecondsRemaining);
});

// --- DIRECTIVES ENGINE ---
const directiveForm = document.getElementById("directiveForm");
directiveForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = document.getElementById("directiveInput").value.trim();
  const slot = document.getElementById("directiveSlot").value;
  if (!text) return;

  appState.directives.push({
    id: Date.now(),
    text,
    slot,
    done: false
  });
  document.getElementById("directiveInput").value = "";
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

// --- GRINDER ENGINE ---
function incrementSubject(subKey, change) {
  const sub = appState.subjects[subKey];
  if (!sub) return;
  sub.solved = Math.max(0, sub.solved + change);
  if (change > 0) sub.correct = Math.max(0, sub.correct + change);
  saveState();
}

// --- ERROR LOG ENGINE ---
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
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })
  });

  // Track as an incorrect attempt
  if (appState.subjects[subject]) {
    appState.subjects[subject].solved += 1;
  }

  document.getElementById("errTopic").value = "";
  document.getElementById("errNote").value = "";
  saveState();
});

function deleteError(id) {
  appState.errors = appState.errors.filter(e => e.id !== id);
  saveState();
}

// --- SETTINGS ENGINE ---
document.getElementById("btnSaveSettings").addEventListener("click", () => {
  const target = parseInt(document.getElementById("settingDailyTarget").value);
  const syl = parseInt(document.getElementById("settingSyllabus").value);
  
  appState.dailyQuestionTarget = target;
  appState.overallSyllabusPercent = syl;
  Object.keys(appState.subjects).forEach(k => appState.subjects[k].target = target);
  saveState();
  alert("Settings updated.");
});

document.getElementById("settingSyllabus").addEventListener("input", (e) => {
  document.getElementById("syllabusValDisplay").textContent = `${e.target.value}%`;
});

document.getElementById("btnResetData").addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all data?")) {
    localStorage.removeItem(STORAGE_KEY);
    appState = initialState;
    saveState();
    location.reload();
  }
});

// --- CHARTS (CHART.JS) ---
let radarChartInstance = null;
let barChartInstance = null;

function computeSubjectScore(subKey) {
  const data = appState.subjects[subKey];
  if (!data || data.solved === 0) return 40; // baseline
  const accuracy = (data.correct / data.solved) * 100;
  const syllabus = appState.overallSyllabusPercent;
  return Math.min(100, Math.round((0.6 * accuracy) + (0.4 * syllabus)));
}

function initCharts() {
  const radarCtx = document.getElementById("radarChart").getContext("2d");
  radarChartInstance = new Chart(radarCtx, {
    type: "radar",
    data: {
      labels: ["Physics", "Chemistry", "Mathematics"],
      datasets: [{
        label: "Mastery Level (%)",
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

// --- RENDER DOM ---
function renderAll() {
  // Top stats
  document.getElementById("topStreak").textContent = `${appState.streak} Days`;
  const hours = (appState.focusMinutesToday / 60).toFixed(1);
  document.getElementById("topHours").textContent = `${hours}h`;
  document.getElementById("sidebarFocusTime").textContent = `${appState.focusMinutesToday}m`;

  // Discipline completion
  const totalTasks = appState.directives.length;
  const doneTasks = appState.directives.filter(d => d.done).length;
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  document.getElementById("topDiscipline").textContent = `${taskPct}%`;
  document.getElementById("directivesCount").textContent = `${doneTasks} / ${totalTasks}`;

  // Completed blocks
  const blocksList = document.getElementById("completedBlocksList");
  blocksList.innerHTML = appState.completedSessions.length === 0 
    ? `<span class="empty-hint">No sessions logged yet today.</span>`
    : appState.completedSessions.map(s => `<span class="chip">${s}</span>`).join("");

  // Directives
  ["Morning", "Afternoon", "Evening"].forEach(slot => {
    const container = document.getElementById(`slot${slot}`);
    const items = appState.directives.filter(d => d.slot === slot);
    container.innerHTML = items.length === 0 
      ? `<span class="empty-hint">No ${slot.toLowerCase()} targets.</span>`
      : items.map(d => `
        <div class="task-item ${d.done ? 'done' : ''}">
          <div class="task-item-left">
            <input type="checkbox" ${d.done ? 'checked' : ''} onclick="toggleDirective(${d.id})">
            <span>${d.text}</span>
          </div>
          <button class="btn btn-small" style="background:none;color:#64748b;" onclick="removeDirective(${d.id})">✕</button>
        </div>
      `).join("");
  });

  // Grinder
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

  // Error Table
  const tableBody = document.getElementById("errorLogBody");
  tableBody.innerHTML = appState.errors.length === 0
    ? `<tr><td colspan="6" style="text-align:center;color:#64748b;">No logged errors. Flawless execution.</td></tr>`
    : appState.errors.map(err => `
      <tr>
        <td><strong>${err.topic}</strong></td>
        <td>${err.subject}</td>
        <td><span class="badge">${err.type}</span></td>
        <td>${err.note}</td>
        <td>${err.date}</td>
        <td><button class="btn btn-secondary btn-small" onclick="deleteError(${err.id})">Resolved</button></td>
      </tr>
    `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  initCharts();
});