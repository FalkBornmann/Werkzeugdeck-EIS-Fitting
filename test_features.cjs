const {test}=require('node:test');
const assert=require('node:assert/strict');
const {graphTopology}=require('./graph-editor.js');
const {predictCircuit,projectionGrid}=require('./projection.js');
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
