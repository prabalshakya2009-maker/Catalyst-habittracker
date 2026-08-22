const STORAGE_KEY = "CALIBRE_OS_STATE_V4";

const defaultSyllabus = {
  Physics: [
    { name: "Kinematics & Vectors", t: true, p: true, r: false },
    { name: "Laws of Motion & Friction", t: true, p: false, r: false },
    { name: "Work, Power & Energy", t: true, p: true, r: true },
    { name: "Rotational Dynamics", t: false, p: false, r: false },
    { name: "Thermodynamics & KTG", t: true, p: false, r: false },
    { name: "Electrostatics & Capacitance", t: true, p: true, r: false },
    { name: "Current Electricity", t: true, p: true, r: true },
    { name: "Magnetic Effects & EMI", t: false, p: false, r: false },
    { name: "Optics (Ray & Wave)", t: false, p: false, r: false },
    { name: "Modern Physics", t: true, p: true, r: false }
  ],
  Chemistry: [
    { name: "Mole Concept & Stoichiometry", t: true, p: true, r: true },
    { name: "Atomic Structure", t: true, p: true, r: false },
    { name: "Chemical Thermodynamics", t: true, p: false, r: false },
    { name: "Chemical Equilibrium", t: true, p: false, r: false },
    { name: "Periodic Table & Bonding", t: true, p: true, r: true },
    { name: "General Organic Chemistry", t: true, p: true, r: false },
    { name: "Hydrocarbons", t: true, p: false, r: false },
    { name: "Coordination Compounds", t: false, p: false, r: false },
    { name: "Carbonyl Compounds", t: false, p: false, r: false },
    { name: "Electrochemistry", t: true, p: true, r: false }
  ],
  Mathematics: [
    { name: "Sets, Relations & Functions", t: true, p: true, r: true },
    { name: "Quadratic Equations", t: true, p: true, r: true },
    { name: "Complex Numbers", t: true, p: false, r: false },
    { name: "Matrices & Determinants", t: true, p: true, r: false },
    { name: "Definite Integration & Areas", t: true, p: true, r: false },
    { name: "Differential Equations", t: true, p: false, r: false },
    { name: "Vectors & 3D Geometry", t: true, p: true, r: true },
    { name: "Coordinate Conic Sections", t: false, p: false, r: false },
    { name: "Probability & Statistics", t: false, p: false, r: false },
    { name: "Limits & Continuity", t: true, p: true, r: false }
  ]
};

const initialState = {
  streak: 1,
  lastActiveDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  hourlyFocus: Array(24).fill(0),
  historicalDailyAvgFocus: 240, // 4.0h baseline
  historicalDailyAvgQuestions: 35,
  totalExamProblemTarget: 3000,
  dailyQuestionTarget: 20,
  completedSessions: [],
  milestones: [
    { id: 1, name: "JEE Main Session 1", date: "2027-01-20" },
    { id: 2, name: "Board Examinations", date: "2027-02-15" },
    { id: 3, name: "JEE Advanced", date: "2027-05-25" }
  ],
  subjects: {
    Physics: { solved: 14, target: 20, correct: 12, tiers: { Foundation: 4, Main: 8, Advanced: 2 } },
    Chemistry: { solved: 18, target: 20, correct: 16, tiers: { Foundation: 6, Main: 10, Advanced: 2 } },
    Mathematics: { solved: 10, target: 20, correct: 7, tiers: { Foundation: 2, Main: 6, Advanced: 2 } }
  },
  directives: [
    { id: 1, text: "Solve 15 Definite Integration PyQs", slot: "Morning", done: false },
    { id: 2, text: "Revise Thermodynamics formulas", slot: "Afternoon", done: false }
  ],
  errors: [
    {
      id: 1,
      topic: "Rotational Inertia / Parallel Axis Theorem",
      subject: "Physics",
      type: "Conceptual Gap",
      note: "I_cm must always be through the center of mass before shifting by Md^2.",
      date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0],
      stage: 3
    }
  ],
  formulas: [
    {
      id: 1,
      title: "Biot-Savart Law",
      subject: "Physics",
      latex: "d\\vec{B} = \\frac{\\mu_0}{4\\pi} \\frac{I (d\\vec{l} \\times \\hat{r})}{r^2}",
      notes: "Applies exclusively to steady line currents in free space."
    },
    {
      id: 2,
      title: "Arrhenius Activation Energy",
      subject: "Chemistry",
      latex: "k = A e^{-\\frac{E_a}{RT}} \\implies \\ln k = \\ln A - \\frac{E_a}{RT}",
      notes: "Slope of ln(k) vs 1/T represents -Ea/R."
    },
    {
      id: 3,
      title: "Leibniz Integral Rule",
      subject: "Mathematics",
      latex: "\\frac{d}{dx} \\int_{u(x)}^{v(x)} f(t) dt = f(v(x))v'(x) - f(u(x))u'(x)",
      notes: "Essential for differentiating variable-limit definite integrals."
    }
  ],
  syllabus: defaultSyllabus,
  mocks: [],
  paceRecords: [],
  frictionLogs: [],
  eveningLogs: [],
  gistToken: "",
  gistId: ""
};

let appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialState;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  renderAll();
}

// Service Worker Setup
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// --- NAVIGATION ---
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));

    btn.classList.add("active");
    const target = document.getElementById(`view-${btn.dataset.tab}`);
    if (target) target.classList.add("active");

    if (btn.dataset.tab === "analytics") updateCharts();
    if (btn.dataset.tab === "formulas") renderFormulas();
  });
});

// --- BINAURAL & AUDIO SYNTHESIZER ---
let audioCtx = null;
let noiseSource = null;
let binauralOscLeft = null;
let binauralOscRight = null;
let isAudioActive = false;

function startBinauralBeats(freqDiff) {
  stopAllAudio();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const baseFreq = 220; // A3 base carrier
  binauralOscLeft = audioCtx.createOscillator();
  binauralOscRight = audioCtx.createOscillator();

  binauralOscLeft.frequency.value = baseFreq;
  binauralOscRight.frequency.value = baseFreq + freqDiff;

  const merger = audioCtx.createChannelMerger(2);
  const gain = audioCtx.createGain();
  gain.gain.value = 0.08;

  binauralOscLeft.connect(merger, 0, 0); // Left ear
  binauralOscRight.connect(merger, 0, 1); // Right ear

  merger.connect(gain);
  gain.connect(audioCtx.destination);

  binauralOscLeft.start();
  binauralOscRight.start();
  isAudioActive = true;
  document.getElementById("btnToggleNoise").textContent = "Stop";
}

function startNoiseBuffer(type) {
  stopAllAudio();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (type === "brown") {
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    } else {
      data[i] = (lastOut + (0.05 * white)) / 1.05;
      lastOut = data[i];
      data[i] *= 2.0;
    }
  }

  noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.12;
  noiseSource.connect(gain);
  gain.connect(audioCtx.destination);

  noiseSource.start();
  isAudioActive = true;
  document.getElementById("btnToggleNoise").textContent = "Stop";
}

function stopAllAudio() {
  if (binauralOscLeft) { binauralOscLeft.stop(); binauralOscLeft = null; }
  if (binauralOscRight) { binauralOscRight.stop(); binauralOscRight = null; }
  if (noiseSource) { noiseSource.stop(); noiseSource = null; }
  isAudioActive = false;
  document.getElementById("btnToggleNoise").textContent = "Play";
}

document.getElementById("btnToggleNoise").addEventListener("click", () => {
  if (isAudioActive) {
    stopAllAudio();
  } else {
    const mode = document.getElementById("audioNoiseType").value;
    if (mode === "gamma") startBinauralBeats(40);
    else if (mode === "alpha") startBinauralBeats(10);
    else if (mode === "brown" || mode === "pink") startNoiseBuffer(mode);
  }
});

document.getElementById("audioNoiseType").addEventListener("change", (e) => {
  if (isAudioActive) {
    if (e.target.value === "gamma") startBinauralBeats(40);
    else if (e.target.value === "alpha") startBinauralBeats(10);
    else if (e.target.value === "brown" || e.target.value === "pink") startNoiseBuffer(e.target.value);
    else stopAllAudio();
  }
});

