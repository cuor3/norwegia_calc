/*
 * Norweski podatek od wynagrodzeń — logika obliczeń (bez zależności).
 * Działa w przeglądarce (window.NorwayTax) i w Node (require).
 *
 * Źródła parametrów:
 *  - 2022: Skatteetaten, Forskuddsmeldingen 2022
 *  - 2023: Skatteetaten, Forskuddsmeldingen 2023
 *  - 2024–2025: regjeringen.no, Skattesatser 2025
 *  - 2026: budsjettforlik Ap/Sp/Rødt z 30.11.2025 (wg smartepenger.no / Sands)
 * Limit PAYE (kildeskatt på lønn) = próg trinnskatt trinn 3 danego roku.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NorwayTax = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RATES = {
    2022: {
      trinn: [[190350, 0.017], [267900, 0.040], [643800, 0.134], [969200, 0.164], [2000000, 0.174]],
      minstePct: 0.46, minsteMin: 31800, minsteMax: 109950,
      person: 58250,
      trygdPct: 0.080, trygdLow: 64650,
      unionMax: 5800,
      kildeskatt: 0.25, payeLimit: 643800,
      source: "Skatteetaten, Forskuddsmeldingen 2022"
    },
    2023: {
      trinn: [[198350, 0.017], [279150, 0.040], [642950, 0.135], [926800, 0.165], [1500000, 0.175]],
      minstePct: 0.46, minsteMin: 0, minsteMax: 104450,
      person: 79600,
      trygdPct: 0.079, trygdLow: 69650,
      unionMax: 7700,
      kildeskatt: 0.25, payeLimit: 642950,
      source: "Skatteetaten, Forskuddsmeldingen 2023"
    },
    2024: {
      trinn: [[208050, 0.017], [292850, 0.040], [670000, 0.136], [937900, 0.166], [1350000, 0.176]],
      minstePct: 0.46, minsteMin: 0, minsteMax: 104450,
      person: 88250,
      trygdPct: 0.078, trygdLow: 69650,
      unionMax: 8000,
      kildeskatt: 0.25, payeLimit: 670000,
      source: "regjeringen.no, Skattesatser 2025 (kolumna 2024)"
    },
    2025: {
      trinn: [[217400, 0.017], [306050, 0.040], [697150, 0.137], [942400, 0.167], [1410750, 0.177]],
      minstePct: 0.46, minsteMin: 0, minsteMax: 92000,
      person: 108550,
      trygdPct: 0.077, trygdLow: 99650,
      unionMax: 8250,
      kildeskatt: 0.25, payeLimit: 697150,
      source: "regjeringen.no, Skattesatser 2025"
    },
    2026: {
      trinn: [[226100, 0.017], [318300, 0.040], [725050, 0.137], [980100, 0.168], [1467200, 0.178]],
      minstePct: 0.46, minsteMin: 0, minsteMax: 95700,
      person: 114540,
      trygdPct: 0.076, trygdLow: 99650,
      unionMax: 8700,
      kildeskatt: 0.25, payeLimit: 725050,
      source: "Budżet 2026 po budsjettforlik z 30.11.2025"
    }
  };

  var GENERAL_RATE = 0.22;      // skatt på alminnelig inntekt
  var TRYGD_PHASE_IN = 0.25;    // opptrappingssats trygdeavgift

  /**
   * @param {object} p
   * @param {number} p.year      rok podatkowy (klucz RATES)
   * @param {number} p.income    dochód brutto z Norwegii w danym roku (NOK)
   * @param {number} p.months    miesiące obowiązku podatkowego (1–12, pełne i rozpoczęte)
   * @param {boolean} p.rule90   reguła 90% (EOG) — pełny personfradrag
   * @param {boolean} p.union    czy odliczać składki związkowe
   * @param {number} p.unionFee  zapłacone składki (NOK)
   * @param {boolean} p.std25    czy pobrano dokładnie 25% kildeskatt
   * @param {number} p.paid      faktycznie pobrany podatek, gdy std25 = false
   */
  function calculate(p) {
    var r = RATES[p.year];
    if (!r) throw new Error("Brak stawek dla roku " + p.year);

    var inc = Math.max(0, Number(p.income) || 0);
    var months = Math.min(12, Math.max(1, Math.round(Number(p.months) || 12)));

    // Trygdeavgift: 0 do progu, potem min(stawka × dochód, 25% × nadwyżka)
    var trygd = inc <= r.trygdLow ? 0 : Math.min(inc * r.trygdPct, TRYGD_PHASE_IN * (inc - r.trygdLow));

    // Minstefradrag: 46% dochodu w granicach [min, max], nigdy więcej niż dochód. Nie dzielony na miesiące.
    var minste = Math.min(inc, Math.max(r.minsteMin, Math.min(inc * r.minstePct, r.minsteMax)));

    // Fagforeningsfradrag: faktycznie zapłacone, nie więcej niż limit roczny
    var union = p.union ? Math.min(Math.max(0, Number(p.unionFee) || 0), r.unionMax) : 0;

    // Personfradrag: proporcjonalnie do miesięcy (begrenset skatteplikt), pełny przy regule 90%
    var person = p.rule90 ? r.person : r.person * months / 12;

    var alminnelig = Math.max(0, inc - minste - union);
    var base22 = Math.max(0, alminnelig - person);
    var tax22 = base22 * GENERAL_RATE;

    // Trinnskatt od personinntekt (brutto), progi nie są dzielone na miesiące
    var trinnRows = [];
    var trinn = 0;
    for (var i = 0; i < r.trinn.length; i++) {
      var from = r.trinn[i][0];
      var to = i + 1 < r.trinn.length ? r.trinn[i + 1][0] : Infinity;
      var amount = Math.max(0, Math.min(inc, to) - from);
      var tax = amount * r.trinn[i][1];
      trinn += tax;
      trinnRows.push({ step: i + 1, from: from, to: to, rate: r.trinn[i][1], amount: amount, tax: tax });
    }

    var total = tax22 + trinn + trygd;
    var payeTax = inc * r.kildeskatt;
    var paid = p.std25 ? payeTax : Math.max(0, Number(p.paid) || 0);

    return {
      year: p.year, income: inc, months: months,
      trygd: trygd, trygdCapped: inc > r.trygdLow && trygd < inc * r.trygdPct,
      minste: minste, union: union, person: person,
      alminnelig: alminnelig, base22: base22, tax22: tax22,
      trinn: trinn, trinnRows: trinnRows,
      total: total, payeTax: payeTax, paid: paid, diff: paid - total,
      effRate: inc > 0 ? total / inc : 0,
      payeEligible: inc <= r.payeLimit,
      rates: r
    };
  }

  return { RATES: RATES, GENERAL_RATE: GENERAL_RATE, calculate: calculate };
});
