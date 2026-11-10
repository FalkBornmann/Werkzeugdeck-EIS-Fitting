/* Topology suggestions, not automatic identification of physical processes. */
const CIRCUIT_SOURCES={
  gamry:{title:"Gamry · EIS-Grundlagen",url:"https://www.gamry.com/application-notes/EIS/basics-of-electrochemical-impedance-spectroscopy/"},
  coating:{title:"Gamry · EIS of Coated Metals",url:"https://www.gamry.com/assets/Uploads/resources/The-Basics-of-EIS-Part-4.pdf"},
  battery:{title:"MathWorks · Battery Equivalent Circuit",url:"https://www.mathworks.com/help/simscape-battery/ref/batteryequivalentcircuit.html"},
  inductance:{title:"BioLogic · Application Note 42",url:"https://www.biologic.net/wp-content/uploads/2019/08/battery-eis-modified-inductance-element_electrochemsitry-an42.pdf"},
  capacitor:{title:"Murata · ESR und ESL von Kondensatoren",url:"https://www.murata.com/en-GB/products/emc/emifil/library/knowhow/basic/chapter06-p6"}
};
const CIRCUIT_PRESETS=[
  {id:"series-rc",category:"Elektrotechnik",title:"RC in Reihe",tree:["s","R","C"],description:"Kapazität mit Serienwiderstand, etwa als einfaches ESR-Modell. Bei hohen Frequenzen kann die parasitäre Induktivität fehlen.",sources:["capacitor"]},
  {id:"series-rl",category:"Elektrotechnik",title:"RL in Reihe",tree:["s","R","L"],description:"Ideale Induktivität mit ohmschem Serienverlust. Wicklungskapazität und frequenzabhängige Verluste sind nicht enthalten.",sources:["gamry"]},
  {id:"series-rlc",category:"Elektrotechnik",title:"Kondensator mit ESR und ESL",tree:["s","R","L","C"],description:"Serienwiderstand, parasitäre Serieninduktivität und Kapazität; kann eine Eigenresonanz beschreiben.",sources:["capacitor"]},
  {id:"randles-rc",category:"Elektrochemie",title:"Vereinfachtes Randles-Modell · RC",tree:["s","R",["p","R","C"]],description:"Lösungswiderstand vor Ladungsdurchtrittswiderstand und Doppelschichtkapazität. Idealisiertes Modell einer Zeitkonstante ohne Diffusion.",sources:["gamry"]},
  {id:"randles-rq",category:"Elektrochemie",title:"Nichtideale Grenzfläche · RQ",tree:["s","R",["p","R","Q"]],description:"RC-Variante mit CPE für nichtideales kapazitives Verhalten. Q ist für n ≠ 1 keine Kapazität in Farad; ein CPE beweist keine bestimmte Ursache.",sources:["gamry"]},
  {id:"randles-warburg",category:"Elektrochemie",title:"Randles mit Warburg-Diffusion",tree:["s","R",["p","C",["s","R","W"]]],description:"Der faradaische Zweig enthält Ladungsdurchtrittswiderstand und Warburg-Element in Reihe, parallel zur Doppelschichtkapazität. W setzt semiunendliche Diffusion voraus.",sources:["gamry","inductance"]},
  {id:"battery-rc",category:"Batterie",title:"Ein RC-Zweig · Kleinsignalmodell",tree:["s","R",["p","R","C"]],description:"Ohmscher Anteil und ein Polarisationszweig. Hier wird nur die Kleinsignalimpedanz gefittet, keine Leerlaufspannung, Kapazität in Ah oder Ladezustandsdynamik.",sources:["battery"]},
  {id:"battery-two-rc",category:"Batterie",title:"Zwei RC-Zweige · zwei Zeitkonstanten",tree:["s","R",["p","R","C"],["p","R","C"]],description:"Ohmscher Anteil und zwei Polarisationszweige. Die Zuordnung der Zweige zu Prozessen erfordert unabhängige Prüfung; überlappende Zeitkonstanten erschweren die Trennung.",sources:["battery"]},
  {id:"battery-inductive",category:"Batterie",title:"Induktiver Anteil + Randles mit Diffusion",tree:["s","R","L",["p","C",["s","R","W"]]],description:"Randles-Netz mit Serieninduktivität für hochfrequente induktive Anteile. Die ideale Induktivität ist ein Spezialfall des von BioLogic beschriebenen La-Elements.",sources:["inductance"]},
  {id:"coating-blocking",category:"Korrosionsschutz",title:"Ideal sperrende Beschichtung",tree:["s","R","C"],description:"Lösungswiderstand und Schichtkapazität. Leckstrom und Grenzflächenreaktionen sind hier nicht abgebildet.",sources:["gamry","coating"]},
  {id:"coating-leaky",category:"Korrosionsschutz",title:"Beschichtung mit endlichem Widerstand",tree:["s","R",["p","R","C"]],description:"Ein Schichtwiderstand parallel zur Schichtkapazität, hinter dem Lösungswiderstand. Einfache Beschreibung eines begrenzten Frequenzbereichs.",sources:["coating"]},
  {id:"coating-pore",category:"Korrosionsschutz",title:"Porenmodell · zwei RC-Prozesse",tree:["s","R",["p","C",["s","R",["p","R","C"]]]],description:"Schichtkapazität parallel zu Porenwiderstand und Grenzflächen-RC-Zweig. Ein mögliches Modell einer durchlässigen Beschichtung, keine eindeutige Schadensdiagnose.",sources:["coating"]},
  {id:"coating-cpe",category:"Korrosionsschutz",title:"Porenmodell · nichtideale CPE-Variante",tree:["s","R",["p","Q",["s","R",["p","R","Q"]]]],description:"Bewusst gewählte CPE-Erweiterung des Porenmodells. Zusätzliche Exponenten erhöhen die Flexibilität und können die Eindeutigkeit der Kennwerte schwächen.",sources:["coating","gamry"]}
];
function validateCircuitTopology(tree) {
  let count=0;
  function visit(node,depth=0){
    if(depth>12)throw new Error("Schaltbild zu tief verschachtelt.");
    if(typeof node==="string"&&["R","C","Q","L","La","W","Wo","Ws","G"].includes(node)){count++;return node;}
    if(!Array.isArray(node)||node.length<3||node.length>13||!["s","p"].includes(node[0]))throw new Error("Ungültige Reihen-/Parallelschaltung.");
    return [node[0],...node.slice(1).map(child=>visit(child,depth+1))];
  }
  const copy=visit(tree);
  if(count>12)throw new Error("Höchstens zwölf Bauteile pro Schaltbild.");
  return copy;
}
function parseCircuitFile(text) {
  const value=JSON.parse(text);
  if(value.format!=="werkzeugdeck-eis-circuit"||value.version!==1)throw new Error("Keine unterstützte Werkzeugdeck-Schaltbilddatei.");
  return validateCircuitTopology(value.topology);
}
if(typeof module!=="undefined")module.exports={CIRCUIT_PRESETS,validateCircuitTopology,parseCircuitFile};
