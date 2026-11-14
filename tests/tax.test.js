// Uruchom z katalogu repozytorium: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, RATES } = require("../assets/tax.js");

const base = { months: 12, rule90: false, union: false, unionFee: 0, std25: true, paid: 0 };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} ≠ ${b}`);

test("2024, 400 000 NOK, 12 miesięcy — pełne wyliczenie krok po kroku", () => {
  const c = calculate({ ...base, year: 2024, income: 400000 });
  near(c.minste, 104450, "minstefradrag (limit)");
  near(c.alminnelig, 295550, "alminnelig inntekt");
  near(c.person, 88250, "personfradrag");
  near(c.base22, 207300, "podstawa 22%");
  near(c.tax22, 45606, "podatek 22%");
  near(c.trinn, (292850 - 208050) * 0.017 + (400000 - 292850) * 0.04, "trinnskatt");
  near(c.trygd, 31200, "trygdeavgift 7,8%");
  near(c.total, 82533.6, "podatek razem");
  near(c.payeTax, 100000, "PAYE 25%");
  near(c.diff, 17466.4, "zwrot");
  assert.equal(c.payeEligible, true);
});

test("Trygdeavgift: opptrapping tuż nad progiem (2025)", () => {
  const c = calculate({ ...base, year: 2025, income: 110000 });
  near(c.trygd, 0.25 * (110000 - 99650), "trygdeavgift ograniczona");
  assert.equal(c.trygdCapped, true);
});

test("Trygdeavgift: 0 poniżej progu", () => {
  const c = calculate({ ...base, year: 2025, income: 90000 });
  assert.equal(c.trygd, 0);
});

test("Trygdeavgift: bez skoku na progu (ciągłość)", () => {
  const r = RATES[2025];
  const a = calculate({ ...base, year: 2025, income: r.trygdLow });
  const b = calculate({ ...base, year: 2025, income: r.trygdLow + 1 });
  assert.ok(b.trygd - a.trygd <= 0.25 + 1e-9);
});

test("Personfradrag proporcjonalny do miesięcy, pełny przy regule 90%", () => {
  const six = calculate({ ...base, year: 2025, income: 300000, months: 6 });
  near(six.person, 108550 / 2, "6/12");
  const full = calculate({ ...base, year: 2025, income: 300000, months: 6, rule90: true });
  near(full.person, 108550, "reguła 90%");
  assert.ok(full.total < six.total);
});

test("Minstefradrag nie jest dzielony na miesiące", () => {
  const a = calculate({ ...base, year: 2025, income: 150000, months: 3 });
  near(a.minste, 150000 * 0.46, "46% dochodu");
});

test("Minstefradrag 2022: dolna granica 31 800, ale nie więcej niż dochód", () => {
  near(calculate({ ...base, year: 2022, income: 50000 }).minste, 31800, "dolna granica");
  near(calculate({ ...base, year: 2022, income: 20000 }).minste, 20000, "ograniczony dochodem");
});

test("Składki związkowe: faktyczna kwota, maks. limit roczny", () => {
  near(calculate({ ...base, year: 2025, income: 400000, union: true, unionFee: 3000 }).union, 3000, "faktyczne");
  near(calculate({ ...base, year: 2025, income: 400000, union: true, unionFee: 20000 }).union, 8250, "limit 2025");
  near(calculate({ ...base, year: 2022, income: 400000, union: true, unionFee: 20000 }).union, 5800, "limit 2022");
});

test("Trinnskatt: wszystkie progi przy wysokim dochodzie (2026)", () => {
  const c = calculate({ ...base, year: 2026, income: 2000000 });
  const t = RATES[2026].trinn;
  let expected = 0;
  for (let i = 0; i < t.length; i++) {
    const to = i + 1 < t.length ? t[i + 1][0] : Infinity;
    expected += Math.max(0, Math.min(2000000, to) - t[i][0]) * t[i][1];
  }
  near(c.trinn, expected, "suma progów");
  assert.equal(c.payeEligible, false);
});

test("Faktycznie pobrany podatek zamiast 25%", () => {
  const c = calculate({ ...base, year: 2025, income: 400000, std25: false, paid: 90000 });
  near(c.paid, 90000, "pobrano");
  near(c.diff, 90000 - c.total, "różnica");
});

test("Dochód 0 nie daje podatku ani NaN", () => {
  const c = calculate({ ...base, year: 2025, income: 0 });
  assert.equal(c.total, 0);
  assert.equal(c.effRate, 0);
});

test("Limit PAYE = próg trinn 3 w każdym roku", () => {
  for (const [y, r] of Object.entries(RATES)) assert.equal(r.payeLimit, r.trinn[2][0], `rok ${y}`);
});

test("Nieznany rok zgłasza błąd", () => {
  assert.throws(() => calculate({ ...base, year: 2019, income: 1 }));
});
