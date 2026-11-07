/* Evaluate the fitted series/parallel model without changing its parameters. */
function predictCircuit(topology, parameters, frequencies) {
  const add = (a,b) => [a[0]+b[0], a[1]+b[1]];
  const mul = (a,b) => [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]];
  const inv = a => { const scale=Math.max(Math.abs(a[0]),Math.abs(a[1]));
    if (!scale) throw new Error("Das Modell enthält eine numerische Singularität.");
    const r=a[0]/scale, i=a[1]/scale, d=r*r+i*i;
    return [r/d/scale,-i/d/scale]; };
  const pow = (a,n) => { const r=Math.hypot(...a)**n, t=Math.atan2(a[1],a[0])*n; return [r*Math.cos(t),r*Math.sin(t)]; };
  const tanh = a => { if (a[0]>20) return [1,0]; const d=Math.cosh(2*a[0])+Math.cos(2*a[1]); return [Math.sinh(2*a[0])/d,Math.sin(2*a[1])/d]; };
  const values=frequencies.map(f => {
    if (!Number.isFinite(f) || f<1e-12 || f>1e12) throw new Error("Frequenzen müssen zwischen 10⁻¹² und 10¹² Hz liegen.");
    const counts={};
    function visit(node) {
      if (Array.isArray(node)) {
        const branches=node.slice(1).map(visit);
        return node[0]==="s" ? branches.reduce(add,[0,0]) : inv(branches.map(inv).reduce(add,[0,0]));
      }
      const id=node+(counts[node]=(counts[node]||0)+1), w=[0,2*Math.PI*f];
      const param=name => { const v=parameters[id+" "+name];
        if (!Number.isFinite(v) || v<=0) throw new Error("Ungültige Modellparameter."); return v; };
      const scale=(a,x) => a.map(v=>v*x);
      switch(node) {
        case "R": return [param("R"),0];
        case "C": return inv(scale(w,param("C")));
        case "L": return scale(w,param("L"));
        case "Q": return inv(scale(pow(w,param("n")),param("Q")));
        case "La": return scale(pow(w,param("n")),param("L"));
        case "W": return scale(pow(w,-.5),param("A")*Math.SQRT2);
        case "G": return scale(pow([1,2*Math.PI*f*param("tau")],-.5),param("R"));
        case "Wo": case "Ws": {
          const u=pow(scale(w,param("tau")),.5), t=tanh(u);
          return scale(node==="Wo" ? inv(mul(u,t)) : mul(t,inv(u)),param("Z0"));
        }
        default: throw new Error("Unbekanntes Bauteil.");
      }
    }
    const z=visit(topology);
    if (!z.every(Number.isFinite) || !Math.hypot(...z)) throw new Error("Prognose numerisch nicht auswertbar. Frequenzbereich verkleinern.");
    return z;
  });
  return {f:frequencies, real:values.map(z=>z[0]), imag:values.map(z=>z[1])};
}

function projectionGrid(min,max) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min<1e-12 || max>1e12 || min>=max)
    throw new Error("Bitte positive Grenzen von 10⁻¹² bis 10¹² Hz mit Minimum < Maximum eingeben.");
  return Array.from({length:401},(_,i)=>i===0?min:i===400?max:10**(Math.log10(min)+(Math.log10(max)-Math.log10(min))*i/400));
}
function frequencyParts(frequency) {
  let exponent=Math.floor(Math.log10(frequency));
  let factor=frequency/10**exponent;
  // Avoid displaying 9.999999999999998 × 10ⁿ for an exact decade.
  if(Math.abs(factor-10)<1e-12){factor=1;exponent++;}
  if(Math.abs(factor-1)<1e-12)factor=1;
  return {factor,exponent};
}
function frequencyFromParts(factor,exponent) {
  if(!Number.isFinite(factor)||factor<=0||!Number.isInteger(exponent)||exponent < -12||exponent > 12)
    throw new Error("Bitte einen positiven Vorfaktor und einen ganzzahligen Exponenten von −12 bis 12 eingeben.");
  const frequency=factor*10**exponent;
  if(frequency<1e-12||frequency>1e12)throw new Error("Frequenzen müssen zwischen 10⁻¹² und 10¹² Hz liegen.");
  return frequency;
}
function formatFrequency(frequency) {
  let {factor,exponent}=frequencyParts(frequency);
  factor=Number(factor.toPrecision(4));
  if(factor===10){factor=1;exponent++;}
  const superscript=String(exponent).replace(/[-0-9]/g,d=>"⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(d)]);
  return (factor===1?"":factor.toLocaleString("de-DE",{maximumSignificantDigits:4})+" × ")+"10"+superscript;
}
if (typeof module!=="undefined") module.exports={predictCircuit,projectionGrid,frequencyParts,frequencyFromParts,formatFrequency};
