/* =============================================
   ToolBox India — Income Tax Calculator
   FY 2025-26 (AY 2026-27)

   Features:
   • Old vs New regime side-by-side comparison
   • Salary breakup (Basic, HRA, Special Allowance, LTA)
   • All major deductions (80C, 80D, 80CCD, HRA, NPS, HomeLoan)
   • Age-based slabs (Below 60 / Senior 60-80 / Super Senior 80+)
   • Surcharge & Cess auto-calculation
   • Visual bar chart comparison
   • Monthly & annual take-home view
   • Tax savings tips
   • INR formatted currency throughout
   • 100% client-side — nothing leaves the browser!
   ============================================= */

(function () {
    'use strict';

    /* ========== TAX SLABS FY 2025-26 ========== */

    // New regime (same for all ages)
    const NEW_SLABS = [
        { from: 0,       to: 400000,   rate: 0    },
        { from: 400000,  to: 800000,   rate: 0.05 },
        { from: 800000,  to: 1200000,  rate: 0.10 },
        { from: 1200000, to: 1600000,  rate: 0.15 },
        { from: 1600000, to: 2000000,  rate: 0.20 },
        { from: 2000000, to: 2400000,  rate: 0.25 },
        { from: 2400000, to: Infinity, rate: 0.30 },
    ];

    // Old regime — below 60
    const OLD_SLABS_NORMAL = [
        { from: 0,       to: 250000,   rate: 0    },
        { from: 250000,  to: 500000,   rate: 0.05 },
        { from: 500000,  to: 1000000,  rate: 0.20 },
        { from: 1000000, to: Infinity, rate: 0.30 },
    ];

    // Old regime — Senior Citizen (60-80)
    const OLD_SLABS_SENIOR = [
        { from: 0,       to: 300000,   rate: 0    },
        { from: 300000,  to: 500000,   rate: 0.05 },
        { from: 500000,  to: 1000000,  rate: 0.20 },
        { from: 1000000, to: Infinity, rate: 0.30 },
    ];

    // Old regime — Super Senior (80+)
    const OLD_SLABS_SUPER = [
        { from: 0,       to: 500000,   rate: 0    },
        { from: 500000,  to: 1000000,  rate: 0.20 },
        { from: 1000000, to: Infinity, rate: 0.30 },
    ];

    /* ========== HELPERS ========== */

    function fmt(n) {
        // Indian Numbering: ₹12,34,567
        if (n === undefined || n === null || isNaN(n)) return '₹0';
        const neg = n < 0;
        n = Math.round(Math.abs(n));
        let s = n.toString();
        let result = '';
        // last 3 digits
        result = s.slice(-3);
        s = s.slice(0, -3);
        // then groups of 2
        while (s.length > 0) {
            result = s.slice(-2) + ',' + result;
            s = s.slice(0, -2);
        }
        return (neg ? '-' : '') + '₹' + result;
    }

    function parseCurrency(str) {
        if (typeof str === 'number') return str;
        return parseInt(String(str).replace(/[₹,\s]/g, '')) || 0;
    }

    function pct(part, total) {
        if (!total) return '0%';
        return ((part / total) * 100).toFixed(1) + '%';
    }

    /* ========== TAX CALCULATION ENGINE ========== */

    function calcTaxOnSlabs(income, slabs) {
        let tax = 0;
        for (const slab of slabs) {
            if (income <= slab.from) break;
            const taxable = Math.min(income, slab.to) - slab.from;
            tax += taxable * slab.rate;
        }
        return tax;
    }

    function calcSurcharge(tax, income, isNew) {
        // Surcharge rates
        if (income <= 5000000) return 0;
        let rate = 0;
        if (income <= 10000000) rate = 0.10;
        else if (income <= 20000000) rate = 0.15;
        else if (income <= 50000000) rate = 0.25;
        else rate = isNew ? 0.25 : 0.37; // New regime caps at 25%
        return Math.round(tax * rate);
    }

    function calcHRAExemption(basic, hra, rent, isMetro) {
        if (!hra || !rent || !basic) return 0;
        const a = hra;
        const b = rent - (0.10 * basic);
        const c = isMetro ? 0.50 * basic : 0.40 * basic;
        return Math.max(0, Math.round(Math.min(a, Math.max(0, b), c)));
    }

    function getOldSlabs(age) {
        if (age >= 80) return OLD_SLABS_SUPER;
        if (age >= 60) return OLD_SLABS_SENIOR;
        return OLD_SLABS_NORMAL;
    }

    function calculateTax(inputs) {
        const {
            grossSalary, basic, hra, lta, specialAllowance,
            rent, isMetro, age,
            sec80C, sec80D, sec80DSenior, sec80CCD1B, sec80CCD2,
            sec80E, sec80G, sec80TTA, sec80EEA,
            homeLoanInterest, npsEmployer,
            otherIncome,
        } = inputs;

        const totalIncome = grossSalary + (otherIncome || 0);

        // ===== NEW REGIME =====
        const newStdDeduction = 75000;
        const newNPSEmployer = Math.min(sec80CCD2 || 0, Math.round(0.14 * basic));
        let newTaxableIncome = totalIncome - newStdDeduction - newNPSEmployer;
        newTaxableIncome = Math.max(0, newTaxableIncome);

        let newTax = calcTaxOnSlabs(newTaxableIncome, NEW_SLABS);

        // Section 87A rebate (new regime): up to ₹12 lakh taxable → rebate up to ₹60,000
        let newRebate = 0;
        if (newTaxableIncome <= 1200000) {
            newRebate = Math.min(newTax, 60000);
        }
        newTax -= newRebate;
        newTax = Math.max(0, newTax);

        const newSurcharge = calcSurcharge(newTax, newTaxableIncome, true);
        const newCess = Math.round((newTax + newSurcharge) * 0.04);
        const newTotalTax = newTax + newSurcharge + newCess;

        // ===== OLD REGIME =====
        const oldStdDeduction = 50000;
        const hraExemption = calcHRAExemption(basic, hra, rent || 0, isMetro);
        const ltaExemption = Math.min(lta || 0, lta || 0); // fully exempt if claimed

        // Section 80C (max ₹1.5L)
        const total80C = Math.min(sec80C || 0, 150000);
        // Section 80D (self: max ₹25K or ₹50K for senior; parents: add ₹25K or ₹50K senior)
        const total80D = Math.min(sec80D || 0, age >= 60 ? 50000 : 25000) + Math.min(sec80DSenior || 0, 50000);
        // Section 80CCD(1B) NPS (max ₹50K)
        const total80CCD1B = Math.min(sec80CCD1B || 0, 50000);
        // Section 80CCD(2) NPS employer (max 14% of basic for pvt sector)
        const total80CCD2 = Math.min(sec80CCD2 || 0, Math.round(0.14 * basic));
        // Section 80E (education loan interest — full deduction)
        const total80E = sec80E || 0;
        // Section 80G (donations)
        const total80G = sec80G || 0;
        // Section 80TTA (savings interest, max ₹10K or ₹50K for senior)
        const total80TTA = Math.min(sec80TTA || 0, age >= 60 ? 50000 : 10000);
        // Section 80EEA (home loan interest extra ₹1.5L for affordable housing)
        const total80EEA = Math.min(sec80EEA || 0, 150000);
        // Home loan interest Sec 24b (max ₹2L for self-occupied)
        const totalHomeLoan = Math.min(homeLoanInterest || 0, 200000);

        const totalDeductions = total80C + total80D + total80CCD1B + total80CCD2 +
            total80E + total80G + total80TTA + total80EEA + totalHomeLoan +
            hraExemption + ltaExemption + oldStdDeduction;

        let oldTaxableIncome = totalIncome - totalDeductions;
        oldTaxableIncome = Math.max(0, oldTaxableIncome);

        const oldSlabs = getOldSlabs(age);
        let oldTax = calcTaxOnSlabs(oldTaxableIncome, oldSlabs);

        // Section 87A rebate (old regime): up to ₹5 lakh → rebate up to ₹12,500
        let oldRebate = 0;
        if (oldTaxableIncome <= 500000) {
            oldRebate = Math.min(oldTax, 12500);
        }
        oldTax -= oldRebate;
        oldTax = Math.max(0, oldTax);

        const oldSurcharge = calcSurcharge(oldTax, oldTaxableIncome, false);
        const oldCess = Math.round((oldTax + oldSurcharge) * 0.04);
        const oldTotalTax = oldTax + oldSurcharge + oldCess;

        return {
            totalIncome,
            newRegime: {
                stdDeduction: newStdDeduction,
                npsEmployer: newNPSEmployer,
                totalDeductions: newStdDeduction + newNPSEmployer,
                taxableIncome: newTaxableIncome,
                baseTax: newTax + newRebate, // before rebate
                rebate: newRebate,
                taxAfterRebate: newTax,
                surcharge: newSurcharge,
                cess: newCess,
                totalTax: newTotalTax,
                takeHome: totalIncome - newTotalTax,
                monthlyTakeHome: Math.round((totalIncome - newTotalTax) / 12),
                effectiveRate: totalIncome ? ((newTotalTax / totalIncome) * 100).toFixed(1) : '0.0',
            },
            oldRegime: {
                stdDeduction: oldStdDeduction,
                hraExemption,
                ltaExemption,
                sec80C: total80C,
                sec80D: total80D,
                sec80CCD1B: total80CCD1B,
                sec80CCD2: total80CCD2,
                sec80E: total80E,
                sec80G: total80G,
                sec80TTA: total80TTA,
                sec80EEA: total80EEA,
                homeLoan: totalHomeLoan,
                totalDeductions,
                taxableIncome: oldTaxableIncome,
                baseTax: oldTax + oldRebate,
                rebate: oldRebate,
                taxAfterRebate: oldTax,
                surcharge: oldSurcharge,
                cess: oldCess,
                totalTax: oldTotalTax,
                takeHome: totalIncome - oldTotalTax,
                monthlyTakeHome: Math.round((totalIncome - oldTotalTax) / 12),
                effectiveRate: totalIncome ? ((oldTotalTax / totalIncome) * 100).toFixed(1) : '0.0',
            },
            savings: Math.abs(newTotalTax - oldTotalTax),
            betterRegime: newTotalTax <= oldTotalTax ? 'new' : 'old',
        };
    }

    /* ========== SLAB BREAKDOWN ========== */
    function getSlabBreakdown(taxableIncome, slabs) {
        const rows = [];
        for (const slab of slabs) {
            if (taxableIncome <= slab.from) {
                rows.push({ range: formatSlabRange(slab), rate: (slab.rate * 100) + '%', taxable: 0, tax: 0 });
                continue;
            }
            const taxable = Math.min(taxableIncome, slab.to === Infinity ? taxableIncome : slab.to) - slab.from;
            const tax = Math.round(taxable * slab.rate);
            rows.push({
                range: formatSlabRange(slab),
                rate: (slab.rate * 100) + '%',
                taxable: Math.max(0, taxable),
                tax,
            });
        }
        return rows;
    }

    function formatSlabRange(slab) {
        const f = (n) => {
            if (n >= 10000000) return '₹' + (n / 10000000) + 'Cr';
            if (n >= 100000) return '₹' + (n / 100000) + 'L';
            if (n >= 1000) return '₹' + (n / 1000) + 'K';
            return '₹' + n;
        };
        if (slab.to === Infinity) return 'Above ' + f(slab.from);
        return f(slab.from) + ' – ' + f(slab.to);
    }

    /* ========== REGISTER TOOL ========== */
    ToolRegistry.register('tax-calculator', {
        render() {
            return `
            <div id="taxRoot">
                <!-- Hero Header -->
                <div class="tax-hero">
                    <div class="tax-hero-content">
                        <h2 class="tax-hero-title">🧮 Income Tax Calculator</h2>
                        <p class="tax-hero-sub">FY 2025-26 (AY 2026-27) • Old vs New Regime • Instant Comparison</p>
                    </div>
                </div>

                <div class="tax-layout">
                    <!-- LEFT: Input Form -->
                    <div class="tax-input-panel">
                        <!-- Age -->
                        <div class="tax-card">
                            <h3 class="tax-card-title">👤 Personal Details</h3>
                            <div class="tax-field">
                                <label>Age Group</label>
                                <div class="tax-age-group">
                                    <button class="tax-age-btn active" data-age="30">Below 60</button>
                                    <button class="tax-age-btn" data-age="65">60-80 (Senior)</button>
                                    <button class="tax-age-btn" data-age="85">80+ (Super Senior)</button>
                                </div>
                            </div>
                        </div>

                        <!-- Income -->
                        <div class="tax-card">
                            <h3 class="tax-card-title">💰 Income Details</h3>
                            <div class="tax-field-row">
                                <div class="tax-field tax-field-full">
                                    <label>Annual Gross Salary (CTC) <span class="tax-required">*</span></label>
                                    <div class="tax-input-wrap">
                                        <span class="tax-input-prefix">₹</span>
                                        <input type="text" id="taxGross" class="tax-input" placeholder="e.g. 15,00,000" inputmode="numeric">
                                    </div>
                                    <span class="tax-field-hint" id="taxGrossWords"></span>
                                </div>
                            </div>

                            <div class="tax-toggle-breakup">
                                <button id="taxBreakupToggle" class="tax-toggle-btn">▸ Enter salary breakup (for HRA calculation)</button>
                            </div>

                            <div id="taxBreakupSection" class="tax-breakup" style="display:none;">
                                <div class="tax-field-grid">
                                    <div class="tax-field">
                                        <label>Basic Salary</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="taxBasic" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>HRA Received</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="taxHRA" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>LTA</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="taxLTA" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>Special Allowance</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="taxSpecial" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                </div>

                                <div class="tax-field-grid" style="margin-top:12px;">
                                    <div class="tax-field">
                                        <label>Rent Paid (Annual)</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="taxRent" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>City</label>
                                        <div class="tax-metro-group">
                                            <button class="tax-metro-btn active" data-metro="true">Metro</button>
                                            <button class="tax-metro-btn" data-metro="false">Non-Metro</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tax-field" style="margin-top:12px;">
                                <label>Other Income (FD interest, rental, etc.)</label>
                                <div class="tax-input-wrap">
                                    <span class="tax-input-prefix">₹</span>
                                    <input type="text" id="taxOtherIncome" class="tax-input" placeholder="0" inputmode="numeric">
                                </div>
                            </div>
                        </div>

                        <!-- Deductions (Old Regime) -->
                        <div class="tax-card">
                            <h3 class="tax-card-title">📋 Deductions <span class="tax-badge-old">Old Regime</span></h3>
                            <p class="tax-card-note">These deductions are only applicable under the Old Tax Regime</p>

                            <!-- 80C -->
                            <div class="tax-deduction-group">
                                <div class="tax-deduction-header">
                                    <span>Section 80C</span>
                                    <span class="tax-limit">Max ₹1.5L</span>
                                </div>
                                <div class="tax-field">
                                    <label>EPF + PPF + ELSS + LIC + Tuition Fees + Stamp Duty</label>
                                    <div class="tax-input-wrap">
                                        <span class="tax-input-prefix">₹</span>
                                        <input type="text" id="tax80C" class="tax-input" placeholder="0" inputmode="numeric">
                                    </div>
                                </div>
                            </div>

                            <!-- 80D -->
                            <div class="tax-deduction-group">
                                <div class="tax-deduction-header">
                                    <span>Section 80D — Medical Insurance</span>
                                    <span class="tax-limit">Max ₹25K / ₹50K</span>
                                </div>
                                <div class="tax-field-grid">
                                    <div class="tax-field">
                                        <label>Self & Family Premium</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80D" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>Parents Premium (Senior)</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80DSenior" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- NPS -->
                            <div class="tax-deduction-group">
                                <div class="tax-deduction-header">
                                    <span>NPS — National Pension Scheme</span>
                                </div>
                                <div class="tax-field-grid">
                                    <div class="tax-field">
                                        <label>80CCD(1B) — Self (Max ₹50K)</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80CCD1B" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>80CCD(2) — Employer NPS</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80CCD2" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Home Loan -->
                            <div class="tax-deduction-group">
                                <div class="tax-deduction-header">
                                    <span>Home Loan Interest (Sec 24b)</span>
                                    <span class="tax-limit">Max ₹2L</span>
                                </div>
                                <div class="tax-field">
                                    <div class="tax-input-wrap">
                                        <span class="tax-input-prefix">₹</span>
                                        <input type="text" id="taxHomeLoan" class="tax-input" placeholder="0" inputmode="numeric">
                                    </div>
                                </div>
                            </div>

                            <!-- Other Deductions -->
                            <div class="tax-toggle-breakup">
                                <button id="taxMoreDeductions" class="tax-toggle-btn">▸ More deductions (80E, 80G, 80TTA, 80EEA)</button>
                            </div>
                            <div id="taxMoreSection" style="display:none;">
                                <div class="tax-field-grid">
                                    <div class="tax-field">
                                        <label>80E — Education Loan Interest</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80E" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>80G — Donations</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80G" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>80TTA — Savings Interest</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80TTA" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="tax-field">
                                        <label>80EEA — Home Loan Extra (Affordable)</label>
                                        <div class="tax-input-wrap">
                                            <span class="tax-input-prefix">₹</span>
                                            <input type="text" id="tax80EEA" class="tax-input" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Calculate -->
                        <button id="taxCalcBtn" class="tax-calc-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
                            Calculate My Tax
                        </button>
                    </div>

                    <!-- RIGHT: Results -->
                    <div class="tax-result-panel" id="taxResultPanel" style="display:none;">

                        <!-- Winner Badge -->
                        <div class="tax-winner-card" id="taxWinnerCard">
                            <div class="tax-winner-icon" id="taxWinnerIcon">🎉</div>
                            <div class="tax-winner-text">
                                <h3 id="taxWinnerTitle">New Regime is Better!</h3>
                                <p id="taxWinnerSaving">You save ₹0 by choosing the New Regime</p>
                            </div>
                        </div>

                        <!-- Comparison Cards -->
                        <div class="tax-compare-grid">
                            <div class="tax-compare-card tax-compare-new" id="taxNewCard">
                                <div class="tax-compare-header">
                                    <span class="tax-compare-label">✨ New Regime</span>
                                    <span class="tax-compare-badge" id="taxNewBadge"></span>
                                </div>
                                <div class="tax-compare-amount" id="taxNewTotal">₹0</div>
                                <div class="tax-compare-rate" id="taxNewRate">Effective Rate: 0%</div>
                                <div class="tax-compare-details">
                                    <div class="tax-detail-row"><span>Gross Income</span><span id="taxNewGross">₹0</span></div>
                                    <div class="tax-detail-row"><span>Standard Deduction</span><span id="taxNewStdDed">-₹75,000</span></div>
                                    <div class="tax-detail-row"><span>NPS Employer (80CCD2)</span><span id="taxNewNPS">₹0</span></div>
                                    <div class="tax-detail-row tax-detail-highlight"><span>Taxable Income</span><span id="taxNewTaxable">₹0</span></div>
                                    <div class="tax-detail-row"><span>Tax on Income</span><span id="taxNewBaseTax">₹0</span></div>
                                    <div class="tax-detail-row tax-detail-green"><span>Rebate u/s 87A</span><span id="taxNewRebate">₹0</span></div>
                                    <div class="tax-detail-row"><span>Surcharge</span><span id="taxNewSurcharge">₹0</span></div>
                                    <div class="tax-detail-row"><span>Health & Edu Cess (4%)</span><span id="taxNewCess">₹0</span></div>
                                    <div class="tax-detail-divider"></div>
                                    <div class="tax-detail-row tax-detail-total"><span>Total Tax</span><span id="taxNewFinal">₹0</span></div>
                                    <div class="tax-detail-row tax-detail-takehome"><span>Annual Take-Home</span><span id="taxNewTakeHome">₹0</span></div>
                                    <div class="tax-detail-row"><span>Monthly Take-Home</span><span id="taxNewMonthly">₹0</span></div>
                                </div>
                            </div>

                            <div class="tax-compare-card tax-compare-old">
                                <div class="tax-compare-header">
                                    <span class="tax-compare-label">📜 Old Regime</span>
                                    <span class="tax-compare-badge" id="taxOldBadge"></span>
                                </div>
                                <div class="tax-compare-amount" id="taxOldTotal">₹0</div>
                                <div class="tax-compare-rate" id="taxOldRate">Effective Rate: 0%</div>
                                <div class="tax-compare-details">
                                    <div class="tax-detail-row"><span>Gross Income</span><span id="taxOldGross">₹0</span></div>
                                    <div class="tax-detail-row"><span>Standard Deduction</span><span id="taxOldStdDed">-₹50,000</span></div>
                                    <div class="tax-detail-row"><span>HRA Exemption</span><span id="taxOldHRA">₹0</span></div>
                                    <div class="tax-detail-row"><span>Section 80C</span><span id="taxOld80C">₹0</span></div>
                                    <div class="tax-detail-row"><span>Section 80D</span><span id="taxOld80D">₹0</span></div>
                                    <div class="tax-detail-row"><span>NPS (80CCD1B + 80CCD2)</span><span id="taxOldNPS">₹0</span></div>
                                    <div class="tax-detail-row"><span>Home Loan Interest</span><span id="taxOldHomeLoan">₹0</span></div>
                                    <div class="tax-detail-row"><span>Other Deductions</span><span id="taxOldOther">₹0</span></div>
                                    <div class="tax-detail-row tax-detail-highlight"><span>Taxable Income</span><span id="taxOldTaxable">₹0</span></div>
                                    <div class="tax-detail-row"><span>Tax on Income</span><span id="taxOldBaseTax">₹0</span></div>
                                    <div class="tax-detail-row tax-detail-green"><span>Rebate u/s 87A</span><span id="taxOldRebate">₹0</span></div>
                                    <div class="tax-detail-row"><span>Surcharge</span><span id="taxOldSurcharge">₹0</span></div>
                                    <div class="tax-detail-row"><span>Health & Edu Cess (4%)</span><span id="taxOldCess">₹0</span></div>
                                    <div class="tax-detail-divider"></div>
                                    <div class="tax-detail-row tax-detail-total"><span>Total Tax</span><span id="taxOldFinal">₹0</span></div>
                                    <div class="tax-detail-row tax-detail-takehome"><span>Annual Take-Home</span><span id="taxOldTakeHome">₹0</span></div>
                                    <div class="tax-detail-row"><span>Monthly Take-Home</span><span id="taxOldMonthly">₹0</span></div>
                                </div>
                            </div>
                        </div>

                        <!-- Visual Bar Chart -->
                        <div class="tax-card" style="margin-top:20px;">
                            <h3 class="tax-card-title">📊 Visual Comparison</h3>
                            <div class="tax-chart" id="taxChart"></div>
                        </div>

                        <!-- Slab Breakdown -->
                        <div class="tax-card" style="margin-top:20px;">
                            <h3 class="tax-card-title">📋 Slab-wise Breakdown</h3>
                            <div class="tax-slab-tabs">
                                <button class="tax-slab-tab active" data-tab="new">New Regime</button>
                                <button class="tax-slab-tab" data-tab="old">Old Regime</button>
                            </div>
                            <div id="taxSlabTableNew" class="tax-slab-table"></div>
                            <div id="taxSlabTableOld" class="tax-slab-table" style="display:none;"></div>
                        </div>

                        <!-- Tax Saving Tips -->
                        <div class="tax-card tax-tips-card" style="margin-top:20px;">
                            <h3 class="tax-card-title">💡 Tax Saving Tips</h3>
                            <div id="taxTips" class="tax-tips"></div>
                        </div>
                    </div>
                </div>

                <!-- Disclaimer -->
                <div class="tax-disclaimer">
                    <strong>Disclaimer:</strong> This calculator is for informational purposes only based on FY 2025-26 tax slabs. It does not constitute professional tax advice. Consult a CA for accurate tax planning. Surcharge and marginal relief calculations are simplified.
                </div>
            </div>
            `;
        },

        init() { setupTaxCalc(); },
        destroy() {},
    });

    /* ========== SETUP ========== */
    function setupTaxCalc() {
        let ageVal = 30;
        let isMetro = true;

        // Age buttons
        document.querySelectorAll('.tax-age-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tax-age-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ageVal = parseInt(btn.dataset.age);
            });
        });

        // Metro buttons
        document.querySelectorAll('.tax-metro-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tax-metro-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                isMetro = btn.dataset.metro === 'true';
            });
        });

        // Salary breakup toggle
        document.getElementById('taxBreakupToggle')?.addEventListener('click', function () {
            const sec = document.getElementById('taxBreakupSection');
            const showing = sec.style.display === 'none';
            sec.style.display = showing ? '' : 'none';
            this.textContent = (showing ? '▾' : '▸') + ' Enter salary breakup (for HRA calculation)';
        });

        // More deductions toggle
        document.getElementById('taxMoreDeductions')?.addEventListener('click', function () {
            const sec = document.getElementById('taxMoreSection');
            const showing = sec.style.display === 'none';
            sec.style.display = showing ? '' : 'none';
            this.textContent = (showing ? '▾' : '▸') + ' More deductions (80E, 80G, 80TTA, 80EEA)';
        });

        // Indian number formatting on inputs
        document.querySelectorAll('.tax-input').forEach(input => {
            input.addEventListener('blur', function () {
                const val = parseCurrency(this.value);
                if (val > 0) this.value = val.toLocaleString('en-IN');
            });
            input.addEventListener('focus', function () {
                const val = parseCurrency(this.value);
                if (val > 0) this.value = val;
            });
        });

        // Words hint for gross salary
        document.getElementById('taxGross')?.addEventListener('input', function () {
            const val = parseCurrency(this.value);
            const el = document.getElementById('taxGrossWords');
            if (el && val > 0) {
                el.textContent = numberToIndianWords(val);
            } else if (el) {
                el.textContent = '';
            }
        });

        // Slab tabs
        document.querySelectorAll('.tax-slab-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tax-slab-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('taxSlabTableNew').style.display = tab.dataset.tab === 'new' ? '' : 'none';
                document.getElementById('taxSlabTableOld').style.display = tab.dataset.tab === 'old' ? '' : 'none';
            });
        });

        // Calculate button
        document.getElementById('taxCalcBtn')?.addEventListener('click', () => {
            const grossSalary = parseCurrency(document.getElementById('taxGross')?.value);
            if (!grossSalary) {
                document.getElementById('taxGross')?.focus();
                return;
            }

            const basic = parseCurrency(document.getElementById('taxBasic')?.value) || Math.round(grossSalary * 0.40);
            const hra = parseCurrency(document.getElementById('taxHRA')?.value) || Math.round(basic * 0.40);
            const lta = parseCurrency(document.getElementById('taxLTA')?.value) || 0;
            const specialAllowance = parseCurrency(document.getElementById('taxSpecial')?.value) || 0;

            const inputs = {
                grossSalary,
                basic,
                hra,
                lta,
                specialAllowance,
                rent: parseCurrency(document.getElementById('taxRent')?.value),
                isMetro,
                age: ageVal,
                sec80C: parseCurrency(document.getElementById('tax80C')?.value),
                sec80D: parseCurrency(document.getElementById('tax80D')?.value),
                sec80DSenior: parseCurrency(document.getElementById('tax80DSenior')?.value),
                sec80CCD1B: parseCurrency(document.getElementById('tax80CCD1B')?.value),
                sec80CCD2: parseCurrency(document.getElementById('tax80CCD2')?.value),
                sec80E: parseCurrency(document.getElementById('tax80E')?.value),
                sec80G: parseCurrency(document.getElementById('tax80G')?.value),
                sec80TTA: parseCurrency(document.getElementById('tax80TTA')?.value),
                sec80EEA: parseCurrency(document.getElementById('tax80EEA')?.value),
                homeLoanInterest: parseCurrency(document.getElementById('taxHomeLoan')?.value),
                npsEmployer: parseCurrency(document.getElementById('tax80CCD2')?.value),
                otherIncome: parseCurrency(document.getElementById('taxOtherIncome')?.value),
            };

            const result = calculateTax(inputs);
            showResults(result, inputs);
        });
    }

    /* ========== SHOW RESULTS ========== */
    function showResults(r, inputs) {
        const panel = document.getElementById('taxResultPanel');
        panel.style.display = '';

        // Scroll into view
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Winner card
        const winnerCard = document.getElementById('taxWinnerCard');
        const isBetter = r.betterRegime;
        document.getElementById('taxWinnerIcon').textContent = '🎉';
        if (isBetter === 'new') {
            document.getElementById('taxWinnerTitle').textContent = '✨ New Regime saves you more!';
            winnerCard.className = 'tax-winner-card tax-winner-new';
            document.getElementById('taxNewBadge').textContent = '✓ BETTER';
            document.getElementById('taxNewBadge').className = 'tax-compare-badge tax-badge-winner';
            document.getElementById('taxOldBadge').textContent = '';
        } else {
            document.getElementById('taxWinnerTitle').textContent = '📜 Old Regime saves you more!';
            winnerCard.className = 'tax-winner-card tax-winner-old';
            document.getElementById('taxOldBadge').textContent = '✓ BETTER';
            document.getElementById('taxOldBadge').className = 'tax-compare-badge tax-badge-winner';
            document.getElementById('taxNewBadge').textContent = '';
        }
        document.getElementById('taxWinnerSaving').textContent = `You save ${fmt(r.savings)} per year by choosing the ${isBetter === 'new' ? 'New' : 'Old'} Regime`;

        // New regime details
        const n = r.newRegime;
        document.getElementById('taxNewTotal').textContent = fmt(n.totalTax);
        document.getElementById('taxNewRate').textContent = `Effective Rate: ${n.effectiveRate}%`;
        document.getElementById('taxNewGross').textContent = fmt(r.totalIncome);
        document.getElementById('taxNewStdDed').textContent = '-' + fmt(n.stdDeduction);
        document.getElementById('taxNewNPS').textContent = n.npsEmployer ? '-' + fmt(n.npsEmployer) : '₹0';
        document.getElementById('taxNewTaxable').textContent = fmt(n.taxableIncome);
        document.getElementById('taxNewBaseTax').textContent = fmt(n.baseTax);
        document.getElementById('taxNewRebate').textContent = n.rebate ? '-' + fmt(n.rebate) : '₹0';
        document.getElementById('taxNewSurcharge').textContent = fmt(n.surcharge);
        document.getElementById('taxNewCess').textContent = fmt(n.cess);
        document.getElementById('taxNewFinal').textContent = fmt(n.totalTax);
        document.getElementById('taxNewTakeHome').textContent = fmt(n.takeHome);
        document.getElementById('taxNewMonthly').textContent = fmt(n.monthlyTakeHome) + '/mo';

        // Old regime details
        const o = r.oldRegime;
        document.getElementById('taxOldTotal').textContent = fmt(o.totalTax);
        document.getElementById('taxOldRate').textContent = `Effective Rate: ${o.effectiveRate}%`;
        document.getElementById('taxOldGross').textContent = fmt(r.totalIncome);
        document.getElementById('taxOldStdDed').textContent = '-' + fmt(o.stdDeduction);
        document.getElementById('taxOldHRA').textContent = o.hraExemption ? '-' + fmt(o.hraExemption) : '₹0';
        document.getElementById('taxOld80C').textContent = o.sec80C ? '-' + fmt(o.sec80C) : '₹0';
        document.getElementById('taxOld80D').textContent = o.sec80D ? '-' + fmt(o.sec80D) : '₹0';
        document.getElementById('taxOldNPS').textContent = (o.sec80CCD1B + o.sec80CCD2) ? '-' + fmt(o.sec80CCD1B + o.sec80CCD2) : '₹0';
        document.getElementById('taxOldHomeLoan').textContent = o.homeLoan ? '-' + fmt(o.homeLoan) : '₹0';
        const otherDed = o.ltaExemption + o.sec80E + o.sec80G + o.sec80TTA + o.sec80EEA;
        document.getElementById('taxOldOther').textContent = otherDed ? '-' + fmt(otherDed) : '₹0';
        document.getElementById('taxOldTaxable').textContent = fmt(o.taxableIncome);
        document.getElementById('taxOldBaseTax').textContent = fmt(o.baseTax);
        document.getElementById('taxOldRebate').textContent = o.rebate ? '-' + fmt(o.rebate) : '₹0';
        document.getElementById('taxOldSurcharge').textContent = fmt(o.surcharge);
        document.getElementById('taxOldCess').textContent = fmt(o.cess);
        document.getElementById('taxOldFinal').textContent = fmt(o.totalTax);
        document.getElementById('taxOldTakeHome').textContent = fmt(o.takeHome);
        document.getElementById('taxOldMonthly').textContent = fmt(o.monthlyTakeHome) + '/mo';

        // Bar chart
        renderChart(r);

        // Slab tables
        renderSlabTable('taxSlabTableNew', n.taxableIncome, NEW_SLABS);
        const oldSlabs = inputs.age >= 80 ? OLD_SLABS_SUPER : inputs.age >= 60 ? OLD_SLABS_SENIOR : OLD_SLABS_NORMAL;
        renderSlabTable('taxSlabTableOld', o.taxableIncome, oldSlabs);

        // Tips
        renderTips(r, inputs);
    }

    /* ========== BAR CHART ========== */
    function renderChart(r) {
        const container = document.getElementById('taxChart');
        if (!container) return;

        const maxVal = Math.max(r.newRegime.totalTax, r.oldRegime.totalTax, 1);
        const newPct = (r.newRegime.totalTax / maxVal * 100).toFixed(1);
        const oldPct = (r.oldRegime.totalTax / maxVal * 100).toFixed(1);

        container.innerHTML = `
            <div class="tax-bar-group">
                <div class="tax-bar-label">
                    <span>✨ New Regime</span>
                    <span class="tax-bar-value">${fmt(r.newRegime.totalTax)}</span>
                </div>
                <div class="tax-bar-track">
                    <div class="tax-bar-fill tax-bar-new" style="width:${newPct}%"></div>
                </div>
            </div>
            <div class="tax-bar-group">
                <div class="tax-bar-label">
                    <span>📜 Old Regime</span>
                    <span class="tax-bar-value">${fmt(r.oldRegime.totalTax)}</span>
                </div>
                <div class="tax-bar-track">
                    <div class="tax-bar-fill tax-bar-old" style="width:${oldPct}%"></div>
                </div>
            </div>
            <div class="tax-bar-group" style="margin-top:16px;">
                <div class="tax-bar-label">
                    <span>💰 Take-Home (New)</span>
                    <span class="tax-bar-value">${fmt(r.newRegime.takeHome)}</span>
                </div>
                <div class="tax-bar-track">
                    <div class="tax-bar-fill tax-bar-takehome-new" style="width:${(r.newRegime.takeHome / r.totalIncome * 100).toFixed(1)}%"></div>
                </div>
            </div>
            <div class="tax-bar-group">
                <div class="tax-bar-label">
                    <span>💰 Take-Home (Old)</span>
                    <span class="tax-bar-value">${fmt(r.oldRegime.takeHome)}</span>
                </div>
                <div class="tax-bar-track">
                    <div class="tax-bar-fill tax-bar-takehome-old" style="width:${(r.oldRegime.takeHome / r.totalIncome * 100).toFixed(1)}%"></div>
                </div>
            </div>
        `;
    }

    /* ========== SLAB TABLE ========== */
    function renderSlabTable(containerId, taxableIncome, slabs) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rows = getSlabBreakdown(taxableIncome, slabs);
        let html = `
            <table class="tax-slab-tbl">
                <thead>
                    <tr><th>Income Slab</th><th>Rate</th><th>Taxable Amount</th><th>Tax</th></tr>
                </thead>
                <tbody>
        `;
        for (const row of rows) {
            const cls = row.tax > 0 ? 'tax-slab-active' : '';
            html += `<tr class="${cls}">
                <td>${row.range}</td>
                <td>${row.rate}</td>
                <td>${fmt(row.taxable)}</td>
                <td>${fmt(row.tax)}</td>
            </tr>`;
        }
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    /* ========== TAX TIPS ========== */
    function renderTips(r, inputs) {
        const container = document.getElementById('taxTips');
        if (!container) return;

        const tips = [];
        const o = r.oldRegime;

        if (!inputs.sec80C || inputs.sec80C < 150000) {
            const unused = 150000 - (inputs.sec80C || 0);
            tips.push({
                icon: '🏦',
                title: 'Maximize Section 80C',
                text: `You can still claim ${fmt(unused)} more under 80C through EPF, PPF, ELSS mutual funds, life insurance, or tuition fees. This could save up to ${fmt(Math.round(unused * 0.30))} in Old Regime.`,
            });
        }

        if (!inputs.sec80D) {
            tips.push({
                icon: '🏥',
                title: 'Get Health Insurance (80D)',
                text: 'Health insurance premiums up to ₹25,000 (₹50,000 for seniors) are deductible under 80D. Add ₹25,000-₹50,000 more for parents.',
            });
        }

        if (!inputs.sec80CCD1B) {
            tips.push({
                icon: '🏛️',
                title: 'Invest in NPS (80CCD1B)',
                text: 'An additional ₹50,000 invested in NPS is deductible under 80CCD(1B) over and above 80C. This can save up to ₹15,000-₹17,000 tax.',
            });
        }

        if (inputs.rent && !inputs.homeLoanInterest) {
            tips.push({
                icon: '🏠',
                title: 'Consider Home Loan Benefits',
                text: 'Home loan interest up to ₹2,00,000 is deductible under Section 24(b) in Old Regime. Principal repayment falls under 80C.',
            });
        }

        if (r.betterRegime === 'new' && o.totalDeductions < 375000) {
            tips.push({
                icon: '📊',
                title: 'Why New Regime is better for you',
                text: `Your total Old Regime deductions are ${fmt(o.totalDeductions)}. The New Regime wins because its lower slab rates offset the lost deductions. Consider the New Regime for simplicity.`,
            });
        }

        if (r.betterRegime === 'old') {
            tips.push({
                icon: '📋',
                title: 'Keep your investment proofs ready',
                text: 'Since Old Regime is better for you, ensure you submit all investment proofs (80C, 80D, rent receipts, home loan certificate) to your employer before March.',
            });
        }

        if (r.totalIncome >= 5000000) {
            tips.push({
                icon: '💼',
                title: 'Explore HUF & Capital Gains planning',
                text: 'At your income level, consider creating an HUF, tax-loss harvesting on investments, and timing capital gains across financial years.',
            });
        }

        tips.push({
            icon: '📅',
            title: 'File before July 31, 2026',
            text: 'The due date for filing ITR for FY 2025-26 (AY 2026-27) is July 31, 2026. Filing early avoids penalties and gets faster refunds.',
        });

        container.innerHTML = tips.map(t => `
            <div class="tax-tip">
                <span class="tax-tip-icon">${t.icon}</span>
                <div>
                    <strong>${t.title}</strong>
                    <p>${t.text}</p>
                </div>
            </div>
        `).join('');
    }

    /* ========== NUMBER TO WORDS ========== */
    function numberToIndianWords(n) {
        if (n >= 10000000) {
            const cr = n / 10000000;
            return cr % 1 === 0 ? cr + ' Crore' : cr.toFixed(2) + ' Crore';
        }
        if (n >= 100000) {
            const l = n / 100000;
            return l % 1 === 0 ? l + ' Lakh' : l.toFixed(2) + ' Lakh';
        }
        if (n >= 1000) {
            const k = n / 1000;
            return k % 1 === 0 ? k + ' Thousand' : k.toFixed(1) + ' Thousand';
        }
        return n.toString();
    }

})();
