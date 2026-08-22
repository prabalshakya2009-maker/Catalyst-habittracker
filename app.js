const STORAGE_KEY = "CALIBRE_OS_STATE_V3";
const GIST_CREDENTIALS_KEY = "CALIBRE_GIST_CREDENTIALS";
const ONBOARDING_KEY = "CALIBRE_ONBOARDED_V1";

// The GitHub token + Gist ID live in their own local-only storage key,
// completely separate from appState. This guarantees they can never end up
// inside an exported JSON backup or inside the state blob pushed to a Gist.
function loadGistCredentials() {
  try {
    return JSON.parse(localStorage.getItem(GIST_CREDENTIALS_KEY)) || { token: "", gistId: "" };
  } catch {
    return { token: "", gistId: "" };
  }
}

function saveGistCredentials(token, gistId) {
  localStorage.setItem(GIST_CREDENTIALS_KEY, JSON.stringify({ token, gistId }));
}

// Strips a legacy token/gistId out of any state object that might still carry
// them (old exports, old Gist pulls, or a browser that never migrated).
function stripLegacyCredentials(obj) {
  if (obj && (obj.gistToken || obj.gistId)) {
    delete obj.gistToken;
    delete obj.gistId;
  }
  return obj;
}

// Initial syllabus matrix chapters with 3-tier tracking
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
  examTargetDate: "2027-01-20",
  totalExamProblemTarget: 3000,
  dailyQuestionTarget: 20,
  completedSessions: [],
  subjects: {
    Physics: { solved: 14, target: 20, correct: 12 },
    Chemistry: { solved: 18, target: 20, correct: 16 },
    Mathematics: { solved: 10, target: 20, correct: 7 }
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
      note: "I_cm must always be through the exact Center of Mass before shifting by Md^2.",
      date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0],
      stage: 3
    }
  ],
  syllabus: defaultSyllabus,
  mocks: [],
  paceRecords: [],
  frictionLogs: []
};

let appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialState;

// One-time migration: earlier versions stored the GitHub token inside appState,
// which meant it could leak into JSON backups and Gist pushes. Move it out to
// dedicated storage so existing users keep their saved token, safely.
if (appState.gistToken || appState.gistId) {
  const existing = loadGistCredentials();
  saveGistCredentials(appState.gistToken || existing.token, appState.gistId || existing.gistId);
  delete appState.gistToken;
  delete appState.gistId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  renderAll();
}

// Register PWA Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// --- TAB ROUTING ---
document.querySelectorAll(".nav-btn[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn[data-tab]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));

    btn.classList.add("active");
    const target = document.getElementById(`view-${btn.dataset.tab}`);
    if (target) target.classList.add("active");

    if (btn.dataset.tab === "analytics") updateCharts();
  });
});

// --- ONBOARDING TOUR ---
function maybeShowOnboarding() {
  if (!localStorage.getItem(ONBOARDING_KEY)) {
    document.getElementById("onboardingModal").classList.add("active");
  }
}

document.getElementById("btnCloseOnboarding").addEventListener("click", () => {
  localStorage.setItem(ONBOARDING_KEY, "1");
  document.getElementById("onboardingModal").classList.remove("active");
});

document.getElementById("btnShowTour").addEventListener("click", () => {
  document.getElementById("onboardingModal").classList.add("active");
});

// --- AMBIENT AUDIO SYNTHESIZER ---
let audioCtx = null;
let noiseNode = null;
let isAudioPlaying = false;

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
      data[i] *= 3.5;
    } else {
      data[i] = (lastOut + (0.05 * white)) / 1.05;
      lastOut = data[i];
      data[i] *= 2.0;
    }
  }
  return buffer;
}

function startAudioNoise() {
  const type = document.getElementById("audioNoiseType").value;
  if (type === "none") return stopAudioNoise();

  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (noiseNode) noiseNode.stop();

  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(type);
  noiseNode.loop = true;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.15;
  noiseNode.connect(gain);
  gain.connect(audioCtx.destination);

  noiseNode.start();
  isAudioPlaying = true;
  document.getElementById("btnToggleNoise").textContent = "Stop";
}

function stopAudioNoise() {
  if (noiseNode) {
    noiseNode.stop();
    noiseNode = null;
  }
  isAudioPlaying = false;
  document.getElementById("btnToggleNoise").textContent = "Play";
}

document.getElementById("btnToggleNoise").addEventListener("click", () => {
  if (isAudioPlaying) stopAudioNoise();
  else startAudioNoise();
});

