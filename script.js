document.addEventListener("DOMContentLoaded", () => {
    
    const todayString = new Date().toDateString(); 
    
    const sfxCheck = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
    const sfxAlarm = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
    sfxCheck.volume = 0.5; sfxAlarm.volume = 0.7;

    const defaultState = {
        xp: 0, level: 1, streak: 0, discipline: 0, 
        focusLog: [], class11Completed: 0, errorLogs: [],
        backlogItems: [], pyqCounts: { physics: 0, chemistry: 0, maths: 0 },
        subjectMastery: [0, 0, 0, 0, 0], weeklyHours: [0, 0, 0, 0, 0, 0, 0], 
        lastLoginDate: todayString, weeklyXP: 0, monthlyXP: 0, history: [],
        
        // V13 FULL CONFIGURATION ENGINE
        config: {
            exam: 'JEE', metric: 'AIR',
            sub1: 'Physics', sub2: 'Physical Chem', sub3: 'Organic Chem', sub4: 'Inorganic Chem', sub5: 'Algebra',
            goal1: 'Phase 1 Syllabus', goal2: 'Phase 2 Syllabus', goal3: 'Mock Test Accuracy',
            block1: 'Morning Block', block2: 'Afternoon Block', block3: 'Evening Block',
            maxChap: 40, maxQ: 300,
            primaryColor: '#00f2fe', secondaryColor: '#ff0844',
            t1Name: 'Standard Block', t1Min: 120,
            t2Name: 'Focus Block', t2Min: 90,
            t3Name: 'Short Block', t3Min: 60,
            t4Name: 'Pomodoro', t4Min: 50
        },
        directives: {
            morning: [{ id: 1, text: "Wake Up & Hydrate", xp: 10, completed: false }],
            afternoon: [{ id: 2, text: "Deep Work Session", xp: 40, completed: false }],
            evening: [{ id: 3, text: "Plan Tomorrow", xp: 20, completed: false }]
        }
    };

    let userData = JSON.parse(localStorage.getItem('jeeNexusData_v13'));
    
    // V13 Migration
    if (!userData) {
        let oldData = JSON.parse(localStorage.getItem('jeeNexusData_v12')) || JSON.parse(localStorage.getItem('jeeNexusData_v11'));
        if (oldData) {
            userData = oldData;
            userData.config = { ...defaultState.config, ...(userData.config || {}) };
            localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));
        } else {
            userData = defaultState;
        }
    }

    if (userData.lastLoginDate !== todayString) {
        let todayDate = new Date(); let lastDate = new Date(userData.lastLoginDate);
        if (userData.discipline >= 70) userData.streak++; else userData.streak = 0;
        userData.history.push({ date: userData.lastLoginDate, discipline: userData.discipline });
        if (userData.history.length > 7) userData.history.shift();
        if (todayDate.getDay() === 1 && lastDate.getDay() !== 1) userData.weeklyXP = 0; 
        if (todayDate.getMonth() !== lastDate.getMonth()) userData.monthlyXP = 0; 
        userData.focusLog = []; userData.lastLoginDate = todayString;
        
        if(userData.directives) {
            Object.keys(userData.directives).forEach(block => {
                userData.directives[block].forEach(task => task.completed = false);
            });
        }
        calculateDisciplineScore();
        localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));
    }

    // --- TIMERS PRE-SETUP ---
    const blockSelector = document.getElementById('blockSelector'); 
    const timerDisplay = document.getElementById('timer');
    const startBtn = document.getElementById('startTimer'); 
    const resetBtn = document.getElementById('resetTimer');
    const logContainer = document.getElementById('sessionLog');
    
    let selectedMinutes = 120;
    let timeLeft = selectedMinutes * 60; 
    let timerInterval; 
    let isRunning = false;

    function updateTimerDisplay() { if(timerDisplay) timerDisplay.innerText = `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`; }

    // --- UNIVERSAL SETTINGS ENGINE (V13) ---
    function applyConfig() {
        const c = userData.config;
        
        document.documentElement.style.setProperty('--primary-neon', c.primaryColor || '#00f2fe');
        document.documentElement.style.setProperty('--secondary-neon', c.secondaryColor || '#ff0844');

        if(document.getElementById('displayExamTitle')) document.getElementById('displayExamTitle').innerText = c.exam;
        if(document.getElementById('displayMetricPrefix')) document.getElementById('displayMetricPrefix').innerText = c.metric;
        if(document.getElementById('displayGoal1')) document.getElementById('displayGoal1').innerText = c.goal1;
        if(document.getElementById('displayGoal2')) document.getElementById('displayGoal2').innerText = c.goal2;
        if(document.getElementById('displayGoal3')) document.getElementById('displayGoal3').innerText = c.goal3;
        
        if(document.getElementById('displayBlock1')) document.getElementById('displayBlock1').innerText = c.block1;
        if(document.getElementById('displayBlock2')) document.getElementById('displayBlock2').innerText = c.block2;
        if(document.getElementById('displayBlock3')) document.getElementById('displayBlock3').innerText = c.block3;

        for(let i=0; i<5; i++) {
            if(document.getElementById(`mastLabel${i}`)) document.getElementById(`mastLabel${i}`).innerText = c[`sub${i+1}`];
            if(document.getElementById(`pyqTitle${i}`)) document.getElementById(`pyqTitle${i}`).innerText = c[`sub${i+1}`] + " Actions";
        }

        if(window.radarChartInstance) { 
            window.radarChartInstance.data.labels = [c.sub1, c.sub2, c.sub3, c.sub4, c.sub5]; 
            window.radarChartInstance.data.datasets[0].borderColor = c.primaryColor || '#00f2fe';
            window.radarChartInstance.data.datasets[0].pointBackgroundColor = c.primaryColor || '#00f2fe';
            window.radarChartInstance.update(); 
        }

        // Apply Custom Timers to Dropdown
        if (blockSelector) {
            blockSelector.innerHTML = `
                <option value="${c.t1Min}" selected>${c.t1Name} (${c.t1Min} min)</option>
                <option value="${c.t2Min}">${c.t2Name} (${c.t2Min} min)</option>
                <option value="${c.t3Min}">${c.t3Name} (${c.t3Min} min)</option>
                <option value="${c.t4Min}">${c.t4Name} (${c.t4Min} min)</option>
            `;
            if (!isRunning) {
                selectedMinutes = parseInt(blockSelector.value) || 120;
                timeLeft = selectedMinutes * 60;
                updateTimerDisplay();
            }
        }

        // Fill Settings Form
        ['Exam', 'Metric', 'Goal1', 'Goal2', 'Goal3', 'Sub1', 'Sub2', 'Sub3', 'Sub4', 'Sub5', 'Block1', 'Block2', 'Block3', 'T1Name', 'T2Name', 'T3Name', 'T4Name'].forEach(key => {
            if(document.getElementById(`conf${key}`)) document.getElementById(`conf${key}`).value = c[key.toLowerCase()] || c[key.charAt(0).toLowerCase() + key.slice(1)];
        });
        
        ['MaxChap', 'MaxQ', 'T1Min', 'T2Min', 'T3Min', 'T4Min'].forEach(key => {
            if(document.getElementById(`conf${key}`)) document.getElementById(`conf${key}`).value = c[key.charAt(0).toLowerCase() + key.slice(1)];
        });

        if(document.getElementById('confPrimaryColor')) document.getElementById('confPrimaryColor').value = c.primaryColor || '#00f2fe';
        if(document.getElementById('confSecondaryColor')) document.getElementById('confSecondaryColor').value = c.secondaryColor || '#ff0844';
    }

    if(document.getElementById('saveConfigBtn')) {
        document.getElementById('saveConfigBtn').addEventListener('click', () => {
            userData.config = {
                exam: document.getElementById('confExam').value || 'Target Exam', metric: document.getElementById('confMetric').value || 'Score',
                goal1: document.getElementById('confGoal1').value || 'Phase 1', goal2: document.getElementById('confGoal2').value || 'Phase 2', goal3: document.getElementById('confGoal3').value || 'Phase 3',
                sub1: document.getElementById('confSub1').value || 'Subject 1', sub2: document.getElementById('confSub2').value || 'Subject 2',
                sub3: document.getElementById('confSub3').value || 'Subject 3', sub4: document.getElementById('confSub4').value || 'Subject 4', sub5: document.getElementById('confSub5').value || 'Subject 5',
                block1: document.getElementById('confBlock1').value || 'Morning Block', block2: document.getElementById('confBlock2').value || 'Afternoon Block', block3: document.getElementById('confBlock3').value || 'Evening Block',
                maxChap: parseInt(document.getElementById('confMaxChap').value) || 40, maxQ: parseInt(document.getElementById('confMaxQ').value) || 300,
                primaryColor: document.getElementById('confPrimaryColor').value || '#00f2fe', secondaryColor: document.getElementById('confSecondaryColor').value || '#ff0844',
                t1Name: document.getElementById('confT1Name').value || 'Standard Block', t1Min: parseInt(document.getElementById('confT1Min').value) || 120,
                t2Name: document.getElementById('confT2Name').value || 'Focus Block', t2Min: parseInt(document.getElementById('confT2Min').value) || 90,
                t3Name: document.getElementById('confT3Name').value || 'Short Block', t3Min: parseInt(document.getElementById('confT3Min').value) || 60,
                t4Name: document.getElementById('confT4Name').value || 'Pomodoro', t4Min: parseInt(document.getElementById('confT4Min').value) || 50
            };
            localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); applyConfig(); updateClass11Progress(); updatePYQ(); alert("Settings applied globally!");
        });
    }

    // Run apply config immediately so the DOM updates before any actions happen
    applyConfig();

    // --- TIMERS INTERACTION ---
    function renderFocusLog() {
        if(!logContainer) return; logContainer.innerHTML = '';
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
                    if(!userData.focusLog) userData.focusLog = []; userData.focusLog.push({ duration: selectedMinutes, time: timeString });
                    localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));
                    renderFocusLog(); sfxAlarm.play().catch(e=>console.log("Audio prevented")); alert(`Block complete!`);
                    timeLeft = selectedMinutes * 60; startBtn.innerText = "Start Focus"; startBtn.classList.replace('secondary-btn', 'primary-btn'); updateTimerDisplay();
                }
            }, 1000);
        } else { clearInterval(timerInterval); isRunning = false; if(blockSelector) blockSelector.disabled = false; startBtn.innerText = "Resume"; startBtn.classList.replace('secondary-btn', 'primary-btn'); }
    });

    if(resetBtn) resetBtn.addEventListener('click', () => { clearInterval(timerInterval); isRunning = false; if(blockSelector) blockSelector.disabled = false; timeLeft = selectedMinutes * 60; updateTimerDisplay(); if(startBtn) { startBtn.innerText = "Start Focus"; startBtn.classList.replace('secondary-btn', 'primary-btn'); } });
    
    renderFocusLog();


    // --- MOBILE HAMBURGER MENU ---
    const openMenuBtn = document.getElementById('openMenuBtn'); const closeMenuBtn = document.getElementById('closeMenuBtn'); const mobileSidebar = document.getElementById('mobileSidebar');
    if(openMenuBtn && closeMenuBtn && mobileSidebar) {
        openMenuBtn.addEventListener('click', () => { mobileSidebar.classList.add('active'); closeMenuBtn.style.display = 'block'; });
        closeMenuBtn.addEventListener('click', () => { mobileSidebar.classList.remove('active'); closeMenuBtn.style.display = 'none'; });
    }

    // --- DRAG AND DROP ENGINE ---
    let draggedItem = null; let dragSourceBlock = null;

    function renderDirectives() {
        ['morning', 'afternoon', 'evening'].forEach(block => {
            const container = document.getElementById(`list-container-${block}`);
            if (!container) return;
            container.innerHTML = '';
            if (userData.directives[block].length === 0) { container.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; padding: 5px 0;">No directives listed. Click + to add.</p>`; return; }

            userData.directives[block].forEach(task => {
                const row = document.createElement('div');
                row.className = `directive-row ${task.completed ? 'completed-task-text' : ''}`;
                row.setAttribute('draggable', true); row.setAttribute('data-id', task.id);
                
                row.innerHTML = `
                    <label class="custom-checkbox">
                        <input type="checkbox" class="directive-checkbox" data-block="${block}" data-id="${task.id}" ${task.completed ? 'checked' : ''}>
                        <span class="checkmark"></span><span>${task.text} <span style="color:var(--primary-neon); font-size:0.7rem;">(+${task.xp}XP)</span></span>
                    </label>
                    <button class="task-delete-btn" data-block="${block}" data-id="${task.id}"><i class="fa-solid fa-trash-can"></i></button>
                `;
                
                row.addEventListener('dragstart', function(e) { draggedItem = this; dragSourceBlock = block; setTimeout(() => this.classList.add('dragging'), 0); });
                row.addEventListener('dragend', function() {
                    this.classList.remove('dragging'); draggedItem = null;
                    const newArray = [];
                    container.querySelectorAll('.directive-row').forEach(r => {
                        const rTask = userData.directives[block].find(t => t.id === parseInt(r.getAttribute('data-id')));
                        if(rTask) newArray.push(rTask);
                    });
                    userData.directives[block] = newArray;
                    localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));
                });
                container.appendChild(row);
            });

            container.addEventListener('dragover', e => {
                e.preventDefault(); if(dragSourceBlock !== block) return;
                const afterElement = getDragAfterElement(container, e.clientY);
                if (afterElement == null) container.appendChild(draggedItem); else container.insertBefore(draggedItem, afterElement);
            });
        });
        setupDirectiveListeners(); calculateDisciplineScore();
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.directive-row:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function addGlobalXP(amount) {
        userData.xp += amount; userData.weeklyXP += amount; userData.monthlyXP += amount;
        if (userData.xp < 0) userData.xp = 0; if (userData.weeklyXP < 0) userData.weeklyXP = 0; if (userData.monthlyXP < 0) userData.monthlyXP = 0;
    }

    function setupDirectiveListeners() {
        document.querySelectorAll('.directive-checkbox').forEach(box => {
            box.addEventListener('change', (e) => {
                const block = e.target.getAttribute('data-block');
                const task = userData.directives[block].find(t => t.id === parseInt(e.target.getAttribute('data-id')));
                if (task) {
                    task.completed = e.target.checked;
                    if (task.completed) { addGlobalXP(task.xp); sfxCheck.play().catch(e => console.log("Audio prevented")); } 
                    else { addGlobalXP(-task.xp); }
                    if (userData.xp >= (userData.level * 1000)) { userData.level++; alert(`🔥 Level Up! You are now Level ${userData.level}`); }
                    calculateDisciplineScore(); updateUI(); renderDirectives();
                }
            });
        });

        document.querySelectorAll('.task-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const block = e.currentTarget.getAttribute('data-block');
                const taskIndex = userData.directives[block].findIndex(t => t.id === parseInt(e.currentTarget.getAttribute('data-id')));
                if (taskIndex !== -1) {
                    if (userData.directives[block][taskIndex].completed) addGlobalXP(-userData.directives[block][taskIndex].xp);
                    userData.directives[block].splice(taskIndex, 1);
                    calculateDisciplineScore(); updateUI(); renderDirectives();
                }
            });
        });
    }

    function calculateDisciplineScore() {
        let total = 0, completed = 0;
        ['morning', 'afternoon', 'evening'].forEach(block => { total += userData.directives[block].length; completed += userData.directives[block].filter(t => t.completed).length; });
        userData.discipline = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (document.getElementById('disciplineScore')) document.getElementById('disciplineScore').innerText = `${userData.discipline}%`;
        localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));
    }

    document.querySelectorAll('.task-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const block = e.currentTarget.getAttribute('data-block');
            const textInput = document.getElementById(`input-text-${block}`); const xpInput = document.getElementById(`input-xp-${block}`);
            if (!textInput || !textInput.value.trim()) return;
            userData.directives[block].push({ id: Date.now() + Math.floor(Math.random() * 1000), text: textInput.value.trim(), xp: parseInt(xpInput.value) || 20, completed: false });
            textInput.value = ''; renderDirectives(); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); updateUI();
        });
    });

    // --- DATA EXPORT / IMPORT ---
    if(document.getElementById('exportDataBtn')) {
        document.getElementById('exportDataBtn').addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userData));
            const downloadAnchorNode = document.createElement('a'); downloadAnchorNode.setAttribute("href", dataStr); downloadAnchorNode.setAttribute("download", "nexus_os_backup.json"); document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
        });
    }
    if(document.getElementById('importDataFile')) {
        document.getElementById('importDataFile').addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if(importedData.config && importedData.directives) { localStorage.setItem('jeeNexusData_v13', JSON.stringify(importedData)); alert("Profile Restore Successful!"); location.reload(); } else { alert("Invalid Backup File."); }
                } catch(err) { alert("Error reading file."); }
            }; reader.readAsText(file);
        });
    }

    function updateBadges() {
        const container = document.getElementById('badgeContainer'); if(!container) return;
        const badges = [
            { id: 'b1', name: "Initiation", icon: "fa-rocket", unlocked: userData.level >= 2 },
            { id: 'b2', name: "7-Day Warrior", icon: "fa-fire-flame-curved", unlocked: userData.streak >= 7 },
            { id: 'b3', name: "Discipline King", icon: "fa-shield-cat", unlocked: userData.discipline === 100 },
            { id: 'b4', name: "Level 10 Boss", icon: "fa-crown", unlocked: userData.level >= 10 },
            { id: 'b5', name: "Grinder", icon: "fa-dumbbell", unlocked: (userData.tasksCompletedToday || 0) >= 10 }
        ];
        container.innerHTML = '';
        badges.forEach(b => {
            const div = document.createElement('div'); div.className = `badge-item ${b.unlocked ? 'badge-unlocked' : 'badge-locked'}`;
            div.innerHTML = `<div class="badge-icon-box"><i class="fa-solid ${b.icon}"></i></div><span class="badge-title">${b.name}</span>`; container.appendChild(div);
        });
    }

    function updateUI() {
        if(document.getElementById('xpDisplay')) document.getElementById('xpDisplay').innerText = userData.xp;
        if(document.getElementById('levelDisplay')) document.getElementById('levelDisplay').innerText = userData.level;
        if(document.getElementById('streakDisplay')) document.getElementById('streakDisplay').innerText = `${userData.streak} Days`;
        if(document.getElementById('disciplineScore')) document.getElementById('disciplineScore').innerText = `${userData.discipline}%`;
        if(document.getElementById('xpBar')) document.getElementById('xpBar').style.width = `${(userData.xp % 1000) / 10}%`;
        if(document.getElementById('weeklyXpDisplay')) document.getElementById('weeklyXpDisplay').innerText = userData.weeklyXP;
        if(document.getElementById('monthlyXpDisplay')) document.getElementById('monthlyXpDisplay').innerText = userData.monthlyXP;
        
        let avgDiscipline = 0;
        if(userData.history && userData.history.length > 0) avgDiscipline = Math.round(userData.history.reduce((a, b) => a + b.discipline, 0) / userData.history.length);
        if(document.getElementById('avgDisciplineDisplay')) document.getElementById('avgDisciplineDisplay').innerText = `${avgDiscipline}%`;

        let estimatedRank = 900000 - (userData.xp * 15) - (userData.discipline * 3000) - (userData.streak * 8000);
        if (estimatedRank < 1) estimatedRank = 1;
        if(document.getElementById('predictedRankDisplay')) document.getElementById('predictedRankDisplay').innerText = Math.floor(estimatedRank).toLocaleString();
        
        updateBadges(); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));
    }

    // --- DYNAMIC TARGET PROGRESS ---
    function updateClass11Progress() {
        const chapCount11 = document.getElementById('chapCount11'); const progBar11 = document.getElementById('progBar11');
        if (!chapCount11 || !progBar11) return;
        let target = userData.config.maxChap || 40;
        let percentage = Math.round((userData.class11Completed / target) * 100);
        chapCount11.innerText = `${userData.class11Completed} / ${target} Units`; progBar11.style.width = `${percentage}%`; progBar11.innerText = `${percentage}%`;
    }

    if(document.getElementById('addChap11')) document.getElementById('addChap11').addEventListener('click', () => { let target = userData.config.maxChap || 40; if (userData.class11Completed < target) { userData.class11Completed++; updateClass11Progress(); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); } });
    if(document.getElementById('subChap11')) document.getElementById('subChap11').addEventListener('click', () => { if (userData.class11Completed > 0) { userData.class11Completed--; updateClass11Progress(); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));} });
    updateClass11Progress();

    // --- ERROR LOG ---
    const errorLogTableBody = document.getElementById('errorLogTableBody');
    function renderErrorLog() {
        if(!errorLogTableBody) return; errorLogTableBody.innerHTML = '';
        if (userData.errorLogs.length === 0) { errorLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No errors logged yet. Flawless execution.</td></tr>`; return; }
        userData.errorLogs.forEach((err, index) => {
            const tr = document.createElement('tr'); tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            let badgeColor = err.type === 'Conceptual Gap' ? '#ff4a5a' : (err.type === 'Memory/Fact Forgotten' ? '#00f2fe' : '#ffc107'); 
            tr.innerHTML = `<td style="padding: 0.8rem; font-weight: bold;">${err.chapter}</td><td style="padding: 0.8rem;"><span style="color: ${badgeColor}; font-size: 0.8rem; border: 1px solid ${badgeColor}; padding: 2px 6px; border-radius: 4px;">${err.type}</span></td><td style="padding: 0.8rem; color: #e0e0e0;">${err.note}</td><td style="padding: 0.8rem; text-align: center;"><button class="delete-err-btn" data-index="${index}" style="background: transparent; border: none; color: #ff4a5a; cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button></td>`;
            errorLogTableBody.appendChild(tr);
        });
        document.querySelectorAll('.delete-err-btn').forEach(btn => { btn.addEventListener('click', (e) => { userData.errorLogs.splice(parseInt(e.currentTarget.getAttribute('data-index')), 1); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); renderErrorLog(); }); });
    }

    if(document.getElementById('addErrorBtn')) document.getElementById('addErrorBtn').addEventListener('click', () => {
        const errChap = document.getElementById('errChap'); const errNote = document.getElementById('errNote'); const errType = document.getElementById('errType');
        if (!errChap.value.trim() || !errNote.value.trim()) return alert('Fill out Topic and Correction note!');
        userData.errorLogs.push({ chapter: errChap.value.trim(), type: errType.value, note: errNote.value.trim() });
        addGlobalXP(50); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData));
        errChap.value = ''; errNote.value = ''; renderErrorLog(); updateUI();
    });
    renderErrorLog();

    // --- BACKLOG BOUNTY ---
    const backlogList = document.getElementById('backlogList');
    function renderBacklogs() {
        if(!backlogList) return; backlogList.innerHTML = '';
        if (!userData.backlogItems || userData.backlogItems.length === 0) { backlogList.innerHTML = '<li style="color: var(--text-muted);">No backlogs!</li>'; return; }
        userData.backlogItems.forEach((item, index) => {
            const li = document.createElement('li'); li.style.justifyContent = 'space-between';
            li.innerHTML = `<span>${item.topic} <span style="color: var(--warning); font-size: 0.7rem; margin-left: 10px;">[${item.xp} XP]</span></span><button class="claim-bounty-btn" data-index="${index}" style="background: var(--success); color: #000; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: bold;">Claim</button>`;
            backlogList.appendChild(li);
        });
        document.querySelectorAll('.claim-bounty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                sfxCheck.play().catch(e=>console.log("Audio prevented"));
                addGlobalXP(parseInt(userData.backlogItems.splice(parseInt(e.currentTarget.getAttribute('data-index')), 1)[0].xp));
                localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); renderBacklogs(); updateUI();
            });
        });
    }

    if(document.getElementById('addBacklogBtn')) document.getElementById('addBacklogBtn').addEventListener('click', () => {
        const backlogInput = document.getElementById('backlogInput'); const backlogXP = document.getElementById('backlogXP');
        if (!backlogInput.value.trim()) return;
        userData.backlogItems.push({ topic: backlogInput.value.trim(), xp: backlogXP.value || 100 });
        localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); backlogInput.value = ''; renderBacklogs();
    });
    renderBacklogs();

    // --- DYNAMIC ACTION GRINDER ---
    function updatePYQ() {
        ['physics', 'chemistry', 'maths'].forEach(sub => {
            const countSpan = document.getElementById(`pyqCount${sub}`); const bar = document.getElementById(`pyqBar${sub}`);
            if (countSpan && bar) {
                let target = userData.config.maxQ || 300;
                let percent = Math.min(Math.round(((userData.pyqCounts[sub] || 0) / target) * 100), 100);
                countSpan.innerText = `${userData.pyqCounts[sub] || 0} / ${target}`; bar.style.width = `${percent}%`; bar.innerText = `${percent}%`;
            }
        });
    }

    document.querySelectorAll('.pyq-add').forEach(btn => { btn.addEventListener('click', (e) => { const sub = e.currentTarget.getAttribute('data-subject'); let target = userData.config.maxQ || 300; if (userData.pyqCounts[sub] < target) { userData.pyqCounts[sub] += 5; localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); updatePYQ(); } }); });
    document.querySelectorAll('.pyq-sub').forEach(btn => { btn.addEventListener('click', (e) => { const sub = e.currentTarget.getAttribute('data-subject'); if (userData.pyqCounts[sub] > 0) { userData.pyqCounts[sub] = Math.max(0, userData.pyqCounts[sub] - 5); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); updatePYQ(); } }); });
    updatePYQ();

    // --- CHART.JS INTEGRATION ---
    Chart.defaults.color = '#888'; Chart.defaults.font.family = "'Inter', sans-serif";
    const ctxRadar = document.getElementById('subjectRadar');
    if (ctxRadar) {
        window.radarChartInstance = new Chart(ctxRadar.getContext('2d'), { type: 'radar', data: { labels: [userData.config.sub1, userData.config.sub2, userData.config.sub3, userData.config.sub4, userData.config.sub5], datasets: [{ label: 'Mastery', data: userData.subjectMastery, backgroundColor: 'rgba(0, 242, 254, 0.2)', borderColor: userData.config.primaryColor || '#00f2fe', pointBackgroundColor: userData.config.primaryColor || '#00f2fe', borderWidth: 2 }] }, options: { scales: { r: { ticks: { display: false, min: 0, max: 100 } } }, plugins: { legend: { display: false } } } });
        for(let i=0; i<5; i++) { const slider = document.getElementById(`mastery${i}`); if(slider) { slider.value = userData.subjectMastery[i]; slider.addEventListener('input', (e) => { userData.subjectMastery[i] = parseInt(e.target.value); localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); window.radarChartInstance.update(); }); } }
    }

    const ctxBar = document.getElementById('weeklyBar');
    if (ctxBar) {
        let ctx = ctxBar.getContext('2d'); let gradient = ctx.createLinearGradient(0, 0, 0, 400); gradient.addColorStop(0, 'rgba(0, 242, 254, 0.8)'); gradient.addColorStop(1, 'rgba(0, 242, 254, 0.1)');
        let barChart = new Chart(ctx, { type: 'bar', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ data: userData.weeklyHours, backgroundColor: gradient, borderRadius: 5 }] }, options: { scales: { y: { beginAtZero: true, max: 24 } }, plugins: { legend: { display: false } } } });
        for(let i=0; i<7; i++) { const input = document.getElementById(`hrs${i}`); if(input) { input.value = userData.weeklyHours[i]; input.addEventListener('input', (e) => { userData.weeklyHours[i] = parseFloat(e.target.value) || 0; localStorage.setItem('jeeNexusData_v13', JSON.stringify(userData)); barChart.update(); }); } }
    }

    // --- INITIALIZATION & NAVIGATION ---
    renderDirectives(); updateUI();

    const navItems = document.querySelectorAll('.nav-links li');
    const allCards = document.querySelectorAll('.content-grid .card');
    allCards.forEach(card => { if (card.classList.contains('tracker-card') || card.classList.contains('settings-card')) card.style.display = 'none'; });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active')); item.classList.add('active');
            const target = item.getAttribute('data-target');
            allCards.forEach(card => {
                if (target === 'all') card.style.display = (card.classList.contains('tracker-card') || card.classList.contains('settings-card')) ? 'none' : 'block';
                else card.style.display = card.classList.contains(target) ? 'block' : 'none';
            });
            if(mobileSidebar && window.innerWidth <= 768) { mobileSidebar.classList.remove('active'); if(closeMenuBtn) closeMenuBtn.style.display = 'none'; }
        });
    });
});