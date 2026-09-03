/* =============================================================
   CALIBRE DAILY TRACKER — app.js  v9.0
   New features: SRS Review Queue, Daily Plan, Session Notes,
   Syllabus Tracker, Difficulty Tracking, Mock Insights,
   Subject Accuracy Chart, Session Log, Motivational Quotes.
   ============================================================= */

const STORAGE_KEY = "CALIBRE_V9";

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

// Spaced Repetition intervals in days (indexed by stage - 1)
const SRS_INTERVALS = [1, 3, 7, 14, 30];

// Full JEE syllabus — used for the Syllabus Tracker
const JEE_SYLLABUS = {
  Physics: [
    "Units & Dimensions", "Kinematics (1D)", "Kinematics (2D)",
    "Newton's Laws of Motion", "Friction", "Work, Energy & Power",
    "Centre of Mass & Collisions", "Rotational Motion", "Gravitation",
    "Fluid Mechanics", "Thermal Physics & Calorimetry", "Thermodynamics",
    "Kinetic Theory of Gases", "Simple Harmonic Motion", "Waves & Sound",
    "Electrostatics", "Capacitors", "Current Electricity",
    "Magnetism & Moving Charges", "Electromagnetic Induction", "AC Circuits",
    "Ray Optics", "Wave Optics", "Modern Physics & Dual Nature",
    "Semiconductors"
  ],
  Chemistry: [
    "Mole Concept & Stoichiometry", "Atomic Structure",
    "Chemical Bonding & Molecular Structure", "Periodic Table & Periodicity",
    "States of Matter", "Thermodynamics", "Chemical Equilibrium",
    "Ionic Equilibrium", "Redox Reactions", "Electrochemistry",
    "Chemical Kinetics", "Solutions & Colligative Properties",
    "Surface Chemistry", "s-Block Elements", "p-Block (Groups 13–14)",
    "p-Block (Groups 15–18)", "d & f Block Elements",
    "Coordination Compounds", "Organic Basics & IUPAC",
    "Hydrocarbons", "Haloalkanes & Haloarenes",
    "Alcohols, Phenols & Ethers", "Aldehydes & Ketones",
    "Carboxylic Acids & Derivatives", "Amines",
    "Biomolecules", "Polymers & Chemistry in Everyday Life"
  ],
  Mathematics: [
    "Sets, Relations & Functions", "Complex Numbers",
    "Quadratic Equations & Inequalities", "Sequences & Series",
    "Matrices", "Determinants", "Permutations & Combinations",
    "Binomial Theorem", "Trigonometric Ratios & Identities",
    "Trigonometric Equations", "Inverse Trigonometry",
    "Straight Lines", "Circles", "Parabola",
    "Ellipse", "Hyperbola", "Limits & Continuity",
    "Differentiation", "Applications of Derivatives",
    "Indefinite Integration", "Definite Integrals",
    "Area Under Curves", "Differential Equations",
    "Vectors", "3D Geometry", "Probability", "Statistics"
  ]
};

const MOTIVATIONAL_QUOTES = [
  "Small consistent actions compound into extraordinary results.",
  "The score gap narrows one solved problem at a time.",
  "Difficult questions today — familiar patterns on exam day.",
  "Discomfort in practice is confidence in the exam hall.",
  "Each focus block is a brick in the foundation of your rank.",
  "Your future self is watching every minute you put in now.",
  "Elite rank = daily discipline, not talent alone.",
  "What feels hard today becomes your edge on exam day.",
  "Accuracy > Speed. Master the concept, the speed follows.",
  "One more problem. One more minute. That's the gap you close.",
  "The student who reviews their mistakes wins.",
  "Consistency is the only strategy that compounds.",
  "Hard problems are just easy problems you haven't seen yet.",
  "Your competitors are resting. Your choice.",
  "Rank is decided months before exam day — in sessions like this."
];

// ═══════════════════════════════════════════════════════════════
//  DEFAULT STATE
// ═══════════════════════════════════════════════════════════════
const defaultState = {
  version: 9,
  streak: 1,
  lastActiveDate: new Date().toISOString().split("T")[0],
  focusMinutesToday: 0,
  dailyFocusGoalHours: 5,
  dailyHistory: {},
  targetExamDate: "",
  examName: "",
  targetMockScore: 250,
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
  mocks: [],
  // New fields v9
  dailyPlan: { morning: "", afternoon: "", evening: "" },
  sessionNotes: [],
  syllabus: {},
  reviewedToday: []   // ids of mistakes reviewed today
};

// ═══════════════════════════════════════════════════════════════
//  DEMO STATE
// ═══════════════════════════════════════════════════════════════
function generateMockHeatmap() {
  const m = {};
  for (let i = 0; i < 35; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (34 - i));
    m[d.toISOString().split("T")[0]] = Math.floor(Math.random() * 300) + 60;
  }
  return m;
}

const demoMistakes = [
  { id: 101, topic: "Constraint Motion on Wedge", subject: "Physics", category: "Wrong Approach", difficulty: "Hard", takeaway: "Draw FBD in ground frame first; pseudo-force only in non-inertial frame.", stage: 2, date: (() => { const d = new Date(); d.setDate(d.getDate()-2); return d.toISOString().split("T")[0]; })() },
  { id: 102, topic: "Integration by Parts selection (ILATE)", subject: "Mathematics", category: "Concept Misunderstanding", difficulty: "Medium", takeaway: "Priority: Inverse > Log > Algebraic > Trig > Exponential. Never skip this.", stage: 1, date: (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split("T")[0]; })() },
  { id: 103, topic: "Parallel Axis Theorem", subject: "Physics", category: "Formula Gap", difficulty: "Medium", takeaway: "I_new = I_cm + Md². The axis through cm must be parallel to the new axis.", stage: 3, date: (() => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split("T")[0]; })() },
  { id: 104, topic: "Henderson-Hasselbalch buffer pH", subject: "Chemistry", category: "Formula Gap", difficulty: "Easy", takeaway: "pH = pKa + log([A⁻]/[HA]). At half-equivalence point, pH = pKa.", stage: 4, date: (() => { const d = new Date(); d.setDate(d.getDate()-14); return d.toISOString().split("T")[0]; })() }
];

const demoState = {
  ...defaultState,
  streak: 18,
  focusMinutesToday: 210,
  dailyFocusGoalHours: 5,
  dailyHistory: generateMockHeatmap(),
  onboarded: true,
  targetExamDate: "2027-01-20",
  examName: "JEE Advanced 2027",
  targetMockScore: 260,
  completedBlocks: ["50m (Physics)", "50m (Math)", "25m (Chemistry)"],
  subjects: {
    Physics:     { solved: 24, target: 20, correct: 21 },
    Chemistry:   { solved: 22, target: 20, correct: 19 },
    Mathematics: { solved: 19, target: 20, correct: 16 }
  },
  tasks: [
    { id: 1, text: "Solve 20 Rotational Dynamics PYQs", slot: "Morning",   done: true  },
    { id: 2, text: "Revise Thermodynamics — 1st & 2nd Law", slot: "Afternoon", done: false },
    { id: 3, text: "Complete Error Log — today's mistakes", slot: "Evening",   done: false }
  ],
  mistakes: demoMistakes,
  mocks: [
    { id: 1, name: "Allen Minor Test 01",    date: "2026-07-15", phy: 68, chem: 72, math: 54,  score: 194, total: 300, neg: 16, accuracy: 78, notes: "Maths time management was off." },
    { id: 2, name: "Full Mock Test 01",      date: "2026-08-01", phy: 76, chem: 78, math: 65,  score: 219, total: 300, neg: 10, accuracy: 83, notes: "Improved PChem significantly." },
    { id: 3, name: "Allen Major Test 02",    date: "2026-08-15", phy: 82, chem: 84, math: 72,  score: 238, total: 300, neg: 8,  accuracy: 88, notes: "Physics strong. Push Maths harder." },
    { id: 4, name: "Full Mock Test 02",      date: "2026-08-28", phy: 88, chem: 86, math: 78,  score: 252, total: 300, neg: 4,  accuracy: 92, notes: "Target score achieved. Maintain." }
  ],
  weeklyFocusVolume: [3.5, 4.2, 5.0, 3.8, 4.5, 3.0, 1.8],
  dailyPlan: {
    morning:   "Electrostatics — 30 PYQs (chapters 1–3)",
    afternoon: "Integration practice — definite integrals",
    evening:   "Review today's mistakes + formula drill"
  },
  sessionNotes: [
    { id: 1, date: new Date().toISOString().split("T")[0], duration: 50, subject: "Physics", note: "Covered Gauss's Law and shell theorem problems.", difficulty: "mixed" },
    { id: 2, date: new Date().toISOString().split("T")[0], duration: 50, subject: "Mathematics", note: "Definite integrals using properties — felt confident by end.", difficulty: "good" }
  ],
  reviewedToday: []
};

