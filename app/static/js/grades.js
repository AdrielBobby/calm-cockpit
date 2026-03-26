document.addEventListener('DOMContentLoaded', () => {
    const apiBase = '/api/grades';

    // Elements
    const cgpaVal = document.getElementById('cgpa-value');
    const semTableBody = document.querySelector('#semesters-table tbody');
    const newSemNum = document.getElementById('new-sem-number');
    const newSemSgpa = document.getElementById('new-sem-sgpa');
    const addSemBtn = document.getElementById('add-sem-btn');

    const internalsGrid = document.getElementById('internals-grid');
    const clearInternalsBtn = document.getElementById('clear-internals-btn');

    let currentSemesterId = null;

    function loadGrades() {
        loadSGPA();
        loadInternals();
    }

    function loadSGPA() {
        fetch(`${apiBase}/sgpa`)
            .then(res => res.json())
            .then(data => {
                cgpaVal.textContent = data.cgpa;
                semTableBody.innerHTML = '';

                data.semesters.forEach(sem => {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td>${sem.number}</td><td>${sem.sgpa}</td>`;
                    semTableBody.appendChild(row);
                });
                // Highlight update
                cgpaVal.classList.add('highlight-flash');
                setTimeout(() => cgpaVal.classList.remove('highlight-flash'), 1000);
            });
    }

    addSemBtn.addEventListener('click', () => {
        const num = newSemNum.value;
        const sgpa = newSemSgpa.value;

        if (!num || !sgpa) return;
        if (parseFloat(sgpa) > 10 || parseFloat(sgpa) < 0) {
            alert('SGPA must be between 0 and 10');
            return;
        }

        fetch(`${apiBase}/sgpa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: parseInt(num), sgpa: parseFloat(sgpa) })
        }).then(() => {
            newSemNum.value = '';
            newSemSgpa.value = '';
            loadSGPA();
        });
    });

    setupConfirmButton(document.getElementById('reset-sgpa-btn'), () => {
        fetch(`${apiBase}/sgpa`, { method: 'DELETE' })
            .then(() => {
                loadSGPA();
                window.showFeedback('SGPA Reset');
            });
    });

    function loadInternals() {
        fetch(`${apiBase}/internals`)
            .then(res => res.json())
            .then(data => {
                currentSemesterId = data.semester_id;
                renderInternalsMatrix(data.marks, data.subject_names || {});
            });
    }

    function renderInternalsMatrix(marks, subjectNames) {
        internalsGrid.innerHTML = '';

        // Headers (Editable Subjects)
        for (let i = 0; i < 6; i++) {
            const h = document.createElement('div');
            h.className = 'internals-header-cell';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = subjectNames[i] || `S${i + 1}`;
            input.addEventListener('change', () => {
                fetch(`${apiBase}/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        semester_id: currentSemesterId,
                        subject_index: i,
                        name: input.value
                    })
                }).then(() => window.showFeedback('Subject renamed'));
            });
            h.appendChild(input);
            internalsGrid.appendChild(h);
        }

        // Row 1 inputs (Internal 1)
        for (let i = 0; i < 6; i++) {
            const val = marks[`${i}_1`] || '';
            const inp = createInternalInput(i, 1, val);
            internalsGrid.appendChild(inp);
        }

        // Row 2 inputs (Internal 2)
        for (let i = 0; i < 6; i++) {
            const val = marks[`${i}_2`] || '';
            const inp = createInternalInput(i, 2, val);
            internalsGrid.appendChild(inp);
        }
    }

    function createInternalInput(subIdx, intNum, val) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = val;
        inp.className = 'tiny-input';
        inp.placeholder = `I${intNum}`;

        inp.addEventListener('change', () => {
            saveInternal(subIdx, intNum, inp.value);
        });
        return inp;
    }

    function saveInternal(subIdx, intNum, mark) {
        fetch(`${apiBase}/internals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                semester_id: currentSemesterId,
                subject_index: subIdx,
                internal_number: intNum,
                mark: mark ? parseFloat(mark) : null
            })
        }); // Valid to fire and forget for "auto-save" feel, or show status
    }

    setupConfirmButton(clearInternalsBtn, () => {
        fetch(`${apiBase}/internals/clear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ semester_id: currentSemesterId })
        }).then(() => {
            loadInternals();
            window.showFeedback('Internals cleared');
        });
    });

    loadGrades();
});
