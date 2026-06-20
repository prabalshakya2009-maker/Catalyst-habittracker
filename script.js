document.addEventListener("DOMContentLoaded", () => {
    
    const todayString = new Date().toDateString(); 
    
    const defaultState = {
        xp: 0, level: 1, streak: 0, discipline: 0, 
        focusLog: [], class11Completed: 0, errorLogs: [],
        backlogItems: [], pyqCounts: { physics: 0, chemistry: 0, maths: 0 },
        subjectMastery: [0, 0, 0, 0, 0], weeklyHours: [0, 0, 0, 0, 0, 0, 0], 
        lastLoginDate: todayString,
        weeklyXP: 0, monthlyXP: 0, history: [], // NEW V10 Analytics Engine
        config: {
            exam: 'JEE', metric: 'AIR',
            sub1: 'Physics', sub2: 'Physical Chem', sub3: 'Organic Chem', sub4: 'Inorganic Chem', sub5: 'Algebra',
            goal1: 'Class 11 Syllabus', goal2: 'Class 12 Syllabus', goal3: 'Mock Test Accuracy'
        },
        directives: {
            morning: [{ id: 1, text: "Wake Up & Hydrate", xp: 10, completed: false }, { id: 2, text: "Deep Work Session 1", xp: 30, completed: false }],
            afternoon: [{ id: 3, text: "Deep Work Session 2", xp: 40, completed: false }],
            evening: [{ id: 4, text: "Plan Tomorrow & Sleep", xp: 20, completed: false }]
        }
    };

    let userData = JSON.parse(localStorage.getItem('jeeNexusData_v10'));
    
    if (!userData) {
        let oldData = JSON.parse(localStorage.getItem('jeeNexusData_v9')) || JSON.parse(localStorage.getItem('jeeNexusData_v8'));
        if (oldData) {
            userData = oldData;
            userData.weeklyXP = userData.weeklyXP || 0;
            userData.monthlyXP = userData.monthlyXP || 0;
            userData.history = userData.history || [];
            localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
        } else {
            userData = defaultState;
        }
    }

    // --- MIDNIGHT RESET & STREAK CALCULATOR ---
    if (userData.lastLoginDate !== todayString) {
        let todayDate = new Date();
        let lastDate = new Date(userData.lastLoginDate);

        // Smart Streak Logic: Did you get >70% Discipline yesterday?
        if (userData.discipline >= 70) {
            userData.streak++;
        } else {
            userData.streak = 0; // The fire burns out if you slack!
        }

        // Save 7-Day History
        userData.history.push({ date: userData.lastLoginDate, discipline: userData.discipline });
        if (userData.history.length > 7) userData.history.shift();

        // Check if we need to reset Weekly/Monthly XP
        if (todayDate.getDay() === 1 && lastDate.getDay() !== 1) userData.weeklyXP = 0; // Resets on Monday
        if (todayDate.getMonth() !== lastDate.getMonth()) userData.monthlyXP = 0; // Resets on 1st of Month

        userData.focusLog = []; 
        userData.lastLoginDate = todayString;
        
        if(userData.directives) {
            Object.keys(userData.directives).forEach(block => {
                userData.directives[block].forEach(task => task.completed = false);
            });
        }
        calculateDisciplineScore();
        localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
    }

    // --- DYNAMIC DIRECTIVES ENGINE ---
    function renderDirectives() {
        ['morning', 'afternoon', 'evening'].forEach(block => {
            const container = document.getElementById(`list-container-${block}`);
            if (!container) return;
            container.innerHTML = '';

            if (userData.directives[block].length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; padding: 5px 0;">No directives listed. Click + to add.</p>`;
                return;
            }

            userData.directives[block].forEach(task => {
                const row = document.createElement('div');
                row.className = 'directive-row';
                row.innerHTML = `
                    <label class="custom-checkbox">
                        <input type="checkbox" class="directive-checkbox" data-block="${block}" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        <span class="${task.completed ? 'completed-task-text' : ''}">${task.text} <span style="color:var(--primary-neon); font-size:0.7rem;">(+${task.xp}XP)</span></span>
                    </label>
                    <button class="task-delete-btn" data-block="${block}" data-id="${task.id}"><i class="fa-solid fa-trash-can"></i></button>
                `;
                container.appendChild(row);
            });
        });
        setupDirectiveListeners();
        calculateDisciplineScore();
    }

    function addGlobalXP(amount) {
        userData.xp += amount;
        userData.weeklyXP += amount;
        userData.monthlyXP += amount;
        if (userData.xp < 0) userData.xp = 0;
        if (userData.weeklyXP < 0) userData.weeklyXP = 0;
        if (userData.monthlyXP < 0) userData.monthlyXP = 0;
    }

    function setupDirectiveListeners() {
        document.querySelectorAll('.directive-checkbox').forEach(box => {
            box.addEventListener('change', (e) => {
                const block = e.target.getAttribute('data-block');
                const id = parseInt(e.target.getAttribute('data-id'));
                const task = userData.directives[block].find(t => t.id === id);

                if (task) {
                    task.completed = e.target.checked;
                    if (task.completed) {
                        addGlobalXP(task.xp);
                    } else {
                        addGlobalXP(-task.xp);
                    }
                    if (userData.xp >= (userData.level * 1000)) { 
                        userData.level++; alert(`🔥 Level Up! You are now Level ${userData.level}`); 
                    }
                    calculateDisciplineScore();
                    updateUI();
                    renderDirectives();
                }
            });
        });

        document.querySelectorAll('.task-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const block = button.getAttribute('data-block');
                const id = parseInt(button.getAttribute('data-id'));
                
                const taskIndex = userData.directives[block].findIndex(t => t.id === id);
                if (taskIndex !== -1) {
                    const task = userData.directives[block][taskIndex];
                    if (task.completed) addGlobalXP(-task.xp);
                    userData.directives[block].splice(taskIndex, 1);
                    calculateDisciplineScore();
                    updateUI();
                    renderDirectives();
                }
            });
        });
    }

    function calculateDisciplineScore() {
        let total = 0, completed = 0;
        ['morning', 'afternoon', 'evening'].forEach(block => {
            total += userData.directives[block].length;
            completed += userData.directives[block].filter(t => t.completed).length;
        });
        userData.discipline = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (document.getElementById('disciplineScore')) document.getElementById('disciplineScore').innerText = `${userData.discipline}%`;
        localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
    }

    document.querySelectorAll('.task-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const block = e.currentTarget.getAttribute('data-block');
            const textInput = document.getElementById(`input-text-${block}`);
            const xpInput = document.getElementById(`input-xp-${block}`);

            if (!textInput || !textInput.value.trim()) return alert('Enter a valid task description!');

            userData.directives[block].push({
                id: Date.now() + Math.floor(Math.random() * 1000), 
                text: textInput.value.trim(), xp: parseInt(xpInput.value) || 20, completed: false
            });
            textInput.value = ''; 
            renderDirectives();
            localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
            updateUI();
        });
    });

    // --- UNIVERSAL SETTINGS ENGINE ---
    function applyConfig() {
        const c = userData.config;
        if(document.getElementById('displayExamTitle')) document.getElementById('displayExamTitle').innerText = c.exam;
        if(document.getElementById('displayMetricPrefix')) document.getElementById('displayMetricPrefix').innerText = c.metric;
        if(document.getElementById('displayGoal1')) document.getElementById('displayGoal1').innerText = c.goal1;
        if(document.getElementById('displayGoal2')) document.getElementById('displayGoal2').innerText = c.goal2;
        if(document.getElementById('displayGoal3')) document.getElementById('displayGoal3').innerText = c.goal3;
        
        for(let i=0; i<5; i++) {
            if(document.getElementById(`mastLabel${i}`)) document.getElementById(`mastLabel${i}`).innerText = c[`sub${i+1}`];
            if(document.getElementById(`pyqTitle${i}`)) document.getElementById(`pyqTitle${i}`).innerText = c[`sub${i+1}`] + " Qs";
        }

        if(window.radarChartInstance) {
            window.radarChartInstance.data.labels = [c.sub1, c.sub2, c.sub3, c.sub4, c.sub5];
            window.radarChartInstance.update();
        }

        ['Exam', 'Metric', 'Goal1', 'Goal2', 'Goal3', 'Sub1', 'Sub2', 'Sub3', 'Sub4', 'Sub5'].forEach(key => {
            if(document.getElementById(`conf${key}`)) document.getElementById(`conf${key}`).value = c[key.toLowerCase()];
        });
    }

    if(document.getElementById('saveConfigBtn')) {
        document.getElementById('saveConfigBtn').addEventListener('click', () => {
            userData.config = {
                exam: document.getElementById('confExam').value || 'Target Exam', metric: document.getElementById('confMetric').value || 'Score',
                goal1: document.getElementById('confGoal1').value || 'Phase 1', goal2: document.getElementById('confGoal2').value || 'Phase 2', goal3: document.getElementById('confGoal3').value || 'Phase 3',
                sub1: document.getElementById('confSub1').value || 'Subject 1', sub2: document.getElementById('confSub2').value || 'Subject 2',
                sub3: document.getElementById('confSub3').value || 'Subject 3', sub4: document.getElementById('confSub4').value || 'Subject 4', sub5: document.getElementById('confSub5').value || 'Subject 5',
            };
            localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
            applyConfig(); alert("Settings applied globally!");
        });
    }

    function updateUI() {
        if(document.getElementById('xpDisplay')) document.getElementById('xpDisplay').innerText = userData.xp;
        if(document.getElementById('levelDisplay')) document.getElementById('levelDisplay').innerText = userData.level;
        if(document.getElementById('streakDisplay')) document.getElementById('streakDisplay').innerText = `${userData.streak} Days`;
        if(document.getElementById('disciplineScore')) document.getElementById('disciplineScore').innerText = `${userData.discipline}%`;
        if(document.getElementById('xpBar')) document.getElementById('xpBar').style.width = `${(userData.xp % 1000) / 10}%`;
        
        // V10 Success Metrics Update
        if(document.getElementById('weeklyXpDisplay')) document.getElementById('weeklyXpDisplay').innerText = userData.weeklyXP;
        if(document.getElementById('monthlyXpDisplay')) document.getElementById('monthlyXpDisplay').innerText = userData.monthlyXP;
        
        let avgDiscipline = 0;
        if(userData.history && userData.history.length > 0) {
            let sum = userData.history.reduce((a, b) => a + b.discipline, 0);
            avgDiscipline = Math.round(sum / userData.history.length);
        }
        if(document.getElementById('avgDisciplineDisplay')) document.getElementById('avgDisciplineDisplay').innerText = `${avgDiscipline}%`;

        let estimatedRank = 900000 - (userData.xp * 15) - (userData.discipline * 3000) - (userData.streak * 8000);
        if (estimatedRank < 1) estimatedRank = 1;
        if(document.getElementById('predictedRankDisplay')) document.getElementById('predictedRankDisplay').innerText = Math.floor(estimatedRank).toLocaleString();
        
        localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
    }

    // --- MILESTONE PROGRESS ---
    function updateClass11Progress() {
        const chapCount11 = document.getElementById('chapCount11');
        const progBar11 = document.getElementById('progBar11');
        if (!chapCount11 || !progBar11) return;
        let percentage = Math.round((userData.class11Completed / 40) * 100);
        chapCount11.innerText = `${userData.class11Completed} / 40 Ch`;
        progBar11.style.width = `${percentage}%`; progBar11.innerText = `${percentage}%`;
    }

    if(document.getElementById('addChap11')) document.getElementById('addChap11').addEventListener('click', () => { if (userData.class11Completed < 40) { userData.class11Completed++; updateClass11Progress(); localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); } });
    if(document.getElementById('subChap11')) document.getElementById('subChap11').addEventListener('click', () => { if (userData.class11Completed > 0) { userData.class11Completed--; updateClass11Progress(); localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));} });
    updateClass11Progress();

    // --- POMODORO TIMER ---
    const blockSelector = document.getElementById('blockSelector');
    const timerDisplay = document.getElementById('timer');
    const startBtn = document.getElementById('startTimer');
    const resetBtn = document.getElementById('resetTimer');
    const logContainer = document.getElementById('sessionLog');
    
    let selectedMinutes = blockSelector ? parseInt(blockSelector.value) : 120;
    let timeLeft = selectedMinutes * 60; 
    let timerInterval; let isRunning = false;

    function updateTimerDisplay() { if(timerDisplay) timerDisplay.innerText = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`; }

    function renderFocusLog() {
        if(!logContainer) return;
        logContainer.innerHTML = '';
        if (!userData.focusLog || userData.focusLog.length === 0) logContainer.innerHTML = '<li style="color: var(--text-muted);">No sessions logged today.</li>';
        else userData.focusLog.forEach(log => { const li = document.createElement('li'); li.innerHTML = `<span><i class="fa-solid fa-check"></i> ${log.duration} min Block</span> <span>${log.time}</span>`; logContainer.appendChild(li); });
    }

    if(blockSelector) blockSelector.addEventListener('change', (e) => { if (!isRunning) { selectedMinutes = parseInt(e.target.value); timeLeft = selectedMinutes * 60; updateTimerDisplay(); } });

    if(startBtn) startBtn.addEventListener('click', () => {
        if (!isRunning) {
            isRunning = true; if(blockSelector) blockSelector.disabled = true; 
            startBtn.innerText = "Pause"; startBtn.classList.replace('primary-btn', 'secondary-btn');
            timerInterval = setInterval(() => {
                if (timeLeft > 0) { timeLeft--; updateTimerDisplay(); } 
                else {
                    clearInterval(timerInterval); isRunning = false; if(blockSelector) blockSelector.disabled = false;
                    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    if(!userData.focusLog) userData.focusLog = [];
                    userData.focusLog.push({ duration: selectedMinutes, time: timeString });
                    localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
                    renderFocusLog(); alert(`Block complete!`);
                    timeLeft = selectedMinutes * 60; startBtn.innerText = "Start Focus"; startBtn.classList.replace('secondary-btn', 'primary-btn'); updateTimerDisplay();
                }
            }, 1000);
        } else {
            clearInterval(timerInterval); isRunning = false; if(blockSelector) blockSelector.disabled = false;
            startBtn.innerText = "Resume"; startBtn.classList.replace('secondary-btn', 'primary-btn');
        }
    });

    if(resetBtn) resetBtn.addEventListener('click', () => {
        clearInterval(timerInterval); isRunning = false; if(blockSelector) blockSelector.disabled = false;
        timeLeft = selectedMinutes * 60; updateTimerDisplay();
        if(startBtn) { startBtn.innerText = "Start Focus"; startBtn.classList.replace('secondary-btn', 'primary-btn'); }
    });

    updateTimerDisplay(); renderFocusLog();

    // --- TRACKER: ERROR LOG ---
    const errorLogTableBody = document.getElementById('errorLogTableBody');
    function renderErrorLog() {
        if(!errorLogTableBody) return;
        errorLogTableBody.innerHTML = '';
        if (userData.errorLogs.length === 0) { errorLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No errors logged yet. Flawless execution.</td></tr>`; return; }
        userData.errorLogs.forEach((err, index) => {
            const tr = document.createElement('tr'); tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            let badgeColor = err.type === 'Conceptual Gap' ? '#ff4a5a' : (err.type === 'Memory/Fact Forgotten' ? '#00f2fe' : '#ffc107'); 
            tr.innerHTML = `<td style="padding: 0.8rem; font-weight: bold;">${err.chapter}</td><td style="padding: 0.8rem;"><span style="color: ${badgeColor}; font-size: 0.8rem; border: 1px solid ${badgeColor}; padding: 2px 6px; border-radius: 4px;">${err.type}</span></td><td style="padding: 0.8rem; color: #e0e0e0;">${err.note}</td><td style="padding: 0.8rem; text-align: center;"><button class="delete-err-btn" data-index="${index}" style="background: transparent; border: none; color: #ff4a5a; cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button></td>`;
            errorLogTableBody.appendChild(tr);
        });
        document.querySelectorAll('.delete-err-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { userData.errorLogs.splice(parseInt(e.currentTarget.getAttribute('data-index')), 1); localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); renderErrorLog(); });
        });
    }

    if(document.getElementById('addErrorBtn')) document.getElementById('addErrorBtn').addEventListener('click', () => {
        const errChap = document.getElementById('errChap'); const errNote = document.getElementById('errNote'); const errType = document.getElementById('errType');
        if (!errChap.value.trim() || !errNote.value.trim()) return alert('Fill out Topic and Correction note!');
        userData.errorLogs.push({ chapter: errChap.value.trim(), type: errType.value, note: errNote.value.trim() });
        addGlobalXP(50); localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData));
        errChap.value = ''; errNote.value = ''; renderErrorLog(); updateUI();
    });
    renderErrorLog();

    // --- TRACKER: BACKLOG BOUNTY ---
    const backlogList = document.getElementById('backlogList');
    function renderBacklogs() {
        if(!backlogList) return;
        backlogList.innerHTML = '';
        if (!userData.backlogItems || userData.backlogItems.length === 0) { backlogList.innerHTML = '<li style="color: var(--text-muted);">No backlogs! You are perfectly on schedule.</li>'; return; }
        userData.backlogItems.forEach((item, index) => {
            const li = document.createElement('li'); li.style.justifyContent = 'space-between';
            li.innerHTML = `<span>${item.topic} <span style="color: var(--warning); font-size: 0.7rem; margin-left: 10px;">[${item.xp} XP]</span></span><button class="claim-bounty-btn" data-index="${index}" style="background: var(--success); color: #000; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: bold;">Claim</button>`;
            backlogList.appendChild(li);
        });
        document.querySelectorAll('.claim-bounty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                addGlobalXP(parseInt(userData.backlogItems.splice(parseInt(e.currentTarget.getAttribute('data-index')), 1)[0].xp));
                localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); renderBacklogs(); updateUI();
            });
        });
    }

    if(document.getElementById('addBacklogBtn')) document.getElementById('addBacklogBtn').addEventListener('click', () => {
        const backlogInput = document.getElementById('backlogInput'); const backlogXP = document.getElementById('backlogXP');
        if (!backlogInput.value.trim()) return;
        userData.backlogItems.push({ topic: backlogInput.value.trim(), xp: backlogXP.value || 100 });
        localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); backlogInput.value = ''; renderBacklogs();
    });
    renderBacklogs();

    // --- TRACKER: PYQ TARGETER ---
    function updatePYQ() {
        ['physics', 'chemistry', 'maths'].forEach(sub => {
            const countSpan = document.getElementById(`pyqCount${sub}`); const bar = document.getElementById(`pyqBar${sub}`);
            if (countSpan && bar) {
                let percent = Math.min(Math.round(((userData.pyqCounts[sub] || 0) / 300) * 100), 100);
                countSpan.innerText = `${userData.pyqCounts[sub] || 0} / 300 Qs`; bar.style.width = `${percent}%`; bar.innerText = `${percent}%`;
            }
        });
    }

    document.querySelectorAll('.pyq-add').forEach(btn => {
        btn.addEventListener('click', (e) => { const sub = e.currentTarget.getAttribute('data-subject'); if (userData.pyqCounts[sub] < 300) { userData.pyqCounts[sub] += 5; localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); updatePYQ(); } });
    });
    document.querySelectorAll('.pyq-sub').forEach(btn => {
        btn.addEventListener('click', (e) => { const sub = e.currentTarget.getAttribute('data-subject'); if (userData.pyqCounts[sub] > 0) { userData.pyqCounts[sub] = Math.max(0, userData.pyqCounts[sub] - 5); localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); updatePYQ(); } });
    });
    updatePYQ();

    // --- INTERACTIVE CHART.JS INTEGRATION ---
    Chart.defaults.color = '#888'; Chart.defaults.font.family = "'Inter', sans-serif";

    const ctxRadar = document.getElementById('subjectRadar');
    if (ctxRadar) {
        window.radarChartInstance = new Chart(ctxRadar.getContext('2d'), {
            type: 'radar',
            data: { labels: [userData.config.sub1, userData.config.sub2, userData.config.sub3, userData.config.sub4, userData.config.sub5],
                    datasets: [{ label: 'Mastery', data: userData.subjectMastery, backgroundColor: 'rgba(0, 242, 254, 0.2)', borderColor: '#00f2fe', pointBackgroundColor: '#00f2fe', borderWidth: 2 }] },
            options: { scales: { r: { ticks: { display: false, min: 0, max: 100 } } }, plugins: { legend: { display: false } } }
        });
        for(let i=0; i<5; i++) {
            const slider = document.getElementById(`mastery${i}`);
            if(slider) {
                slider.value = userData.subjectMastery[i];
                slider.addEventListener('input', (e) => { userData.subjectMastery[i] = parseInt(e.target.value); localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); window.radarChartInstance.update(); });
            }
        }
    }

    const ctxBar = document.getElementById('weeklyBar');
    if (ctxBar) {
        let ctx = ctxBar.getContext('2d');
        let gradient = ctx.createLinearGradient(0, 0, 0, 400); gradient.addColorStop(0, 'rgba(0, 242, 254, 0.8)'); gradient.addColorStop(1, 'rgba(0, 242, 254, 0.1)');
        let barChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ data: userData.weeklyHours, backgroundColor: gradient, borderRadius: 5 }] },
            options: { scales: { y: { beginAtZero: true, max: 24 } }, plugins: { legend: { display: false } } }
        });
        for(let i=0; i<7; i++) {
            const input = document.getElementById(`hrs${i}`);
            if(input) {
                input.value = userData.weeklyHours[i];
                input.addEventListener('input', (e) => { userData.weeklyHours[i] = parseFloat(e.target.value) || 0; localStorage.setItem('jeeNexusData_v10', JSON.stringify(userData)); barChart.update(); });
            }
        }
    }

    // --- NAVIGATION TOGGLE & INITIALIZATION ---
    applyConfig(); 
    renderDirectives(); 
    updateUI();

    const navItems = document.querySelectorAll('.nav-links li');
    const allCards = document.querySelectorAll('.content-grid .card');
    
    allCards.forEach(card => { 
        if (card.classList.contains('tracker-card') || card.classList.contains('settings-card')) card.style.display = 'none'; 
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active')); item.classList.add('active');
            const target = item.getAttribute('data-target');
            
            allCards.forEach(card => {
                if (target === 'all') {
                    card.style.display = (card.classList.contains('tracker-card') || card.classList.contains('settings-card')) ? 'none' : 'block';
                } else {
                    card.style.display = card.classList.contains(target) ? 'block' : 'none';
                }
            });
        });
    });
});