// ═══════════════════════════════════════════════════════════════
//  LOAD & SAVE STATE
// ═══════════════════════════════════════════════════════════════
let appState;
let isDemoMode = false;
let realAppStateBackup = null;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  appState = raw ? { ...defaultState, ...JSON.parse(raw) } : { ...defaultState };
} catch (e) {
  console.warn("[Calibre] State parse error, using defaults:", e);
  appState = { ...defaultState };
}

function saveState() {
  if (!isDemoMode) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      showToast("⚠ Storage quota exceeded — export your backup now!", "warning", 7000);
    }
  }
  renderAll();
}

// ═══════════════════════════════════════════════════════════════
//  STREAK & MIDNIGHT RESET
// ═══════════════════════════════════════════════════════════════
const todayDateStr = new Date().toISOString().split("T")[0];
const yesterday    = new Date(); yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split("T")[0];

if (appState.lastActiveDate !== todayDateStr) {
  if (appState.lastActiveDate === yesterdayStr) {
    appState.streak = (appState.streak || 0) + 1;
  } else {
    appState.streak = 1;
  }
  appState.focusMinutesToday = 0;
  appState.completedBlocks   = [];
  appState.reviewedToday     = [];
  appState.lastActiveDate    = todayDateStr;
  // Reset daily plan for new day
  appState.dailyPlan = { morning: "", afternoon: "", evening: "" };
  saveState();
}

// Ensure new state fields exist for users upgrading from v8
if (!appState.dailyPlan)   appState.dailyPlan   = { morning: "", afternoon: "", evening: "" };
if (!appState.sessionNotes) appState.sessionNotes = [];
if (!appState.syllabus)    appState.syllabus    = {};
if (!appState.reviewedToday) appState.reviewedToday = [];
if (!appState.examName)    appState.examName    = "";
if (!appState.targetMockScore) appState.targetMockScore = 250;

