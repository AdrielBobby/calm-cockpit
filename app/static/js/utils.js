/**
 * Enhances a button to require a second click to confirm an action.
 * @param {HTMLElement} btn - The button element
 * @param {Function} onConfirm - Callback to run on confirmed click
 * @param {string} confirmText - Text to show during confirmation state (default: "Confirm?")
 */
function setupConfirmButton(btn, onConfirm, confirmText = "Confirm?") {
    if (!btn) return;

    let isConfirming = false;
    let timeout;
    const originalText = btn.textContent;
    const originalColor = btn.style.color;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isConfirming) {
            // Second click: Execute
            onConfirm();
            reset();
        } else {
            // First click: Enter confirm state
            isConfirming = true;
            btn.textContent = confirmText;
            btn.style.color = 'var(--danger, #ff4d4d)';

            // Auto-reset after 3 seconds
            timeout = setTimeout(reset, 3000);
        }
    });

    function reset() {
        isConfirming = false;
        btn.textContent = originalText;
        btn.style.color = originalColor;
        clearTimeout(timeout);
    }
}

window.setupConfirmButton = setupConfirmButton;
