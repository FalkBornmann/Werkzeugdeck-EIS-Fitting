/* Convert explicit wires to the series/parallel tree understood by the fitter. */
function graphTopology(parts, wires) {
  if (!parts.length || parts.length>12) throw new Error("Bitte 1 bis 12 Bauteile einsetzen.");
  const pins=new Set(["A","B",...parts.flatMap(p=>[p.id+":0",p.id+":1"])]);
  const parent=new Map([...pins].map(p=>[p,p]));
  const find=p=>parent.get(p)===p?p:(parent.set(p,find(parent.get(p))),parent.get(p));
  for (const [a,b] of wires) {
    if (!pins.has(a)||!pins.has(b)) throw new Error("Eine Leitung hat keinen gültigen Anschluss.");
    parent.set(find(a),find(b));
  }
  const a=find("A"), b=find("B");
  if (a===b) throw new Error("Kurzschluss zwischen A und B. Bitte die direkte Verbindung entfernen.");
  let edges=parts.map(p=>({a:find(p.id+":0"),b:find(p.id+":1"),tree:p.kind}));
  if (edges.some(e=>e.a===e.b)) throw new Error("Ein Bauteil ist durch eine Leitung kurzgeschlossen.");
  const connected=new Set([a]);
  for (let i=0;i<=edges.length;i++) for (const e of edges) if(connected.has(e.a)||connected.has(e.b)) {connected.add(e.a);connected.add(e.b);}
  if (!connected.has(b)||edges.some(e=>!connected.has(e.a)||!connected.has(e.b))) throw new Error("Offene oder unverbundene Schaltung. Alle Bauteile mit A und B verbinden.");
  const join=(op,x,y)=>[op,...(Array.isArray(x)&&x[0]===op?x.slice(1):[x]),...(Array.isArray(y)&&y[0]===op?y.slice(1):[y])];
  while (edges.length>1) {
    let reduced=false;
    for(let i=0;i<edges.length&&!reduced;i++) for(let j=i+1;j<edges.length;j++) {
      const x=edges[i],y=edges[j];
      if ((x.a===y.a&&x.b===y.b)||(x.a===y.b&&x.b===y.a)) {
        edges[i]={...x,tree:join("p",x.tree,y.tree)}; edges.splice(j,1); reduced=true; break;
      }
    }
    if (reduced) continue;
    const nodes=new Set(edges.flatMap(e=>[e.a,e.b]));
    for(const n of nodes) {
      if(n===a||n===b) continue;
      const incident=edges.filter(e=>e.a===n||e.b===n);
      if(incident.length!==2) continue;
      const [x,y]=incident, other=e=>e.a===n?e.b:e.a;
      edges=edges.filter(e=>e!==x&&e!==y);
      edges.push({a:other(x),b:other(y),tree:join("s",x.tree,y.tree)}); reduced=true; break;
    }
    if(!reduced) throw new Error("Nur Reihen-/Parallelschaltungen werden unterstützt. Brücken oder offene Seitenzweige bitte umbauen.");
  }
  const e=edges[0];
  if(!((e.a===a&&e.b===b)||(e.a===b&&e.b===a))) throw new Error("Offener Seitenzweig: Jedes Bauteil muss Teil der Schaltung zwischen A und B sein.");
  return e.tree;
}