document.getElementById("audioNoiseType").addEventListener("change", () => {
  if (isAudioPlaying) startAudioNoise();
});

// --- DEEP WORK TIMER & FRICTION LOGGING ---
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
    // Pausing session: Open Friction Prompt
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
  appState.frictionLogs.push({
    timestamp: new Date().toISOString(),
    reason
  });
  document.getElementById("frictionModal").classList.remove("active");
  saveState();
}

// --- QUESTION PACE STOPWATCH ---
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
  appState.paceRecords.unshift({
    subject,
    timeSecs: paceSeconds,
    correct: isCorrect,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  if (appState.subjects[subject]) {
    appState.subjects[subject].solved += 1;
    if (isCorrect) appState.subjects[subject].correct += 1;
  }

  paceSeconds = 0;
  paceTimerDisplay.textContent = "00:00";
  saveState();
}

document.getElementById("btnPaceLapCorrect").addEventListener("click", () => logPaceResult(true));
document.getElementById("btnPaceLapWrong").addEventListener("click", () => logPaceResult(false));

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

// --- MOCK TEST LOGGING & AIR PREDICTOR ---
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

// --- SPACED REPETITION FLASHCARD ENGINE ---
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
    alert("Spaced review session completed!");
  }
}

function closeFlashModal() {
  document.getElementById("flashModal").classList.remove("active");
}

// --- GITHUB GIST CLOUD SYNC ---
document.getElementById("btnPushGist").addEventListener("click", async () => {
  const token = document.getElementById("gistToken").value.trim();
  let gistId = document.getElementById("gistId").value.trim();
  if (!token) return alert("Please provide a GitHub Personal Access Token.");

  const payload = {
    description: "Calibre OS Study State Sync",
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
      saveGistCredentials(token, data.id);
      document.getElementById("gistId").value = data.id;
      alert(`Pushed successfully to Gist: ${data.id}`);
    } else {
      alert("GitHub didn't return a Gist ID — check that your token has the 'gist' scope.");
    }
  } catch (err) {
    alert("Failed to push to GitHub Gist.");
  }
});

document.getElementById("btnPullGist").addEventListener("click", async () => {
  const token = document.getElementById("gistToken").value.trim();
  const gistId = document.getElementById("gistId").value.trim();
  if (!token || !gistId) return alert("Please provide both Token and Gist ID.");

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `token ${token}` }
    });
    const data = await res.json();
    if (data.files && data.files["calibre_state.json"]) {
      appState = stripLegacyCredentials(JSON.parse(data.files["calibre_state.json"].content));
      saveGistCredentials(token, gistId);
      saveState();
      alert("State pulled successfully from Gist!");
    } else {
      alert("No saved state found on that Gist yet — push from a device first.");
    }
  } catch (err) {
    alert("Failed to pull from GitHub Gist.");
  }
});

// --- P2P STUDY ROOM (PEERJS) ---
let peer = null;
let peerConnections = [];

function showPeerMessage(msg) {
  const el = document.getElementById("peerStatusMessage");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.style.display = "block";
}

function initPeer() {
  if (typeof Peer === "undefined") {
    document.getElementById("peerStatusBadge").textContent = "Unavailable Offline";
    showPeerMessage("Study-room library failed to load. Check your connection and reload the page.");
    return;
  }
  peer = new Peer();
  peer.on("open", (id) => {
    document.getElementById("myPeerId").value = id;
    document.getElementById("peerStatusBadge").textContent = "Active & Ready";
  });

  peer.on("connection", (conn) => {
    handlePeerConnection(conn);
  });

  peer.on("error", (err) => {
    document.getElementById("peerStatusBadge").textContent = "Connection Error";
    showPeerMessage(
      err && err.type === "peer-unavailable"
        ? "That Peer ID wasn't found. Double-check it with your partner and try again."
        : "Couldn't reach the study-room service. Check your connection and try again."
    );
  });

  peer.on("disconnected", () => {
    document.getElementById("peerStatusBadge").textContent = "Disconnected";
    showPeerMessage("Lost connection to the study-room service. Reload the page to reconnect.");
  });
}

function handlePeerConnection(conn) {
  peerConnections.push(conn);
  conn.on("data", (data) => {
    updatePeerDisplay(conn.peer, data);
  });
  conn.on("open", () => {
    showPeerMessage("");
    broadcastPeerData();
  });
  conn.on("close", () => {
    peerConnections = peerConnections.filter(c => c !== conn);
    const el = document.getElementById(`peer-${conn.peer}`);
    if (el) el.remove();
    const container = document.getElementById("peerRoomCards");
    if (container && container.children.length === 0) {
      container.innerHTML = `<span class="empty-hint">No peer connected. Share your ID to study synchronously.</span>`;
    }
  });
  conn.on("error", () => showPeerMessage("Connection to that partner dropped unexpectedly."));
}

