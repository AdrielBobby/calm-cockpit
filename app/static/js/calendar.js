document.addEventListener('DOMContentLoaded', () => {
    const API = '/api/calendar';
    const LABELS = ['Personal', 'Exam', 'Project', 'Gym', 'Study', 'Other'];
    const LABEL_COLORS = {
        Personal: '#bb86fc',
        Exam:     '#cf6679',
        Project:  '#03dac6',
        Gym:      '#ffb74d',
        Study:    '#81d4fa',
        Other:    '#a0a0a0',
    };

    // State
    const today = new Date();
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth(); // 0-indexed
    let eventsCache = {}; // keyed by "YYYY-MM-DD"

    // Elements
    const grid = document.getElementById('cal-grid');
    const monthLabel = document.getElementById('cal-month-label');
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    const modal = document.getElementById('cal-modal');
    const modalBackdrop = document.getElementById('cal-modal-backdrop');
    const modalTitle = document.getElementById('cal-modal-title');
    const modalEventsList = document.getElementById('cal-events-list');
    const modalForm = document.getElementById('cal-event-form');

    if (!grid) return; // Calendar panel not present

    // --- Navigation ---
    prevBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        loadMonth();
    });

    nextBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        loadMonth();
    });

    // --- Core: Load Month ---
    function loadMonth() {
        const monthStr = formatMonth(currentYear, currentMonth);
        monthLabel.textContent = new Date(currentYear, currentMonth, 1)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        fetch(`${API}/events?month=${monthStr}`)
            .then(r => r.json())
            .then(events => {
                // Re-index events by date
                eventsCache = {};
                events.forEach(e => {
                    if (!eventsCache[e.date]) eventsCache[e.date] = [];
                    eventsCache[e.date].push(e);
                });
                renderGrid();
            });
    }

    // --- Render Calendar Grid ---
    function renderGrid() {
        grid.innerHTML = '';

        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startDow = (firstDay.getDay() + 6) % 7; // Mon=0

        // Day name headers
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => {
            const h = document.createElement('div');
            h.className = 'cal-day-name';
            h.textContent = d;
            grid.appendChild(h);
        });

        // Empty leading cells
        for (let i = 0; i < startDow; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day-cell cal-day-empty';
            grid.appendChild(empty);
        }

        // Day cells
        const todayStr = formatDate(today);
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = formatDate(new Date(currentYear, currentMonth, d));
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell';
            if (dateStr === todayStr) cell.classList.add('cal-today');

            const num = document.createElement('span');
            num.className = 'cal-day-num';
            num.textContent = d;
            cell.appendChild(num);

            // Event dots
            const dayEvents = eventsCache[dateStr] || [];
            if (dayEvents.length) {
                const dotsRow = document.createElement('div');
                dotsRow.className = 'cal-dots';
                dayEvents.slice(0, 3).forEach(ev => {
                    const dot = document.createElement('span');
                    dot.className = 'cal-dot';
                    dot.style.background = LABEL_COLORS[ev.label] || '#888';
                    dot.title = ev.title;
                    dotsRow.appendChild(dot);
                });
                if (dayEvents.length > 3) {
                    const more = document.createElement('span');
                    more.className = 'cal-dot-more';
                    more.textContent = `+${dayEvents.length - 3}`;
                    dotsRow.appendChild(more);
                }
                cell.appendChild(dotsRow);
            }

            cell.addEventListener('click', () => openModal(dateStr));
            grid.appendChild(cell);
        }
    }

    // --- Modal ---
    function openModal(dateStr) {
        const dayEvents = eventsCache[dateStr] || [];
        const displayDate = new Date(dateStr + 'T00:00:00')
            .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        modalTitle.textContent = displayDate;
        renderModalEvents(dayEvents, dateStr);
        resetForm(dateStr);

        modal.classList.add('open');
        modalBackdrop.classList.add('open');
        document.addEventListener('keydown', onEsc);
    }

    function closeModal() {
        modal.classList.remove('open');
        modalBackdrop.classList.remove('open');
        document.removeEventListener('keydown', onEsc);
    }

    function onEsc(e) { if (e.key === 'Escape') closeModal(); }

    modalBackdrop.addEventListener('click', closeModal);
    document.getElementById('cal-modal-close').addEventListener('click', closeModal);

    function renderModalEvents(events, dateStr) {
        modalEventsList.innerHTML = '';
        if (!events.length) {
            modalEventsList.innerHTML = '<p class="cal-no-events">No events yet — add one below.</p>';
            return;
        }
        events.forEach(ev => {
            const status = ev.status || 'planned';
            let statusClass = 'status-planned';
            let statusText = 'Planned';
            if (status === 'in_progress') { statusClass = 'status-inprogress'; statusText = 'In Progress'; }
            if (status === 'done') { statusClass = 'status-done'; statusText = 'Done'; }

            const item = document.createElement('div');
            item.className = 'cal-event-item';
            item.innerHTML = `
                <span class="cal-event-dot" style="background:${LABEL_COLORS[ev.label] || '#888'}"></span>
                <div class="cal-event-info">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <strong>${escHtml(ev.title)}</strong>
                        <span class="status-pill ${statusClass} cal-event-status" style="cursor:pointer;" title="Click to change status">${statusText}</span>
                    </div>
                    ${ev.start_time ? `<span class="cal-event-time">${ev.start_time}${ev.end_time ? ' – ' + ev.end_time : ''}</span>` : ''}
                    ${ev.description ? `<span class="cal-event-desc">${escHtml(ev.description)}</span>` : ''}
                    <span class="cal-label-badge" style="background:${LABEL_COLORS[ev.label] || '#888'}22;color:${LABEL_COLORS[ev.label] || '#888'}">${ev.label}</span>
                </div>
                <div class="cal-event-actions">
                    <button class="btn-cal-edit btn-text" title="Edit">✎</button>
                    <button class="btn-cal-delete btn-text" title="Delete" style="color:var(--danger)">✕</button>
                </div>
            `;
            
            // Cycle status on click
            item.querySelector('.cal-event-status').addEventListener('click', () => {
                const states = ['planned', 'in_progress', 'done'];
                const nextState = states[(states.indexOf(status) + 1) % states.length];
                fetch(`${API}/event/${ev.id}/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: nextState })
                }).then(() => refreshAfterChange(dateStr));
            });

            item.querySelector('.btn-cal-edit').addEventListener('click', () => populateFormForEdit(ev));
            item.querySelector('.btn-cal-delete').addEventListener('click', () => deleteEvent(ev.id, dateStr));
            modalEventsList.appendChild(item);
        });
    }

    function resetForm(dateStr) {
        modalForm.dataset.editId = '';
        modalForm.dataset.date = dateStr;
        document.getElementById('cal-form-title-label').textContent = 'Add Event';
        document.getElementById('cal-input-title').value = '';
        document.getElementById('cal-input-desc').value = '';
        document.getElementById('cal-input-start').value = '';
        document.getElementById('cal-input-end').value = '';
        document.getElementById('cal-input-label').value = 'Personal';
        document.getElementById('cal-input-status').value = 'planned';
        document.getElementById('cal-form-submit').textContent = 'Add Event';
        document.getElementById('cal-form-cancel').style.display = 'none';
    }

    function populateFormForEdit(ev) {
        modalForm.dataset.editId = ev.id;
        modalForm.dataset.date = ev.date;
        document.getElementById('cal-form-title-label').textContent = 'Edit Event';
        document.getElementById('cal-input-title').value = ev.title;
        document.getElementById('cal-input-desc').value = ev.description || '';
        document.getElementById('cal-input-start').value = ev.start_time || '';
        document.getElementById('cal-input-end').value = ev.end_time || '';
        document.getElementById('cal-input-label').value = ev.label || 'Personal';
        document.getElementById('cal-input-status').value = ev.status || 'planned';
        document.getElementById('cal-form-submit').textContent = 'Save Changes';
        document.getElementById('cal-form-cancel').style.display = 'inline-block';
        document.getElementById('cal-input-title').focus();
    }

    document.getElementById('cal-form-cancel').addEventListener('click', () => {
        resetForm(modalForm.dataset.date);
    });

    // --- Form Submit (Create / Update) ---
    modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = modalForm.dataset.editId;
        const dateStr = modalForm.dataset.date;
        const payload = {
            title: document.getElementById('cal-input-title').value.trim(),
            description: document.getElementById('cal-input-desc').value.trim(),
            date: dateStr,
            start_time: document.getElementById('cal-input-start').value.trim(),
            end_time: document.getElementById('cal-input-end').value.trim(),
            label: document.getElementById('cal-input-label').value,
            status: document.getElementById('cal-input-status').value,
        };

        if (!payload.title) {
            document.getElementById('cal-input-title').focus();
            return;
        }

        const url = editId ? `${API}/event/${editId}/update` : `${API}/event`;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(() => {
            window.showFeedback(editId ? 'Event updated' : 'Event added');
            // Refresh the modal and grid for the current month
            refreshAfterChange(dateStr);
        });
    });

    function deleteEvent(id, dateStr) {
        fetch(`${API}/event/${id}/delete`, { method: 'POST' })
            .then(() => {
                window.showFeedback('Event deleted');
                refreshAfterChange(dateStr);
            });
    }

    function refreshAfterChange(openDate) {
        const monthStr = formatMonth(currentYear, currentMonth);
        fetch(`${API}/events?month=${monthStr}`)
            .then(r => r.json())
            .then(events => {
                eventsCache = {};
                events.forEach(e => {
                    if (!eventsCache[e.date]) eventsCache[e.date] = [];
                    eventsCache[e.date].push(e);
                });
                renderGrid();
                // Re-open modal for same date if it's still open
                if (modal.classList.contains('open')) {
                    const dayEvents = eventsCache[openDate] || [];
                    renderModalEvents(dayEvents, openDate);
                    resetForm(openDate);
                }
            });
    }

    // --- Helpers ---
    function formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatMonth(y, m) {
        return `${y}-${String(m + 1).padStart(2, '0')}`;
    }

    function escHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- Boot ---
    loadMonth();
});