// ═══════════════════════════════════════════════════════════════
//  TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  const icons = { info: "ℹ", success: "✓", warning: "⚠", error: "✕" };
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icons[type] || "ℹ"}</span><span class="toast-msg">${message}</span><button class="toast-close" aria-label="Dismiss">✕</button>`;
  toast.querySelector(".toast-close").addEventListener("click", () => dismissToast(toast));
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  if (duration > 0) setTimeout(() => dismissToast(toast), duration);
  return toast;
}
function dismissToast(toast) {
  toast.classList.remove("toast-visible");
  toast.addEventListener("transitionend", () => toast.remove(), { once: true });
}

// ═══════════════════════════════════════════════════════════════
//  CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════════
function showConfirm(message, title = "Confirm") {
  return new Promise(resolve => {
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
  const confirmMsg = appState.onboarded
    ? "This will reset your subject progress and syllabus to the new preset. Continue?"
    : null;

  const doApply = () => {
    if (type === "stem") {
      appState.subjects = {
        Physics:     { solved: 0, target: 20, correct: 0 },
        Chemistry:   { solved: 0, target: 20, correct: 0 },
        Mathematics: { solved: 0, target: 20, correct: 0 }
      };
      appState.dailySubjectGoal = 20;
    } else if (type === "college") {
      appState.subjects = {
        "Algorithms & DSA":  { solved: 0, target: 10, correct: 0 },
        "System Design":     { solved: 0, target: 10, correct: 0 },
        "Projects & Dev":    { solved: 0, target: 10, correct: 0 }
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
    appState.syllabus = {};
    initSyllabusState();
    appState.onboarded = true;
    closeOnboardingModal();
    saveState();
    showToast("Profile set! Syllabus tracker is ready.", "success");
  };

  if (appState.onboarded) {
    showConfirm(confirmMsg, "Change Preset?").then(ok => { if (ok) doApply(); });
  } else {
    doApply();
  }
}

function closeOnboardingModal() {
  document.getElementById("onboardingModal").classList.remove("active");
}

// ═══════════════════════════════════════════════════════════════
//  SYLLABUS TRACKER
// ═══════════════════════════════════════════════════════════════
function initSyllabusState() {
  if (!appState.syllabus) appState.syllabus = {};
  Object.keys(appState.subjects || {}).forEach(subject => {
    if (!appState.syllabus[subject]) appState.syllabus[subject] = {};
    const chapters = JEE_SYLLABUS[subject] || [];
    chapters.forEach(ch => {
      if (appState.syllabus[subject][ch] === undefined) {
        appState.syllabus[subject][ch] = false;
      }
    });
  });
}

function toggleChapter(subject, chapter) {
  if (!appState.syllabus[subject]) appState.syllabus[subject] = {};
  appState.syllabus[subject][chapter] = !appState.syllabus[subject][chapter];
  saveState();
}

function renderSyllabus() {
  const container = document.getElementById("syllabusContainer");
  const badge     = document.getElementById("syllabusOverallBadge");
  if (!container) return;

  initSyllabusState();
  container.innerHTML = "";

  let totalChapters = 0, totalDone = 0;

  Object.entries(appState.subjects || {}).forEach(([subject, _]) => {
    const knownChapters = JEE_SYLLABUS[subject] || [];
    const subjectData   = appState.syllabus[subject] || {};
    const customChapters = Object.keys(subjectData).filter(ch => !knownChapters.includes(ch));
    const allChapters   = [...knownChapters, ...customChapters];

    if (!allChapters.length) return;

    const done = allChapters.filter(ch => subjectData[ch]).length;
    totalChapters += allChapters.length;
    totalDone     += done;
    const pct     = Math.round((done / allChapters.length) * 100);

    const section = document.createElement("div");
    section.className = "syllabus-subject";

    section.innerHTML = `
      <div class="syllabus-subject-header" onclick="this.parentElement.classList.toggle('collapsed')" role="button" tabindex="0" aria-expanded="true" aria-label="Toggle ${subject} chapters">
        <div class="syllabus-header-left">
          <svg class="syllabus-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="syllabus-subject-name">${escapeHtml(subject)}</span>
          <span class="syllabus-pct ${pct === 100 ? "done" : ""}">${done}/${allChapters.length}</span>
        </div>
        <div class="syllabus-progress-mini">
          <div class="progress-bar-wrap small" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${allChapters.length}">
            <div class="progress-bar ${pct === 100 ? "progress-bar-done" : ""}" style="width:${pct}%"></div>
          </div>
          <span class="syllabus-pct-num">${pct}%</span>
        </div>
      </div>
      <div class="syllabus-chapters">
        ${allChapters.map(ch => {
          const isDone = !!subjectData[ch];
          return `
            <label class="chapter-item ${isDone ? "done" : ""}" aria-label="${escapeHtml(ch)}: ${isDone ? "complete" : "incomplete"}">
              <input type="checkbox" class="chapter-checkbox" ${isDone ? "checked" : ""}
                onchange="toggleChapter('${escapeHtml(subject)}','${escapeHtml(ch)}')" aria-label="${escapeHtml(ch)}">
              <span class="chapter-name">${escapeHtml(ch)}</span>
              ${isDone ? '<svg class="chapter-done-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ""}
            </label>
          `;
        }).join("")}
        <div class="chapter-add-row">
          <input class="input-control input-sm chapter-add-input" id="newChapter-${escapeHtml(subject)}" type="text" placeholder="Add custom chapter..." maxlength="60" aria-label="Add chapter to ${subject}">
          <button class="btn btn-ghost btn-xs" onclick="addCustomChapter('${escapeHtml(subject)}')" aria-label="Add chapter">+</button>
        </div>
      </div>
    `;

    // Keyboard support for header
    section.querySelector(".syllabus-subject-header").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    });

    container.appendChild(section);
  });

  const overallPct = totalChapters > 0 ? Math.round((totalDone / totalChapters) * 100) : 0;
  badge.textContent = `${overallPct}% complete`;
  badge.className = `badge ${overallPct === 100 ? "badge-green" : ""}`;
}

function addCustomChapter(subject) {
  const input = document.getElementById(`newChapter-${subject}`);
  const name  = input?.value?.trim();
  if (!name) return;
  if (!appState.syllabus[subject]) appState.syllabus[subject] = {};
  if (appState.syllabus[subject][name] !== undefined) {
    showToast("Chapter already exists.", "warning"); return;
  }
  appState.syllabus[subject][name] = false;
  input.value = "";
  saveState();
}

// ═══════════════════════════════════════════════════════════════
//  DAILY PLAN
// ═══════════════════════════════════════════════════════════════
function renderDailyPlan() {
  const plan   = appState.dailyPlan || {};
  const dateEl = document.getElementById("dailyPlanDate");
  const mEl    = document.getElementById("planMorning");
  const aEl    = document.getElementById("planAfternoon");
  const eEl    = document.getElementById("planEvening");

  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
  }
  if (mEl) mEl.value = plan.morning   || "";
  if (aEl) aEl.value = plan.afternoon || "";
  if (eEl) eEl.value = plan.evening   || "";

  // Highlight current time slot
  const hour = new Date().getHours();
  const slotMap = { slotMorning: hour < 12, slotAfternoon: hour >= 12 && hour < 18, slotEvening: hour >= 18 };
  Object.entries(slotMap).forEach(([id, active]) => {
    document.getElementById(id)?.classList.toggle("plan-slot-active", active);
  });
}

function saveDailyPlan() {
  appState.dailyPlan = {
    morning:   document.getElementById("planMorning")?.value?.trim()   || "",
    afternoon: document.getElementById("planAfternoon")?.value?.trim() || "",
    evening:   document.getElementById("planEvening")?.value?.trim()   || ""
  };
  if (!isDemoMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// Auto-save daily plan on blur
["planMorning","planAfternoon","planEvening"].forEach(id => {
  document.getElementById(id)?.addEventListener("blur", saveDailyPlan);
});

// ═══════════════════════════════════════════════════════════════
//  SRS REVIEW QUEUE
// ═══════════════════════════════════════════════════════════════
function getMistakeDueDate(mistake) {
  const interval = SRS_INTERVALS[Math.min((mistake.stage || 1) - 1, SRS_INTERVALS.length - 1)];
  const d = new Date(mistake.date);
  d.setDate(d.getDate() + interval);
  return d.toISOString().split("T")[0];
}

function getMistakesDueToday() {
  return (appState.mistakes || []).filter(m => {
    if ((m.stage || 1) >= 5) return false;
    if ((appState.reviewedToday || []).includes(m.id)) return false;
    return getMistakeDueDate(m) <= todayDateStr;
  });
}

function getMistakesUpcoming(days = 7) {
  const result = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const due = (appState.mistakes || []).filter(m => {
      if ((m.stage || 1) >= 5) return false;
      return getMistakeDueDate(m) === dateStr;
    });
    if (due.length) result.push({ date: dateStr, items: due });
  }
  return result;
}

function markReviewed(id) {
  if (!appState.reviewedToday) appState.reviewedToday = [];
  if (!appState.reviewedToday.includes(id)) appState.reviewedToday.push(id);

  // Advance stage
  const m = (appState.mistakes || []).find(m => m.id === id);
  if (m) {
    m.stage = Math.min((m.stage || 1) + 1, 5);
    if (m.stage >= 5) {
      showToast(`🏆 "${m.topic}" mastered! Moved to Long-term memory.`, "success", 5000);
    } else {
      const nextDays = SRS_INTERVALS[m.stage - 1];
      showToast(`✓ Reviewed. Next review in ${nextDays} day${nextDays > 1 ? "s" : ""}.`, "info", 3000);
    }
  }
  saveState();
}

function snoozeReview(id) {
  if (!appState.reviewedToday) appState.reviewedToday = [];
  if (!appState.reviewedToday.includes(id)) appState.reviewedToday.push(id);
  showToast("Snoozed until tomorrow.", "info", 2000);
  saveState();
}

function renderReview() {
  const dueList      = document.getElementById("reviewDueList");
  const upcomingGrid = document.getElementById("reviewUpcomingGrid");
  const badge        = document.getElementById("reviewDueBadge");
  const navBadge     = document.getElementById("reviewNavBadge");

  const due       = getMistakesDueToday();
  const upcoming  = getMistakesUpcoming(7);
  const mastered  = (appState.mistakes || []).filter(m => (m.stage || 1) >= 5).length;
  const active    = (appState.mistakes || []).filter(m => (m.stage || 1) < 5).length;
  const reviewed  = (appState.reviewedToday || []).length;

  // Update stat boxes
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl("rsrsDueToday",      due.length);
  setEl("rsrsReviewedToday", reviewed);
  setEl("rsrsActive",        active);
  setEl("rsrsMastered",      mastered);

  if (badge)    badge.textContent = `${due.length} item${due.length !== 1 ? "s" : ""}`;
  if (navBadge) {
    navBadge.textContent = due.length > 0 ? due.length : "";
    navBadge.style.display = due.length > 0 ? "inline-flex" : "none";
  }

  // Due list
  if (dueList) {
    if (!due.length) {
      dueList.innerHTML = `<li class="empty-state" role="listitem">
        🎉 No reviews due today! Come back tomorrow or add more mistakes to log.
      </li>`;
    } else {
      dueList.innerHTML = "";
      due.forEach(m => {
        const stageDots = Array.from({ length: 5 }, (_, i) =>
          `<span class="stage-dot ${i < (m.stage||1) ? "active" : ""}" aria-hidden="true"></span>`
        ).join("");

        const diffColor = { Easy: "green", Medium: "amber", Hard: "rose" }[m.difficulty] || "amber";
        const li = document.createElement("li");
        li.className = "review-item";
        li.setAttribute("role", "listitem");
        li.innerHTML = `
          <div class="review-item-header">
            <div class="review-item-meta">
              <span class="mistake-topic">${escapeHtml(m.topic)}</span>
              <span class="badge badge-subject">${escapeHtml(m.subject)}</span>
              <span class="badge badge-${diffColor}">${m.difficulty || "Medium"}</span>
            </div>
            <span class="review-stage-label">Stage ${m.stage||1}/5</span>
          </div>
          ${m.takeaway ? `<blockquote class="review-takeaway">${escapeHtml(m.takeaway)}</blockquote>` : ""}
          <div class="review-item-footer">
            <div class="stage-row" aria-label="Stage ${m.stage||1} of 5">${stageDots}</div>
            <div class="review-actions">
              <button class="btn btn-ghost btn-xs" onclick="snoozeReview(${m.id})" aria-label="Snooze to tomorrow">Snooze</button>
              <button class="btn btn-primary btn-small" onclick="markReviewed(${m.id})" aria-label="Mark as reviewed">
                ✓ Reviewed
              </button>
            </div>
          </div>
        `;
        dueList.appendChild(li);
      });
    }
  }

  // Upcoming
  if (upcomingGrid) {
    if (!upcoming.length) {
      upcomingGrid.innerHTML = `<p class="field-hint" style="padding:16px">No upcoming reviews in the next 7 days.</p>`;
    } else {
      upcomingGrid.innerHTML = upcoming.map(({ date, items }) => {
        const d = new Date(date);
        const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
        return `
          <div class="upcoming-day">
            <span class="upcoming-date">${label}</span>
            <span class="upcoming-count">${items.length} review${items.length > 1 ? "s" : ""}</span>
            <ul class="upcoming-topics">
              ${items.slice(0, 3).map(m => `<li>${escapeHtml(m.topic)}</li>`).join("")}
              ${items.length > 3 ? `<li>+${items.length - 3} more</li>` : ""}
            </ul>
          </div>
        `;
      }).join("");
    }
  }

  // Update Review Widget on Focus tab
  renderReviewWidget();
}

function renderReviewWidget() {
  const widget     = document.getElementById("reviewWidget");
  const widgetList = document.getElementById("reviewWidgetList");
  const widgetCount = document.getElementById("reviewWidgetCount");
  const due = getMistakesDueToday();

  if (widgetCount) widgetCount.textContent = `${due.length} item${due.length !== 1 ? "s" : ""}`;
  if (!widgetList) return;

  if (!due.length) {
    widgetList.innerHTML = `<p class="field-hint" style="padding:8px 0">All caught up! 🎉</p>`;
    return;
  }

  widgetList.innerHTML = "";
  due.slice(0, 4).forEach(m => {
    const div = document.createElement("div");
    div.className = "review-widget-item";
    div.innerHTML = `
      <div class="review-widget-item-text">
        <span class="review-widget-topic">${escapeHtml(m.topic)}</span>
        <span class="badge badge-subject">${escapeHtml(m.subject)}</span>
      </div>
      <button class="btn btn-ghost btn-xs" onclick="markReviewed(${m.id})" aria-label="Mark reviewed">✓</button>
    `;
    widgetList.appendChild(div);
  });

  if (due.length > 4) {
    const more = document.createElement("button");
    more.className = "btn btn-ghost btn-xs w-full mt-1";
    more.textContent = `+${due.length - 4} more — go to Review tab`;
    more.addEventListener("click", () => switchTab("review"));
    widgetList.appendChild(more);
  }
}

// ═══════════════════════════════════════════════════════════════
//  SESSION NOTES
// ═══════════════════════════════════════════════════════════════
let _currentSessionDuration = 0;

function showSessionNoteModal(duration) {
  _currentSessionDuration = duration;
  const modal   = document.getElementById("sessionNoteModal");
  const title   = document.getElementById("sessionNoteTitle");
  const textEl  = document.getElementById("sessionNoteText");
  const subjSel = document.getElementById("sessionNoteSubject");

  if (title) title.textContent = `${duration}m Sprint Complete! 🎯`;
  if (textEl) textEl.value = "";

  // Populate subject dropdown
  if (subjSel) {
    subjSel.innerHTML = Object.keys(appState.subjects || {})
      .map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
      .join("");
  }

  if (modal) modal.classList.add("active");
}

function saveSessionNote() {
  const modal     = document.getElementById("sessionNoteModal");
  const note      = document.getElementById("sessionNoteText")?.value?.trim() || "";
  const subject   = document.getElementById("sessionNoteSubject")?.value || "";
  const difficulty = document.getElementById("sessionNoteDifficulty")?.value || "good";

  const entry = {
    id:         Date.now(),
    date:       todayDateStr,
    duration:   _currentSessionDuration,
    subject:    subject,
    note:       note,
    difficulty: difficulty
  };

  if (!appState.sessionNotes) appState.sessionNotes = [];
  appState.sessionNotes.unshift(entry);

  // Keep last 50 notes
  if (appState.sessionNotes.length > 50) appState.sessionNotes = appState.sessionNotes.slice(0, 50);

  // Update the completed block label with note
  const lastIdx = appState.completedBlocks.length - 1;
  if (lastIdx >= 0 && note) {
    appState.completedBlocks[lastIdx] += ` — ${note.slice(0, 30)}${note.length > 30 ? "…" : ""}`;
  }

  if (modal) modal.classList.remove("active");
  saveState();
}

function skipSessionNote() {
  document.getElementById("sessionNoteModal")?.classList.remove("active");
}

document.getElementById("btnSaveSessionNote")?.addEventListener("click", saveSessionNote);
document.getElementById("btnSkipSessionNote")?.addEventListener("click", skipSessionNote);

function renderSessionLog() {
  const list = document.getElementById("sessionLogList");
  if (!list) return;
  const notes = (appState.sessionNotes || []).slice(0, 8);

  if (!notes.length) {
    list.innerHTML = `<li class="empty-state" role="listitem">No session notes yet. After your first timer sprint, you'll be prompted to log what you covered.</li>`;
    return;
  }

  const diffIcon = { good: "🟢", mixed: "🟡", tough: "🔴" };
  list.innerHTML = "";
  notes.forEach(n => {
    const li = document.createElement("li");
    li.className = "session-log-item";
    li.innerHTML = `
      <div class="session-log-header">
        <span class="session-log-meta">${n.date} · ${n.duration}m · ${escapeHtml(n.subject || "General")} ${diffIcon[n.difficulty] || ""}</span>
      </div>
      ${n.note ? `<p class="session-log-note">${escapeHtml(n.note)}</p>` : "<p class='field-hint'>No note recorded.</p>"}
    `;
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════════
//  DEMO DATA TOGGLE
// ═══════════════════════════════════════════════════════════════
function toggleDemoData() {
  isDemoMode = !isDemoMode;
  document.getElementById("btnDemoToggleDesktop").textContent = isDemoMode ? "Exit Sample Data" : "Preview Sample Data";
  document.getElementById("btnDemoToggleMobile").textContent  = isDemoMode ? "Live" : "Sample";

  if (isDemoMode) {
    realAppStateBackup = JSON.parse(JSON.stringify(appState));
    appState = JSON.parse(JSON.stringify(demoState));
    showToast("Showing sample data — your real data is safe.", "info");
  } else {
    appState = realAppStateBackup ? JSON.parse(JSON.stringify(realAppStateBackup)) : { ...defaultState };
    realAppStateBackup = null;
    showToast("Back to your live data.", "info");
  }
  renderAll(); updateCharts();
}

document.getElementById("btnDemoToggleDesktop")?.addEventListener("click", toggleDemoData);
document.getElementById("btnDemoToggleMobile")?.addEventListener("click", toggleDemoData);

// ═══════════════════════════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════════════════════════
function switchTab(tabName) {
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  const btn  = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
  const pane = document.getElementById(`view-${tabName}`);
  if (btn)  btn.classList.add("active");
  if (pane) pane.classList.add("active");

  const mobileIndicator = document.getElementById("mobileTabIndicator");
  if (mobileIndicator && btn) mobileIndicator.textContent = btn.dataset.label || tabName;

  if (tabName === "dashboard" || tabName === "mocks") updateCharts();
  if (tabName === "review") renderReview();
}

document.querySelectorAll(".nav-link").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ═══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
  if (e.code === "Space" && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); document.getElementById("btnTimerStart")?.click();
  }
  if (e.altKey && e.key.toLowerCase() === "q") { e.preventDefault(); switchTab("practice"); }
  if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); switchTab("review"); }
  if (e.altKey && e.key.toLowerCase() === "m") { e.preventDefault(); switchTab("mistakes"); }
  if (e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); toggleFullscreen(); }
});

