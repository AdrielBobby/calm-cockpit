document.addEventListener('DOMContentLoaded', () => {
    const apiBase = '/api/attendance';
    const container = document.getElementById('attendance-timetable');
    const missedEl = document.getElementById('att-missed');
    const remainingEl = document.getElementById('att-remaining');

    // Inject Stats Container if missing
    if (!document.getElementById('att-stats')) {
        const statsDiv = document.createElement('div');
        statsDiv.id = 'att-stats';
        container.after(statsDiv);
    }

    // Inject CSS
    const styleId = 'att-custom-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .att-stats-table { width: 100%; margin-top: 10px; font-size: 0.85rem; border-collapse: collapse; }
            .att-stats-table th, .att-stats-table td { padding: 4px 6px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .att-stats-table th { color: var(--text-muted, #888); font-weight: normal; }
            .btn-holiday { font-size: 0.7rem; margin-left: 10px; padding: 2px 6px; cursor: pointer; background: transparent; border: 1px solid #444; color: #888; border-radius: 4px; }
            .btn-holiday:hover { border-color: #666; color: #ccc; }
            .timetable-item.status-holiday { opacity: 0.6; }
            .status-holiday .tt-actions { display: none; } /* Hide actions for holiday */
            
            /* Inline Editing Styles */
            .tt-subject, .tt-time { cursor: pointer; border-bottom: 1px dashed transparent; transition: border-color 0.2s; }
            .tt-subject:hover, .tt-time:hover { border-bottom-color: rgba(255,255,255,0.3); }
            .btn-delete-slot { opacity: 0; transition: opacity 0.2s; font-size: 0.8rem; color: var(--danger); background: none; border: none; cursor: pointer; margin-left: 5px; }
            .timetable-item:hover .btn-delete-slot { opacity: 1; }
        `;
        document.head.appendChild(style);
    }

    function loadAttendance() {
        fetch(`${apiBase}/data`)
            .then(res => res.json())
            .then(data => {
                const { weekly_context, subjects } = data;

                // Update stats
                missedEl.textContent = weekly_context.missed;
                remainingEl.textContent = weekly_context.remaining;

                // Render Timetable
                renderTimetable(weekly_context.slots);

                // Render Stats
                renderStats(subjects);
            });
    }

    // 1. Populate Subject Datalist & Add Listener
    const subjectList = document.getElementById('att-subjects-list');
    const subjectInput = document.getElementById('att-subject-input');
    const addBtn = document.getElementById('att-add-btn');
    const clearBtn = document.getElementById('reset-att-btn');

    if (subjectInput && addBtn) {
        fetch(`${apiBase}/subjects`)
            .then(res => res.json())
            .then(data => {
                subjectList.innerHTML = '';
                data.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub.name;
                    subjectList.appendChild(opt);
                });
            });

        addBtn.addEventListener('click', () => {
            const day = document.getElementById('att-day').value;
            const subName = subjectInput.value;
            const start = document.getElementById('att-start').value;
            const end = document.getElementById('att-end').value;

            if (!subName) return alert('Please enter a subject name');

            fetch(`${apiBase}/timetable`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day, subject_name: subName, start, end })
            }).then(() => {
                window.showFeedback('Class added');
                // clear input?
                subjectInput.value = '';
                loadAttendance();
            });
        });

    }

    if (clearBtn) {
        setupConfirmButton(clearBtn, () => {
            fetch(`${apiBase}/reset`, { method: 'DELETE' })
                .then(() => {
                    window.showFeedback('Attendance Cleared');
                    loadAttendance();
                    if (subjectList) subjectList.innerHTML = '';
                });
        });
    }

    window.toggleHoliday = function (date, shouldMark) {
        // Exposed to window because onclick in HTML string calls it
        const method = shouldMark ? 'POST' : 'DELETE';
        fetch(`${apiBase}/holiday`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date })
        }).then(() => {
            window.showFeedback(shouldMark ? 'Holiday Marked' : 'Holiday Removed');
            loadAttendance();
        });
    }

    function renderTimetable(slots) {
        container.innerHTML = '';

        if (slots.length === 0) {
            container.innerHTML = '<div class="empty-state">No schedule set. Add a class above to start tracking.</div>';
            return;
        }

        const grouped = {};
        slots.forEach(s => {
            if (!grouped[s.day]) grouped[s.day] = [];
            grouped[s.day].push(s);
        });

        const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        let delayCounter = 1;

        daysOrder.forEach(day => {
            if (!grouped[day]) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = `day-group reveal stagger-${(delayCounter++ % 4) + 1}`;

            const daySlots = grouped[day];
            const date = daySlots[0].date;
            const isHoliday = daySlots.some(s => s.status === 'holiday');

            const header = document.createElement('div');
            header.className = 'day-header';
            header.innerHTML = `<span>${day} <small style="font-weight:normal;opacity:0.5">(${date.split('-').slice(1).join('/')})</small></span>`;

            const holBtn = document.createElement('button');
            holBtn.className = 'btn-holiday';
            holBtn.textContent = isHoliday ? 'Unmark Holiday' : 'Mark Holiday';
            holBtn.onclick = () => window.toggleHoliday(date, !isHoliday);
            header.appendChild(holBtn);

            groupDiv.appendChild(header);

            const list = document.createElement('ul');
            list.className = 'checklist';

            daySlots.forEach(slot => {
                const li = document.createElement('li');
                li.className = `timetable-item status-${slot.status}`;

                // Action buttons: Always show check/x unless holiday
                // Delete button: Shown on hover via CSS
                let mainActions = '';
                if (slot.status === 'holiday') {
                    mainActions = '<span style="font-size:0.8rem;color:var(--text-muted)">Holiday</span>';
                } else {
                    mainActions = `
                        <button class="btn-text btn-mark-att" title="Attended">✔</button>
                        <button class="btn-text btn-mark-miss" title="Missed">✘</button>
                     `;
                }

                li.innerHTML = `
                    <div class="tt-time" title="Click to edit time">${slot.start}<br><small>${slot.end}</small></div>
                    <div class="tt-subject" title="Click to edit subject">${window.escapeHTML(slot.subject)}</div>
                    <div class="tt-actions">
                        ${mainActions}
                        <button class="btn-delete-slot" title="Delete Class (Temporary)">🗑</button>
                    </div>
                `;

                // Attended/Missed State
                if (slot.status === 'attended') {
                    const btn = li.querySelector('.btn-mark-att');
                    if (btn) btn.style.color = 'var(--success)';
                }
                if (slot.status === 'missed') {
                    const btn = li.querySelector('.btn-mark-miss');
                    if (btn) btn.style.color = 'var(--danger)';
                }

                // Interaction Listeners
                if (slot.status !== 'holiday') {
                    li.querySelector('.btn-mark-att').addEventListener('click', () => mark(slot, 'attended'));
                    li.querySelector('.btn-mark-miss').addEventListener('click', () => mark(slot, 'missed'));
                }

                // Inline Editing Listeners
                li.querySelector('.tt-subject').addEventListener('click', () => editSubject(slot));
                li.querySelector('.tt-time').addEventListener('click', () => editTime(slot));

                // Delete Listener
                li.querySelector('.btn-delete-slot').addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent other clicks
                    deleteSlot(slot);
                });

                list.appendChild(li);
            });

            groupDiv.appendChild(list);
            container.appendChild(groupDiv);
        });
    }

    function mark(slot, status) {
        fetch(`${apiBase}/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: slot.date,
                timetable_id: slot.id,
                status: status
            })
        }).then(() => {
            window.showFeedback(`Marked as ${status}`);
            loadAttendance();
        });
    }

    function renderStats(subjects) {
        const container = document.getElementById('att-stats');
        if (!container) return;

        let html = '<div class="att-stats-grid">';

        subjects.forEach(sub => {
            const pct = sub.percentage;
            const radius = 24;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (pct / 100) * circumference;

            let colorClass = 'ring-med';
            if (pct >= 75) colorClass = 'ring-high';
            else if (pct < 60) colorClass = 'ring-low';

            html += `
                <div class="att-stat-card reveal stagger-4">
                    <svg class="progress-ring">
                        <circle stroke="rgba(255,255,255,0.1)" stroke-width="4" fill="transparent" r="${radius}" cx="30" cy="30"/>
                        <circle class="progress-ring__circle ${colorClass}" stroke-width="4" fill="transparent" r="${radius}" cx="30" cy="30"
                                style="stroke-dasharray: ${circumference} ${circumference}; stroke-dashoffset: ${offset}"/>
                    </svg>
                    <div style="position:absolute; top:28px; font-size:0.7rem; font-weight:600;">${Math.round(pct)}%</div>
                    <div class="stat-subject">${sub.name}</div>
                    <div class="stat-value">${sub.attended}/${sub.total}</div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // Inline Editing Functions
    function editSubject(slot) {
        const newSubject = prompt("Rename Subject:", slot.subject);
        if (newSubject === null || newSubject === slot.subject) return;

        updateSlot(slot.id, { subject_name: newSubject });
    }

    function editTime(slot) {
        const newStart = prompt("Start Time (HH:MM):", slot.start);
        if (newStart === null) return;

        const newEnd = prompt("End Time (HH:MM):", slot.end);
        if (newEnd === null) return;

        updateSlot(slot.id, { start: newStart, end: newEnd });
    }

    function updateSlot(id, data) {
        fetch(`${apiBase}/timetable/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(() => {
            window.showFeedback('Updated (This Week Only)');
            loadAttendance();
        });
    }

    function deleteSlot(slot) {
        if (!confirm(`Remove ${slot.subject} from this week's schedule?`)) return;

        fetch(`${apiBase}/timetable/${slot.id}`, {
            method: 'DELETE'
        }).then(() => {
            window.showFeedback('Removed (This Week Only)');
            loadAttendance();
        });
    }

    // ==============================================
    // ATTENDANCE WINDOW VIEW
    // ==============================================
    const windowStartInput = document.getElementById('att-window-start');
    const windowEndInput = document.getElementById('att-window-end');
    const windowApplyBtn = document.getElementById('att-window-apply');
    const windowResults = document.getElementById('att-window-results');

    // Pre-fill from localStorage
    const savedStart = localStorage.getItem('att_window_start');
    const savedEnd = localStorage.getItem('att_window_end');
    if (windowStartInput && savedStart) windowStartInput.value = savedStart;
    if (windowEndInput && savedEnd) windowEndInput.value = savedEnd;

    function fetchWindow() {
        const start = windowStartInput.value;
        const end = windowEndInput.value;
        if (!start || !end) return;

        localStorage.setItem('att_window_start', start);
        localStorage.setItem('att_window_end', end);

        fetch(`${apiBase}/window?start=${start}&end=${end}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    windowResults.innerHTML = `
                        <div class="att-window-section">
                            <div class="att-window-error">⚠ ${data.error}</div>
                        </div>`;
                    return;
                }
                renderWindowResults(data);
            })
            .catch(() => {
                windowResults.innerHTML = `<div class="att-window-error">⚠ Could not fetch window data.</div>`;
            });
    }

    function renderWindowResults(data) {
        if (!windowResults) return;

        const radius = 24;
        const circumference = 2 * Math.PI * radius;

        let ringsHtml = '';
        data.subjects.forEach(sub => {
            const pct = sub.percentage;
            const offset = circumference - (pct / 100) * circumference;
            // Always use 80% threshold for internals window
            let colorClass = 'ring-high';
            if (pct < 80) colorClass = 'ring-low';
            else if (pct < 90) colorClass = 'ring-med';

            const badge = sub.below_threshold
                ? `<span class="att-warning-badge">⚠</span>`
                : '';

            ringsHtml += `
                <div class="att-stat-card${sub.below_threshold ? ' att-stat-card--warn' : ''}" style="position:relative;">
                    ${badge}
                    <svg class="progress-ring">
                        <circle stroke="rgba(255,255,255,0.1)" stroke-width="4" fill="transparent" r="${radius}" cx="30" cy="30"/>
                        <circle class="progress-ring__circle ${colorClass}" stroke-width="4" fill="transparent"
                                r="${radius}" cx="30" cy="30"
                                style="stroke-dasharray:${circumference} ${circumference};stroke-dashoffset:${offset}"/>
                    </svg>
                    <div style="position:absolute;top:28px;font-size:0.7rem;font-weight:600;">${Math.round(pct)}%</div>
                    <div class="stat-subject">${sub.name}</div>
                    <div class="stat-value">${sub.attended}/${sub.total}</div>
                </div>
            `;
        });

        windowResults.innerHTML = `
            <div class="att-window-section">
                <div class="att-window-section-title">
                    📊 Window: ${data.start} → ${data.end}
                </div>
                <div class="att-stats-grid">${ringsHtml}</div>
            </div>`;
    }

    if (windowApplyBtn) {
        windowApplyBtn.addEventListener('click', fetchWindow);
    }

    // Auto-fetch if saved values exist
    if (savedStart && savedEnd) {
        fetchWindow();
    }

    loadAttendance();
});
