document.addEventListener('DOMContentLoaded', () => {
    const apiBase = '/api/finance';

    // Elements
    const accountsList = document.getElementById('accounts-list');
    const netWorthVal = document.getElementById('net-worth-value');
    const incomeBar = document.getElementById('income-bar');
    const expenseBar = document.getElementById('expense-bar');
    const incomeVal = document.getElementById('income-val');
    const expenseVal = document.getElementById('expense-val');

    const transAccountSelect = document.getElementById('trans-account');
    const transAmountInput = document.getElementById('trans-amount');
    const transTypeSelect = document.getElementById('trans-type');
    const addTransBtn = document.getElementById('add-trans-btn');

    // Fetch and Render Data
    function loadFinanceData() {
        fetch(`${apiBase}/data`)
            .then(res => res.json())
            .then(data => {
                // Render Accounts
                renderAccounts(data.accounts);

                // Render Net Worth
                netWorthVal.textContent = data.net_worth.toLocaleString('en-IN');

                // Render Chart/Summary
                const inc = data.monthly_stats.income;
                const exp = data.monthly_stats.expense;
                const total = inc + exp;

                let incPct = total ? (inc / total) * 100 : 50;
                let expPct = total ? (exp / total) * 100 : 50;

                incomeBar.style.width = `${incPct}%`;
                expenseBar.style.width = `${expPct}%`;

                incomeVal.textContent = inc.toLocaleString('en-IN');
                expenseVal.textContent = exp.toLocaleString('en-IN');
            });
    }

    function renderAccounts(accounts) {
        accountsList.innerHTML = '';
        transAccountSelect.innerHTML = '';

        if (accounts.length === 0) {
            // Seed defaults if empty
            seedDefaults();
            return;
        }

        accounts.forEach(acc => {
            // Card
            const card = document.createElement('div');
            card.className = 'account-card';
            card.innerHTML = `
                <div class="acc-name">${window.escapeHTML(acc.name)}</div>
                <div class="acc-bal">₹${acc.balance.toLocaleString('en-IN')}</div>
            `;
            accountsList.appendChild(card);

            // Dropdown option
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name;
            transAccountSelect.appendChild(opt);
        });
    }

    function seedDefaults() {
        const defaults = [
            { name: 'HDFC', type: 'bank' },
            { name: 'Metro Card', type: 'wallet' },
            { name: 'Cash', type: 'cash' }
        ];

        Promise.all(defaults.map(acc =>
            fetch(`${apiBase}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(acc)
            })
        )).then(() => loadFinanceData());
    }

    // Reset Data
    // Reset Data
    setupConfirmButton(document.getElementById('reset-finance-btn'), () => {
        fetch(`${apiBase}/reset`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    window.showFeedback('Finance data reset');
                    loadFinanceData();
                }
            });
    });

    // Add Transaction
    addTransBtn.addEventListener('click', () => {
        const payload = {
            account_id: transAccountSelect.value,
            amount: transAmountInput.value,
            type: transTypeSelect.value,
            date: new Date().toISOString()
        };

        if (!payload.account_id || !payload.amount) return;

        fetch(`${apiBase}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) {
                transAmountInput.value = '';
                loadFinanceData();
                window.showFeedback('Transaction added');
            }
        });
    });

    // Initial Load
    loadFinanceData();
});