function layoutCircuitGraph(tree) {
  const validate=typeof validateCircuitTopology!=="undefined"?validateCircuitTopology:require("./circuit-presets.js").validateCircuitTopology;
  tree=validate(tree);
  function measure(node){
    if(typeof node==="string")return {w:170,h:100};
    const children=node.slice(1).map(measure);
    return node[0]==="s"?{w:children.reduce((sum,child)=>sum+child.w,0),h:Math.max(...children.map(child=>child.h))}:{w:Math.max(...children.map(child=>child.w))+100,h:children.reduce((sum,child)=>sum+child.h,0)};
  }
  const size=measure(tree),boardWidth=Math.max(940,size.w+160),boardHeight=Math.max(410,size.h+100),parts=[],wires=[];
  const connect=pins=>pins.slice(1).forEach(pin=>{if(pin!==pins[0])wires.push([pins[0],pin]);});
  function place(node,x,y){
    const box=measure(node);
    if(typeof node==="string"){const id="e"+(parts.length+1);parts.push({id,kind:node,x:x+box.w/2-55,y:y-24});return {left:[id+":0"],right:[id+":1"]};}
    if(node[0]==="s"){
      let offset=x;const branches=node.slice(1).map(child=>{const ends=place(child,offset,y);offset+=measure(child).w;return ends;});
      for(let i=1;i<branches.length;i++)connect([...branches[i-1].right,...branches[i].left]);
      return {left:branches[0].left,right:branches.at(-1).right};
    }
    let offset=y-box.h/2;const branches=node.slice(1).map(child=>{const childBox=measure(child),ends=place(child,x+50,offset+childBox.h/2);offset+=childBox.h;return ends;});
    return {left:branches.flatMap(b=>b.left),right:branches.flatMap(b=>b.right)};
  }
  const ends=place(tree,80,boardHeight/2);connect(["A",...ends.left]);connect(["B",...ends.right]);
  return {parts,wires,boardWidth,boardHeight};
}
function createGraphEditor(container, preview, changed) {
  const kinds={R:"Widerstand",C:"Kondensator",Q:"CPE",L:"Induktivität",La:"Modifizierte Induktivität",W:"Warburg",Wo:"Warburg offen",Ws:"Warburg kurzgeschlossen",G:"Gerischer"};
  let parts=[], wires=[], history=[], pending=null, locked=false, next=1,boardWidth=940,boardHeight=410;
  const save=()=>history.push(JSON.stringify({parts,wires,next,boardWidth,boardHeight}));
  const action=(label,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=fn;return b;};
  const palette=document.createElement("div");palette.className="actions graph-palette";
  const scroll=document.createElement("div");scroll.className="graph-scroll";
  const board=document.createElement("div");board.className="graph-board";board.setAttribute("aria-label","Zeichenfläche für Ersatzschaltbild");
  scroll.append(board);
  const message=document.createElement("p"); message.setAttribute("role","status");
  const tools=document.createElement("div");tools.className="actions";
  const undo=action("Rückgängig",()=>{if(!history.length)return;({parts,wires,next,boardWidth,boardHeight}=JSON.parse(history.pop()));pending=null;render();changed();});
  const reset=action("Leere Zeichenfläche",()=>{save();parts=[];wires=[];pending=null;update();});
  const preset=action("Vorlage R + (R ∥ C)",()=>{save();loadPreset();update();});
  tools.append(undo,reset,preset,action("Verbindung abbrechen",()=>{pending=null;render();}));
  for(const [kind,name] of Object.entries(kinds)) {
    const b=action(kind+" · "+name,()=>add(kind,160+(parts.length%4)*165,65+Math.floor(parts.length/4)*100));
    b.draggable=true;b.ondragstart=e=>{if(locked){e.preventDefault();return;}e.dataTransfer.setData("application/x-eis-component",kind);};palette.append(b);
  }
  board.ondragover=e=>{if(!locked)e.preventDefault();};
  board.ondrop=e=>{e.preventDefault();const kind=e.dataTransfer.getData("application/x-eis-component");if(!kinds[kind]||locked)return;const r=board.getBoundingClientRect();add(kind,e.clientX-r.left-55,e.clientY-r.top-24);};
  function add(kind,x,y) {if(locked||parts.length>=12)return;save();parts.push({id:"e"+next++,kind,x:Math.max(80,Math.min(boardWidth-180,x)),y:Math.max(25,Math.min(boardHeight-80,y))});update();}
  function update(){pending=null;render();changed();}
  function loadPreset(){boardWidth=940;boardHeight=410;next=4;parts=[{id:"e1",kind:"R",x:160,y:165},{id:"e2",kind:"R",x:460,y:85},{id:"e3",kind:"C",x:460,y:245}];wires=[["A","e1:0"],["e1:1","e2:0"],["e1:1","e3:0"],["e2:1","B"],["e3:1","B"]];}
  function connect(pin){if(locked)return;if(!pending){pending=pin;render();return;}if(pending!==pin&&!wires.some(w=>w.includes(pin)&&w.includes(pending))){save();wires.push([pending,pin]);update();}else{pending=null;render();}}
  function coords(pin){if(pin==="A")return [40,boardHeight/2];if(pin==="B")return [boardWidth-40,boardHeight/2];const [id,end]=pin.split(":"),p=parts.find(p=>p.id===id);return [p.x+(end==="0"?0:110),p.y+24];}
  function pinButton(pin,label,parent,x,y){const b=action("●",()=>connect(pin));b.className="graph-pin";b.setAttribute("aria-label",label);b.setAttribute("aria-pressed",String(pending===pin));b.style.left=x+"px";b.style.top=y+"px";parent.append(b);}
  function render(){
    board.replaceChildren();
    board.style.width=boardWidth+"px";board.style.height=boardHeight+"px";
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 940 410");svg.classList.add("graph-wires");
    wires.forEach(([a,b],i)=>{const [x,y]=coords(a),[xx,yy]=coords(b),path=document.createElementNS(svg.namespaceURI,"path");path.setAttribute("d",`M${x} ${y}H${(x+xx)/2}V${yy}H${xx}`);path.setAttribute("fill","none");path.setAttribute("stroke","#087f83");path.setAttribute("stroke-width","3");svg.append(path);});board.append(svg);
    svg.setAttribute("viewBox",`0 0 ${boardWidth} ${boardHeight}`);svg.style.width=boardWidth+"px";svg.style.height=boardHeight+"px";
    pinButton("A","Anschluss A",board,18,boardHeight/2-22);pinButton("B","Anschluss B",board,boardWidth-62,boardHeight/2-22);
    for(const [text,x] of [["A",32],["B",boardWidth-48]]){const label=document.createElement("strong");label.textContent=text;label.style.cssText=`position:absolute;left:${x}px;top:${boardHeight/2-55}px`;board.append(label);}
    const counts={};
    for(const p of parts){
      const label=p.kind+(counts[p.kind]=(counts[p.kind]||0)+1),box=document.createElement("div");box.className="graph-part";box.style.left=p.x+"px";box.style.top=p.y+"px";
      const handle=action(label,()=>{});handle.className="graph-handle";handle.setAttribute("aria-label",label+" verschieben (Pfeiltasten oder Ziehen)");
      const symbol=drawCircuit(p.kind,{});symbol.setAttribute("viewBox","30 15 140 50");symbol.setAttribute("width","100");symbol.setAttribute("height","36");symbol.setAttribute("aria-hidden","true");symbol.style.cssText="pointer-events:none;display:block;width:100%;height:36px";symbol.querySelectorAll("text").forEach(t=>t.textContent===p.kind+"1"&&(t.textContent=label));handle.replaceChildren(symbol);
      handle.onkeydown=e=>{const d={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];if(!d||locked)return;e.preventDefault();save();p.x=Math.max(80,Math.min(boardWidth-180,p.x+d[0]));p.y=Math.max(25,Math.min(boardHeight-80,p.y+d[1]));render();board.querySelector(`[data-part="${p.id}"]`)?.focus();};handle.dataset.part=p.id;
      handle.onpointerdown=e=>{if(locked)return;const start={x:e.clientX,y:e.clientY,px:p.x,py:p.y};save();handle.setPointerCapture(e.pointerId);handle.onpointermove=ev=>{p.x=Math.max(80,Math.min(boardWidth-180,start.px+ev.clientX-start.x));p.y=Math.max(25,Math.min(boardHeight-80,start.py+ev.clientY-start.y));box.style.left=p.x+"px";box.style.top=p.y+"px";svg.querySelectorAll("path").forEach((path,i)=>{const [x,y]=coords(wires[i][0]),[xx,yy]=coords(wires[i][1]);path.setAttribute("d",`M${x} ${y}H${(x+xx)/2}V${yy}H${xx}`);});};handle.onpointerup=()=>{handle.onpointermove=null;render();};};
      box.append(handle);pinButton(p.id+":0",label+" Anschluss links",box,-22,2);pinButton(p.id+":1",label+" Anschluss rechts",box,88,2);
      const remove=action("×",()=>{save();parts=parts.filter(q=>q!==p);wires=wires.filter(w=>!w.some(pin=>pin.startsWith(p.id+":")));update();});remove.className="graph-remove";remove.setAttribute("aria-label",label+" entfernen");box.append(remove);board.append(box);
    }
    preview.replaceChildren();
    try{preview.append(drawCircuit(graphTopology(parts,wires),{}));message.textContent=pending?"Zweiten Anschluss anklicken. Mehrere Leitungen an einem Anschluss bilden einen Knoten.":"Schaltung gültig. Die Vorschau zeigt die vom Fit verwendete Topologie.";message.className="notice";}
    catch(e){message.textContent=(pending?"Zweiten Anschluss anklicken. ":"")+e.message;message.className="notice warn";}
    wireList.replaceChildren(...wires.map(([a,b],i)=>action(`Leitung ${i+1}: ${a} ↔ ${b} entfernen`,()=>{save();wires.splice(i,1);update();})));
    for(const b of container.querySelectorAll("button"))b.disabled=locked;
    for(const b of palette.querySelectorAll("button"))b.disabled=locked||parts.length>=12;
    undo.disabled=locked||!history.length;
  }
  const wireDetails=document.createElement("details"),summary=document.createElement("summary"),wireList=document.createElement("div");summary.textContent="Leitungen einzeln entfernen";wireList.className="actions";wireDetails.append(summary,wireList);
  container.append(palette,tools,scroll,message,wireDetails);loadPreset();render();
  return {topology:()=>graphTopology(parts,wires),setTopology:tree=>{if(locked)return;const layout=layoutCircuitGraph(tree);save();({parts,wires,boardWidth,boardHeight}=layout);next=parts.length+1;update();},lock:value=>{locked=value;render();}};
}
if(typeof module!=="undefined")module.exports={graphTopology,layoutCircuitGraph};