// --- KIOSK MODE & PAGE VISIBILITY LOCK ---
let isKioskActive = false;
document.getElementById("toggleKioskMode").addEventListener("change", (e) => {
  isKioskActive = e.target.checked;
  if (isKioskActive && !document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && isTimerActive && isKioskActive) {
    clearInterval(timerInterval);
    isTimerActive = false;
    btnTimerToggle.textContent = "Resume Session";
    document.getElementById("frictionModal").classList.add("active");
  }
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
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
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
    document.getElementById("frictionModal").classList.add("active");
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
        
        const hourNow = new Date().getHours();
        appState.hourlyFocus[hourNow] = (appState.hourlyFocus[hourNow] || 0) + mins;

        appState.completedSessions.push(`${mins}m Monotask Block`);
        btnTimerToggle.textContent = "Start Session";
        timerSeconds = mins * 60;
        timerDisplay.textContent = formatTime(timerSeconds);
        saveState();
        broadcastPeerData();
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

function logFrictionAndClose(reason) {
  appState.frictionLogs.push({ timestamp: new Date().toISOString(), reason });
  document.getElementById("frictionModal").classList.remove("active");
  saveState();
}

// --- STOPWATCH & TIERED DIFFICULTY LOGGING ---
let paceInterval = null;
let paceSeconds = 0;
let isPaceRunning = false;

const paceTimerDisplay = document.getElementById("paceTimerDisplay");
const btnPaceToggle = document.getElementById("btnPaceToggle");

btnPaceToggle.addEventListener("click", () => {
  if (isPaceRunning) {
    clearInterval(paceInterval);
    isPaceRunning = false;
    btnPaceToggle.textContent = "Start Question";
  } else {
    paceSeconds = 0;
    isPaceRunning = true;
    btnPaceToggle.textContent = "Stop / Pause";
    paceInterval = setInterval(() => {
      paceSeconds++;
      paceTimerDisplay.textContent = formatTime(paceSeconds);
    }, 1000);
  }
});

function logPaceResult(isCorrect) {
  if (paceSeconds === 0) return;
  clearInterval(paceInterval);
  isPaceRunning = false;
  btnPaceToggle.textContent = "Start Question";

  const subject = document.getElementById("paceSubject").value;
  const difficulty = document.getElementById("paceDifficulty").value;

  appState.paceRecords.unshift({
    subject,
    difficulty,
    timeSecs: paceSeconds,
    correct: isCorrect,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  if (appState.subjects[subject]) {
    appState.subjects[subject].solved += 1;
    if (isCorrect) appState.subjects[subject].correct += 1;
    if (!appState.subjects[subject].tiers) appState.subjects[subject].tiers = { Foundation: 0, Main: 0, Advanced: 0 };
    appState.subjects[subject].tiers[difficulty] = (appState.subjects[subject].tiers[difficulty] || 0) + 1;
  }

  paceSeconds = 0;
  paceTimerDisplay.textContent = "00:00";
  saveState();
}

document.getElementById("btnPaceLapCorrect").addEventListener("click", () => logPaceResult(true));
document.getElementById("btnPaceLapWrong").addEventListener("click", () => logPaceResult(false));

function quickAddTieredQuestion(subject, tier) {
  if (appState.subjects[subject]) {
    appState.subjects[subject].solved += 1;
    appState.subjects[subject].correct += 1;
    if (!appState.subjects[subject].tiers) appState.subjects[subject].tiers = { Foundation: 0, Main: 0, Advanced: 0 };
    appState.subjects[subject].tiers[tier] = (appState.subjects[subject].tiers[tier] || 0) + 1;
    saveState();
  }
}

// --- SOCRATIC AI PROMPT FORMATTER ---
function copySocraticPrompt(errId) {
  const err = appState.errors.find(e => e.id === errId);
  if (!err) return;

  const prompt = `I made an analytical error during a problem-solving session in ${err.subject}.
- Specific Topic: ${err.topic}
- Classification: ${err.type}
- My Reflection Note: "${err.note}"

Act as an elite Socratic academic tutor. Do not give the direct answer immediately:
1. Ask 2 progressive diagnostic questions to uncover the exact breakdown in my first-principles derivation.
2. Provide a rigorous, conceptual breakdown of the underlying physical/mathematical law.
3. Supply 1 harder variation problem with an edge case constraint to verify my understanding.`;

  navigator.clipboard.writeText(prompt).then(() => {
    alert("Socratic AI Prompt copied to clipboard! Paste into your AI chat.");
  });
}

// --- FORMULA VAULT (LATEX + SEARCH) ---
function renderFormulas() {
  const container = document.getElementById("formulaGridContainer");
  const search = document.getElementById("formulaSearchInput").value.toLowerCase();
  const filterSub = document.getElementById("formulaSubjectFilter").value;

  const filtered = appState.formulas.filter(f => {
    const matchSub = filterSub === "all" || f.subject === filterSub;
    const matchSearch = f.title.toLowerCase().includes(search) || f.notes.toLowerCase().includes(search);
    return matchSub && matchSearch;
  });

  container.innerHTML = filtered.map(f => `
    <div class="formula-card">
      <div class="formula-card-header">
        <strong>${f.title}</strong>
        <span class="badge">${f.subject}</span>
      </div>
      <div class="formula-latex-render" id="latex-box-${f.id}"></div>
      <div class="text-muted" style="font-size:0.8rem;">${f.notes}</div>
    </div>
  `).join("") || `<span class="empty-hint">No formulas match your query.</span>`;

  filtered.forEach(f => {
    const el = document.getElementById(`latex-box-${f.id}`);
    if (el && window.katex) {
      katex.render(f.latex, el, { throwOnError: false, displayMode: true });
    }
  });
}

document.getElementById("formulaSearchInput").addEventListener("input", renderFormulas);
document.getElementById("formulaSubjectFilter").addEventListener("change", renderFormulas);

document.getElementById("btnOpenFormulaModal").addEventListener("click", () => {
  document.getElementById("formulaModal").classList.add("active");
});

function closeFormulaModal() {
  document.getElementById("formulaModal").classList.remove("active");
}

document.getElementById("addFormulaForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("formFormulaTitle").value.trim();
  const subject = document.getElementById("formFormulaSubject").value;
  const latex = document.getElementById("formFormulaLatex").value.trim();
  const notes = document.getElementById("formFormulaNotes").value.trim();

  appState.formulas.push({ id: Date.now(), title, subject, latex, notes });
  e.target.reset();
  closeFormulaModal();
  saveState();
  renderFormulas();
});

// --- GUIDED EVENING SHUTDOWN RITUAL ---
document.getElementById("btnTriggerShutdown").addEventListener("click", () => {
  document.getElementById("shutdownModal").classList.add("active");
});

function closeShutdownModal() {
  document.getElementById("shutdownModal").classList.remove("active");
}

document.getElementById("shutdownFatigue").addEventListener("input", (e) => {
  document.getElementById("shutdownFatigueVal").textContent = `${e.target.value} / 5 Rating`;
});

document.getElementById("btnCompleteShutdown").addEventListener("click", () => {
  const fatigue = document.getElementById("shutdownFatigue").value;
  const t1 = document.getElementById("tomorrowTask1").value.trim();
  const t2 = document.getElementById("tomorrowTask2").value.trim();
  const t3 = document.getElementById("tomorrowTask3").value.trim();

  if (t1) appState.directives.push({ id: Date.now(), text: t1, slot: "Morning", done: false });
  if (t2) appState.directives.push({ id: Date.now() + 1, text: t2, slot: "Afternoon", done: false });
  if (t3) appState.directives.push({ id: Date.now() + 2, text: t3, slot: "Evening", done: false });

  appState.eveningLogs.unshift({
    date: new Date().toISOString().split("T")[0],
    fatigueScore: fatigue,
    tasksPlanned: [t1, t2, t3].filter(Boolean)
  });

  closeShutdownModal();
  saveState();
  alert("Evening Shutdown Complete. Directives staged for tomorrow.");
});

// --- CSV BATCH IMPORTER ---
document.getElementById("csvFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const lines = event.target.result.split("\n");
    let importedErrors = 0;
    lines.forEach(line => {
      const parts = line.split(",");
      if (parts.length >= 4) {
        appState.errors.unshift({
          id: Date.now() + Math.random(),
          topic: parts[0].trim(),
          subject: parts[1].trim(),
          type: parts[2].trim(),
          note: parts[3].trim(),
          date: new Date().toISOString().split("T")[0],
          stage: 3
        });
        importedErrors++;
      }
    });
    saveState();
    alert(`Successfully imported ${importedErrors} rows from CSV!`);
  };
  reader.readAsText(file);
});

// --- MULTI-MILESTONE MANAGER ---
document.getElementById("addMilestoneForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("milestoneName").value.trim();
  const date = document.getElementById("milestoneDate").value;

  appState.milestones.push({ id: Date.now(), name, date });
  e.target.reset();
  saveState();
});

