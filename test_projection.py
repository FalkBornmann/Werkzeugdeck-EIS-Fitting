"""Independent numerical checks against the actual SciPy circuit engine."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest
import numpy as np
from circuits import ELEMENTS, compile_circuit, search
from fitting import load_spectrum

ROOT=Path(__file__).resolve().parent

class ProjectionTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node.js required for cross-runtime test')
    def test_javascript_matches_python_for_all_elements_and_nested_model(self):
        f=np.geomspace(1e-12,1e12,101)
        cases=[]
        for tree in [*ELEMENTS, ('s','R',('p','Q',('s','R',('p','C','Wo'))))]:
            _,evaluate,names,x,lo,hi=compile_circuit(tree,f,np.full(len(f),100+0j))
            parameters={name:float(value if high==1 else 10**value) for name,value,high in zip(names,x,hi)}
            expected=evaluate(x)
            cases.append({'tree':tree,'parameters':parameters,'f':f.tolist(),'real':expected.real.tolist(),'imag':expected.imag.tolist()})
        script="const {predictCircuit}=require('./projection.js');let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(c=>predictCircuit(c.tree,c.parameters,c.f)))));"
        actual=json.loads(subprocess.run(['node','-e',script],input=json.dumps(cases),text=True,cwd=ROOT,capture_output=True,check=True).stdout)
        for case,got in zip(cases,actual):
            with self.subTest(tree=case['tree']):
                expected=np.array(case['real'])+1j*np.array(case['imag'])
                observed=np.array(got['real'])+1j*np.array(got['imag'])
                np.testing.assert_allclose(observed,expected,rtol=2e-12,atol=1e-20)

    def test_both_real_examples_import_and_fit(self):
        examples=json.loads((ROOT/'examples.json').read_text(encoding='utf-8'))
        self.assertEqual(set(examples),{'rc','coating'})
        for key,item in examples.items():
            with self.subTest(example=key):
                raw=('frequency_Hz,Zreal_ohm,Zimag_ohm\n'+'\n'.join(','.join(map(str,row)) for row in zip(item['f'],item['real'],item['imag']))).encode()
                f,z=load_spectrum(raw,'.csv')
                self.assertEqual(len(f),50)
                self.assertEqual((f[0],f[-1]),(.1,100000))
                fits=search('R,C,Q',5,f,z)
                self.assertTrue(fits)
                self.assertTrue(all(np.isfinite(fit['rms']) for fit in fits))
                self.assertLess(fits[0]['rms'],5)

if __name__=='__main__':unittest.main()
