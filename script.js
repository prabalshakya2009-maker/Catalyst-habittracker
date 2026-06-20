document.addEventListener("DOMContentLoaded", () => {
    
    const todayString = new Date().toDateString(); 
    
    const defaultState = {
        xp: 0, level: 1, streak: 0, discipline: 0, tasksCompletedToday: 0,
        checkboxStates: [], focusLog: [], class11Completed: 0, errorLogs: [],
        backlogItems: [], pyqCounts: { physics: 0, chemistry: 0, maths: 0 },
        subjectMastery: [0, 0, 0, 0, 0], weeklyHours: [0, 0, 0, 0, 0, 0, 0], 
        lastLoginDate: todayString
    };

    let userData = JSON.parse(localStorage.getItem('jeeNexusData_v7'));
    
    if (!userData) {
        let oldData = JSON.parse(localStorage.getItem('jeeNexusData_v6'));
        if (oldData) {
            userData = oldData;
            userData.subjectMastery = (userData.subjectMastery || [0,0,0,0,0,0]).slice(0, 5); 
            userData.weeklyHours = userData.weeklyHours || [0, 0, 0, 0, 0, 0, 0];
            localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData));
        } else {
            userData = defaultState;
        }
    }

    if (userData.lastLoginDate !== todayString) {
        userData.checkboxStates = []; userData.tasksCompletedToday = 0;
        userData.discipline = 0; userData.focusLog = []; 
        userData.lastLoginDate = todayString;
        localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData));
    }

    function updateUI() {
        const els = {
            xp: document.getElementById('xpDisplay'), lvl: document.getElementById('levelDisplay'),
            str: document.getElementById('streakDisplay'), dis: document.getElementById('disciplineScore'),
            bar: document.getElementById('xpBar'), rank: document.getElementById('predictedRankDisplay')
        };
        
        if(els.xp) els.xp.innerText = userData.xp;
        if(els.lvl) els.lvl.innerText = userData.level;
        if(els.str) els.str.innerText = `${userData.streak} Days`;
        if(els.dis) els.dis.innerText = `${userData.discipline}%`;
        if(els.bar) els.bar.style.width = `${(userData.xp % 1000) / 10}%`;
        
        let estimatedRank = 900000 - (userData.xp * 15) - (userData.discipline * 3000) - (userData.streak * 8000);
        if (estimatedRank < 1) estimatedRank = 1;
        if(els.rank) els.rank.innerText = `AIR ${Math.floor(estimatedRank).toLocaleString()}`;
        
        localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData));
    }

    // --- CLASS 11 CHAPTER MATH ---
    function updateClass11Progress() {
        const chapCount11 = document.getElementById('chapCount11');
        const progBar11 = document.getElementById('progBar11');
        if (!chapCount11 || !progBar11) return;
        
        let percentage = Math.round((userData.class11Completed / 44) * 100);
        chapCount11.innerText = `${userData.class11Completed} / 44 Ch`;
        progBar11.style.width = `${percentage}%`;
        progBar11.innerText = `${percentage}%`;
    }

    const addChap = document.getElementById('addChap11');
    const subChap = document.getElementById('subChap11');
    if(addChap) addChap.addEventListener('click', () => {
        if (userData.class11Completed < 44) { userData.class11Completed++; updateClass11Progress(); }
    });
    if(subChap) subChap.addEventListener('click', () => {
        if (userData.class11Completed > 0) { userData.class11Completed--; updateClass11Progress(); }
    });

    updateClass11Progress();

    // --- DYNAMIC SCHEDULE ---
    const dayOfWeek = new Date().getDay(); 
    let activeScheduleId = [1, 3, 5].includes(dayOfWeek) ? 'schedule-MWF' : ([2, 4, 6].includes(dayOfWeek) ? 'schedule-TTS' : 'schedule-S');
    let headerText = [1, 3, 5].includes(dayOfWeek) ? 'MWF Protocol' : ([2, 4, 6].includes(dayOfWeek) ? 'TTS Protocol' : 'Sunday Deep Work');

    const dayLabel = document.getElementById('dayLabel');
    const activeBlock = document.getElementById(activeScheduleId);
    if(dayLabel) dayLabel.innerText = headerText;
    if(activeBlock) activeBlock.style.display = 'block';

    const checkboxes = document.querySelectorAll(`#${activeScheduleId} .custom-checkbox input[type="checkbox"]`);
    checkboxes.forEach((box, index) => {
        box.checked = userData.checkboxStates[index] || false;
        box.addEventListener('change', (e) => {
            const xpGained = parseInt(e.target.getAttribute('data-xp'));
            if (e.target.checked) { userData.xp += xpGained; userData.tasksCompletedToday++; userData.checkboxStates[index] = true; } 
            else { userData.xp -= xpGained; userData.tasksCompletedToday--; userData.checkboxStates[index] = false; }
            if (userData.tasksCompletedToday < 0) userData.tasksCompletedToday = 0;
            userData.discipline = Math.round((userData.tasksCompletedToday / checkboxes.length) * 100);
            if (userData.xp >= (userData.level * 1000)) { userData.level++; alert(`🔥 Level Up!`); }
            updateUI();
        });
    });

    updateUI();

    // --- POMODORO TIMER ---
    const blockSelector = document.getElementById('blockSelector');
    const timerDisplay = document.getElementById('timer');
    const startBtn = document.getElementById('startTimer');
    const resetBtn = document.getElementById('resetTimer');
    const logContainer = document.getElementById('sessionLog');
    
    let selectedMinutes = blockSelector ? parseInt(blockSelector.value) : 120;
    let timeLeft = selectedMinutes * 60; 
    let timerInterval;
    let isRunning = false;

    function updateTimerDisplay() {
        if(!timerDisplay) return;
        timerDisplay.innerText = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;
    }

    function renderFocusLog() {
        if(!logContainer) return;
        logContainer.innerHTML = '';
        if (!userData.focusLog || userData.focusLog.length === 0) {
            logContainer.innerHTML = '<li style="color: var(--text-muted);">No sessions logged today.</li>';
        } else {
            userData.focusLog.forEach(log => {
                const li = document.createElement('li');
                li.innerHTML = `<span><i class="fa-solid fa-check"></i> ${log.duration} min Block</span> <span>${log.time}</span>`;
                logContainer.appendChild(li);
            });
        }
    }

    if(blockSelector) blockSelector.addEventListener('change', (e) => {
        if (!isRunning) { selectedMinutes = parseInt(e.target.value); timeLeft = selectedMinutes * 60; updateTimerDisplay(); }
    });

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
                    localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData));
                    renderFocusLog();
                    alert(`Block complete!`);
                    timeLeft = selectedMinutes * 60; startBtn.innerText = "Start Focus";
                    startBtn.classList.replace('secondary-btn', 'primary-btn'); updateTimerDisplay();
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
    const addErrorBtn = document.getElementById('addErrorBtn');
    const errorLogTableBody = document.getElementById('errorLogTableBody');

    function renderErrorLog() {
        if(!errorLogTableBody) return;
        errorLogTableBody.innerHTML = '';
        if (userData.errorLogs.length === 0) {
            errorLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No errors logged yet. Flawless execution.</td></tr>`; return;
        }
        userData.errorLogs.forEach((err, index) => {
            const tr = document.createElement('tr'); tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            let badgeColor = err.type === 'Conceptual Gap' ? '#ff4a5a' : (err.type === 'Formula Forgotten' ? '#00f2fe' : '#ffc107'); 
            tr.innerHTML = `
                <td style="padding: 0.8rem; font-weight: bold;">${err.chapter}</td>
                <td style="padding: 0.8rem;"><span style="color: ${badgeColor}; font-size: 0.8rem; border: 1px solid ${badgeColor}; padding: 2px 6px; border-radius: 4px;">${err.type}</span></td>
                <td style="padding: 0.8rem; color: #e0e0e0;">${err.note}</td>
                <td style="padding: 0.8rem; text-align: center;"><button class="delete-err-btn" data-index="${index}" style="background: transparent; border: none; color: #ff4a5a; cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button></td>
            `;
            errorLogTableBody.appendChild(tr);
        });
        document.querySelectorAll('.delete-err-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                userData.errorLogs.splice(parseInt(e.currentTarget.getAttribute('data-index')), 1);
                localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData)); renderErrorLog();
            });
        });
    }

    if(addErrorBtn) addErrorBtn.addEventListener('click', () => {
        const errChap = document.getElementById('errChap'); const errNote = document.getElementById('errNote');
        const errType = document.getElementById('errType');
        if (!errChap.value.trim() || !errNote.value.trim()) return alert('Fill out Chapter and Correction note!');
        userData.errorLogs.push({ chapter: errChap.value.trim(), type: errType.value, note: errNote.value.trim() });
        userData.xp += 50; localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData));
        errChap.value = ''; errNote.value = ''; renderErrorLog(); updateUI();
    });
    renderErrorLog();

    // --- TRACKER: BACKLOG BOUNTY ---
    const addBacklogBtn = document.getElementById('addBacklogBtn');
    const backlogList = document.getElementById('backlogList');

    function renderBacklogs() {
        if(!backlogList) return;
        backlogList.innerHTML = '';
        if (!userData.backlogItems || userData.backlogItems.length === 0) {
            backlogList.innerHTML = '<li style="color: var(--text-muted);">No backlogs! You are perfectly on schedule.</li>'; return;
        }
        userData.backlogItems.forEach((item, index) => {
            const li = document.createElement('li'); li.style.justifyContent = 'space-between';
            li.innerHTML = `<span>${item.topic} <span style="color: var(--warning); font-size: 0.7rem; margin-left: 10px;">[${item.xp} XP]</span></span>
                <button class="claim-bounty-btn" data-index="${index}" style="background: var(--success); color: #000; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: bold;">Claim</button>`;
            backlogList.appendChild(li);
        });
        document.querySelectorAll('.claim-bounty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                userData.xp += parseInt(userData.backlogItems.splice(parseInt(e.currentTarget.getAttribute('data-index')), 1)[0].xp);
                localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData)); renderBacklogs(); updateUI();
            });
        });
    }

    if(addBacklogBtn) addBacklogBtn.addEventListener('click', () => {
        const backlogInput = document.getElementById('backlogInput'); const backlogXP = document.getElementById('backlogXP');
        if (!backlogInput.value.trim()) return;
        userData.backlogItems.push({ topic: backlogInput.value.trim(), xp: backlogXP.value || 100 });
        localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData)); backlogInput.value = ''; renderBacklogs();
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
        btn.addEventListener('click', (e) => {
            const sub = e.currentTarget.getAttribute('data-subject');
            if (userData.pyqCounts[sub] < 300) { userData.pyqCounts[sub] += 5; localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData)); updatePYQ(); }
        });
    });
    document.querySelectorAll('.pyq-sub').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sub = e.currentTarget.getAttribute('data-subject');
            if (userData.pyqCounts[sub] > 0) { userData.pyqCounts[sub] = Math.max(0, userData.pyqCounts[sub] - 5); localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData)); updatePYQ(); }
        });
    });
    updatePYQ();

    // --- INTERACTIVE CHART.JS INTEGRATION ---
    Chart.defaults.color = '#888'; Chart.defaults.font.family = "'Inter', sans-serif";

    const ctxRadar = document.getElementById('subjectRadar');
    if (ctxRadar) {
        let radarChart = new Chart(ctxRadar.getContext('2d'), {
            type: 'radar',
            data: { labels: ['Physics', 'Physical Chem', 'Organic Chem', 'Inorganic Chem', 'Maths'],
                    datasets: [{ label: 'Mastery', data: userData.subjectMastery, backgroundColor: 'rgba(0, 242, 254, 0.2)', borderColor: '#00f2fe', pointBackgroundColor: '#00f2fe', borderWidth: 2 }] },
            options: { scales: { r: { ticks: { display: false, min: 0, max: 100 } } }, plugins: { legend: { display: false } } }
        });
        for(let i=0; i<5; i++) {
            const slider = document.getElementById(`mastery${i}`);
            if(slider) {
                slider.value = userData.subjectMastery[i];
                slider.addEventListener('input', (e) => {
                    userData.subjectMastery[i] = parseInt(e.target.value); localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData)); radarChart.update();
                });
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
                input.addEventListener('input', (e) => {
                    userData.weeklyHours[i] = parseFloat(e.target.value) || 0; localStorage.setItem('jeeNexusData_v7', JSON.stringify(userData)); barChart.update();
                });
            }
        }
    }

    // --- NAVIGATION TOGGLE ---
    const navItems = document.querySelectorAll('.nav-links li');
    const allCards = document.querySelectorAll('.content-grid .card');
    allCards.forEach(card => { if (card.classList.contains('tracker-card')) card.style.display = 'none'; });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active')); item.classList.add('active');
            const target = item.getAttribute('data-target');
            allCards.forEach(card => {
                card.style.display = (target === 'all') 
                    ? (card.classList.contains('tracker-card') ? 'none' : 'block') 
                    : (card.classList.contains(target) ? 'block' : 'none');
            });
        });
    });
});