// ═══════════════════════════════════════════════════════════════
//  FULLSCREEN
// ═══════════════════════════════════════════════════════════════
const btnFullscreen = document.getElementById("btnFullscreen");
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err =>
      showToast(`Fullscreen not available: ${err.message}`, "warning")
    );
  } else document.exitFullscreen();
}
btnFullscreen?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  const isFS = !!document.fullscreenElement;
  if (btnFullscreen) btnFullscreen.innerHTML = isFS
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="8 3 3 3 3 8"/><polyline points="21 8 21 3 16 3"/><polyline points="3 16 3 21 8 21"/><polyline points="16 21 21 21 21 16"/></svg> Exit Fullscreen`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Fullscreen`;
});

// ═══════════════════════════════════════════════════════════════
//  TIMER ENGINE
// ═══════════════════════════════════════════════════════════════
let timerMins    = 50;
let timerSeconds = 50 * 60;
let timerTotal   = 50 * 60;
let timerInterval     = null;
let isTimerActive     = false;
let isBreakSession    = false;
let activeBoundTask   = null;
const RING_CIRC       = 2 * Math.PI * 54; // r=54 → 339.3

const timerClock  = document.getElementById("timerClock");
const timerRing   = document.getElementById("timerRing");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerReset = document.getElementById("btnTimerReset");

function formatTime(s) {
  const m   = Math.floor(Math.abs(s) / 60).toString().padStart(2, "0");
  const sec = (Math.abs(s) % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function updateRing(left, total) {
  if (!timerRing) return;
  timerRing.style.strokeDashoffset = RING_CIRC * (1 - Math.max(0, left / total));
}

function syncTitle() {
  document.title = isTimerActive ? `${formatTime(timerSeconds)} — Calibre` : "Calibre — Precision Study Workspace";
}

function showQuote() {
  const el = document.getElementById("motivationalQuote");
  if (!el) return;
  const q = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  el.textContent = `"${q}"`;
}

// Preset buttons
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (isTimerActive) return;
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    timerMins = parseInt(btn.dataset.time);
    timerSeconds = timerTotal = timerMins * 60;
    if (timerClock) timerClock.textContent = formatTime(timerSeconds);
    updateRing(timerSeconds, timerTotal);
    isBreakSession = false;
    const tag = document.getElementById("timerTag");
    if (tag) tag.textContent = `${timerMins}m Focus Block`;
  });
});

function playChime() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    [[523.25, 0], [659.25, 0.15], [783.99, 0.3], [1046.5, 0.5]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 1.2);
    });
  } catch (_) {}
}

