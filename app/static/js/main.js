document.addEventListener('DOMContentLoaded', () => {

    // ── Date Display (Pill Format) ──
    const dateDisplay = document.getElementById('date-display');
    const updateDate = () => {
        const now = new Date();
        const month = now.toLocaleString('en-US', { month: 'short' });
        const day = now.getDate();
        const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        dateDisplay.textContent = `📅 ${month} ${day} – ${time}`;
    };
    updateDate();
    setInterval(updateDate, 60000);

    // ── Keyboard Shortcuts ──
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        const map = {
            't': 'timetable-section',
            'a': 'attendance-section',
            'c': 'calendar-section',
            'f': 'finance-section',
            'g': 'goals-section',
            'y': 'gym-section',
            'p': 'projects-section',
            'r': 'grades-section',
            'e': 'ese-calc-section',
        };

        const targetId = map[e.key.toLowerCase()];
        if (targetId) {
            const el = document.getElementById(targetId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    console.log('Calm Cockpit v2.0 Loaded');

    // ── Global Security Helper (XSS Protection) ──
    window.escapeHTML = function(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    // ── Global Feedback Helper (Toast) ──
    window.showFeedback = (message, element) => {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        if (element) {
            element.classList.add('highlight-flash');
            setTimeout(() => element.classList.remove('highlight-flash'), 1000);
        }
    };

    // ── Spotlight Effect (Mouse-tracking radial glow) ──
    const panels = document.querySelectorAll('.panel');

    document.addEventListener('mousemove', (e) => {
        panels.forEach(panel => {
            const rect = panel.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            panel.style.setProperty('--x', `${x}px`);
            panel.style.setProperty('--y', `${y}px`);
        });
    });
});