function removeMilestone(id) {
  appState.milestones = appState.milestones.filter(m => m.id !== id);
  saveState();
}

function getPrimaryMilestone() {
  if (!appState.milestones.length) return { name: "Exam", diffDays: 30 };
  const sorted = [...appState.milestones].sort((a, b) => new Date(a.date) - new Date(b.date));
  const nearest = sorted.find(m => (new Date(m.date) - new Date()) > 0) || sorted[0];
  const diffDays = Math.max(1, Math.ceil((new Date(nearest.date) - new Date()) / 86400000));
  return { name: nearest.name, diffDays };
}

// --- SYLLABUS MATRIX ---
function calculateSyllabusPercent() {
  let totalPoints = 0;
  let earnedPoints = 0;
  Object.keys(appState.syllabus).forEach(sub => {
    appState.syllabus[sub].forEach(ch => {
      totalPoints += 3;
      if (ch.t) earnedPoints += 1;
      if (ch.p) earnedPoints += 1;
      if (ch.r) earnedPoints += 1;
    });
  });
  return totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
}

function toggleSyllabusStage(sub, idx, stage) {
  appState.syllabus[sub][idx][stage] = !appState.syllabus[sub][idx][stage];
  saveState();
}

// --- MOCKS & AIR CALIBRATION ---
document.getElementById("mockTestForm").addEventListener("submit", (e) => {
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

function calculateAIRFromMocks() {
  if (!appState.mocks || appState.mocks.length === 0) return "Need Mock Data";
  const recent = appState.mocks.slice(0, 3);
  const avgPct = recent.reduce((sum, m) => sum + (m.score / m.total), 0) / recent.length * 100;

  if (avgPct >= 78) return "Top 1,000 (AIR 1 - 1,000)";
  if (avgPct >= 65) return "Top 3,500 (AIR 1,000 - 3,500)";
  if (avgPct >= 52) return "Top 8,000 (AIR 3,500 - 8,000)";
  if (avgPct >= 40) return "Top 18,000 (AIR 8,000 - 18,000)";
  return "25,000+ (Needs Calibration)";
}

// --- SPACED RECALL FLASHCARDS ---
let activeFlashIndex = 0;
let dueFlashcards = [];

function getDueErrors() {
  const now = new Date();
  return appState.errors.filter(err => {
    const logged = new Date(err.date);
    const diff = Math.floor((now - logged) / 86400000);
    return diff >= (err.stage || 3);
  });
}

document.getElementById("btnStartFlashMode").addEventListener("click", () => {
  dueFlashcards = getDueErrors();
  if (dueFlashcards.length === 0) return alert("No errors currently due for spaced review!");
  activeFlashIndex = 0;
  loadFlashcard(0);
  document.getElementById("flashModal").classList.add("active");
});

function loadFlashcard(idx) {
  const item = dueFlashcards[idx];
  document.getElementById("flashProgress").textContent = `Card ${idx + 1} / ${dueFlashcards.length}`;
  document.getElementById("flashTopic").textContent = item.topic;
  document.getElementById("flashSubject").textContent = item.subject;
  document.getElementById("flashType").textContent = item.type;
  document.getElementById("flashNote").textContent = item.note;
  document.getElementById("flashRevealZone").style.display = "none";
  document.getElementById("btnRevealFlash").style.display = "inline-block";
  document.getElementById("btnPassFlash").style.display = "none";
  document.getElementById("btnFailFlash").style.display = "none";
}

document.getElementById("btnRevealFlash").addEventListener("click", () => {
  document.getElementById("flashRevealZone").style.display = "block";
  document.getElementById("btnRevealFlash").style.display = "none";
  document.getElementById("btnPassFlash").style.display = "inline-block";
  document.getElementById("btnFailFlash").style.display = "inline-block";
});

document.getElementById("btnPassFlash").addEventListener("click", () => {
  const item = dueFlashcards[activeFlashIndex];
  const orig = appState.errors.find(e => e.id === item.id);
  if (orig) {
    orig.stage = orig.stage === 3 ? 7 : (orig.stage === 7 ? 21 : 30);
    orig.date = new Date().toISOString().split("T")[0];
  }
  nextFlashcard();
});

document.getElementById("btnFailFlash").addEventListener("click", () => {
  const item = dueFlashcards[activeFlashIndex];
  const orig = appState.errors.find(e => e.id === item.id);
  if (orig) {
    orig.stage = 3;
    orig.date = new Date().toISOString().split("T")[0];
  }
  nextFlashcard();
});

function nextFlashcard() {
  activeFlashIndex++;
  if (activeFlashIndex < dueFlashcards.length) loadFlashcard(activeFlashIndex);
  else {
    closeFlashModal();
    saveState();
    alert("Recall Session Completed!");
  }
}

function closeFlashModal() {
  document.getElementById("flashModal").classList.remove("active");
}

// --- GIST SYNC ---
document.getElementById("btnPushGist").addEventListener("click", async () => {
  const token = document.getElementById("gistToken").value.trim();
  let gistId = document.getElementById("gistId").value.trim();
  if (!token) return alert("Please provide a GitHub Personal Access Token.");

  const payload = {
    description: "Calibre OS State Backup",
    public: false,
    files: { "calibre_state.json": { content: JSON.stringify(appState, null, 2) } }
  };

  try {
    const url = gistId ? `https://api.github.com/gists/${gistId}` : `https://api.github.com/gists`;
    const res = await fetch(url, {
      method: gistId ? "PATCH" : "POST",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.id) {
      appState.gistToken = token;
      appState.gistId = data.id;
      document.getElementById("gistId").value = data.id;
      saveState();
      alert(`Pushed to Gist: ${data.id}`);
    }
  } catch (err) {
    alert("Failed to push to GitHub Gist.");
  }
});

document.getElementById("btnPullGist").addEventListener("click", async () => {
  const token = document.getElementById("gistToken").value.trim();
  const gistId = document.getElementById("gistId").value.trim();
  if (!token || !gistId) return alert("Provide both Token and Gist ID.");

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `token ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files["calibre_state.json"]) {
      appState = JSON.parse(data.files["calibre_state.json"].content);
      saveState();
      alert("State restored from Gist!");
    }
  } catch (err) {
    alert("Failed to pull from Gist.");
  }
});

// --- P2P STUDY ROOM ---
let peer = null;
let peerConnections = [];

function initPeer() {
  if (typeof Peer === "undefined") return;
  peer = new Peer();
  peer.on("open", (id) => {
    document.getElementById("myPeerId").value = id;
    document.getElementById("peerStatusBadge").textContent = "Active & Ready";
  });
  peer.on("connection", (conn) => handlePeerConnection(conn));
}

function handlePeerConnection(conn) {
  peerConnections.push(conn);
  conn.on("data", (data) => updatePeerDisplay(conn.peer, data));
  conn.on("open", () => broadcastPeerData());
}

document.getElementById("btnConnectPeer").addEventListener("click", () => {
  const targetId = document.getElementById("targetPeerId").value.trim();
  if (!targetId || !peer) return;
  handlePeerConnection(peer.connect(targetId));
});

function broadcastPeerData() {
  const payload = {
    focusMins: appState.focusMinutesToday,
    totalSolved: Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0),
    streak: appState.streak
  };
  peerConnections.forEach(c => { if (c.open) c.send(payload); });
}

function updatePeerDisplay(peerId, data) {
  const container = document.getElementById("peerRoomCards");
  const cardId = `peer-${peerId}`;
  let el = document.getElementById(cardId);
  if (!el) {
    el = document.createElement("div");
    el.id = cardId;
    el.className = "peer-card";
    container.innerHTML = "";
    container.appendChild(el);
  }
  el.innerHTML = `
    <div>
      <strong>Peer: ${peerId.slice(0, 8)}...</strong>
      <div class="text-muted">${data.focusMins}m Focused | ${data.totalSolved} Questions Solved</div>
    </div>
    <span class="badge fresh">🔥 ${data.streak}d Streak</span>
  `;
}

// --- DIRECTIVES & ERRORS CORE ---
document.getElementById("directiveForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("directiveInput");
  const slot = document.getElementById("directiveSlot").value;
  if (!input.value.trim()) return;

  appState.directives.push({ id: Date.now(), text: input.value.trim(), slot, done: false });
  input.value = "";
  saveState();
});

function toggleDirective(id) {
  const itm = appState.directives.find(d => d.id === id);
  if (itm) { itm.done = !itm.done; saveState(); }
}

function removeDirective(id) {
  appState.directives = appState.directives.filter(d => d.id !== id);
  saveState();
}

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
    date: new Date().toISOString().split("T")[0],
    stage: 3
  });

  if (appState.subjects[subject]) appState.subjects[subject].solved += 1;
  document.getElementById("errTopic").value = "";
  document.getElementById("errNote").value = "";
  saveState();
});

function deleteError(id) {
  appState.errors = appState.errors.filter(e => e.id !== id);
  saveState();
}

// Backup JSON
document.getElementById("btnExportJSON").addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `calibre_backup_${new Date().toISOString().split("T")[0]}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.subjects && parsed.syllabus) {
        appState = parsed;
        saveState();
        alert("State restored!");
      }
    } catch (err) { alert("Invalid JSON."); }
  };
  reader.readAsText(e.target.files[0]);
});