btnTimerStart?.addEventListener("click", () => {
  btnTimerStart.classList.remove("pulse-btn");
  if (isTimerActive) {
    clearInterval(timerInterval);
    isTimerActive = false;
    btnTimerStart.textContent = "Resume Session";
    syncTitle();
  } else {
    isTimerActive = true;
    btnTimerStart.textContent = "Pause";
    showQuote();

    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerClock) timerClock.textContent = formatTime(timerSeconds);
      updateRing(timerSeconds, timerTotal);
      syncTitle();

      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        isTimerActive = false;
        playChime();
        syncTitle();

        if (!isBreakSession) {
          // Log focus session (only if not demo)
          if (!isDemoMode) {
            appState.focusMinutesToday = (appState.focusMinutesToday || 0) + timerMins;
            appState.dailyHistory[todayDateStr] = (appState.dailyHistory[todayDateStr] || 0) + timerMins;
            const dow = new Date().getDay();
            appState.weeklyFocusVolume[dow] = parseFloat(((appState.dailyHistory[todayDateStr] || 0) / 60).toFixed(2));
            const label = activeBoundTask ? `${timerMins}m (${activeBoundTask})` : `${timerMins}m Focus Block`;
            if (!appState.completedBlocks) appState.completedBlocks = [];
            appState.completedBlocks.push(label);
          }

          // Start break
          isBreakSession = true;
          timerSeconds = timerTotal = 5 * 60;
          if (timerClock) timerClock.textContent = "05:00";
          updateRing(timerSeconds, timerTotal);
          const tag = document.getElementById("timerTag");
          if (tag) tag.textContent = "☕ 5m Rest Break";
          btnTimerStart.textContent = "Start Break";

          // Show session note modal (only in real mode)
          if (!isDemoMode) {
            // Save state first, then show note modal
            if (!isDemoMode) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); } catch(_) {} }
            renderAll();
            setTimeout(() => showSessionNoteModal(timerMins), 500);
          }

          showToast(`🎯 ${timerMins}m sprint done! 5-minute break starting.`, "success", 5000);

        } else {
          // Break over → reset
          isBreakSession = false;
          timerSeconds = timerTotal = timerMins * 60;
          if (timerClock) timerClock.textContent = formatTime(timerSeconds);
          updateRing(timerSeconds, timerTotal);
          const tag = document.getElementById("timerTag");
          if (tag) tag.textContent = `${timerMins}m Focus Block`;
          btnTimerStart.textContent = "Start Session";
          btnTimerStart.classList.add("pulse-btn");
          showToast("Break over! Ready for the next sprint? 🚀", "info", 4000);
        }
      }
    }, 1000);
  }
});

btnTimerReset?.addEventListener("click", () => {
  clearInterval(timerInterval);
  isTimerActive = false; isBreakSession = false;
  timerSeconds = timerTotal = timerMins * 60;
  if (timerClock) timerClock.textContent = formatTime(timerSeconds);
  updateRing(timerSeconds, timerTotal);
  btnTimerStart.textContent = "Start Session";
  const tag = document.getElementById("timerTag");
  if (tag) tag.textContent = `${timerMins}m Focus Block`;
  syncTitle();
});

