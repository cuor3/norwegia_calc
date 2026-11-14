(function () {
  "use strict";

  var T = window.NorwayTax;
  var RATES = T.RATES;
  var GENERAL_RATE = T.GENERAL_RATE;

  // ---------- formatowanie ----------
  var nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
  function nok(v) { return nf.format(Math.round(v)) + " NOK"; }
  function pln(v) { return nf.format(Math.round(v)) + " PLN"; }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d).replace(".", ",") + "%"; }

  // ---------- stan ----------
  var $ = function (id) { return document.getElementById(id); };
  var DEFAULTS = { year: 2025, income: 400000, months: 12, rule90: false, union: false, unionFee: 0, std25: true, paid: 100000, fx: 0.37 };
  var KEY = "nokTaxCalc.v3";

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && RATES[s.year]) return Object.assign({}, DEFAULTS, s);
    } catch (e) { /* brak dostępu do localStorage */ }
    return Object.assign({}, DEFAULTS);
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignoruj */ } }

  Object.keys(RATES).sort().reverse().forEach(function (y) {
    var o = document.createElement("option");
    o.value = y;
    o.textContent = y;
    $("year").appendChild(o);
  });

  var state = load();
  $("year").value = String(state.year);
  $("income").value = state.income;
  $("months").value = state.months;
  $("rule90").checked = state.rule90;
  $("union").checked = state.union;
  $("unionFee").value = state.unionFee;
  $("std25").checked = state.std25;
  $("paid").value = state.paid;
  $("fx").value = state.fx;

  function num(id) { var v = parseFloat(String($(id).value).replace(",", ".")); return isFinite(v) ? v : NaN; }

  function setErr(id, msg) {
    var e = $(id + "-err");
    e.hidden = !msg;
    e.textContent = msg || "";
    $(id).setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function read() {
    var s = {
      year: parseInt($("year").value, 10),
      income: num("income"), months: num("months"),
      rule90: $("rule90").checked, union: $("union").checked, unionFee: num("unionFee"),
      std25: $("std25").checked, paid: num("paid"), fx: num("fx")
    };
    var ok = true;
    if (!(s.income >= 0)) { setErr("income", "Wpisz kwotę dochodu (0 lub więcej)."); ok = false; }
    else if (s.income > 50000000) { setErr("income", "Kwota wygląda na zbyt dużą. Sprawdź liczbę zer."); ok = false; }
    else setErr("income", "");

    if (!(s.months >= 1 && s.months <= 12 && Math.floor(s.months) === s.months)) { setErr("months", "Podaj pełną liczbę miesięcy od 1 do 12."); ok = false; }
    else setErr("months", "");

    if (!s.std25) {
      if (!(s.paid >= 0)) { setErr("paid", "Wpisz pobrany podatek (0 lub więcej)."); ok = false; }
      else if (s.income > 0 && s.paid > s.income) { setErr("paid", "Pobrany podatek nie może być wyższy niż dochód."); ok = false; }
      else setErr("paid", "");
    } else setErr("paid", "");

    if (s.union && !(s.unionFee >= 0)) { setErr("unionFee", "Wpisz kwotę składek (0 lub więcej)."); ok = false; }
    else setErr("unionFee", "");

    if (!(s.fx > 0)) s.fx = 0;
    return { s: s, ok: ok };
  }

  // ---------- render ----------
  function row(op, label, val, cls) {
    return "<tr" + (cls ? ' class="' + cls + '"' : "") + '><td class="op">' + (op || "") + "</td><td>" + label + '</td><td class="n">' + val + "</td></tr>";
  }
  function sec(label) { return '<tr class="sec"><td colspan="3">' + label + "</td></tr>"; }

  var lastText = "";

  function render() {
    var res = read();
    var s = res.s;
    var r = RATES[s.year];

    $("union-box").hidden = !s.union;
    $("paid-box").hidden = s.std25;
    $("union-hint").textContent = "Odliczenie maks. " + nok(r.unionMax) + " w " + s.year + " r.";
    $("rates-source").textContent = "Stawki " + s.year + ": " + r.source + ".";

    if (!res.ok) {
      $("verdict").className = "verdict neutral";
      $("v-label").textContent = "Popraw zaznaczone pola";
      $("v-amount").textContent = "—";
      $("v-pln").textContent = "";
      return;
    }
    save(s);

    var c = T.calculate(s);

    var v = $("verdict");
    if (Math.abs(c.diff) < 1) { v.className = "verdict neutral"; $("v-label").textContent = "Brak zwrotu i dopłaty"; }
    else if (c.diff > 0) { v.className = "verdict good"; $("v-label").textContent = "Szacowany zwrot podatku"; }
    else { v.className = "verdict bad"; $("v-label").textContent = "Szacowana dopłata"; }

    $("v-amount").textContent = nok(Math.abs(c.diff));
    $("v-pln").textContent = s.fx > 0 ? "≈ " + pln(Math.abs(c.diff) * s.fx) + " (kurs " + String(s.fx).replace(".", ",") + ")" : "";

    $("k-paid").textContent = nok(c.paid);
    $("k-due").textContent = nok(c.total);
    $("k-rate").textContent = pct(c.effRate, 2);

    var minsteLabel = "Minstefradrag (" + pct(r.minstePct, 0) + ", maks. " + nf.format(r.minsteMax) + (r.minsteMin ? ", min. " + nf.format(r.minsteMin) : "") + ")";
    var personLabel = "Personfradrag" + (s.rule90 ? " (pełny, reguła 90%)" : (c.months < 12 ? " (" + c.months + "/12 z " + nf.format(r.person) + ")" : ""));

    var h = "";
    h += sec("Podstawa (alminnelig inntekt)");
    h += row("", "Dochód brutto (personinntekt)", nok(c.income));
    h += row("−", minsteLabel, nok(c.minste));
    if (s.union) h += row("−", "Fagforeningsfradrag", nok(c.union));
    h += row("=", "Alminnelig inntekt", nok(c.alminnelig));
    h += row("−", personLabel, nok(c.person));
    h += row("=", "Podstawa podatku " + pct(GENERAL_RATE, 0), nok(c.base22));
    h += sec("Podatek należny");
    h += row("", "Skatt på alminnelig inntekt (" + pct(GENERAL_RATE, 0) + ")", nok(c.tax22));
    h += row("+", "Trinnskatt", nok(c.trinn));
    c.trinnRows.forEach(function (t) {
      if (t.amount <= 0) return;
      var range = nf.format(t.from) + (t.to === Infinity ? "+" : "–" + nf.format(t.to));
      h += row("", "Trinn " + t.step + ": " + range + " × " + pct(t.rate), nok(t.tax), "detail");
    });
    h += row("+", "Trygdeavgift (" + pct(r.trygdPct) + (c.trygdCapped ? ", ograniczona opptrapping" : "") + ")", nok(c.trygd));
    h += row("=", "Podatek należny razem", nok(c.total), "total");
    h += sec("Porównanie");
    h += row("", s.std25 ? "Pobrany kildeskatt (25% × brutto)" : "Faktycznie pobrany podatek", nok(c.paid));
    h += row("−", "Podatek należny", nok(c.total));
    h += row("=", c.diff >= 0 ? "Zwrot" : "Dopłata", nok(Math.abs(c.diff)), "total");
    $("breakdown").innerHTML = h;

    var alerts = [];
    if (!c.payeEligible) {
      alerts.push("<b>Powyżej limitu PAYE:</b> dochód przekracza " + nok(r.payeLimit) + " (limit na " + s.year + " r.). Taka osoba nie może być w PAYE i jest rozliczana zwykłymi zasadami, więc porównanie z 25% ma tylko charakter orientacyjny.");
    }
    if (c.diff < -0.5 && s.std25 && c.payeEligible) {
      alerts.push("<b>Zwykłe rozliczenie się nie opłaca:</b> przy tych danych daje wyższy podatek niż 25% PAYE. Rezygnacja z PAYE jest dobrowolna i nieodwracalna dla danego roku.");
    }
    $("alerts").innerHTML = alerts.map(function (a) { return '<div class="warnbox">' + a + "</div>"; }).join("");

    lastText = [
      "Rozliczenie Norwegia " + s.year,
      "Dochód brutto: " + nok(c.income),
      "Minstefradrag: " + nok(c.minste),
      s.union ? "Fagforeningsfradrag: " + nok(c.union) : null,
      "Personfradrag: " + nok(c.person) + (s.rule90 ? " (reguła 90%)" : " (" + c.months + "/12)"),
      "Podstawa 22%: " + nok(c.base22),
      "Podatek 22%: " + nok(c.tax22),
      "Trinnskatt: " + nok(c.trinn),
      "Trygdeavgift: " + nok(c.trygd),
      "Podatek należny: " + nok(c.total),
      "Pobrany podatek: " + nok(c.paid),
      (c.diff >= 0 ? "Zwrot: " : "Dopłata: ") + nok(Math.abs(c.diff)) + (s.fx > 0 ? " (≈ " + pln(Math.abs(c.diff) * s.fx) + ")" : ""),
      "Szacunek — wiążące jest rozliczenie Skatteetaten."
    ].filter(Boolean).join("\n");
  }

  // ---------- zdarzenia ----------
  $("f").addEventListener("input", render);
  $("f").addEventListener("change", render);
  $("f").addEventListener("submit", function (e) { e.preventDefault(); });

  $("reset").addEventListener("click", function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignoruj */ }
    state = Object.assign({}, DEFAULTS);
    $("year").value = String(state.year);
    $("income").value = state.income;
    $("months").value = state.months;
    $("rule90").checked = state.rule90;
    $("union").checked = state.union;
    $("unionFee").value = state.unionFee;
    $("std25").checked = state.std25;
    $("paid").value = state.paid;
    $("fx").value = state.fx;
    render();
  });

  $("copy").addEventListener("click", function () {
    var done = function () {
      var el = $("copied");
      el.hidden = false;
      setTimeout(function () { el.hidden = true; }, 1800);
    };
    var fallback = function () {
      var t = $("copy-fallback");
      t.hidden = false;
      t.value = lastText;
      t.focus();
      t.select();
    };
    try { navigator.clipboard.writeText(lastText).then(done, fallback); }
    catch (e) { fallback(); }
  });

  render();
})();
