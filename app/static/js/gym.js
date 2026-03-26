document.addEventListener('DOMContentLoaded', () => {
    const apiBase = '/api/gym';

    const daySelect = document.getElementById('gym-day-select');
    const exerciseSelect = document.getElementById('gym-exercise-select');
    const setsInput = document.getElementById('gym-sets');
    const repsInput = document.getElementById('gym-reps');
    const weightInput = document.getElementById('gym-weight');
    const logBtn = document.getElementById('gym-log-btn');
    const chartCanvas = document.getElementById('gym-chart');
    const ctx = chartCanvas.getContext('2d');

    // Workout Splits Configuration
    const workoutSplits = {
        'Leg': ['Squats', 'Extensions', 'Curls', 'Raises'],
        'Chest': ['Flat Press', 'Hammer Press', 'Incline Press', 'Decline Press', 'Fly'],
        'Lats': ['Pulldowns', 'Seated Rows', 'Machine Bend Over', 'Shrugs'],
        'Arms': ['Barbell Curls', 'Bicep Machine Curls', 'Cable Skull Crushers', 'Rope Push Downs', 'Tricep Dips'],
        'Shoulders': ['Shoulder Press', 'Side Raises', 'Rear Delt Flys', 'Face Pull', 'Upright Row', 'Shrug']
    };

    // 1. Handle Day Selection
    daySelect.addEventListener('change', () => {
        const day = daySelect.value;
        const exercises = workoutSplits[day] || [];

        exerciseSelect.innerHTML = '';
        if (exercises.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = 'Select a Day first';
            exerciseSelect.appendChild(opt);
            return;
        }

        exercises.forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex;
            opt.textContent = ex;
            exerciseSelect.appendChild(opt);
        });

        // Trigger exercise change to load graph for first item
        if (exercises.length > 0) {
            exerciseSelect.value = exercises[0];
            loadGraphData(exercises[0]);
        }
    });

    // 2. Handle Exercise Selection (Graph Update)
    exerciseSelect.addEventListener('change', () => {
        const exName = exerciseSelect.value;
        if (exName) loadGraphData(exName);
    });

    function loadGraphData(exerciseName) {
        let url = `${apiBase}/data`;
        if (exerciseName) url += `?exercise_name=${encodeURIComponent(exerciseName)}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                drawChart(data.volume_data, exerciseName);
                if (data.history) renderHistory(data.history);
            });
    }

    function renderHistory(history) {
        const container = document.getElementById('gym-history');
        if (!container) return;

        container.innerHTML = '';
        if (history.length === 0) {
            container.innerHTML = '<div style="color:#666; font-size:0.8rem; text-align:center;">No recent workouts</div>';
            return;
        }

        history.forEach(item => {
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            div.style.fontSize = '0.85rem';

            const dateStr = new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            let html = `<div style="color:var(--primary); margin-bottom:2px;">${dateStr}</div>`;

            item.sets.forEach(s => {
                html += `<div style="display:flex; justify-content:space-between; color:#ccc;">
                    <span>${s.name}</span>
                    <span>${s.sets} x ${s.reps} @ ${s.weight || 0}kg</span>
                </div>`;
            });

            div.innerHTML = html;
            container.appendChild(div);
        });
    }

    function drawChart(data, label) {
        // Handle High-DPI screens
        const dpr = window.devicePixelRatio || 1;
        const rect = chartCanvas.getBoundingClientRect();

        // Set actual size in memory (scaled to account for extra pixel density)
        chartCanvas.width = rect.width * dpr;
        chartCanvas.height = rect.height * dpr;

        // Normalize coordinate system to use css pixels
        ctx.scale(dpr, dpr);

        // Clear using logical width/height
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (!data || data.length === 0 || data.every(d => d.volume === 0)) {
            ctx.fillStyle = '#888';
            ctx.font = '10px Inter';
            ctx.fillText(`No active data for ${label || 'selection'}`, 10, 30);
            return;
        }

        const padding = 5;
        // Use logical dimensions (rect) for drawing calculations since context is scaled
        const plotWidth = rect.width - padding * 2;
        const plotHeight = rect.height - padding * 2;
        const maxVol = Math.max(...data.map(d => d.volume), 10);
        const barWidth = plotWidth / data.length;

        ctx.fillStyle = '#03dac6'; // Cyan accent

        data.forEach((d, i) => {
            const barHeight = (d.volume / maxVol) * plotHeight;
            const x = padding + i * barWidth + 2;
            const y = plotHeight + padding - barHeight;
            ctx.fillRect(x, y, barWidth - 4, barHeight);
        });

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '8px Inter';
        ctx.fillText(label || '', plotWidth - 50, 10);
    }

    logBtn.addEventListener('click', () => {
        const exName = exerciseSelect.value;
        if (!exName) return alert("Select an exercise first");

        const payload = {
            date: new Date().toISOString().split('T')[0],
            sets: [{
                exercise_name: exName,
                sets: parseInt(setsInput.value, 10),
                reps: parseInt(repsInput.value, 10),
                weight: weightInput.value ? parseFloat(weightInput.value) : null
            }]
        };

        if (!payload.sets[0].sets || !payload.sets[0].reps) {
            alert("Please enter Sets and Reps");
            return;
        }

        fetch(`${apiBase}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) throw new Error("Validation Error: Please check your input");
            return res.json();
        })
        .then(() => {
            setsInput.value = '';
            repsInput.value = ''; // Keep weight?
            loadGraphData(exName); // Reload graph to show new volume
            window.showFeedback('Workout logged');
        })
        .catch(err => alert("Failed to log: " + err.message));
    });

    // Add enter key support
    [setsInput, repsInput, weightInput].forEach(inp => {
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') logBtn.click();
        });
    });

    // Init: Load generic data first or wait
    // Actually, let's just trigger leg day default?
    // Or leave empty.
    daySelect.value = "Leg";
    daySelect.dispatchEvent(new Event('change'));
});