function refreshTimerTaskBind() {
  const sel = document.getElementById("timerTaskBind");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Bind to a task (optional) —</option>`;
  (appState.tasks || []).filter(t => !t.done).forEach(t => {
    const o = document.createElement("option");
    o.value = t.text; o.textContent = t.text;
    sel.appendChild(o);
  });
}

document.getElementById("timerTaskBind")?.addEventListener("change", e => {
  activeBoundTask = e.target.value || null;
});

// ═══════════════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnAddTask")?.addEventListener("click", addTask);
document.getElementById("taskInput")?.addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });

function addTask() {
  const input = document.getElementById("taskInput");
  const slot  = document.getElementById("taskSlotSelect")?.value || "Morning";
  const text  = input?.value?.trim();
  if (!text) { input?.focus(); return; }
  if (!appState.tasks) appState.tasks = [];
  appState.tasks.push({ id: Date.now(), text, slot, done: false });
  if (input) input.value = "";
  saveState();
}

function toggleTask(id) {
  const t = (appState.tasks || []).find(t => t.id === id);
  if (t) { t.done = !t.done; saveState(); }
}

function deleteTask(id) {
  appState.tasks = (appState.tasks || []).filter(t => t.id !== id);
  saveState();
}

function renderTasks() {
  const list  = document.getElementById("taskList");
  const badge = document.getElementById("taskCompletionBadge");
  if (!list) return;
  const tasks = appState.tasks || [];
  const done  = tasks.filter(t => t.done).length;
  if (badge) {
    badge.textContent = `${done}/${tasks.length}`;
    badge.className = `badge ${done === tasks.length && tasks.length > 0 ? "badge-green" : ""}`;
  }
  list.innerHTML = "";
  ["Morning","Afternoon","Evening"].forEach(slot => {
    const slotTasks = tasks.filter(t => t.slot === slot);
    if (!slotTasks.length) return;
    const header = document.createElement("li");
    header.className = "task-slot-header"; header.textContent = slot;
    header.setAttribute("role", "presentation");
    list.appendChild(header);
    slotTasks.forEach(task => {
      const li = document.createElement("li");
      li.className = `task-item ${task.done ? "done" : ""}`;
      li.setAttribute("role", "listitem");
      li.innerHTML = `
        <button class="task-check" onclick="toggleTask(${task.id})" aria-label="${task.done ? "Mark incomplete" : "Mark complete"}: ${escapeHtml(task.text)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            ${task.done ? '<polyline points="20 6 9 17 4 12"/>' : '<circle cx="12" cy="12" r="9"/>'}
          </svg>
        </button>
        <span class="task-text">${escapeHtml(task.text)}</span>
        <span class="task-slot-tag">${task.slot}</span>
        <button class="task-delete" onclick="deleteTask(${task.id})" aria-label="Delete task">✕</button>
      `;
      list.appendChild(li);
    });
  });
  refreshTimerTaskBind();
}

// ═══════════════════════════════════════════════════════════════
//  MISTAKES
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnAddMistake")?.addEventListener("click", addMistake);

function addMistake() {
  const topic      = document.getElementById("mistakeTopic")?.value?.trim();
  const subject    = document.getElementById("mistakeSubject")?.value;
  const category   = document.getElementById("mistakeCategory")?.value;
  const difficulty = document.getElementById("mistakeDifficulty")?.value || "Medium";
  const takeaway   = document.getElementById("mistakeTakeaway")?.value?.trim() || "";

  if (!topic) { showToast("Please enter a topic/concept.", "warning"); document.getElementById("mistakeTopic")?.focus(); return; }

  if (!appState.mistakes) appState.mistakes = [];
  appState.mistakes.push({ id: Date.now(), topic, subject, category, difficulty, takeaway, stage: 1, date: todayDateStr });

  ["mistakeTopic","mistakeTakeaway"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  saveState();
  showToast(`Logged! Next review in 1 day. 📌`, "success", 3000);
}

function advanceMistakeStage(id) {
  const m = (appState.mistakes || []).find(m => m.id === id);
  if (m && (m.stage || 1) < 5) { m.stage++; saveState(); }
}

function deleteMistake(id) {
  appState.mistakes = (appState.mistakes || []).filter(m => m.id !== id);
  saveState();
}

function renderMistakes() {
  const list  = document.getElementById("mistakeList");
  const badge = document.getElementById("mistakeCountBadge");
  if (!list) return;
  const mistakes = appState.mistakes || [];
  if (badge) badge.textContent = `${mistakes.length} entr${mistakes.length === 1 ? "y" : "ies"}`;

  // Refresh subject dropdown
  const sel = document.getElementById("mistakeSubject");
  if (sel) {
    sel.innerHTML = "";
    Object.keys(appState.subjects || {}).forEach(s => sel.appendChild(new Option(s, s)));
  }

  list.innerHTML = "";
  if (!mistakes.length) {
    list.innerHTML = `<li class="empty-state" role="listitem">No mistakes logged yet. Add errors here to build your SRS review queue.</li>`;
    return;
  }

  const diffColor = { Easy: "green", Medium: "amber", Hard: "rose" };
  [...mistakes].sort((a, b) => b.id - a.id).forEach(m => {
    const stageDots = Array.from({ length: 5 }, (_, i) =>
      `<span class="stage-dot ${i < (m.stage||1) ? "active" : ""}" aria-hidden="true"></span>`
    ).join("");

    const nextReview = (m.stage||1) >= 5 ? "Mastered ✓" : `Next: ${getMistakeDueDate(m)}`;
    const li = document.createElement("li");
    li.className = "mistake-item";
    li.innerHTML = `
      <div class="mistake-header">
        <div class="mistake-header-left">
          <span class="mistake-topic">${escapeHtml(m.topic)}</span>
          <span class="badge badge-subject">${escapeHtml(m.subject)}</span>
          <span class="badge badge-${diffColor[m.difficulty] || "amber"}">${m.difficulty || "Medium"}</span>
          <span class="badge badge-category">${escapeHtml(m.category)}</span>
        </div>
        <div class="mistake-header-right">
          <span class="mistake-date">${m.date}</span>
          <span class="next-review-label">${nextReview}</span>
        </div>
      </div>
      ${m.takeaway ? `<blockquote class="mistake-takeaway">${escapeHtml(m.takeaway)}</blockquote>` : ""}
      <div class="mistake-footer">
        <div class="stage-row" aria-label="Stage ${m.stage||1} of 5">${stageDots}</div>
        <div class="mistake-actions">
          <button class="btn btn-ghost btn-xs" onclick="advanceMistakeStage(${m.id})" ${(m.stage||1)>=5?"disabled":""} aria-label="Mark reviewed">
            ${(m.stage||1)>=5 ? "✓ Mastered" : "Mark Reviewed →"}
          </button>
          <button class="btn btn-ghost btn-xs danger" onclick="deleteMistake(${m.id})" aria-label="Delete">✕</button>
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════════
//  PRACTICE — QUESTION LOG
// ═══════════════════════════════════════════════════════════════
function renderPractice() {
  const container = document.getElementById("practiceSubjectCards");
  const badge     = document.getElementById("practiceTotalBadge");
  const cumBadge  = document.getElementById("cumulativeTotalBadge");
  if (!container) return;

  const subjects = appState.subjects || {};
  let totalSolved = 0;
  Object.values(subjects).forEach(s => totalSolved += (s.solved || 0));
  if (badge)    badge.textContent = `${totalSolved} solved`;
  if (cumBadge) cumBadge.textContent = `${totalSolved} total`;

  container.innerHTML = "";
  Object.entries(subjects).forEach(([name, data]) => {
    const acc      = data.solved > 0 ? Math.round((data.correct / data.solved) * 100) : 0;
    const progress = Math.min(100, data.target > 0 ? Math.round((data.solved / data.target) * 100) : 0);

    const card = document.createElement("div");
    card.className = "practice-subject-card";
    card.innerHTML = `
      <div class="practice-card-header">
        <span class="practice-subject-name">${escapeHtml(name)}</span>
        <div class="practice-card-right">
          <span class="practice-acc ${acc >= 80 ? "acc-good" : acc >= 60 ? "acc-ok" : "acc-low"}">${acc}% acc</span>
          <span class="practice-stats">${data.solved}/${data.target} today</span>
        </div>
      </div>
      <div class="progress-bar-wrap" role="progressbar" aria-valuenow="${data.solved}" aria-valuemin="0" aria-valuemax="${data.target}">
        <div class="progress-bar ${progress >= 100 ? "progress-bar-done" : ""}" style="width:${progress}%"></div>
      </div>
      <div class="practice-input-row">
        <div class="practice-input-group">
          <label class="field-label" for="inp-solved-${name}">Solved</label>
          <input class="input-control input-sm" id="inp-solved-${name}" type="number" min="0" value="${data.solved}" aria-label="${name} solved">
        </div>
        <div class="practice-input-group">
          <label class="field-label" for="inp-correct-${name}">Correct</label>
          <input class="input-control input-sm" id="inp-correct-${name}" type="number" min="0" value="${data.correct}" aria-label="${name} correct">
        </div>
        <div class="practice-input-group">
          <label class="field-label" for="inp-target-${name}">Target</label>
          <input class="input-control input-sm" id="inp-target-${name}" type="number" min="1" value="${data.target}" aria-label="${name} target">
        </div>
        <button class="btn btn-primary btn-small" onclick="updateSubject('${escapeHtml(name)}')" aria-label="Save ${name}">Save</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateSubject(name) {
  const solved  = parseInt(document.getElementById(`inp-solved-${name}`)?.value)  || 0;
  const correct = parseInt(document.getElementById(`inp-correct-${name}`)?.value) || 0;
  const target  = parseInt(document.getElementById(`inp-target-${name}`)?.value)  || 20;
  if (correct > solved) { showToast(`Correct (${correct}) can't exceed Solved (${solved}).`, "warning"); return; }
  if (!appState.subjects) appState.subjects = {};
  appState.subjects[name] = { ...appState.subjects[name], solved, correct: Math.min(correct, solved), target };
  saveState();
  showToast(`${name} updated.`, "success", 2000);
}

// ═══════════════════════════════════════════════════════════════
//  MOCKS
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnSaveMock")?.addEventListener("click", saveMock);

function saveMock() {
  const name  = document.getElementById("mockName")?.value?.trim();
  const date  = document.getElementById("mockDate")?.value;
  const phy   = parseInt(document.getElementById("mockPhy")?.value)   || 0;
  const chem  = parseInt(document.getElementById("mockChem")?.value)  || 0;
  const math  = parseInt(document.getElementById("mockMath")?.value)  || 0;
  const total = parseInt(document.getElementById("mockTotal")?.value) || (phy + chem + math);
  const neg   = parseInt(document.getElementById("mockNeg")?.value)   || 0;
  const acc   = parseInt(document.getElementById("mockAcc")?.value)   || 0;
  const notes = document.getElementById("mockNotes")?.value?.trim()   || "";

  if (!name || !date) { showToast("Please fill in test name and date.", "warning"); return; }
  if (!appState.mocks) appState.mocks = [];
  appState.mocks.push({ id: Date.now(), name, date, phy, chem, math, score: total, total: 300, neg, accuracy: acc, notes });
  ["mockName","mockDate","mockPhy","mockChem","mockMath","mockTotal","mockNeg","mockAcc","mockNotes"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  saveState(); updateCharts();
  showToast("Mock result saved! 📊", "success");
}

function deleteMock(id) {
  appState.mocks = (appState.mocks || []).filter(m => m.id !== id);
  saveState(); updateCharts();
}

function renderMockInsights() {
  const el    = document.getElementById("mockInsights");
  if (!el) return;
  const mocks = appState.mocks || [];
  if (!mocks.length) { el.innerHTML = ""; return; }

  const sorted   = [...mocks].sort((a, b) => a.date.localeCompare(b.date));
  const best     = Math.max(...mocks.map(m => m.score));
  const avg      = Math.round(mocks.reduce((s, m) => s + m.score, 0) / mocks.length);
  const last     = sorted[sorted.length - 1];
  const prev     = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const delta    = prev ? last.score - prev.score : null;
  const target   = appState.targetMockScore || 250;
  const gap      = target - last.score;

  // Weakest subject across all mocks
  const phyAvg  = Math.round(mocks.reduce((s, m) => s + (m.phy || 0),  0) / mocks.length);
  const chemAvg = Math.round(mocks.reduce((s, m) => s + (m.chem || 0), 0) / mocks.length);
  const mathAvg = Math.round(mocks.reduce((s, m) => s + (m.math || 0), 0) / mocks.length);
  const weakSubject = phyAvg <= chemAvg && phyAvg <= mathAvg ? "Physics"
                    : chemAvg <= phyAvg && chemAvg <= mathAvg ? "Chemistry"
                    : "Mathematics";

  el.innerHTML = `
    <div class="mock-insights-inner">
      <div class="mock-insight-card">
        <span class="mock-insight-val accent">${best}/300</span>
        <span class="mock-insight-lbl">Best Score</span>
      </div>
      <div class="mock-insight-card">
        <span class="mock-insight-val">${avg}/300</span>
        <span class="mock-insight-lbl">Average Score</span>
      </div>
      <div class="mock-insight-card">
        <span class="mock-insight-val ${delta !== null ? (delta >= 0 ? "green" : "rose") : ""}">${delta !== null ? (delta >= 0 ? `+${delta}` : delta) : "—"}</span>
        <span class="mock-insight-lbl">Last vs Prev</span>
      </div>
      <div class="mock-insight-card">
        <span class="mock-insight-val ${gap <= 0 ? "green" : "amber"}">${gap <= 0 ? "🎯 Target Hit!" : `–${gap} to go`}</span>
        <span class="mock-insight-lbl">Gap to Target (${target})</span>
      </div>
      <div class="mock-insight-card">
        <span class="mock-insight-val rose">${weakSubject}</span>
        <span class="mock-insight-lbl">Focus Area</span>
      </div>
    </div>
  `;
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
    li.innerHTML = `
      <div class="mock-item-header">
        <span class="mock-name">${escapeHtml(m.name)}</span>
        <span class="mock-date">${m.date}</span>
      </div>
      <div class="mock-scores">
        <span class="mock-score-chip">PHY <strong>${m.phy || 0}</strong></span>
        <span class="mock-score-chip">CHEM <strong>${m.chem || 0}</strong></span>
        <span class="mock-score-chip">MATH <strong>${m.math || 0}</strong></span>
        <span class="mock-score-chip accent">TOTAL <strong>${m.score}/300</strong></span>
        <span class="mock-score-chip">ACC <strong>${m.accuracy || 0}%</strong></span>
        <span class="mock-score-chip rose">–ve <strong>${m.neg || 0}</strong></span>
      </div>
      ${m.notes ? `<p class="mock-reflection">${escapeHtml(m.notes)}</p>` : ""}
      <button class="btn btn-ghost btn-xs danger mt-1" onclick="deleteMock(${m.id})" aria-label="Delete ${escapeHtml(m.name)}">Delete</button>
    `;
    list.appendChild(li);
  });
  renderMockInsights();
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════
document.getElementById("btnSaveSettings")?.addEventListener("click", () => {
  appState.targetExamDate      = document.getElementById("settingExamDate")?.value   || "";
  appState.examName            = document.getElementById("settingExamName")?.value?.trim() || "";
  appState.dailyFocusGoalHours = parseFloat(document.getElementById("settingDailyGoal")?.value)  || 5;
  appState.dailySubjectGoal    = parseInt(document.getElementById("settingDailyQGoal")?.value)   || 20;
  appState.totalQuestionGoal   = parseInt(document.getElementById("settingTotalQGoal")?.value)   || 3000;
  appState.targetMockScore     = parseInt(document.getElementById("settingTargetScore")?.value)  || 250;
  saveState();
  showToast("Settings saved.", "success", 2500);
});

function renderSettings() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
  set("settingExamDate",   appState.targetExamDate    || "");
  set("settingExamName",   appState.examName          || "");
  set("settingDailyGoal",  appState.dailyFocusGoalHours || 5);
  set("settingDailyQGoal", appState.dailySubjectGoal  || 20);
  set("settingTotalQGoal", appState.totalQuestionGoal || 3000);
  set("settingTargetScore",appState.targetMockScore   || 250);
}

// Clear / Export / Import
document.getElementById("btnClearData")?.addEventListener("click", async () => {
  const ok = await showConfirm("This will permanently delete ALL your study data — streaks, tasks, mistakes, mocks, notes, and syllabus. Cannot be undone.", "⚠ Clear All Data?");
  if (ok) { localStorage.removeItem(STORAGE_KEY); appState = { ...defaultState }; saveState(); showToast("All data cleared.", "info"); }
});

document.getElementById("btnExportData")?.addEventListener("click", () => {
  if (isDemoMode) { showToast("Exit sample data mode first.", "warning"); return; }
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `calibre-backup-${todayDateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported! 💾", "success");
});

document.getElementById("importFileInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const ok = await showConfirm("Importing will overwrite your current data. Continue?", "Import Backup");
  if (!ok) { e.target.value = ""; return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (typeof imported !== "object" || !imported.streak) throw new Error("Not a valid Calibre backup.");
      appState = { ...defaultState, ...imported };
      saveState();
      showToast("Backup imported! ✅", "success", 5000);
    } catch (err) { showToast(`Import failed: ${err.message}`, "error", 6000); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ═══════════════════════════════════════════════════════════════
//  AMBIENT NOISE
// ═══════════════════════════════════════════════════════════════
let audioCtx = null, noiseNode = null, noiseGain = null, isAudioPlaying = false;
const btnToggleNoise  = document.getElementById("btnToggleNoise");
const audioNoiseType  = document.getElementById("audioNoiseType");
const noiseVolumeEl   = document.getElementById("noiseVolume");
const noiseVolumeLabel = document.getElementById("noiseVolumeLabel");

noiseVolumeEl?.addEventListener("input", () => {
  const vol = parseInt(noiseVolumeEl.value);
  if (noiseVolumeLabel) noiseVolumeLabel.textContent = `${vol}%`;
  if (noiseGain) noiseGain.gain.setTargetAtTime(vol / 1000, audioCtx.currentTime, 0.1);
});

function createNoiseBuffer(type) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const buf  = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    if (type === "brown") { data[i] = (last + 0.02 * w) / 1.02; last = data[i]; data[i] *= 3.5; }
    else                  { data[i] = (last + 0.05 * w) / 1.05; last = data[i]; data[i] *= 2.0; }
  }
  return buf;
}

function startAudioNoise() {
  const type = audioNoiseType?.value;
  if (type === "none") return stopAudioNoise();
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try { noiseNode?.stop(); } catch (_) {}
  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = parseInt(noiseVolumeEl?.value || 15) / 1000;
  noiseGain.connect(audioCtx.destination);
  noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = createNoiseBuffer(type);
  noiseNode.loop   = true;
  noiseNode.connect(noiseGain);
  noiseNode.start();
  isAudioPlaying = true;
  if (btnToggleNoise) btnToggleNoise.textContent = "Stop";
}

function stopAudioNoise() {
  try { noiseNode?.stop(); } catch (_) {}
  noiseNode = null;
  isAudioPlaying = false;
  if (btnToggleNoise) btnToggleNoise.textContent = "Play";
}

btnToggleNoise?.addEventListener("click",  () => { isAudioPlaying ? stopAudioNoise() : startAudioNoise(); });
audioNoiseType?.addEventListener("change", () => { if (isAudioPlaying) startAudioNoise(); });

// ═══════════════════════════════════════════════════════════════
//  STATS RIBBON
// ═══════════════════════════════════════════════════════════════
function renderTopStats() {
  const s = appState;

  // Streak
  const streakEl    = document.getElementById("topStreak");
  const streakSubEl = document.getElementById("topStreakSub");
  if (streakEl) streakEl.textContent = `${s.streak} ${s.streak === 1 ? "Day" : "Days"}`;
  if (streakSubEl) {
    const msg = s.streak >= 30 ? "🔥 On fire!" : s.streak >= 14 ? "⚡ Great momentum" : s.streak >= 7 ? "💪 One week strong" : "Keep going →";
    streakSubEl.textContent = msg;
  }

  // Focus time
  const hours = ((s.focusMinutesToday || 0) / 60).toFixed(1);
  const goal  = s.dailyFocusGoalHours || 5;
  const pct   = Math.min(100, Math.round(((s.focusMinutesToday || 0) / (goal * 60)) * 100));
  const el1   = document.getElementById("topFocusTime");
  const el2   = document.getElementById("topFocusSub");
  if (el1) el1.textContent = `${hours}h`;
  if (el2) el2.textContent = `${pct}% of ${goal}h goal`;

  // Questions today
  const totalQ  = Object.values(s.subjects || {}).reduce((a, sub) => a + (sub.solved || 0), 0);
  const qTarget = Object.values(s.subjects || {}).reduce((a, sub) => a + (sub.target || 0), 0);
  const el3     = document.getElementById("topQuestionsToday");
  const el4     = document.getElementById("topQSub");
  if (el3) el3.textContent = totalQ;
  if (el4) el4.textContent = `Goal: ${qTarget} across all subjects`;

  // Exam countdown
  const cdEl  = document.getElementById("topCountdown");
  const prEl  = document.getElementById("topPaceRequired");
  if (s.targetExamDate) {
    const diff = Math.ceil((new Date(s.targetExamDate) - new Date()) / 86400000);
    if (cdEl) cdEl.textContent = diff > 0 ? `${diff} Days` : "Exam Day! 🎯";
    const name = s.examName || "";
    if (prEl) prEl.textContent = name || (diff > 0 ? `${Math.ceil(diff / 7)} weeks left` : "Best of luck!");
  } else {
    if (cdEl) cdEl.textContent = "-- Days";
    if (prEl) prEl.textContent = "Set exam date in Settings →";
  }
}

// ═══════════════════════════════════════════════════════════════
//  SUBJECT PROGRESS (Focus tab)
// ═══════════════════════════════════════════════════════════════
function renderSubjectProgress() {
  const container = document.getElementById("subjectProgressList");
  const sub       = document.getElementById("subjectProgressSub");
  if (!container) return;
  container.innerHTML = "";
  const subjects = appState.subjects || {};
  const total = Object.values(subjects).reduce((a, s) => a + (s.solved || 0), 0);
  const tgt   = Object.values(subjects).reduce((a, s) => a + (s.target || 0), 0);
  if (sub) sub.textContent = `${total}/${tgt} questions`;

  Object.entries(subjects).forEach(([name, data]) => {
    const pct = data.target > 0 ? Math.min(100, Math.round((data.solved / data.target) * 100)) : 0;
    const acc = data.solved > 0 ? Math.round((data.correct / data.solved) * 100) : 0;
    const row = document.createElement("div");
    row.className = "subject-progress-row";
    row.innerHTML = `
      <span class="subject-progress-name">${escapeHtml(name)}</span>
      <div class="progress-bar-wrap small" role="progressbar" aria-valuenow="${data.solved}" aria-valuemin="0" aria-valuemax="${data.target}">
        <div class="progress-bar ${pct>=100?"progress-bar-done":""}" style="width:${pct}%"></div>
      </div>
      <span class="subject-progress-stat">${data.solved}/${data.target} · <span class="${acc>=80?"accent":acc>=60?"text-amber":"text-rose"}">${acc}%</span></span>
    `;
    container.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════════
//  COMPLETED BLOCKS & SESSION STATS
// ═══════════════════════════════════════════════════════════════
function renderCompletedBlocks() {
  const el = document.getElementById("completedBlocksList");
  if (!el) return;
  const blocks = appState.completedBlocks || [];
  if (!blocks.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="blocks-label">Today's sprints:</div>` +
    blocks.map(b => `<span class="block-chip">${escapeHtml(b)}</span>`).join("");

  const sessions = blocks.length;
  const sEl = document.getElementById("sessionsToday");
  const tEl = document.getElementById("sessionsTotalTime");
  if (sEl) sEl.textContent = sessions;
  if (tEl) tEl.textContent = `${appState.focusMinutesToday || 0}m`;
}

// ═══════════════════════════════════════════════════════════════
//  HEATMAP
// ═══════════════════════════════════════════════════════════════
function renderHeatmap() {
  const grid = document.getElementById("heatmapGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const history = appState.dailyHistory || {};
  const days    = 35;
  const today   = new Date();

  ["Mo","Tu","We","Th","Fr","Sa","Su"].forEach(d => {
    const lbl = document.createElement("div");
    lbl.className = "heatmap-day-label"; lbl.textContent = d;
    lbl.setAttribute("aria-hidden", "true");
    grid.appendChild(lbl);
  });

  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(today); d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    const mins = history[iso] || 0;
    const level = mins === 0 ? 0 : mins < 60 ? 1 : mins < 120 ? 2 : mins < 200 ? 3 : 4;
    const cell  = document.createElement("div");
    cell.className = `heatmap-cell level-${level}`;
    cell.title = `${iso}: ${mins ? Math.round(mins) + "m studied" : "No study"}`;
    cell.setAttribute("aria-label", cell.title);
    grid.appendChild(cell);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CHARTS
// ═══════════════════════════════════════════════════════════════
let focusChartInst = null;
let mockChartInst  = null;
let mockSubjectChartInst = null;
let subjectAccChartInst  = null;

function initCharts() {
  const fcCanvas  = document.getElementById("focusChart");
  const mcCanvas  = document.getElementById("mockChart");
  const mscCanvas = document.getElementById("mockSubjectChart");
  const sacCanvas = document.getElementById("subjectAccuracyChart");

  if (fcCanvas && !focusChartInst) {
    focusChartInst = new Chart(fcCanvas, {
      type: "bar",
      data: {
        labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
        datasets: [{
          label: "Focus (hrs)", data: [0,0,0,0,0,0,0],
          backgroundColor: "rgba(56,189,248,0.35)", borderColor: "#38bdf8",
          borderWidth: 2, borderRadius: 4
        }]
      },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 12, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } }
        }
      }
    });
  }

  if (mcCanvas && !mockChartInst) {
    mockChartInst = new Chart(mcCanvas, {
      type: "line",
      data: {
        labels: [], datasets: [{
          label: "Score /300", data: [],
          borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.12)",
          tension: 0.4, pointBackgroundColor: "#10b981", fill: true, pointRadius: 5
        }, {
          label: "Target", data: [],
          borderColor: "#f59e0b", borderDash: [5, 5],
          borderWidth: 1.5, pointRadius: 0, fill: false
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true, labels: { color: "#94a3b8", font: { family: "Inter" } } } },
        scales: {
          y: { min: 0, max: 300, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { ticks: { color: "#94a3b8", maxRotation: 30 }, grid: { display: false } }
        }
      }
    });
  }

  if (mscCanvas && !mockSubjectChartInst) {
    mockSubjectChartInst = new Chart(mscCanvas, {
      type: "bar",
      data: {
        labels: [], datasets: [
          { label: "Physics",     data: [], backgroundColor: "rgba(56,189,248,0.6)",  borderColor: "#38bdf8", borderWidth: 1.5, borderRadius: 3 },
          { label: "Chemistry",   data: [], backgroundColor: "rgba(167,139,250,0.6)", borderColor: "#a78bfa", borderWidth: 1.5, borderRadius: 3 },
          { label: "Mathematics", data: [], backgroundColor: "rgba(16,185,129,0.6)",  borderColor: "#10b981", borderWidth: 1.5, borderRadius: 3 }
        ]
      },
      options: {
        responsive: true, plugins: { legend: { labels: { color: "#94a3b8" } } },
        scales: {
          y: { min: 0, max: 120, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } },
          x: { ticks: { color: "#94a3b8", maxRotation: 30 }, grid: { display: false } }
        }
      }
    });
  }

  if (sacCanvas && !subjectAccChartInst) {
    subjectAccChartInst = new Chart(sacCanvas, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [{ data: [], backgroundColor: ["rgba(56,189,248,0.7)","rgba(167,139,250,0.7)","rgba(16,185,129,0.7)","rgba(245,158,11,0.7)"], borderWidth: 0 }]
      },
      options: {
        responsive: true, cutout: "60%",
        plugins: { legend: { position: "right", labels: { color: "#94a3b8", font: { family: "Inter" } } } }
      }
    });
  }
}

