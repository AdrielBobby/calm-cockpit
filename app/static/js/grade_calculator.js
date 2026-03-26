/**
 * ESE Grade Calculator – Calm Cockpit Integration
 * Extracted from ese-grade-calc.vercel.app (grade calculator section only).
 * All functions prefixed with "ese" to avoid collisions with existing grades.js.
 */

(function () {
    'use strict';

    /* ── Grade thresholds ── */
    const gradeThresholds = [
        { grade: 'S',  point: 10,  min: 90, color: 'ese-grade-s' },
        { grade: 'A+', point: 9.0, min: 85, color: 'ese-grade-aplus' },
        { grade: 'A',  point: 8.5, min: 80, color: 'ese-grade-a' },
        { grade: 'B+', point: 8.0, min: 75, color: 'ese-grade-bplus' },
        { grade: 'B',  point: 7.5, min: 70, color: 'ese-grade-b' },
        { grade: 'C+', point: 7.0, min: 65, color: 'ese-grade-cplus' },
        { grade: 'C',  point: 6.5, min: 60, color: 'ese-grade-c' },
        { grade: 'D',  point: 6.0, min: 55, color: 'ese-grade-d' },
        { grade: 'P',  point: 5.5, min: 50, color: 'ese-grade-p' }
    ];

    /* ── Subject list (client-side only, no persistence) ── */
    let subjects = [];

    /* ── DOM refs (set after DOMContentLoaded) ── */
    let elName, elCurrent, elMaxSess, elMaxESE, elContainer;

    /* ── Preset setter ── */
    function eseSetPreset(type) {
        if (type === 'theory')     { elMaxSess.value = 50;  elMaxESE.value = 100; }
        if (type === 'integrated') { elMaxSess.value = 150; elMaxESE.value = 100; }
        if (type === 'lab')        { elMaxSess.value = 75;  elMaxESE.value = 75;  }
    }

    /* ── Core calculation ── */
    function eseCalculateRequiredESE(currentMarks, maxSessional, maxESE, targetPercentage) {
        const totalMarks = maxSessional + maxESE;
        const targetTotal = (targetPercentage / 100) * totalMarks;
        const requiredESE = targetTotal - currentMarks;
        const minESE = 0.4 * maxESE;

        return {
            required: Math.ceil(requiredESE),
            possible: requiredESE <= maxESE && requiredESE >= minESE
        };
    }

    /* ── Add subject ── */
    function eseAddSubject() {
        const name = elName.value.trim();
        const current = parseFloat(elCurrent.value);
        const maxSess = parseFloat(elMaxSess.value);
        const maxESE = parseFloat(elMaxESE.value);

        if (!name || isNaN(current) || isNaN(maxSess) || isNaN(maxESE)) {
            showToast('Fill in all fields');
            return;
        }
        if (current > maxSess) {
            showToast('Current marks can\'t exceed max sessional');
            return;
        }

        subjects.push({ name, current, maxSess, maxESE });
        elName.value = '';
        elCurrent.value = '';
        eseRenderSubjects();
    }

    /* ── Delete subject ── */
    function eseDeleteSubject(index) {
        subjects.splice(index, 1);
        eseRenderSubjects();
    }

    /* ── Update subject field inline ── */
    function eseUpdateSubject(index, field, value) {
        const v = parseFloat(value);
        if (!isNaN(v)) {
            subjects[index][field] = v;
            eseRenderSubjects();
        }
    }

    /* ── Render all subject cards ── */
    function eseRenderSubjects() {
        if (subjects.length === 0) {
            elContainer.innerHTML =
                '<div class="ese-empty-state">No subjects yet — add one above to get started.</div>';
            return;
        }

        elContainer.innerHTML = '';

        subjects.forEach(function (subject, index) {
            const totalMarks = subject.maxSess + subject.maxESE;
            const currentPct = ((subject.current / totalMarks) * 100).toFixed(1);
            const minESEThreshold = 0.4 * subject.maxESE;

            /* Build grade rows */
            let rowsHTML = '';
            gradeThresholds.forEach(function (grade) {
                const result = eseCalculateRequiredESE(
                    subject.current, subject.maxSess, subject.maxESE, grade.min
                );
                let cls = 'ese-value';
                let note = '';

                if (!result.possible) {
                    if (result.required > subject.maxESE) {
                        cls += ' impossible';
                        note = '<span class="ese-note">impossible</span>';
                    } else {
                        cls += ' warning';
                        note = '<span class="ese-note">below min ' + minESEThreshold + '</span>';
                    }
                } else if (result.required < minESEThreshold) {
                    cls += ' warning';
                    note = '<span class="ese-note">below min ' + minESEThreshold + '</span>';
                }

                const display = (result.required <= subject.maxESE)
                    ? Math.max(result.required, minESEThreshold)
                    : '—';

                rowsHTML +=
                    '<tr>' +
                        '<td><span class="ese-grade-tag ' + grade.color + '">' + grade.grade + '</span></td>' +
                        '<td>' + grade.point + '</td>' +
                        '<td>' + grade.min + '%</td>' +
                        '<td><span class="' + cls + '">' + display + '</span>' + note + '</td>' +
                    '</tr>';
            });

            /* Pass / fail alert */
            const passResult = eseCalculateRequiredESE(
                subject.current, subject.maxSess, subject.maxESE, 50
            );
            let passMsg = '';
            let passClass = 'ese-pass-alert';

            if (passResult.required > subject.maxESE) {
                passMsg = 'Cannot pass even with ' + subject.maxESE + '/' + subject.maxESE + ' in ESE';
                passClass += ' ese-pass-danger';
            } else if (passResult.required <= minESEThreshold) {
                passMsg = 'Any score ≥' + minESEThreshold + '/' + subject.maxESE + ' in ESE will pass';
                passClass += ' ese-pass-safe';
            } else {
                passMsg = 'Need ' + passResult.required + '/' + subject.maxESE + ' in ESE to pass';
            }

            /* Build card */
            const card = document.createElement('div');
            card.className = 'ese-subject-card';
            card.innerHTML =
                '<div class="ese-subject-top">' +
                    '<span class="ese-subject-name">' + subject.name + '</span>' +
                    '<button class="btn-small ese-delete-btn" data-idx="' + index + '">Delete</button>' +
                '</div>' +

                '<div class="ese-stats-bar">' +
                    '<div class="ese-stat-item"><span>Current:</span> <strong>' + subject.current + '/' + subject.maxSess + '</strong></div>' +
                    '<div class="ese-stat-item"><span>Total:</span> <strong>' + totalMarks + '</strong></div>' +
                    '<div class="ese-stat-item"><span>Pct:</span> <strong>' + currentPct + '%</strong></div>' +
                '</div>' +

                '<div class="' + passClass + '">' + passMsg + '</div>' +

                '<div class="ese-grades-table">' +
                    '<table>' +
                        '<thead><tr>' +
                            '<th>Grade</th><th>GP</th><th>Target %</th>' +
                            '<th>Min ESE (/' + subject.maxESE + ')</th>' +
                        '</tr></thead>' +
                        '<tbody>' + rowsHTML + '</tbody>' +
                    '</table>' +
                '</div>' +

                '<div class="ese-edit-bar">' +
                    '<input type="number" class="ese-edit-input" placeholder="Update current marks" data-idx="' + index + '" data-field="current">' +
                    '<input type="number" class="ese-edit-input" placeholder="Update max sessional" data-idx="' + index + '" data-field="maxSess">' +
                '</div>';

            elContainer.appendChild(card);
        });

        /* Attach delete listeners */
        elContainer.querySelectorAll('.ese-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                eseDeleteSubject(parseInt(this.getAttribute('data-idx'), 10));
            });
        });

        /* Attach edit listeners */
        elContainer.querySelectorAll('.ese-edit-input').forEach(function (input) {
            input.addEventListener('change', function () {
                eseUpdateSubject(
                    parseInt(this.getAttribute('data-idx'), 10),
                    this.getAttribute('data-field'),
                    this.value
                );
            });
        });
    }

    /* ── Show toast (reuse dashboard toast if available) ── */
    function showToast(msg) {
        const t = document.getElementById('toast');
        if (t) {
            t.textContent = msg;
            t.classList.add('show');
            setTimeout(function () { t.classList.remove('show'); }, 2000);
        } else {
            alert(msg);
        }
    }

    /* ── Bootstrap on DOM ready ── */
    document.addEventListener('DOMContentLoaded', function () {
        elName      = document.getElementById('eseSubjectName');
        elCurrent   = document.getElementById('eseCurrentMarks');
        elMaxSess   = document.getElementById('eseMaxSessional');
        elMaxESE    = document.getElementById('eseMaxESE');
        elContainer = document.getElementById('eseSubjectsContainer');

        /* Preset buttons */
        document.querySelectorAll('.ese-preset-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                eseSetPreset(this.getAttribute('data-preset'));
            });
        });

        /* Add button */
        var addBtn = document.getElementById('eseAddSubjectBtn');
        if (addBtn) {
            addBtn.addEventListener('click', eseAddSubject);
        }

        /* Enter key in form inputs → add subject */
        var formInputs = document.querySelectorAll('.ese-form-grid input');
        formInputs.forEach(function (input) {
            input.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') { eseAddSubject(); }
            });
        });
    });
})();
