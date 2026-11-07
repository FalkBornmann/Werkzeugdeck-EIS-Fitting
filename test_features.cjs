const {test}=require('node:test');
const assert=require('node:assert/strict');
const {graphTopology}=require('./graph-editor.js');
const {predictCircuit,projectionGrid}=require('./projection.js');
const {parseSpectrum}=require('./spectrum-preview.js');
const raw=text=>new TextEncoder().encode(text).buffer;
test('CSV preview handles quoted reordered columns, BOM, CRLF and descending frequencies',()=>{
  const data=parseSpectrum(raw('\ufeffextra,Zimag_ohm,frequency_Hz,Zreal_ohm\r\n'+Array.from({length:8},(_,i)=>`"a,b",-2,"${8-i}",1`).join('\r\n')),'.csv');
  assert.deepEqual(data.f,[1,2,3,4,5,6,7,8]);assert.ok(data.imag.every(v=>v===-2));
});
test('preview rejects invalid files instead of drawing incomplete or stale points',()=>{
  const csv=rows=>'frequency_Hz,Zreal_ohm,Zimag_ohm\n'+rows.join('\n');
  for(const rows of [Array(8).fill('1,1,-2'),Array.from({length:8},(_,i)=>`${i},1,-2`),Array.from({length:8},(_,i)=>`${i+1},,-2`),Array.from({length:8},(_,i)=>`${i+1},nan,-2`),Array(7).fill('1,1,-2')]) assert.throws(()=>parseSpectrum(raw(csv(rows)),'.csv'));
  assert.throws(()=>parseSpectrum(new ArrayBuffer(2000001),'.csv'),/groß/);
  assert.throws(()=>parseSpectrum(new ArrayBuffer(20),'.ism'),/ISM/);
  assert.throws(()=>parseSpectrum(raw('anything'),'.txt'),/ISM- oder CSV/);
});
test('ISM preview preserves signed phase and sorts the spectrum',()=>{
  const n=8,buffer=new ArrayBuffer(12+34*n),v=new DataView(buffer);new Uint8Array(buffer).set([0,0,255,255,255,254]);v.setUint8(11,n-1);
  for(let i=0;i<n;i++){v.setFloat64(12+8*i,n-i);v.setFloat64(12+8*(n+i),10);v.setFloat64(12+8*(2*n+i),-Math.PI/2);}
  const data=parseSpectrum(buffer,'.ism');assert.deepEqual(data.f,[1,2,3,4,5,6,7,8]);assert.ok(data.imag.every(z=>Math.abs(z+10)<1e-10));assert.throws(()=>parseSpectrum(buffer.slice(0,-1),'.ism'),/ISM/);
});
const part=(id,kind='R')=>({id,kind});
test('manual wiring recognizes nested series/parallel independent of coordinates',()=>{
  const tree=graphTopology([part('r'),part('rp'),part('c','C')],[['A','r:0'],['r:1','rp:0'],['r:1','c:0'],['rp:1','B'],['c:1','B']]);
  const counts={}; const assign=n=>Array.isArray(n)?n.slice(1).forEach(assign):counts[n]=(counts[n]||0)+1;
  assign(tree);assert.deepEqual(counts,{R:2,C:1});
  assert.ok(JSON.stringify(tree).includes('"p"'));
});
test('direct wiring and crossed wires do not imply a junction',()=>{
  assert.equal(graphTopology([part('r')],[['A','r:0'],['r:1','B']]),'R');
  assert.throws(()=>graphTopology([part('r'),part('c','C')],[['A','r:0'],['c:1','B']]),/Offene/);
});
test('short circuits, unused components, dangling branches and bridges are rejected',()=>{
  assert.throws(()=>graphTopology([part('r')],[['A','B']]),/Kurzschluss/);
  assert.throws(()=>graphTopology([part('r')],[['A','r:0'],['r:0','r:1'],['r:1','B']]),/Kurzschluss|kurzgeschlossen/);
  assert.throws(()=>graphTopology([part('r'),part('c','C')],[['A','r:0'],['r:1','B']]),/Offene/);
  assert.throws(()=>graphTopology([part('r'),part('d')],[['A','r:0'],['r:1','B'],['A','d:0']]),/Seitenzweig|Reihen/);
  const parts=['a','b','c','d','e'].map(id=>part(id));
  const wires=[['A','a:0'],['A','c:0'],['a:1','b:0'],['a:1','e:0'],['c:1','d:0'],['c:1','e:1'],['b:1','B'],['d:1','B']];
  assert.throws(()=>graphTopology(parts,wires),/Brücken/);
});
test('projection agrees with the analytic RC impedance and leaves parameters untouched',()=>{
  const tree=['s','R',['p','R','C']], params={'R1 R':10,'R2 R':1000,'C1 C':1e-4}, before=JSON.stringify(params);
  const f=[1e-12,1,1e12], z=predictCircuit(tree,params,f);
  for(let i=0;i<f.length;i++) {const q=2*Math.PI*f[i]*.1;assert.ok(Math.abs(z.real[i]-(10+1000/(1+q*q)))<1e-9);assert.ok(Math.abs(z.imag[i]+1000*q/(1+q*q))<1e-9);}
  assert.equal(JSON.stringify(params),before);
});
test('frequency bounds and numerical singularities are checked',()=>{
  for(const [a,b] of [[0,1],[10,1],[1,1],[NaN,1],[1e-13,1],[1,1e13]])assert.throws(()=>projectionGrid(a,b));
  const grid=projectionGrid(1e-12,1e12);assert.equal(grid[0],1e-12);assert.equal(grid.at(-1),1e12);assert.ok(grid.every((f,i)=>!i||f>grid[i-1]));
  assert.throws(()=>predictCircuit('R',{'R1 R':NaN},[1]));
});