function updateCharts() {
  if (!focusChartInst) { initCharts(); return; }

  focusChartInst.data.datasets[0].data = appState.weeklyFocusVolume || [0,0,0,0,0,0,0];
  focusChartInst.update("none");

  if (mockChartInst) {
    const mocks   = [...(appState.mocks || [])].sort((a, b) => a.date.localeCompare(b.date));
    const target  = appState.targetMockScore || 250;
    mockChartInst.data.labels               = mocks.map(m => m.date);
    mockChartInst.data.datasets[0].data     = mocks.map(m => m.score);
    mockChartInst.data.datasets[1].data     = mocks.map(() => target);
    mockChartInst.update("none");
  }

  if (mockSubjectChartInst) {
    const mocks = [...(appState.mocks || [])].sort((a, b) => a.date.localeCompare(b.date));
    mockSubjectChartInst.data.labels              = mocks.map(m => m.date);
    mockSubjectChartInst.data.datasets[0].data    = mocks.map(m => m.phy  || 0);
    mockSubjectChartInst.data.datasets[1].data    = mocks.map(m => m.chem || 0);
    mockSubjectChartInst.data.datasets[2].data    = mocks.map(m => m.math || 0);
    mockSubjectChartInst.update("none");
  }

  if (subjectAccChartInst) {
    const subjects = appState.subjects || {};
    subjectAccChartInst.data.labels            = Object.keys(subjects);
    subjectAccChartInst.data.datasets[0].data  = Object.values(subjects).map(s => s.solved || 0);
    subjectAccChartInst.update("none");
  }
}

