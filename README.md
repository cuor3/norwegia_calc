# Zwrot podatku z Norwegii

Kalkulator porównujący podatek pobrany w systemie PAYE (kildeskatt 25%) z podatkiem z
rocznego rozliczenia (ordinær skatteberegning) dla lat 2022–2026. To statyczna strona
bez kroku budowania i bez zależności, więc działa bezpośrednio na GitHub Pages.

## Struktura

```
index.html          strona
assets/tax.js       stawki i logika obliczeń (przeglądarka + Node)
assets/app.js       obsługa formularza i widok wyniku
assets/style.css    wygląd (jasny i ciemny motyw)
tests/tax.test.js   testy obliczeń (node:test)
.nojekyll           wyłącza przetwarzanie Jekyll na GitHub Pages
.github/workflows/test.yml   testy przy każdym pushu
```

## Publikacja na GitHub Pages

1. Utwórz repozytorium i wgraj zawartość tego folderu do gałęzi `main`.
2. W repozytorium: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   wybierz gałąź `main` i folder `/ (root)`, zapisz.
3. Po chwili strona będzie dostępna pod `https://<użytkownik>.github.io/<repozytorium>/`.

Wszystkie ścieżki są względne, więc strona działa też pod własną domeną (plik `CNAME`)
i po otwarciu `index.html` bezpośrednio z dysku.

## Testy

Wymagany Node 18 lub nowszy:

```
node --test
```

## Aktualizacja stawek na nowy rok

Dodaj rok w obiekcie `RATES` w `assets/tax.js` (progi trinnskatt, minstefradrag,
personfradrag, trygdeavgift, limit związkowy, limit PAYE = próg trinn 3) i wpisz źródło
w polu `source`. Lista lat w formularzu buduje się z tego obiektu automatycznie.
Uruchom testy: test „Limit PAYE = próg trinn 3” sprawdza spójność nowego wpisu.

## Model obliczeń

| Pozycja | Sposób liczenia |
|---|---|
| Minstefradrag | 46% dochodu, maks. limit roczny (2022 także min. 31 800), bez dzielenia na miesiące |
| Fagforeningsfradrag | faktycznie zapłacone składki, maks. limit roczny |
| Personfradrag | proporcjonalnie do miesięcy pobytu; pełny przy regule 90% (EOG) |
| Podatek 22% | od alminnelig inntekt pomniejszonego o personfradrag |
| Trinnskatt | od dochodu brutto, pełne progi roczne |
| Trygdeavgift | stawka dla wynagrodzeń, z ograniczeniem do 25% nadwyżki ponad dolny próg |

Pominięte: pendlerfradrag, reisefradrag, odsetki, ulgi rodzinne, inne dochody, stawki
dla osób spoza folketrygden, obniżone stawki w Finnmark i Nord-Troms.

## Źródła stawek

- 2022: Skatteetaten, Forskuddsmeldingen 2022
- 2023: Skatteetaten, Forskuddsmeldingen 2023
- 2024–2025: regjeringen.no, Skattesatser 2025
- 2026: budżet po porozumieniu Ap/Sp/Rødt z 30.11.2025

Wynik jest szacunkiem. Wiążące jest rozliczenie Skatteetaten.
