document.addEventListener('DOMContentLoaded', () => {
    const apiBase = '/api/goals';
    const list = document.getElementById('goals-list');
    const progressBar = document.getElementById('goals-progress');
    const input = document.getElementById('new-goal-input');

    function loadGoals() {
        fetch(apiBase)
            .then(res => res.json())
            .then(data => {
                renderGoals(data.goals);
                progressBar.style.width = `${data.percentage}%`;
            });
    }

    function renderGoals(goals) {
        list.innerHTML = '';
        goals.forEach(goal => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" ${goal.is_completed ? 'checked' : ''}>
                <span class="editable goal-text">${window.escapeHTML(goal.text)}</span>
            `;

            // Checkbox listener
            const checkbox = li.querySelector('input');
            checkbox.addEventListener('change', () => {
                updateGoal(goal.id, { is_completed: checkbox.checked });
            });

            // Inline edit text
            const textSpan = li.querySelector('.goal-text');
            textSpan.addEventListener('click', () => {
                const newText = prompt("Edit goal:", goal.text);
                if (newText && newText !== goal.text) {
                    updateGoal(goal.id, { text: newText });
                }
            });

            list.appendChild(li);
        });
    }

    function updateGoal(id, updates) {
        fetch(`${apiBase}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        }).then(() => loadGoals());
    }

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            fetch(apiBase, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: input.value.trim() })
            }).then(() => {
                input.value = '';
                loadGoals();
            });
        }
    });

    setupConfirmButton(document.getElementById('reset-goals-btn'), () => {
        fetch(apiBase, { method: 'DELETE' })
            .then(() => {
                loadGoals();
                window.showFeedback('Goals cleared');
            });
    });

    loadGoals();
});