// ═══════════════════════════════════════════════════════════════
//  PACE ALERT BANNER
// ═══════════════════════════════════════════════════════════════
let paceBannerDismissed = false;

function checkPaceAlert() {
  if (paceBannerDismissed || isDemoMode) return;
  const hour    = new Date().getHours();
  if (hour < 20) return;
  const goalMins = (appState.dailyFocusGoalHours || 5) * 60;
  const doneMins = appState.focusMinutesToday || 0;
  const pct      = goalMins > 0 ? (doneMins / goalMins) * 100 : 100;
  const banner   = document.getElementById("paceBanner");
  const text     = document.getElementById("paceBannerText");
  if (pct < 50) {
    if (text) text.textContent = `⏰ Evening check-in: ${Math.round(pct)}% of your ${appState.dailyFocusGoalHours}h goal done. A short sprint now keeps your streak alive!`;
    if (banner) banner.classList.remove("hidden");
  } else {
    if (banner) banner.classList.add("hidden");
  }
}

function dismissPaceBanner() { paceBannerDismissed = true; document.getElementById("paceBanner")?.classList.add("hidden"); }

setInterval(checkPaceAlert, 60 * 1000);

// ═══════════════════════════════════════════════════════════════
//  RENDER ALL
// ═══════════════════════════════════════════════════════════════
function renderAll() {
  renderTopStats();
  renderDailyPlan();
  renderTasks();
  renderSubjectProgress();
  renderCompletedBlocks();
  renderHeatmap();
  renderPractice();
  renderSyllabus();
  renderMistakes();
  renderMocks();
  renderReview();
  renderSessionLog();
  renderSettings();
  checkPaceAlert();
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initSyllabusState();
  renderAll();
  initCharts();
  updateCharts();
  checkOnboarding();
  checkPaceAlert();
  showQuote();

  // Show a random quote each time Focus tab becomes active
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === "dashboard") showQuote();
    });
  });
});
