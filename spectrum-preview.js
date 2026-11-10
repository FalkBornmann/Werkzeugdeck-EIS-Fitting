/* Read measurement points locally, without loading or running the fitter. */
function parseSpectrum(raw, suffix) {
  if (raw.byteLength > 2_000_000) throw new Error("Datei zu groß (maximal 2 MB).");
  let points=[];
  if(suffix===".ism") {
    const bytes=new Uint8Array(raw), view=new DataView(raw);
    if(bytes.length<12 || ![0,0,255,255,255,254].every((v,i)=>bytes[i]===v)) throw new Error("Ungültige oder nicht unterstützte ISM-Datei.");
    let count=0;for(let i=6;i<12;i++)count=count*256+bytes[i];count++;
    if(count>5000 || bytes.length<12+34*count) throw new Error("Ungültige oder nicht unterstützte ISM-Datei.");
    const f=Array.from({length:count},(_,i)=>view.getFloat64(12+8*i,false));
    const start=f.indexOf(Math.min(...f)),end=f.indexOf(Math.max(...f));
    for(let i=Math.min(start,end);i<=Math.max(start,end);i++) {
      const magnitude=view.getFloat64(12+8*(count+i),false),phase=view.getFloat64(12+8*(2*count+i),false);
      if(!Number.isFinite(phase)||Math.abs(phase)>Math.PI+1e-6)throw new Error("Ungültiger ISM-Phasenwinkel.");
      if(magnitude<=0)throw new Error("Impedanzbeträge müssen positiv sein.");
      points.push([f[i],magnitude*Math.cos(phase),magnitude*Math.sin(phase)]);
    }
  } else if(suffix===".csv") {
    const text=new TextDecoder("utf-8",{fatal:true}).decode(raw);
    const rows=[];let row=[],cell="",quoted=false,closed=false;
    for(let i=0;i<=text.length;i++) {
      const c=i===text.length?"\n":text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
      if(c==='"'&&!cell&&!closed){quoted=true;continue;}
      if(c===","||c==="\n"||c==="\r") {
        row.push(cell);cell="";closed=false;
        if(c!==","){if(row.some(s=>s.trim()))rows.push(row);row=[];if(c==="\r"&&text[i+1]==="\n")i++;}
      }else{if(closed)throw new Error("Ungültige CSV-Anführungszeichen.");cell+=c;}
    }
    if(quoted)throw new Error("Ungültige CSV-Anführungszeichen.");
    const header=rows.shift()||[],names=["frequency_Hz","Zreal_ohm","Zimag_ohm"],indices=names.map(n=>header.indexOf(n));
    if(indices.some(i=>i<0))throw new Error("CSV-Spalten erforderlich: frequency_Hz, Zreal_ohm, Zimag_ohm.");
    points=rows.map(r=>indices.map(i=>{
      const value=r[i]?.trim();
      if(!value||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(value))throw new Error("CSV enthält einen ungültigen Zahlenwert.");
      return Number(value);
    }));
  } else throw new Error("Bitte eine ISM- oder CSV-Datei auswählen.");
  if(points.length<8||points.length>5000||points.some(p=>!p.every(Number.isFinite)))throw new Error("Erwartet werden 8 bis 5000 gültige Frequenzpunkte.");
  points.sort((a,b)=>a[0]-b[0]);
  if(points.some((p,i)=>p[0]<=0||(i&&p[0]===points[i-1][0])||Math.hypot(p[1],p[2])===0))throw new Error("Frequenzen müssen positiv und eindeutig sein. Impedanz darf nicht null sein.");
  if(points.some(p=>p[0]<1e-12||p[0]>1e12||Math.hypot(p[1],p[2])<1e-12||Math.hypot(p[1],p[2])>1e18))throw new Error("Unterstützt werden 10⁻¹² bis 10¹² Hz und Impedanzbeträge von 10⁻¹² bis 10¹⁸ Ω.");
  return {f:points.map(p=>p[0]),real:points.map(p=>p[1]),imag:points.map(p=>p[2])};
}
function selectSpectrumPoints(data, excluded) {
  const omitted=new Set(excluded);
  if([...omitted].some(i=>!Number.isInteger(i)||i<0||i>=data.f.length))throw new Error("Ungültige Messpunktauswahl.");
  const indices=data.f.map((_,i)=>i).filter(i=>!omitted.has(i));
  if(indices.length<8)throw new Error("Für einen Fit müssen mindestens acht Messpunkte eingeschlossen bleiben.");
  return {indices,f:indices.map(i=>data.f[i]),real:indices.map(i=>data.real[i]),imag:indices.map(i=>data.imag[i])};
}
if(typeof module!=="undefined")module.exports={parseSpectrum,selectSpectrumPoints};
