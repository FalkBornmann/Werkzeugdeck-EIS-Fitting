# EIS-Fitting

**[App im Browser öffnen](https://falkbornmann.github.io/EIS-Fitting-Web/)** · Keine Installation nötig.

EIS-Spektren aus Zahner-ISM oder CSV fitten und passende Ersatzschaltbilder vergleichen. Messdateien bleiben auf dem eigenen Rechner.

1. **Beispiel fitten** wählen oder eine Messdatei laden.
2. Bauteiltypen für die automatische Suche auswählen oder unter **Eigenes Schaltbild** eine feste Schaltung aufbauen.
3. Fit auswählen, Schaltbild mit Bauteilwerten, Bode- und Nyquist-Diagramm ansehen oder den Fit als CSV speichern.

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

Tests: `python -m unittest discover -v`.

</details>