document.getElementById("btnConnectPeer").addEventListener("click", () => {
  const targetId = document.getElementById("targetPeerId").value.trim();
  if (!targetId) return showPeerMessage("Paste a partner's Peer ID first.");
  if (!peer || peer.disconnected) return showPeerMessage("Still connecting to the study-room service — try again in a moment.");
  const conn = peer.connect(targetId);
  handlePeerConnection(conn);
});

function broadcastPeerData() {
  const payload = {
    focusMins: appState.focusMinutesToday,
    totalSolved: Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0),
    streak: appState.streak
  };
  peerConnections.forEach(c => {
    if (c.open) c.send(payload);
  });
}

function updatePeerDisplay(peerId, data) {
  const container = document.getElementById("peerRoomCards");
  const cardId = `peer-${peerId}`;
  let el = document.getElementById(cardId);
  if (!el) {
    const hint = container.querySelector(".empty-hint");
    if (hint) container.innerHTML = "";
    el = document.createElement("div");
    el.id = cardId;
    el.className = "peer-card";
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

// Directives Form Submit
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

function incrementSubject(subKey, change) {
  const sub = appState.subjects[subKey];
  if (!sub) return;
  sub.solved = Math.max(0, sub.solved + change);
  if (change > 0) sub.correct = Math.max(0, sub.correct + change);
  saveState();
  broadcastPeerData();
}

// Error Submit
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

// Settings
document.getElementById("btnSaveSettings").addEventListener("click", () => {
  appState.examTargetDate = document.getElementById("settingExamDate").value;
  appState.totalExamProblemTarget = parseInt(document.getElementById("settingTotalTarget").value);
  appState.dailyQuestionTarget = parseInt(document.getElementById("settingDailyTarget").value);
  Object.keys(appState.subjects).forEach(k => appState.subjects[k].target = appState.dailyQuestionTarget);
  saveState();
  alert("Settings updated.");
});

// JSON Export / Import
document.getElementById("btnExportJSON").addEventListener("click", () => {
  const exportable = stripLegacyCredentials({ ...appState });
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportable, null, 2));
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
        appState = stripLegacyCredentials(parsed);
        saveState();
        alert("State successfully restored!");
      } else {
        alert("That file doesn't look like a Calibre backup.");
      }
    } catch (err) {
      alert("Invalid JSON format.");
    }
  };
  reader.readAsText(e.target.files[0]);
});

document.getElementById("btnForgetGistToken").addEventListener("click", () => {
  localStorage.removeItem(GIST_CREDENTIALS_KEY);
  document.getElementById("gistToken").value = "";
  document.getElementById("gistId").value = "";
});

