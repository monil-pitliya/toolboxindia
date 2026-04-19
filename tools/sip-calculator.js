/* =============================================
   Free Toolbox — SIP & Investment Calculator

   Modes: SIP, Lumpsum, Step-Up SIP, SWP,
          Goal-Based (Reverse SIP), SIP vs Lumpsum

   Features: Real-time calc, doughnut chart,
   growth chart, year-wise table, LTCG tax,
   inflation-adjusted values, Indian ₹ formatting

   100% client-side. Zero data sent anywhere.
   ============================================= */

(function () {
    'use strict';

    // ===== Constants =====
    const LTCG_RATE = 0.125;          // 12.5% post-Budget 2024
    const LTCG_EXEMPTION = 125000;    // ₹1.25 lakh per FY
    const DEFAULT_INFLATION = 6;

    // ===== State =====
    let currentMode = 'sip';
    let chartCanvas = null;
    let growthCanvas = null;

    // ===== Register =====
    ToolRegistry.register('sip-calculator', {
        title: 'SIP & Investment Calculator',
        description: 'Plan your investments — SIP, Lumpsum, Step-Up SIP, SWP, Goal-Based. With LTCG tax, inflation adjustment, charts & year-wise breakdown.',
        category: 'Calculators',
        tags: ['sip calculator', 'mutual fund calculator', 'lumpsum calculator', 'step up sip', 'swp calculator', 'goal sip', 'investment calculator', 'sip vs lumpsum', 'sip return calculator', 'mutual fund return', 'monthly investment'],

        render() {
            return `
                <div class="sip-container">
                    <!-- Hero -->
                    <div class="sip-hero">
                        <h2>SIP & Investment Calculator</h2>
                        <p>Plan smarter investments — see returns, tax impact & inflation-adjusted value instantly</p>
                    </div>

                    <!-- Mode Tabs -->
                    <div class="sip-modes">
                        <button class="sip-mode-btn active" data-mode="sip">💰 SIP</button>
                        <button class="sip-mode-btn" data-mode="lumpsum">🏦 Lumpsum</button>
                        <button class="sip-mode-btn" data-mode="stepup">📈 Step-Up SIP</button>
                        <button class="sip-mode-btn" data-mode="swp">🔄 SWP</button>
                        <button class="sip-mode-btn" data-mode="goal">🎯 Goal SIP</button>
                        <button class="sip-mode-btn" data-mode="compare">⚖️ SIP vs Lumpsum</button>
                    </div>

                    <!-- Calculator Body -->
                    <div class="sip-body">
                        <!-- Left: Inputs -->
                        <div class="sip-inputs" id="sipInputs">
                            <!-- Dynamically injected per mode -->
                        </div>

                        <!-- Right: Results -->
                        <div class="sip-results" id="sipResults">
                            <div class="sip-results-placeholder">
                                <span>📊</span>
                                <p>Adjust the sliders to see results</p>
                            </div>
                        </div>
                    </div>

                    <!-- Year-wise Breakdown -->
                    <div class="sip-breakdown" id="sipBreakdown" style="display:none;">
                        <!-- table injected -->
                    </div>

                    <!-- Disclaimer -->
                    <div class="sip-disclaimer">
                        <strong>⚠️ Disclaimer:</strong> Mutual fund investments are subject to market risks. Read all scheme-related documents carefully. Past performance is not indicative of future results. This calculator provides approximate estimates for educational purposes only.
                    </div>
                </div>
            `;
        },

        init() {
            initSIP();
        },

        destroy() {
            currentMode = 'sip';
            chartCanvas = null;
            growthCanvas = null;
        }
    });

    // ===== Initialise =====
    function initSIP() {
        setTimeout(() => {
            // Mode switching
            document.querySelectorAll('.sip-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.sip-mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentMode = btn.dataset.mode;
                    renderInputs();
                    calculate();
                });
            });

            renderInputs();
            calculate();
        }, 100);
    }

    // ===== Render mode-specific inputs =====
    function renderInputs() {
        const container = document.getElementById('sipInputs');
        if (!container) return;

        switch (currentMode) {
            case 'sip':
                container.innerHTML = buildSIPInputs(); break;
            case 'lumpsum':
                container.innerHTML = buildLumpsumInputs(); break;
            case 'stepup':
                container.innerHTML = buildStepUpInputs(); break;
            case 'swp':
                container.innerHTML = buildSWPInputs(); break;
            case 'goal':
                container.innerHTML = buildGoalInputs(); break;
            case 'compare':
                container.innerHTML = buildCompareInputs(); break;
        }

        // Bind all sliders
        container.querySelectorAll('.sip-slider').forEach(slider => {
            const numInput = container.querySelector(`#${slider.id.replace('Slider', '')}`);
            if (numInput) {
                slider.addEventListener('input', () => {
                    numInput.value = Number(slider.value).toLocaleString('en-IN');
                    numInput._rawValue = slider.value;
                    calculate();
                });
                numInput.addEventListener('input', () => {
                    const raw = numInput.value.replace(/,/g, '');
                    const val = parseFloat(raw);
                    if (!isNaN(val)) {
                        slider.value = val;
                        numInput._rawValue = raw;
                    }
                    calculate();
                });
                numInput.addEventListener('blur', () => {
                    const raw = numInput.value.replace(/,/g, '');
                    const val = parseFloat(raw);
                    if (!isNaN(val)) {
                        numInput.value = Number(val).toLocaleString('en-IN');
                        numInput._rawValue = val;
                    }
                });
            }
        });

        // Toggle listeners
        container.querySelectorAll('.sip-toggle-input').forEach(cb => {
            cb.addEventListener('change', () => calculate());
        });
    }

    function getVal(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const raw = el._rawValue !== undefined ? el._rawValue : el.value.replace(/,/g, '');
        return parseFloat(raw) || 0;
    }

    function isChecked(id) {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    }

    // ===== Input builders =====
    function sliderGroup(label, id, min, max, value, step, prefix, suffix, hint) {
        const formatted = Number(value).toLocaleString('en-IN');
        return `
            <div class="sip-field">
                <div class="sip-field-header">
                    <label class="sip-field-label">${label}</label>
                    <div class="sip-field-value">
                        ${prefix ? `<span class="sip-prefix">${prefix}</span>` : ''}
                        <input type="text" class="sip-num-input" id="${id}" value="${formatted}" inputmode="decimal">
                        ${suffix ? `<span class="sip-suffix">${suffix}</span>` : ''}
                    </div>
                </div>
                <input type="range" class="sip-slider" id="${id}Slider" min="${min}" max="${max}" value="${value}" step="${step}">
                ${hint ? `<span class="sip-field-hint">${hint}</span>` : ''}
            </div>
        `;
    }

    function toggleField(label, id, checked, hint) {
        return `
            <div class="sip-toggle-field">
                <label class="sip-toggle-label">
                    <input type="checkbox" class="sip-toggle-input" id="${id}" ${checked ? 'checked' : ''}>
                    <span class="sip-toggle-switch"></span>
                    <span>${label}</span>
                </label>
                ${hint ? `<span class="sip-toggle-hint">${hint}</span>` : ''}
            </div>
        `;
    }

    function buildSIPInputs() {
        return `
            <h3 class="sip-input-title">SIP Calculator</h3>
            <p class="sip-input-desc">Calculate returns on your monthly SIP investment</p>
            ${sliderGroup('Monthly Investment', 'sipAmount', 500, 500000, 5000, 500, '₹', '', 'Min ₹500 • Max ₹5,00,000')}
            ${sliderGroup('Expected Return Rate (p.a.)', 'sipRate', 1, 30, 12, 0.5, '', '%', 'Equity: 10-15% • Debt: 6-8% • Hybrid: 8-12%')}
            ${sliderGroup('Investment Period', 'sipYears', 1, 40, 10, 1, '', 'years', '')}
            ${toggleField('Adjust for Inflation', 'sipInflation', false, `Uses ${DEFAULT_INFLATION}% average inflation`)}
            ${toggleField('Calculate LTCG Tax', 'sipTax', false, '12.5% on gains above ₹1.25L/year')}
        `;
    }

    function buildLumpsumInputs() {
        return `
            <h3 class="sip-input-title">Lumpsum Calculator</h3>
            <p class="sip-input-desc">Calculate returns on a one-time investment</p>
            ${sliderGroup('Investment Amount', 'lsAmount', 5000, 10000000, 100000, 5000, '₹', '', 'Min ₹5,000 • Max ₹1 Crore')}
            ${sliderGroup('Expected Return Rate (p.a.)', 'lsRate', 1, 30, 12, 0.5, '', '%', '')}
            ${sliderGroup('Investment Period', 'lsYears', 1, 40, 10, 1, '', 'years', '')}
            ${toggleField('Adjust for Inflation', 'lsInflation', false, '')}
            ${toggleField('Calculate LTCG Tax', 'lsTax', false, '')}
        `;
    }

    function buildStepUpInputs() {
        return `
            <h3 class="sip-input-title">Step-Up SIP Calculator</h3>
            <p class="sip-input-desc">Increase your SIP amount every year to build wealth faster</p>
            ${sliderGroup('Starting Monthly SIP', 'suAmount', 500, 500000, 5000, 500, '₹', '', '')}
            ${sliderGroup('Annual Step-Up', 'suStep', 1, 50, 10, 1, '', '%', 'How much you increase SIP each year')}
            ${sliderGroup('Expected Return Rate (p.a.)', 'suRate', 1, 30, 12, 0.5, '', '%', '')}
            ${sliderGroup('Investment Period', 'suYears', 1, 40, 10, 1, '', 'years', '')}
            ${toggleField('Adjust for Inflation', 'suInflation', false, '')}
            ${toggleField('Calculate LTCG Tax', 'suTax', false, '')}
        `;
    }

    function buildSWPInputs() {
        return `
            <h3 class="sip-input-title">SWP Calculator</h3>
            <p class="sip-input-desc">Plan systematic withdrawals from your investment corpus</p>
            ${sliderGroup('Total Corpus', 'swpCorpus', 100000, 100000000, 5000000, 50000, '₹', '', '')}
            ${sliderGroup('Monthly Withdrawal', 'swpWithdraw', 1000, 1000000, 25000, 1000, '₹', '', '')}
            ${sliderGroup('Expected Return Rate (p.a.)', 'swpRate', 1, 20, 8, 0.5, '', '%', '')}
            ${sliderGroup('Withdrawal Period', 'swpYears', 1, 40, 10, 1, '', 'years', '')}
        `;
    }

    function buildGoalInputs() {
        return `
            <h3 class="sip-input-title">Goal-Based SIP Calculator</h3>
            <p class="sip-input-desc">Find out how much monthly SIP you need to reach your target</p>
            ${sliderGroup('Target Amount', 'goalTarget', 100000, 100000000, 5000000, 50000, '₹', '', 'Your financial goal amount')}
            ${sliderGroup('Expected Return Rate (p.a.)', 'goalRate', 1, 30, 12, 0.5, '', '%', '')}
            ${sliderGroup('Time to Achieve Goal', 'goalYears', 1, 40, 10, 1, '', 'years', '')}
            ${sliderGroup('Existing Investments', 'goalExisting', 0, 50000000, 0, 10000, '₹', '', 'Amount already saved towards this goal')}
            ${toggleField('Adjust target for Inflation', 'goalInflation', false, `Accounts for ${DEFAULT_INFLATION}% annual inflation`)}
        `;
    }

    function buildCompareInputs() {
        return `
            <h3 class="sip-input-title">SIP vs Lumpsum Comparison</h3>
            <p class="sip-input-desc">Compare which strategy gives better returns</p>
            ${sliderGroup('Total Investment Amount', 'cmpAmount', 10000, 10000000, 600000, 10000, '₹', '', 'Same total amount invested via both strategies')}
            ${sliderGroup('Expected Return Rate (p.a.)', 'cmpRate', 1, 30, 12, 0.5, '', '%', '')}
            ${sliderGroup('Investment Period', 'cmpYears', 1, 40, 10, 1, '', 'years', '')}
        `;
    }

    // ===== Calculation engine =====
    function calculate() {
        switch (currentMode) {
            case 'sip':      calcSIP(); break;
            case 'lumpsum':  calcLumpsum(); break;
            case 'stepup':   calcStepUp(); break;
            case 'swp':      calcSWP(); break;
            case 'goal':     calcGoal(); break;
            case 'compare':  calcCompare(); break;
        }
    }

    // --- SIP ---
    function calcSIP() {
        const P = getVal('sipAmount');
        const rate = getVal('sipRate') / 100;
        const years = getVal('sipYears');
        const adjInflation = isChecked('sipInflation');
        const calcTax = isChecked('sipTax');

        const n = years * 12;
        const i = rate / 12;
        const invested = P * n;
        const futureValue = i > 0 ? P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : invested;
        const gains = futureValue - invested;

        let tax = 0;
        if (calcTax && gains > LTCG_EXEMPTION) {
            tax = (gains - LTCG_EXEMPTION) * LTCG_RATE;
        }

        const postTaxValue = futureValue - tax;
        const inflationAdj = adjInflation ? postTaxValue / Math.pow(1 + DEFAULT_INFLATION / 100, years) : null;

        // Year-wise data
        const yearData = [];
        let cumInv = 0, prevFV = 0;
        for (let y = 1; y <= years; y++) {
            const months = y * 12;
            cumInv = P * months;
            const fv = i > 0 ? P * ((Math.pow(1 + i, months) - 1) / i) * (1 + i) : cumInv;
            const yearGain = fv - prevFV - P * 12;
            yearData.push({ year: y, invested: cumInv, value: fv, gains: fv - cumInv, yearReturn: yearGain });
            prevFV = fv;
        }

        showResults({
            invested, futureValue, gains, tax, postTaxValue, inflationAdj, yearData,
            label1: 'Invested Amount', label2: 'Est. Returns',
            color1: '#6366f1', color2: '#22c55e'
        });
    }

    // --- Lumpsum ---
    function calcLumpsum() {
        const P = getVal('lsAmount');
        const rate = getVal('lsRate') / 100;
        const years = getVal('lsYears');
        const adjInflation = isChecked('lsInflation');
        const calcTax = isChecked('lsTax');

        const futureValue = P * Math.pow(1 + rate, years);
        const gains = futureValue - P;

        let tax = 0;
        if (calcTax && gains > LTCG_EXEMPTION) {
            tax = (gains - LTCG_EXEMPTION) * LTCG_RATE;
        }

        const postTaxValue = futureValue - tax;
        const inflationAdj = adjInflation ? postTaxValue / Math.pow(1 + DEFAULT_INFLATION / 100, years) : null;

        const yearData = [];
        for (let y = 1; y <= years; y++) {
            const fv = P * Math.pow(1 + rate, y);
            yearData.push({ year: y, invested: P, value: fv, gains: fv - P, yearReturn: fv - (y > 1 ? P * Math.pow(1 + rate, y - 1) : P) });
        }

        showResults({
            invested: P, futureValue, gains, tax, postTaxValue, inflationAdj, yearData,
            label1: 'Invested Amount', label2: 'Est. Returns',
            color1: '#6366f1', color2: '#22c55e'
        });
    }

    // --- Step-Up SIP ---
    function calcStepUp() {
        const startSIP = getVal('suAmount');
        const step = getVal('suStep') / 100;
        const rate = getVal('suRate') / 100;
        const years = getVal('suYears');
        const adjInflation = isChecked('suInflation');
        const calcTax = isChecked('suTax');

        const i = rate / 12;
        let totalInvested = 0;
        let totalValue = 0;
        const yearData = [];

        for (let y = 1; y <= years; y++) {
            const sip = startSIP * Math.pow(1 + step, y - 1);
            const yearInv = sip * 12;
            totalInvested += yearInv;

            // FV of this year's SIP compounded for remaining years
            const remainingMonths = (years - y) * 12;
            const sipFV = i > 0
                ? sip * ((Math.pow(1 + i, 12) - 1) / i) * (1 + i) * Math.pow(1 + i, remainingMonths)
                : yearInv;
            totalValue += sipFV;

            yearData.push({
                year: y,
                invested: totalInvested,
                monthlySIP: Math.round(sip),
                value: totalValue,
                gains: totalValue - totalInvested
            });
        }

        const gains = totalValue - totalInvested;
        let tax = 0;
        if (calcTax && gains > LTCG_EXEMPTION) {
            tax = (gains - LTCG_EXEMPTION) * LTCG_RATE;
        }

        const postTaxValue = totalValue - tax;
        const inflationAdj = adjInflation ? postTaxValue / Math.pow(1 + DEFAULT_INFLATION / 100, years) : null;

        // Recalculate cumulative yearData accurately
        let cumulativeInv = 0;
        let cumulativeVal = 0;
        const yearDataRecalc = [];
        for (let y = 1; y <= years; y++) {
            const sip = startSIP * Math.pow(1 + step, y - 1);
            cumulativeInv += sip * 12;
            // Compound previous + this year's contribution
            cumulativeVal = cumulativeVal * Math.pow(1 + rate / 12, 12);
            const monthlyI = rate / 12;
            if (monthlyI > 0) {
                cumulativeVal += sip * ((Math.pow(1 + monthlyI, 12) - 1) / monthlyI) * (1 + monthlyI);
            } else {
                cumulativeVal += sip * 12;
            }
            yearDataRecalc.push({
                year: y,
                invested: cumulativeInv,
                monthlySIP: Math.round(sip),
                value: cumulativeVal,
                gains: cumulativeVal - cumulativeInv
            });
        }

        const finalVal = yearDataRecalc.length > 0 ? yearDataRecalc[yearDataRecalc.length - 1].value : 0;
        const finalGains = finalVal - totalInvested;
        let finalTax = 0;
        if (calcTax && finalGains > LTCG_EXEMPTION) {
            finalTax = (finalGains - LTCG_EXEMPTION) * LTCG_RATE;
        }
        const finalPostTax = finalVal - finalTax;
        const finalInflAdj = adjInflation ? finalPostTax / Math.pow(1 + DEFAULT_INFLATION / 100, years) : null;

        showResults({
            invested: totalInvested, futureValue: finalVal, gains: finalGains, tax: finalTax,
            postTaxValue: finalPostTax, inflationAdj: finalInflAdj, yearData: yearDataRecalc,
            label1: 'Invested Amount', label2: 'Est. Returns',
            color1: '#6366f1', color2: '#22c55e',
            isStepUp: true
        });
    }

    // --- SWP ---
    function calcSWP() {
        const corpus = getVal('swpCorpus');
        const withdraw = getVal('swpWithdraw');
        const rate = getVal('swpRate') / 100;
        const years = getVal('swpYears');

        const monthlyRate = rate / 12;
        const months = years * 12;
        let balance = corpus;
        let totalWithdrawn = 0;
        let totalReturns = 0;
        const yearData = [];
        let depleted = false;

        for (let y = 1; y <= years; y++) {
            let yearWithdrawn = 0;
            let yearReturns = 0;
            for (let m = 0; m < 12; m++) {
                const interest = balance * monthlyRate;
                balance = balance + interest - withdraw;
                yearReturns += interest;
                yearWithdrawn += withdraw;

                if (balance <= 0) {
                    balance = 0;
                    depleted = true;
                    totalWithdrawn += yearWithdrawn;
                    totalReturns += yearReturns;
                    yearData.push({
                        year: y, balance: 0, withdrawn: totalWithdrawn,
                        returns: totalReturns, yearWithdrawn, yearReturns
                    });
                    break;
                }
            }
            if (depleted) break;
            totalWithdrawn += yearWithdrawn;
            totalReturns += yearReturns;
            yearData.push({
                year: y, balance, withdrawn: totalWithdrawn,
                returns: totalReturns, yearWithdrawn, yearReturns
            });
        }

        showSWPResults({ corpus, balance, totalWithdrawn, totalReturns, depleted, yearData, years });
    }

    // --- Goal-Based ---
    function calcGoal() {
        const target = getVal('goalTarget');
        const rate = getVal('goalRate') / 100;
        const years = getVal('goalYears');
        const existing = getVal('goalExisting');
        const adjInflation = isChecked('goalInflation');

        let adjustedTarget = target;
        if (adjInflation) {
            adjustedTarget = target * Math.pow(1 + DEFAULT_INFLATION / 100, years);
        }

        // FV of existing investments
        const existingFV = existing * Math.pow(1 + rate, years);
        const needed = Math.max(0, adjustedTarget - existingFV);

        // Required monthly SIP
        const i = rate / 12;
        const n = years * 12;
        let requiredSIP = 0;
        if (i > 0 && n > 0) {
            requiredSIP = needed * i / ((Math.pow(1 + i, n) - 1) * (1 + i));
        } else if (n > 0) {
            requiredSIP = needed / n;
        }

        // Also calculate required lumpsum
        const requiredLumpsum = needed / Math.pow(1 + rate, years);

        showGoalResults({
            target, adjustedTarget, existing, existingFV, needed,
            requiredSIP: Math.ceil(requiredSIP),
            requiredLumpsum: Math.round(requiredLumpsum),
            rate: rate * 100, years, adjInflation
        });
    }

    // --- SIP vs Lumpsum ---
    function calcCompare() {
        const total = getVal('cmpAmount');
        const rate = getVal('cmpRate') / 100;
        const years = getVal('cmpYears');

        // Lumpsum
        const lsFV = total * Math.pow(1 + rate, years);
        const lsGains = lsFV - total;

        // SIP (invest same total over the period)
        const monthlySIP = total / (years * 12);
        const i = rate / 12;
        const n = years * 12;
        const sipFV = i > 0 ? monthlySIP * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : total;
        const sipGains = sipFV - total;

        // Year-wise
        const yearData = [];
        for (let y = 1; y <= years; y++) {
            const lsVal = total * Math.pow(1 + rate, y);
            const months = y * 12;
            const sipVal = i > 0 ? monthlySIP * ((Math.pow(1 + i, months) - 1) / i) * (1 + i) : monthlySIP * months;
            const sipInvested = monthlySIP * months;
            yearData.push({ year: y, lsValue: lsVal, sipValue: sipVal, sipInvested });
        }

        showCompareResults({
            total, monthlySIP: Math.round(monthlySIP),
            lsFV, lsGains, sipFV, sipGains, years, yearData
        });
    }

    // ===== Show Results =====
    function showResults({ invested, futureValue, gains, tax, postTaxValue, inflationAdj, yearData, label1, label2, color1, color2, isStepUp }) {
        const container = document.getElementById('sipResults');
        const breakdownEl = document.getElementById('sipBreakdown');
        if (!container) return;

        const gainPct = invested > 0 ? ((gains / invested) * 100).toFixed(1) : '0';

        container.innerHTML = `
            <div class="sip-result-cards">
                <div class="sip-rcard sip-rcard-primary">
                    <span class="sip-rcard-label">Total Value</span>
                    <span class="sip-rcard-value">${formatINR(futureValue)}</span>
                    <span class="sip-rcard-sub">After ${yearData.length} years</span>
                </div>
                <div class="sip-rcard">
                    <span class="sip-rcard-label">Total Invested</span>
                    <span class="sip-rcard-value">${formatINR(invested)}</span>
                </div>
                <div class="sip-rcard sip-rcard-green">
                    <span class="sip-rcard-label">Est. Returns</span>
                    <span class="sip-rcard-value">${formatINR(gains)}</span>
                    <span class="sip-rcard-sub">+${gainPct}% total gain</span>
                </div>
                ${tax > 0 ? `
                <div class="sip-rcard sip-rcard-amber">
                    <span class="sip-rcard-label">LTCG Tax (12.5%)</span>
                    <span class="sip-rcard-value">−${formatINR(tax)}</span>
                </div>
                <div class="sip-rcard sip-rcard-blue">
                    <span class="sip-rcard-label">Post-Tax Value</span>
                    <span class="sip-rcard-value">${formatINR(postTaxValue)}</span>
                </div>` : ''}
                ${inflationAdj !== null ? `
                <div class="sip-rcard sip-rcard-orange">
                    <span class="sip-rcard-label">Inflation-Adjusted Value</span>
                    <span class="sip-rcard-value">${formatINR(inflationAdj)}</span>
                    <span class="sip-rcard-sub">In today's purchasing power</span>
                </div>` : ''}
            </div>

            <!-- Doughnut Chart -->
            <div class="sip-chart-area">
                <canvas id="sipDoughnut" width="240" height="240"></canvas>
                <div class="sip-chart-legend">
                    <span class="sip-legend-item"><span class="sip-legend-dot" style="background:${color1}"></span>${label1}: ${formatINR(invested)}</span>
                    <span class="sip-legend-item"><span class="sip-legend-dot" style="background:${color2}"></span>${label2}: ${formatINR(gains)}</span>
                </div>
            </div>

            <!-- Growth Chart -->
            <div class="sip-growth-area">
                <h4>Growth Over Time</h4>
                <canvas id="sipGrowth" width="500" height="220"></canvas>
            </div>
        `;

        // Draw charts
        drawDoughnut('sipDoughnut', invested, gains, color1, color2);
        drawGrowthChart('sipGrowth', yearData);

        // Year-wise table
        if (breakdownEl) {
            breakdownEl.style.display = 'block';
            breakdownEl.innerHTML = `
                <h4 class="sip-bk-title">📋 Year-wise Breakdown</h4>
                <div class="sip-bk-scroll">
                    <table class="sip-bk-table">
                        <thead>
                            <tr>
                                <th>Year</th>
                                ${isStepUp ? '<th>Monthly SIP</th>' : ''}
                                <th>Invested</th>
                                <th>Value</th>
                                <th>Gains</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${yearData.map(r => `
                                <tr>
                                    <td>${r.year}</td>
                                    ${isStepUp ? `<td>${formatINR(r.monthlySIP)}</td>` : ''}
                                    <td>${formatINR(r.invested)}</td>
                                    <td class="sip-bk-val">${formatINR(r.value)}</td>
                                    <td class="sip-bk-gain">${formatINR(r.gains)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    // ===== SWP Results =====
    function showSWPResults({ corpus, balance, totalWithdrawn, totalReturns, depleted, yearData, years }) {
        const container = document.getElementById('sipResults');
        const breakdownEl = document.getElementById('sipBreakdown');
        if (!container) return;

        container.innerHTML = `
            <div class="sip-result-cards">
                <div class="sip-rcard sip-rcard-primary">
                    <span class="sip-rcard-label">Remaining Corpus</span>
                    <span class="sip-rcard-value">${formatINR(balance)}</span>
                    ${depleted ? '<span class="sip-rcard-warn">⚠️ Corpus depleted!</span>' : `<span class="sip-rcard-sub">After ${yearData.length} years</span>`}
                </div>
                <div class="sip-rcard">
                    <span class="sip-rcard-label">Initial Corpus</span>
                    <span class="sip-rcard-value">${formatINR(corpus)}</span>
                </div>
                <div class="sip-rcard sip-rcard-blue">
                    <span class="sip-rcard-label">Total Withdrawn</span>
                    <span class="sip-rcard-value">${formatINR(totalWithdrawn)}</span>
                </div>
                <div class="sip-rcard sip-rcard-green">
                    <span class="sip-rcard-label">Returns Earned</span>
                    <span class="sip-rcard-value">${formatINR(totalReturns)}</span>
                </div>
                ${depleted ? `<div class="sip-rcard sip-rcard-red">
                    <span class="sip-rcard-label">Warning</span>
                    <span class="sip-rcard-value">Depleted in Year ${yearData.length}</span>
                    <span class="sip-rcard-sub">Reduce withdrawal or increase corpus</span>
                </div>` : ''}
            </div>

            <div class="sip-chart-area">
                <canvas id="sipDoughnut" width="240" height="240"></canvas>
                <div class="sip-chart-legend">
                    <span class="sip-legend-item"><span class="sip-legend-dot" style="background:#6366f1"></span>Remaining: ${formatINR(balance)}</span>
                    <span class="sip-legend-item"><span class="sip-legend-dot" style="background:#f59e0b"></span>Withdrawn: ${formatINR(totalWithdrawn)}</span>
                </div>
            </div>

            <div class="sip-growth-area">
                <h4>Corpus Over Time</h4>
                <canvas id="sipGrowth" width="500" height="220"></canvas>
            </div>
        `;

        drawDoughnut('sipDoughnut', balance, totalWithdrawn, '#6366f1', '#f59e0b');
        drawSWPGrowthChart('sipGrowth', yearData, corpus);

        if (breakdownEl) {
            breakdownEl.style.display = 'block';
            breakdownEl.innerHTML = `
                <h4 class="sip-bk-title">📋 Year-wise Withdrawal Schedule</h4>
                <div class="sip-bk-scroll">
                    <table class="sip-bk-table">
                        <thead><tr><th>Year</th><th>Withdrawn</th><th>Returns</th><th>Balance</th></tr></thead>
                        <tbody>
                            ${yearData.map(r => `
                                <tr>
                                    <td>${r.year}</td>
                                    <td>${formatINR(r.yearWithdrawn)}</td>
                                    <td class="sip-bk-gain">${formatINR(r.yearReturns)}</td>
                                    <td class="sip-bk-val">${formatINR(r.balance)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    // ===== Goal Results =====
    function showGoalResults({ target, adjustedTarget, existing, existingFV, needed, requiredSIP, requiredLumpsum, rate, years, adjInflation }) {
        const container = document.getElementById('sipResults');
        const breakdownEl = document.getElementById('sipBreakdown');
        if (!container) return;

        container.innerHTML = `
            <div class="sip-result-cards">
                <div class="sip-rcard sip-rcard-primary">
                    <span class="sip-rcard-label">Required Monthly SIP</span>
                    <span class="sip-rcard-value">${formatINR(requiredSIP)}</span>
                    <span class="sip-rcard-sub">To reach your goal in ${years} years</span>
                </div>
                <div class="sip-rcard sip-rcard-blue">
                    <span class="sip-rcard-label">Or One-Time Lumpsum</span>
                    <span class="sip-rcard-value">${formatINR(requiredLumpsum)}</span>
                </div>
                <div class="sip-rcard">
                    <span class="sip-rcard-label">Target Amount</span>
                    <span class="sip-rcard-value">${formatINR(adjustedTarget)}</span>
                    ${adjInflation ? `<span class="sip-rcard-sub">Inflation-adjusted from ${formatINR(target)}</span>` : ''}
                </div>
                ${existing > 0 ? `
                <div class="sip-rcard sip-rcard-green">
                    <span class="sip-rcard-label">Existing Investments grow to</span>
                    <span class="sip-rcard-value">${formatINR(existingFV)}</span>
                    <span class="sip-rcard-sub">From current ${formatINR(existing)}</span>
                </div>` : ''}
                <div class="sip-rcard sip-rcard-orange">
                    <span class="sip-rcard-label">Gap to Fill</span>
                    <span class="sip-rcard-value">${formatINR(needed)}</span>
                    <span class="sip-rcard-sub">Amount SIP needs to generate</span>
                </div>
            </div>

            <div class="sip-goal-tips">
                <h4>💡 Tips to Reach Your Goal Faster</h4>
                <ul>
                    <li>Consider a <strong>Step-Up SIP</strong> — increase by 10% each year to reduce the monthly amount needed now</li>
                    ${existing > 0 ? '<li>Your existing savings help! Keep them invested for compounding benefits</li>' : '<li>Start early — even ₹500/month extra makes a big difference over time</li>'}
                    <li>ELSS funds (equity-linked) offer tax savings under Section 80C while building wealth</li>
                    <li>Review and rebalance your investments annually to stay on track</li>
                </ul>
            </div>
        `;

        if (breakdownEl) { breakdownEl.style.display = 'none'; breakdownEl.innerHTML = ''; }
    }

    // ===== Compare Results =====
    function showCompareResults({ total, monthlySIP, lsFV, lsGains, sipFV, sipGains, years, yearData }) {
        const container = document.getElementById('sipResults');
        const breakdownEl = document.getElementById('sipBreakdown');
        if (!container) return;

        const winner = lsFV > sipFV ? 'Lumpsum' : 'SIP';
        const diff = Math.abs(lsFV - sipFV);

        container.innerHTML = `
            <div class="sip-compare-winner">
                <span class="sip-cw-icon">${winner === 'Lumpsum' ? '🏦' : '💰'}</span>
                <span class="sip-cw-text"><strong>${winner}</strong> gives <strong>${formatINR(diff)}</strong> more</span>
                <span class="sip-cw-hint">Assuming same return rate & total investment</span>
            </div>

            <div class="sip-compare-cards">
                <div class="sip-cmp-card ${winner === 'SIP' ? 'sip-cmp-winner' : ''}">
                    <h4>💰 SIP</h4>
                    <p class="sip-cmp-sub">${formatINR(monthlySIP)}/month × ${years} years</p>
                    <div class="sip-cmp-row"><span>Invested</span><span>${formatINR(total)}</span></div>
                    <div class="sip-cmp-row"><span>Returns</span><span class="sip-cmp-green">${formatINR(sipGains)}</span></div>
                    <div class="sip-cmp-row sip-cmp-total"><span>Total Value</span><span>${formatINR(sipFV)}</span></div>
                </div>
                <div class="sip-cmp-card ${winner === 'Lumpsum' ? 'sip-cmp-winner' : ''}">
                    <h4>🏦 Lumpsum</h4>
                    <p class="sip-cmp-sub">One-time ${formatINR(total)}</p>
                    <div class="sip-cmp-row"><span>Invested</span><span>${formatINR(total)}</span></div>
                    <div class="sip-cmp-row"><span>Returns</span><span class="sip-cmp-green">${formatINR(lsGains)}</span></div>
                    <div class="sip-cmp-row sip-cmp-total"><span>Total Value</span><span>${formatINR(lsFV)}</span></div>
                </div>
            </div>

            <div class="sip-growth-area">
                <h4>Growth Comparison</h4>
                <canvas id="sipGrowth" width="500" height="220"></canvas>
            </div>

            <div class="sip-compare-note">
                <strong>📝 Note:</strong> Lumpsum benefits from full compounding from day 1, so it typically outperforms SIP at the same return rate. However, SIP reduces <strong>timing risk</strong> through rupee-cost averaging — making it ideal when investing from monthly income or during volatile markets.
            </div>
        `;

        drawCompareGrowthChart('sipGrowth', yearData, total);

        if (breakdownEl) {
            breakdownEl.style.display = 'block';
            breakdownEl.innerHTML = `
                <h4 class="sip-bk-title">📋 Year-wise Comparison</h4>
                <div class="sip-bk-scroll">
                    <table class="sip-bk-table">
                        <thead><tr><th>Year</th><th>SIP Invested</th><th>SIP Value</th><th>Lumpsum Value</th><th>Difference</th></tr></thead>
                        <tbody>
                            ${yearData.map(r => `
                                <tr>
                                    <td>${r.year}</td>
                                    <td>${formatINR(r.sipInvested)}</td>
                                    <td>${formatINR(r.sipValue)}</td>
                                    <td>${formatINR(r.lsValue)}</td>
                                    <td class="${r.lsValue > r.sipValue ? 'sip-bk-gain' : 'sip-bk-loss'}">${formatINR(Math.abs(r.lsValue - r.sipValue))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    // ===== Charts =====
    // ===== HiDPI Canvas Helper =====
    function setupHiDPICanvas(canvas, logicalW, logicalH) {
        const dpr = window.devicePixelRatio || 1;
        // If logicalW is 0 or 'auto', use parent container width
        if (!logicalW) logicalW = canvas.parentElement ? canvas.parentElement.clientWidth : 500;
        canvas.width = logicalW * dpr;
        canvas.height = logicalH * dpr;
        canvas.style.width = logicalW + 'px';
        canvas.style.height = logicalH + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        return { ctx, w: logicalW, h: logicalH };
    }

    function drawDoughnut(canvasId, val1, val2, color1, color2) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const { ctx, w, h } = setupHiDPICanvas(canvas, 240, 240);
        const size = Math.min(w, h);
        const cx = size / 2, cy = size / 2;
        const outerR = size / 2 - 10;
        const innerR = outerR * 0.55;

        ctx.clearRect(0, 0, w, h);

        const total = val1 + val2;
        if (total <= 0) return;

        const angle1 = (val1 / total) * Math.PI * 2;

        // Arc 1
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, -Math.PI / 2, -Math.PI / 2 + angle1);
        ctx.closePath();
        ctx.fillStyle = color1;
        ctx.fill();

        // Arc 2
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, -Math.PI / 2 + angle1, -Math.PI / 2 + Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = color2;
        ctx.fill();

        // Inner circle (hole)
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
        ctx.fill();

        // Center text
        ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatINRCompact(total), cx, cy - 6);
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.fillText('Total Value', cx, cy + 12);
    }

    function drawGrowthChart(canvasId, yearData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const { ctx, w, h } = setupHiDPICanvas(canvas, 0, 220);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.clearRect(0, 0, w, h);

        if (yearData.length === 0) return;

        const pad = { t: 20, r: 20, b: 30, l: 60 };
        const cw = w - pad.l - pad.r;
        const ch = h - pad.t - pad.b;

        const maxVal = Math.max(...yearData.map(d => d.value));
        const maxInv = Math.max(...yearData.map(d => d.invested));
        const yMax = maxVal * 1.1;

        // Grid
        ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const gy = pad.t + ch - (ch * i / 4);
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l + cw, gy); ctx.stroke();
            ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatINRCompact(yMax * i / 4), pad.l - 8, gy);
        }

        // Stacked area — invested
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t + ch);
        yearData.forEach((d, i) => {
            const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d.invested / yMax) * ch;
            ctx.lineTo(x, y);
        });
        yearData.slice().reverse().forEach(() => {});
        ctx.lineTo(pad.l + cw, pad.t + ch);
        ctx.closePath();
        ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.fill();

        // Stacked area — total value
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t + ch);
        yearData.forEach((d, i) => {
            const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d.value / yMax) * ch;
            ctx.lineTo(x, y);
        });
        ctx.lineTo(pad.l + cw, pad.t + ch);
        ctx.closePath();
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fill();

        // Line — total value
        ctx.beginPath();
        yearData.forEach((d, i) => {
            const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d.value / yMax) * ch;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Line — invested
        ctx.beginPath();
        yearData.forEach((d, i) => {
            const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d.invested / yMax) * ch;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // X axis labels
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const step = Math.max(1, Math.floor(yearData.length / 8));
        yearData.forEach((d, i) => {
            if (i % step === 0 || i === yearData.length - 1) {
                const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
                ctx.fillText(`Y${d.year}`, x, pad.t + ch + 16);
            }
        });
    }

    function drawSWPGrowthChart(canvasId, yearData, initialCorpus) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const { ctx, w, h } = setupHiDPICanvas(canvas, 0, 220);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.clearRect(0, 0, w, h);

        const pad = { t: 20, r: 20, b: 30, l: 60 };
        const cw = w - pad.l - pad.r;
        const ch = h - pad.t - pad.b;

        const yMax = initialCorpus * 1.1;

        // Grid
        ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const gy = pad.t + ch - (ch * i / 4);
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l + cw, gy); ctx.stroke();
            ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(formatINRCompact(yMax * i / 4), pad.l - 8, gy);
        }

        // Area
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t + ch - (initialCorpus / yMax) * ch);
        yearData.forEach((d, i) => {
            const x = pad.l + ((i + 1) / yearData.length) * cw;
            const y = pad.t + ch - (d.balance / yMax) * ch;
            ctx.lineTo(x, y);
        });
        ctx.lineTo(pad.l + cw, pad.t + ch);
        ctx.lineTo(pad.l, pad.t + ch);
        ctx.closePath();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(pad.l, pad.t + ch - (initialCorpus / yMax) * ch);
        yearData.forEach((d, i) => {
            const x = pad.l + ((i + 1) / yearData.length) * cw;
            const y = pad.t + ch - (d.balance / yMax) * ch;
            ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // X labels
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        yearData.forEach((d, i) => {
            if (i % Math.max(1, Math.floor(yearData.length / 8)) === 0 || i === yearData.length - 1) {
                const x = pad.l + ((i + 1) / yearData.length) * cw;
                ctx.fillText(`Y${d.year}`, x, pad.t + ch + 16);
            }
        });
    }

    function drawCompareGrowthChart(canvasId, yearData, total) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const { ctx, w, h } = setupHiDPICanvas(canvas, 0, 220);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.clearRect(0, 0, w, h);

        const pad = { t: 20, r: 20, b: 30, l: 60 };
        const cw = w - pad.l - pad.r;
        const ch = h - pad.t - pad.b;

        const yMax = Math.max(...yearData.map(d => Math.max(d.lsValue, d.sipValue))) * 1.1;

        // Grid
        ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const gy = pad.t + ch - (ch * i / 4);
            ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l + cw, gy); ctx.stroke();
            ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(formatINRCompact(yMax * i / 4), pad.l - 8, gy);
        }

        // SIP line
        ctx.beginPath();
        yearData.forEach((d, i) => {
            const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d.sipValue / yMax) * ch;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Lumpsum line
        ctx.beginPath();
        yearData.forEach((d, i) => {
            const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d.lsValue / yMax) * ch;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Legend
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#6366f1';
        ctx.fillText('— SIP', pad.l + 10, pad.t + 10);
        ctx.fillStyle = '#22c55e';
        ctx.fillText('— Lumpsum', pad.l + 60, pad.t + 10);

        // X labels
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        yearData.forEach((d, i) => {
            if (i % Math.max(1, Math.floor(yearData.length / 8)) === 0 || i === yearData.length - 1) {
                const x = pad.l + (i / (yearData.length - 1 || 1)) * cw;
                ctx.fillText(`Y${d.year}`, x, pad.t + ch + 16);
            }
        });
    }

    // ===== Formatting =====
    function formatINR(num) {
        if (num === null || num === undefined || isNaN(num)) return '₹0';
        const abs = Math.abs(Math.round(num));
        const formatted = abs.toLocaleString('en-IN');
        return (num < 0 ? '-' : '') + '₹' + formatted;
    }

    function formatINRCompact(num) {
        if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr';
        if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
        if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
        return '₹' + Math.round(num);
    }

})();
