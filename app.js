const DB_KEY = "CALIBRE_SIMPLE_STATE";

const defaultState = {
  streak: 1,
  lastDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  weeklyFocus: [3.5, 4.0, 2.5, 5.0, 3.0, 4.5, 0], // Mon-Sun
  questions: {
    Physics: 0,
    Chemistry: 0,
    Mathematics: 0
  },
  todos: [
    { id: 1, text: "Complete 15 Physics Mechanics questions", done: false },
    { id: 2, text: "Revise Organic Chemistry reactions", done: false }
  ],
  mistakes: [
    {
      id: 1,
      subject: "Physics",
      chapter: "Thermodynamics",
      note: "Work done in adiabatic expansion is positive when system does work on surroundings."
    }
  ]
};

let state = JSON.parse(localStorage.getItem(DB_KEY)) || defaultState;

function save() {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
  render();
}

// Check new day reset
const todayStr = new Date().toISOString().split("T")[0];
if (state.lastDate !== todayStr) {
  state.focusMinutesToday = 0;
  state.questions = { Physics: 0, Chemistry: 0, Mathematics: 0 };
  state.lastDate = todayStr;
  state.streak += 1;
  save();
}

// --- TAB SWITCHING ---
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    btn.classList.add("active");
    const target = document.getElementById(`tab-${btn.dataset.tab}`);
    if (target) target.classList.add("active");

    if (btn.dataset.tab === "stats") renderChart();
  });
});

// --- TIMER ENGINE ---
let timerMins = 25;
let timerSeconds = 25 * 60;
let timerInterval = null;
let isRunning = false;

const timerDisplay = document.getElementById("timerDisplay");
const btnToggle = document.getElementById("btnTimerToggle");
const btnReset = document.getElementById("btnTimerReset");

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

document.querySelectorAll(".pill-btn").forEach(pill => {
  pill.addEventListener("click", () => {
    if (isRunning) return;
    document.querySelectorAll(".pill-btn").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");

    timerMins = parseInt(pill.dataset.mins);
    timerSeconds = timerMins * 60;
    timerDisplay.textContent = formatTime(timerSeconds);
  });
});

btnToggle.addEventListener("click", () => {
  if (isRunning) {
    clearInterval(timerInterval);
    isRunning = false;
    btnToggle.textContent = "Resume Focus";
  } else {
    isRunning = true;
    btnToggle.textContent = "Pause";
    timerInterval = setInterval(() => {
      timerSeconds--;
      timerDisplay.textContent = formatTime(timerSeconds);

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        isRunning = false;
        state.focusMinutesToday += timerMins;
        btnToggle.textContent = "Start Focus";
        timerSeconds = timerMins * 60;
        timerDisplay.textContent = formatTime(timerSeconds);
        save();
        alert("Session completed! Take a short break.");
      }
    }, 1000);
  }
});

btnReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  isRunning = false;
  btnToggle.textContent = "Start Focus";
  timerSeconds = timerMins * 60;
  timerDisplay.textContent = formatTime(timerSeconds);
});

// --- QUESTION COUNTERS ---
function changeQuestions(subject, delta) {
  state.questions[subject] = Math.max(0, (state.questions[subject] || 0) + delta);
  save();
}

// --- TO-DO LIST ---
document.getElementById("todoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("todoInput");
  const val = input.value.trim();
  if (!val) return;

  state.todos.push({ id: Date.now(), text: val, done: false });
  input.value = "";
  save();
});

function toggleTodo(id) {
  const item = state.todos.find(t => t.id === id);
  if (item) {
    item.done = !item.done;
    save();
  }
}

function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  save();
}

// --- MISTAKE NOTEBOOK ---
document.getElementById("mistakeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const chapter = document.getElementById("mistakeChapter").value.trim();
  const subject = document.getElementById("mistakeSubject").value;
  const note = document.getElementById("mistakeNote").value.trim();

  state.mistakes.unshift({ id: Date.now(), chapter, subject, note });
  document.getElementById("mistakeChapter").value = "";
  document.getElementById("mistakeNote").value = "";
  save();
});

function deleteMistake(id) {
  state.mistakes = state.mistakes.filter(m => m.id !== id);
  save();
}

// --- BACKUP & IMPORT ---
document.getElementById("btnExportData").addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `calibre_backup_${todayStr}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.todos && parsed.questions) {
        state = parsed;
        save();
        alert("Study data restored successfully!");
      }
    } catch (err) {
      alert("Invalid backup file.");
    }
  };
  reader.readAsText(e.target.files[0]);
});

// --- CHART RENDER ---
let chartInstance = null;
function renderChart() {
  const ctx = document.getElementById("weeklyChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"],
      datasets: [{
        data: [...state.weeklyFocus.slice(0, 6), +(state.focusMinutesToday / 60).toFixed(1)],
        backgroundColor: "#334155",
        hoverBackgroundColor: "#38bdf8",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          grid: { color: "#334155" },
          ticks: { color: "#94a3b8", callback: v => `${v}h` }
        },
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8" }
        }
      }
    }
  });
}

// --- RENDER DOM ---
function render() {
  // Streak & Today hours
  document.getElementById("streakBadge").textContent = `🔥 ${state.streak} Day Streak`;
  const h = Math.floor(state.focusMinutesToday / 60);
  const m = state.focusMinutesToday % 60;
  document.getElementById("todayStudyHours").textContent = `${h}h ${m}m`;

  // Questions
  document.getElementById("countPhysics").textContent = state.questions.Physics || 0;
  document.getElementById("countChemistry").textContent = state.questions.Chemistry || 0;
  document.getElementById("countMathematics").textContent = state.questions.Mathematics || 0;
  
  const totalQ = (state.questions.Physics || 0) + (state.questions.Chemistry || 0) + (state.questions.Mathematics || 0);
  document.getElementById("totalQuestionsText").textContent = `${totalQ} Solved`;

  // Todos
  const doneCount = state.todos.filter(t => t.done).length;
  document.getElementById("taskProgressText").textContent = `${doneCount} / ${state.todos.length} Done`;

  const todoContainer = document.getElementById("todoListContainer");
  if (state.todos.length === 0) {
    todoContainer.innerHTML = `<p class="empty-state">No tasks added. Add your next goal above!</p>`;
  } else {
    todoContainer.innerHTML = state.todos.map(t => `
      <div class="todo-item ${t.done ? 'done' : ''}">
        <div class="todo-left">
          <input type="checkbox" ${t.done ? 'checked' : ''} onclick="toggleTodo(${t.id})">
          <span>${t.text}</span>
        </div>
        <button class="btn btn-ghost" style="padding:2px 8px; border:none;" onclick="deleteTodo(${t.id})">✕</button>
      </div>
    `).join("");
  }

  // Mistakes
  document.getElementById("mistakeCountText").textContent = `${state.mistakes.length} note${state.mistakes.length === 1 ? '' : 's'}`;
  const mistakeContainer = document.getElementById("mistakeListContainer");
  if (state.mistakes.length === 0) {
    mistakeContainer.innerHTML = `<p class="empty-state">No mistakes logged yet. When you solve questions and get one wrong, write it here!</p>`;
  } else {
    mistakeContainer.innerHTML = state.mistakes.map(m => `
      <div class="mistake-card">
        <div class="mistake-content">
          <h4><span class="badge-sub">${m.subject}</span> ${m.chapter}</h4>
          <p>${m.note}</p>
        </div>
        <button class="btn btn-ghost" style="padding:2px 8px; font-size:0.8rem;" onclick="deleteMistake(${m.id})">✓ Understood</button>
      </div>
    `).join("");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  render();
});