// Canvas Export
document.getElementById("btnDownloadCard").addEventListener("click", () => {
  const canvas = document.getElementById("shareCanvas");
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, 1000, 1000);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 44px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("CALIBRE OS", 100, 140);
  ctx.fillStyle = "#64748b";
  ctx.font = "26px 'JetBrains Mono', monospace";
  ctx.fillText(new Date().toDateString().toUpperCase(), 100, 190);

  ctx.fillStyle = "#121824";
  ctx.fillRect(100, 260, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("DEEP FOCUS TIME", 140, 320);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${(appState.focusMinutesToday / 60).toFixed(1)} Hours`, 140, 410);

  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  ctx.fillStyle = "#121824";
  ctx.fillRect(100, 500, 880, 200);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("PROBLEMS SOLVED TODAY", 140, 560);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 72px 'JetBrains Mono', monospace";
  ctx.fillText(`${totalSolved} Questions`, 140, 650);

  ctx.fillStyle = "#121824";
  ctx.fillRect(100, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("STREAK", 140, 800);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 52px 'JetBrains Mono', monospace";
  ctx.fillText(`${appState.streak} Days 🔥`, 140, 870);

  ctx.fillStyle = "#121824";
  ctx.fillRect(560, 740, 420, 180);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "24px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("MOCK AIR", 600, 800);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 44px 'JetBrains Mono', monospace";
  ctx.fillText(calculateAIRFromMocks().slice(0, 12), 600, 870);

  const link = document.createElement("a");
  link.download = `calibre_${new Date().toISOString().split("T")[0]}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// --- CHARTS ---
let radarChartInstance = null;
let barChartInstance = null;

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

  const barCtx = document.getElementById("weeklyBarChart").getContext("2d");
  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [{
        data: [4.0, 3.5, 5.0, 2.5, 4.5, (appState.focusMinutesToday / 60).toFixed(1), 0],
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
  // Top Headers
  document.getElementById("topStreak").textContent = `${appState.streak} Days`;
  document.getElementById("topHours").textContent = `${(appState.focusMinutesToday / 60).toFixed(1)}h`;

  const examDate = new Date(appState.examTargetDate);
  const diffDays = Math.max(1, Math.ceil((examDate - new Date()) / 86400000));
  document.getElementById("topCountdown").textContent = `${diffDays} Days`;
  document.getElementById("topRank").textContent = calculateAIRFromMocks();

  // Run Rate
  const totalSolved = Object.values(appState.subjects).reduce((a, b) => a + b.solved, 0);
  const remainingQs = Math.max(0, appState.totalExamProblemTarget - totalSolved);
  const runRate = (remainingQs / diffDays).toFixed(1);
  document.getElementById("paceBanner").textContent = `Target Pace: Solve ${runRate} problems/day across all subjects to hit ${appState.totalExamProblemTarget} questions before exam.`;

  // Settings
  document.getElementById("settingExamDate").value = appState.examTargetDate;
  document.getElementById("settingTotalTarget").value = appState.totalExamProblemTarget;
  document.getElementById("settingDailyTarget").value = appState.dailyQuestionTarget;

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

  // Pace Stopwatch Log
  const avgPace = appState.paceRecords.length > 0 
    ? (appState.paceRecords.reduce((a, b) => a + b.timeSecs, 0) / appState.paceRecords.length / 60).toFixed(1)
    : "--";
  document.getElementById("currentPaceAvg").textContent = `Avg Pace: ${avgPace} min/Q`;
  document.getElementById("paceLogList").innerHTML = appState.paceRecords.slice(0, 6).map(p => `
    <span class="chip" style="color: ${p.correct ? 'var(--accent-success)' : 'var(--accent-danger)'}">
      ${p.subject}: ${(p.timeSecs / 60).toFixed(1)}m (${p.correct ? '✓' : '✗'})
    </span>
  `).join("") || `<span class="empty-hint">No pace records logged.</span>`;

  // Syllabus Matrix Render
  document.getElementById("syllabusProgressPct").textContent = `${calculateSyllabusPercent()}%`;
  const sylContainer = document.getElementById("syllabusContainer");
  sylContainer.innerHTML = Object.keys(appState.syllabus).map(sub => `
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

  // Error Table & Due Errors
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
        <td><button class="btn btn-secondary btn-small" onclick="deleteError(${err.id})">Resolve</button></td>
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

  if (appState.mocks.length > 0) {
    const latest = appState.mocks[0];
    document.getElementById("mockSummaryCallout").innerHTML = `
      <div style="font-size:1.1rem; font-weight:700;">Latest: ${latest.name} — ${latest.score}/${latest.total} (${latest.accuracy}% Accuracy)</div>
      <div class="text-muted mt-2">Predicted Standings: <strong style="color:var(--accent-primary);">${calculateAIRFromMocks()}</strong></div>
    `;
  }

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
      <p class="mt-2"><strong>${topErr ? `${topErr[0]} (${topErr[1]} logged)` : "No dominant errors recorded."}</strong></p>
      <span class="text-muted">Target this in your next problem batch before moving forward.</span>
    </div>
    <div class="audit-box">
      <h4>🧠 Primary Friction Driver</h4>
      <p class="mt-2"><strong>${topFriction ? `${topFriction[0]} (${topFriction[1]} times)` : "Smooth execution with zero friction."}</strong></p>
      <span class="text-muted">Adjust daily sleep routines or keep mobile devices in another room.</span>
    </div>
  `;

  // Completed blocks
  document.getElementById("completedBlocksList").innerHTML = appState.completedSessions.map(s => `<span class="chip">${s}</span>`).join("") || `<span class="empty-hint">No sessions completed today.</span>`;
}

function hydrateGistFields() {
  const creds = loadGistCredentials();
  if (creds.token) document.getElementById("gistToken").value = creds.token;
  if (creds.gistId) document.getElementById("gistId").value = creds.gistId;
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  try { initCharts(); } catch (e) { console.error("Chart init failed (chart.js may not have loaded):", e); }
  try { initPeer(); } catch (e) { console.error("Peer init failed (peerjs may not have loaded):", e); }
  hydrateGistFields();
  maybeShowOnboarding();
});