// --- ANALYTICS CHARTS ---
let radarChartInstance = null;
let hourlyChartInstance = null;

function computeSubjectScore(subKey) {
  const data = appState.subjects[subKey];
  if (!data || data.solved === 0) return 40;
  const acc = (data.correct / data.solved) * 100;
  return Math.min(100, Math.round((0.6 * acc) + (0.4 * calculateSyllabusPercent())));
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

  const hourlyCtx = document.getElementById("hourlyBarChart").getContext("2d");
  hourlyChartInstance = new Chart(hourlyCtx, {
    type: "bar",
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [{
        label: "Focus (mins)",
        data: appState.hourlyFocus,
        backgroundColor: "#1e293b",
        hoverBackgroundColor: "#38bdf8",
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: "#1e293b" }, ticks: { color: "#64748b" } },
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 9 } } }
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
  if (hourlyChartInstance) {
    hourlyChartInstance.data.datasets[0].data = appState.hourlyFocus;
    hourlyChartInstance.update();
  }
}

// --- RENDER DOM ENGINE ---
function renderAll() {
  document.getElementById("topStreak").textContent = `${appState.streak} Days`;
  document.getElementById("topHours").textContent = `${(appState.focusMinutesToday / 60).toFixed(1)}h`;

  const primaryMilestone = getPrimaryMilestone();
  document.getElementById("topCountdown").textContent = `${primaryMilestone.diffDays}d (${primaryMilestone.name})`;
  document.getElementById("topRank").textContent = calculateAIRFromMocks();

  // Run-Rate Calculation
  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  const remainingQs = Math.max(0, appState.totalExamProblemTarget - totalSolved);
  const runRate = (remainingQs / primaryMilestone.diffDays).toFixed(1);
  document.getElementById("paceBanner").textContent = `Required Velocity: Solve ${runRate} problems/day before ${primaryMilestone.name}.`;

  // Ghost Mode Comparison
  const focusDiff = appState.focusMinutesToday - (appState.historicalDailyAvgFocus * (new Date().getHours() / 24));
  const focusDiffHours = (Math.abs(focusDiff) / 60).toFixed(1);
  const statusStr = focusDiff >= 0 
    ? `🔥 Ahead of historical benchmark by +${focusDiffHours}h output.`
    : `⚠️ Behind baseline pace by -${focusDiffHours}h. Complete a 50m sprint to calibrate.`;
  document.getElementById("ghostModeText").textContent = statusStr;

  // Directives
  const totalD = appState.directives.length;
  const doneD = appState.directives.filter(d => d.done).length;
  document.getElementById("directivesCount").textContent = `${doneD} / ${totalD}`;

  ["Morning", "Afternoon", "Evening"].forEach(slot => {
    const cont = document.getElementById(`slot${slot}`);
    const itms = appState.directives.filter(d => d.slot === slot);
    cont.innerHTML = itms.length === 0 ? `<span class="empty-hint">No ${slot.toLowerCase()} targets.</span>` : itms.map(d => `
      <div class="task-item ${d.done ? 'done' : ''}">
        <div class="task-item-left">
          <input type="checkbox" ${d.done ? 'checked' : ''} onclick="toggleDirective(${d.id})">
          <span>${d.text}</span>
        </div>
        <button class="btn btn-tiny" style="background:none;color:#64748b;" onclick="removeDirective(${d.id})">✕</button>
      </div>
    `).join("");
  });

  // Tiered Problem Grinder
  const grinderContainer = document.getElementById("grinderList");
  grinderContainer.innerHTML = Object.keys(appState.subjects).map(subKey => {
    const sub = appState.subjects[subKey];
    const tiers = sub.tiers || { Foundation: 0, Main: 0, Advanced: 0 };
    const pct = Math.min(100, Math.round((sub.solved / sub.target) * 100));
    return `
      <div class="grinder-item">
        <div class="grinder-info">
          <span>${subKey} (${sub.solved} / ${sub.target} Qs)</span>
          <span class="text-muted" style="font-size:0.75rem;">F:${tiers.Foundation || 0} | M:${tiers.Main || 0} | A:${tiers.Advanced || 0}</span>
        </div>
        <div class="grinder-controls">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="tier-buttons">
            <button class="tier-btn" onclick="quickAddTieredQuestion('${subKey}', 'Foundation')">+F</button>
            <button class="tier-btn" onclick="quickAddTieredQuestion('${subKey}', 'Main')">+M</button>
            <button class="tier-btn" onclick="quickAddTieredQuestion('${subKey}', 'Advanced')">+Adv</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Pace Stopwatch Log
  const avgPace = appState.paceRecords.length > 0 
    ? (appState.paceRecords.reduce((a, b) => a + b.timeSecs, 0) / appState.paceRecords.length / 60).toFixed(1)
    : "--";
  document.getElementById("currentPaceAvg").textContent = `Avg Pace: ${avgPace} min/Q`;
  document.getElementById("paceLogList").innerHTML = appState.paceRecords.slice(0, 5).map(p => `
    <span class="chip" style="color: ${p.correct ? 'var(--accent-success)' : 'var(--accent-danger)'}">
      ${p.subject} [${p.difficulty || 'M'}]: ${(p.timeSecs / 60).toFixed(1)}m
    </span>
  `).join("") || `<span class="empty-hint">No pace records.</span>`;

  // Milestones List
  document.getElementById("milestonesList").innerHTML = appState.milestones.map(m => `
    <div class="milestone-item">
      <span><strong>${m.name}</strong> (${m.date})</span>
      <button class="btn btn-tiny btn-danger" onclick="removeMilestone(${m.id})">✕</button>
    </div>
  `).join("") || `<span class="empty-hint">No milestones added.</span>`;

  // Syllabus Matrix Render
  document.getElementById("syllabusProgressPct").textContent = `${calculateSyllabusPercent()}%`;
  document.getElementById("syllabusContainer").innerHTML = Object.keys(appState.syllabus).map(sub => `
    <div class="syllabus-subject-col">
      <h3>${sub}</h3>
      ${appState.syllabus[sub].map((ch, idx) => `
        <div class="syllabus-chapter">
          <div class="chapter-title">${ch.name}</div>
          <div class="chapter-toggles">
            <label><input type="checkbox" ${ch.t ? 'checked' : ''} onchange="toggleSyllabusStage('${sub}', ${idx}, 't')"> Theory</label>
            <label><input type="checkbox" ${ch.p ? 'checked' : ''} onchange="toggleSyllabusStage('${sub}', ${idx}, 'p')"> PYQs</label>
            <label><input type="checkbox" ${ch.r ? 'checked' : ''} onchange="toggleSyllabusStage('${sub}', ${idx}, 'r')"> Rev</label>
          </div>
        </div>
      `).join("")}
    </div>
  `).join("");

  // Error Table with Socratic Button
  const due = getDueErrors();
  document.getElementById("dueErrorsCount").textContent = `${due.length} Due`;
  document.getElementById("errorLogBody").innerHTML = appState.errors.map(err => {
    const isDue = due.some(d => d.id === err.id);
    return `
      <tr>
        <td><strong>${err.topic}</strong></td>
        <td>${err.subject}</td>
        <td><span class="badge">${err.type}</span></td>
        <td>${err.note}</td>
        <td><span class="badge ${isDue ? 'due' : 'fresh'}">${isDue ? `Due (Stage ${err.stage}d)` : `Stage ${err.stage}d`}</span></td>
        <td>
          <button class="btn btn-secondary btn-tiny" onclick="copySocraticPrompt(${err.id})">Socratic AI</button>
          <button class="btn btn-secondary btn-tiny" onclick="deleteError(${err.id})">Resolve</button>
        </td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="6" style="text-align:center;color:#64748b;">No logged errors.</td></tr>`;

  // Mocks Table
  document.getElementById("mockLogBody").innerHTML = appState.mocks.map(m => `
    <tr>
      <td><strong>${m.name}</strong></td>
      <td>${m.date}</td>
      <td>${m.phy}</td>
      <td>${m.chem}</td>
      <td>${m.math}</td>
      <td><strong>${m.score} / ${m.total}</strong></td>
      <td style="color:var(--accent-danger);">${m.neg}</td>
      <td><span class="badge fresh">${m.accuracy}%</span></td>
    </tr>
  `).join("") || `<tr><td colspan="8" style="text-align:center;color:#64748b;">No mocks logged yet.</td></tr>`;

  // Weekly Audit Synthesis
  const frictionCounts = {};
  appState.frictionLogs.forEach(f => frictionCounts[f.reason] = (frictionCounts[f.reason] || 0) + 1);
  const topFriction = Object.entries(frictionCounts).sort((a, b) => b[1] - a[1])[0];

  const errCounts = {};
  appState.errors.forEach(e => errCounts[e.type] = (errCounts[e.type] || 0) + 1);
  const topErr = Object.entries(errCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("weeklyAuditContent").innerHTML = `
    <div class="audit-box">
      <h4>⚠️ Primary Error Leak</h4>
      <p class="mt-2"><strong>${topErr ? `${topErr[0]} (${topErr[1]} occurrences)` : "No dominant errors recorded."}</strong></p>
      <span class="text-muted">Target this in your next problem batch.</span>
    </div>
    <div class="audit-box">
      <h4>🧠 Primary Friction Driver</h4>
      <p class="mt-2"><strong>${topFriction ? `${topFriction[0]} (${topFriction[1]} times)` : "Zero logged interruptions."}</strong></p>
      <span class="text-muted">Lock in Kiosk Mode during morning sprint sessions.</span>
    </div>
  `;

  document.getElementById("completedBlocksList").innerHTML = appState.completedSessions.map(s => `<span class="chip">${s}</span>`).join("") || `<span class="empty-hint">No sessions logged today.</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  initCharts();
  initPeer();
});