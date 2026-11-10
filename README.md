# EIS-Fitting

**[App im Werkzeugdeck öffnen](https://werkzeugdeck.pages.dev/tools/eis-fitting/)** · Keine Installation für die Onlineversion nötig.

EIS-Spektren aus Zahner-ISM oder CSV fitten und passende Ersatzschaltbilder vergleichen. Messdateien bleiben auf dem eigenen Rechner.

1. Eine eigene Messdatei laden: **Bode- und Nyquist-Messkurven erscheinen sofort vor der Modellauswahl**, ohne Fit oder Download von Rechenbibliotheken. Die Vorschau bleibt beim Aufbau des Schaltbilds sichtbar. Eine neue Datei entfernt alte Fitergebnisse; fehlerhafte Dateien entfernen auch die Vorschau und sperren den Datei-Fit. Alternativ eines der beiden **Messbeispiele ansehen** und anschließend fitten. Die Beispiele enthalten jeweils 50 originale Frequenz-/Impedanzwerte von 0,1 Hz bis 100 kHz aus realen Messungen. Nur diese Messwerte sind eingebunden, keine weiteren ISM-Metadaten. Die neutralen Namen **Dreierschaltbild** (eine Zeitkonstante) und **Fünferschaltbild** (zwei Zeitkonstanten) beschreiben einfache Ausgangsmodelle; die automatische Suche kann andere Schaltungen vorschlagen. Beide Beispiele lassen sich als CSV herunterladen.
2. Optional einzelne Messpunkte durch Anklicken in Bode-/Nyquist-Vorschau oder per Checkbox in der Messpunkttabelle ausschließen. Graue Kreuze bleiben in beiden Ergebnisdiagrammen und in PNG-/SVG-Exporten sichtbar. **Alle Messpunkte einschließen** stellt die Auswahl wieder her. Mindestens acht Punkte müssen verbleiben; das Modell kann weitere Punkte erfordern. Jede Änderung blendet den alten Fit aus. Fit, RMS und AICc werden ausschließlich aus der verbleibenden Auswahl berechnet. Alle Kandidaten werden mit denselben Punkten verglichen. Ausschlüsse bleiben für die jeweilige geladene Datei bzw. das jeweilige Beispiel erhalten; eine neu geladene Datei beginnt mit allen Punkten. Der Fit-CSV-Export enthält alle Originalpunkte mit `included_in_fit` (1/0); für ausgeschlossene Punkte bleiben die Fitspalten leer. Die Prognose bezieht sich auf den verbleibenden Frequenzbereich. Ausschlüsse fachlich begründen und dokumentieren; ein kleinerer RMS allein ist kein Grund.
3. Bauteiltypen für die automatische Suche auswählen oder unter **Eigenes Schaltbild** eine feste Schaltung aufbauen: im strukturierten Editor oder zusätzlich grafisch per Drag-and-drop. Im grafischen Editor Bauteile auf die Fläche ziehen oder anklicken und je zwei Anschlüsse anklicken, um eine Leitung zu zeichnen. Mehrere Leitungen am selben Anschluss bilden einen Knoten; reine Kreuzungen verbinden nicht. Tab/Enter verbinden Anschlüsse, Pfeiltasten verschieben ein fokussiertes Bauteil. Rückgängig, Löschen einzelner Leitungen und eine RC-Vorlage helfen beim Aufbau. Beide Editoren behalten eigene Entwürfe. Unterstützt werden Reihen-/Parallelnetze bis zwölf Bauteile; offene, kurzgeschlossene oder nicht reduzierbare Brückennetze werden vor dem Fit abgewiesen.
4. Im Modellvergleich stehen die Ersatzschaltbilder bereits als Grafiken. Über **Fit anzeigen** direkt in einer Tabellenzeile das gewünschte Modell wählen; die aktive Zeile ist hervorgehoben. Unterhalb erscheinen Schaltbild mit Bauteilwerten, Bode- und Nyquist-Diagramm. **Zurück zum Modellvergleich** führt zur aktiven Zeile zurück. Tastatur und Touch werden unterstützt; die Schaltbilder werden vollständig eingepasst; auf kleinen Bildschirmen lässt sich die Tabelle seitlich scrollen. Prognose und Exporte verwenden immer das ausgewählte Modell. Das zusätzliche Fit-Dropdown entfällt.
5. Optional die **Frequenzprognose** aktivieren und untere/obere Frequenz als Vorfaktor × 10^Exponent eingeben (die Exponentenpfeile ändern die Frequenz um Faktor 10; Zwischenwerte sind über den Vorfaktor möglich) oder mit **Unten ÷ 10 / Oben × 10** erweitern. Die Grenzen müssen den ganzen Messbereich einschließen und zwischen 10⁻¹² und 10¹² Hz liegen. Mess- und Prognosebereich werden einheitlich in Potenzschreibweise angezeigt. Das Modell wird mit unveränderten Fitparametern ausgewertet. Sandfarbene Flächen und gestrichelte Kurven kennzeichnen Extrapolationen; Punkte bleiben ausschließlich Messwerte. RMS, AICc und Nyquist bleiben auf die Messung bezogen. Ein eigener Modell-CSV-Export markiert jede Zeile als `extrapolation` oder `measured_frequency_range`. PNG-Exporte enthalten die sichtbare Prognose samt Kennzeichnung. Die Prognose ist modellabhängig und enthält kein Konfidenzband; daraus folgt keine Bestätigung physikalischer Prozesse außerhalb der Messung.

<details>
<summary>Dateiformat und Fitmethode</summary>

CSV-Dateien verwenden UTF-8, Komma als Trennzeichen und einen Dezimalpunkt. Erwartete Spalten: `frequency_Hz,Zreal_ohm,Zimag_ohm`. Kapazitive Impedanz hat einen negativen Imaginärteil.

Die App kombiniert zugelassene Bauteile in Reihen- und Parallelzweigen. Ein CPE zählt als ein Bauteil und besitzt zwei Fitparameter. Die Suche erweitert aussichtsreiche Kandidaten bis zur gewählten Grenze. AICc berücksichtigt die Anzahl der freien Parameter. Die Ergebnisse stammen aus einer heuristischen Suche.

</details>

<details>
<summary>Lokaler Start und Web-Build</summary>

Für den lokalen Python-Start mit Python 3.11 oder neuer:

```sh
python -m pip install -r requirements.txt
python app.py --open
```

Unter Windows kann nach der Installation auch `Start-EIS-Fitting.cmd` verwendet werden. `python build_web.py` erstellt die Einzel-App unter `dist/` . Der Browser lädt Pyodide und SciPy beim ersten Fit. Der Fit läuft in einem Web Worker.

Tests: `python -m unittest discover -v` und `node --test test_features.cjs`. Die Python-Tests prüfen zusätzlich beide Messbeispiele und die Übereinstimmung der JavaScript-Prognose mit dem Python-Rechenkern für alle Bauteiltypen.

Mit installiertem Playwright: `node test_browser.cjs`. Der Test startet lokale Python- und Static-Server sowie einen isolierten Headless-Browser ohne Benutzerprofil und prüft beide Rechenwege, Drag-and-drop, Anschlussverdrahtung, Verschieben, Prognose, Modellwechsel, CSV-/PNG-Exporte und die mobile Breite. `EIS_PYTHON` und `EIS_BROWSER` können die Python- und Browserprogramme vorgeben. Standardmäßig wird `.venv/Scripts/python.exe` und der Playwright-Chromium verwendet.

</details>

## Theorie und Bedienoberfläche

Die Oberfläche folgt KeksUndTee: dunkelgrüner Kopfbereich, sandfarbene Akzente und helle Karten mit responsiven Eingaben. Eine sichtbare Einführung erklärt die Grundlagen; die ausführliche Theorie lässt sich mit Herleitungen, Rechenverfahren, Grenzen und Fachquellen aufklappen. Nutzungshinweise erläutern KI-Unterstützung, Messdatenverarbeitung, Exporte, Hosting und Haftung.


## Werkzeugdeck-Katalog
Dieses Repository enthält ausschließlich das Tool. Fachgebiete, Navigation, veröffentlichter Versionsstand und gemeinsame Auslieferung werden im [Werkzeugdeck-Katalog](https://github.com/FalkBornmann/Werkzeugdeck) gepflegt.
Online: https://werkzeugdeck.pages.dev/tools/eis-fitting/

## Grafikexport
Die erzeugten Diagramme und Grafiken lassen sich als PNG und als echte SVG-Vektorgrafik speichern. SVG enthält skalierbare Linien, Flächen und Text. Beide Formate übernehmen den gewählten Darstellungszustand; Exporte entstehen lokal im Browser.

## Fachtheorie und einheitliche Bedienung
[Fachtheorie öffnen](https://werkzeugdeck.pages.dev/bereiche/elektrochemie/theorie/) · [Design- und Exportvorgaben](https://github.com/FalkBornmann/Werkzeugdeck/blob/main/docs/DESIGN.md)
Das gemeinsame Exportmenü bietet Darstellung, Dateityp und Speichern. PNG ist vorausgewählt; SVG enthält skalierbare Vektoren und Text.


## Schaltbildbibliothek und Messreihen

Unter **Eigenes Schaltbild** (beide Editoren) stehen 13 Vorlagen in den Kategorien Elektrochemie, Elektrotechnik, Batterie und Korrosionsschutz. Jeweils eine Vorlage wird mit Vorschau, Einsatzbereich, Grenzen und Quellen angezeigt. Die Auswahl umfasst unter anderem RC/RL/RLC, Randles mit und ohne Warburg-Diffusion, Batterie-RC-Zweige und Beschichtungs-/Porenmodelle. Die Zuordnung ist eine Orientierung, keine Diagnose eines Mechanismus. Das Batteriemodell beschreibt hier die Kleinsignalimpedanz und kein vollständiges SOC-/Leerlaufspannungsmodell.

**Vorlage in Editor übernehmen** lädt eine bearbeitbare Topologie. Der nachfolgende Fit optimiert nur deren Parameter, statt automatisch viele Topologien zu durchsuchen. Der Entwurf bleibt bei einem Dateiwechsel bestehen. Über **Schaltbild als JSON speichern** / **Schaltbilddatei laden** lässt er sich zwischen Sitzungen und Editoren wiederverwenden; Messdaten und Kennwerte sind nicht enthalten. Ein gewähltes automatisches Fitmodell kann ebenfalls als Entwurf übernommen werden. JSON-Importe werden auf das Dateiformat, zulässige Bauteile und höchstens zwölf Elemente geprüft.

Nyquist- und Bode-Fitlinien verwenden ein logarithmisches Raster mit mindestens 401 Punkten und den verwendeten Messfrequenzen. Es wird die komplexe Modellimpedanz mit unveränderten Fitparametern berechnet, keine geometrische Glättung der Messdaten. CSV-Fitwerte, RMS und AICc beziehen sich weiterhin auf die tatsächlich zum Fit verwendeten Messpunkte. Eine optisch glatte Linie validiert kein Modell.
