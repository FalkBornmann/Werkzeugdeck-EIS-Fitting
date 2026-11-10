/* Run with Playwright installed; uses an isolated headless browser, no user profile. */
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=__dirname;
const python=process.env.EIS_PYTHON||path.join(root,'.venv','Scripts','python.exe');
const child=(args,cwd=root)=>spawn(python,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
async function ready(url){for(let i=0;i<80;i++){try{await new Promise((resolve,reject)=>require('node:http').get(url,r=>{r.resume();r.on('end',()=>r.statusCode===200?resolve():reject(new Error('HTTP '+r.statusCode)));}).on('error',reject));return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Local test server failed: '+url);}
async function fitted(page){await page.waitForFunction(()=>!document.getElementById('results').hidden,{},{timeout:180000});}
(async()=>{
  const api=child(['app.py','--port','8876']), web=child(['-m','http.server','8877','--bind','127.0.0.1'],'dist');
  let browser;
  try{
    await Promise.all([ready('http://127.0.0.1:8876/'),ready('http://127.0.0.1:8877/')]);
    browser=await chromium.launch({headless:true,...(process.env.EIS_BROWSER?{executablePath:process.env.EIS_BROWSER}:{})});
    const context=await browser.newContext({acceptDownloads:true,hasTouch:true,viewport:{width:1440,height:1000}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8876/');
    const examples=JSON.parse(await fs.readFile(path.join(root,'examples.json'),'utf8'));
    const upload=async(key,name='measurement.csv')=>{const e=examples[key];await page.locator('#file').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from('frequency_Hz,Zreal_ohm,Zimag_ohm\n'+e.f.map((f,i)=>[f,e.real[i],e.imag[i]].join(',')).join('\n'))});await page.locator('#measurement-preview').waitFor({state:'visible'});};
    if(!process.env.EIS_SELECTION_ONLY){
    await upload('rc');
    assert.equal(await page.locator('#preview-bode-plot circle').count(),100);
    assert.equal(await page.locator('#preview-nyquist-plot circle').count(),50);
    assert.equal(await page.locator('#measurement-preview polyline').count(),0);
    assert.equal(await page.locator('#results').isVisible(),false);
    assert.ok(await page.locator('#run').isEnabled());
    await page.locator('#fit-mode').selectOption('graph');
    assert.equal(await page.locator('#measurement-preview').isVisible(),true);
    assert.equal(await page.locator('#graph-controls').isVisible(),true);
    // A real HTML5 palette drop creates a component; reset/undo retain the graph.
    await page.getByRole('button',{name:'R · Widerstand',exact:true}).dragTo(page.locator('.graph-board'),{targetPosition:{x:320,y:280}});
    assert.equal(await page.locator('.graph-part').count(),4);
    await page.getByRole('button',{name:'Rückgängig',exact:true}).click();
    assert.equal(await page.locator('.graph-part').count(),3);
    const handle=page.getByRole('button',{name:'R1 verschieben (Pfeiltasten oder Ziehen)',exact:true});
    await handle.focus();await page.keyboard.press('ArrowRight');
    const bounds=await handle.boundingBox();
    await page.mouse.move(bounds.x+30,bounds.y+20);await page.mouse.down();await page.mouse.move(bounds.x+80,bounds.y+35,{steps:8});await page.mouse.up();
    await page.getByRole('button',{name:'Leere Zeichenfläche',exact:true}).click();
    await page.getByRole('button',{name:'R · Widerstand',exact:true}).click();
    await page.getByRole('button',{name:'Anschluss A',exact:true}).click();
    await page.getByRole('button',{name:'R1 Anschluss links',exact:true}).click();
    await page.getByRole('button',{name:'R1 Anschluss rechts',exact:true}).click();
    await page.getByRole('button',{name:'Anschluss B',exact:true}).click();
    assert.match(await page.locator('#graph-editor [role=status]').innerText(),/gültig/);
    await page.getByRole('button',{name:'Vorlage R + (R ∥ C)',exact:true}).click();
    await fs.mkdir(path.join(root,'.test-artifacts'),{recursive:true});
    await page.locator('#graph-controls').screenshot({path:path.join(root,'.test-artifacts','graph-editor.png')});
    await page.locator('#demo').click();await fitted(page);
    const rms=await page.locator('#rows').innerText();
    await page.locator('#extend-low').click();await page.locator('#extend-high').click();
    assert.equal(await page.locator('#f-min').inputValue(),'-2');
    assert.equal(await page.locator('#f-min-factor').inputValue(),'1');
    assert.equal(await page.locator('#f-max').inputValue(),'6');
    await page.locator('#f-min').press('ArrowDown');await page.locator('#f-min').press('Tab');
    assert.equal(await page.locator('#f-min').inputValue(),'-3');
    await page.locator('#project-apply').click();
    assert.match(await page.locator('#projection-status').innerText(),/Messbereich: 10⁻¹ bis 10⁵ Hz · Modellkurve: 10⁻³ bis 10⁶ Hz/);
    assert.equal(await page.locator('#rows').innerText(),rms);
    assert.equal(await page.locator('#bode-plot rect').count(),2);
    assert.equal(await page.locator('#bode-plot polyline[stroke-dasharray]').count(),4);
    await page.locator('#f-min-factor').fill('0');await page.locator('#project-apply').click();
    assert.match(await page.locator('#projection-status').innerText(),/positiven Vorfaktor/);
    await page.locator('#f-min-factor').fill('2.5');await page.locator('#project-apply').click();
    assert.match(await page.locator('#projection-status').innerText(),/2,5 × 10⁻³/);
    const csvPromise=page.waitForEvent('download');await page.locator('#export-projection').click();const csv=await csvPromise;
    assert.match(await fs.readFile(await csv.path(),'utf8'),/extrapolation/);
    for(const object of ['bode','nyquist','schaltbild','uebersicht'])for(const format of ['png','svg']){
      await page.locator('[data-export-object]').selectOption(object);await page.locator('[data-export-format]').selectOption(format);
      const pending=page.waitForEvent('download');await page.locator('[data-export-save]').click();const d=await pending,buf=await fs.readFile(await d.path());
      if(format==='png'){assert.equal(buf.subarray(1,4).toString(),'PNG');assert.ok(buf.length>3000);}
      else{assert.match(buf.toString(),/<svg/);assert.doesNotMatch(buf.toString(),/<image\b|data:image/);}
    }
    await page.locator('#results').screenshot({path:path.join(root,'.test-artifacts','results.png')});
    await page.locator('#project-reset').click();assert.equal(await page.locator('#bode-plot rect').count(),0);
    assert.equal(await page.locator('#f-min').inputValue(),'-1');
    assert.equal(await page.locator('#f-max').inputValue(),'5');
    await upload('coating','other.csv');
    assert.match(await page.locator('#preview-summary').innerText(),/other.csv/);
    assert.equal(await page.locator('#results').isVisible(),false);
    await page.locator('#file').setInputFiles({name:'broken.csv',mimeType:'text/csv',buffer:Buffer.from('not a spectrum')});
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('nicht gelesen'));
    assert.equal(await page.locator('#measurement-preview').isVisible(),false);
    assert.equal(await page.locator('#run').isEnabled(),false);
    await upload('rc');await page.locator('#run').click();await fitted(page);
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log('PASS: graphical drop, movement, manual wiring, validation, fit, projection, CSV/4 PNG exports and mobile width (local Python).');
    await page.goto('http://127.0.0.1:8877/');
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await upload('rc');
    await page.locator('#example-preview').click();
    await page.waitForFunction(()=>document.getElementById('preview-summary').textContent.includes('Dreierschaltbild'));
    assert.equal(requests.some(url=>url.includes('fit-worker')||url.includes('pyodide')||url.endsWith('/fit')),false);
    assert.equal(await page.locator('#results').isVisible(),false);
    await page.locator('#measurement-preview').screenshot({path:path.join(root,'.test-artifacts','measurement-preview.png')});
    console.log('PASS: uploaded CSV preview and examples before fitting, no worker/library downloads; model editing retains preview, file changes clear fits, invalid files clear preview and disable fitting.');
    for(const key of ['rc','coating']){
      await page.locator('#example').selectOption(key);await page.locator('#demo').click();await fitted(page);
      assert.match(await page.locator('#status').innerText(),/50 Frequenzpunkte/);
      console.log('PASS: actual Pyodide Web Worker fits real example '+key+' ('+(await page.locator('#rows tr').first().innerText())+').');
    }
    await page.locator('#extend-low').click();await page.locator('#extend-high').click();
    const rows=page.locator('#rows tr');
    assert.equal(await page.locator('#model').count(),0);
    assert.equal(await page.locator('#rows .model-diagram svg').count(),await rows.count());
    assert.equal(await page.locator('#rows .model-select[aria-pressed=true]').count(),1);
    const second=rows.nth(1),expectedPaths=await second.locator('svg path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')));
    await second.locator('.model-select').focus();await page.keyboard.press('Enter');
    assert.equal(await second.locator('.model-select').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#rows .model-select[aria-pressed=true]').count(),1);
    assert.match(await page.locator('#fit-detail').innerText(),/Modell 2/);
    assert.equal(await page.locator('#fit-detail').evaluate(e=>document.activeElement===e),true);
    assert.deepEqual(await page.locator('#circuit svg path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d'))),expectedPaths);
    assert.match(await page.locator('#projection-status').innerText(),/Kein erneuter Fit/);
    const modelCsvPromise=page.waitForEvent('download');await page.locator('#export').click();
    const modelCsv=await fs.readFile(await (await modelCsvPromise).path(),'utf8');
    const exported=modelCsv.trim().split('\n')[1].split(',').map(Number);
    const expected=await page.evaluate(()=>({real:selected().real[0],imag:selected().imag[0]}));
    assert.equal(exported[3],expected.real);assert.equal(exported[4],expected.imag);
    await page.locator('#back-to-comparison').click();
    assert.equal(await second.locator('.model-select').evaluate(e=>document.activeElement===e),true);
    await page.setViewportSize({width:1440,height:1000});
    assert.ok(await page.locator('.model-diagram').evaluateAll(items=>items.every(e=>e.scrollWidth<=e.clientWidth+1)));
    await page.locator('.table-scroll').screenshot({path:path.join(root,'.test-artifacts','model-comparison-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.ok(await page.locator('.model-diagram').evaluateAll(items=>items.every(e=>e.scrollWidth<=e.clientWidth+1)));
    await page.locator('.table-scroll').screenshot({path:path.join(root,'.test-artifacts','model-comparison-mobile.png')});
    await rows.nth(0).locator('.model-select').tap();
    assert.match(await page.locator('#fit-detail').innerText(),/Modell 1/);
    }
    // A known RC spectrum with one deliberate faulty point must recover the
    // original parameters when that point is excluded, in both runtimes.
    const frequencies=Array.from({length:40},(_,i)=>.1*10**(6*i/39));
    const measurements=frequencies.map((f,i)=>{const q=2*Math.PI*f*.1;return [f,10+1000/(1+q*q)+(i===17?2000:0),-1000*q/(1+q*q)-(i===17?1000:0)];});
    const faultyCsv='frequency_Hz,Zreal_ohm,Zimag_ohm\n'+measurements.map(p=>p.join(',')).join('\n');
    for(const origin of ['http://127.0.0.1:8876/','http://127.0.0.1:8877/']){
      await page.setViewportSize({width:1440,height:1000});await page.goto(origin);
      await page.locator('#file').setInputFiles({name:'faulty-rc.csv',mimeType:'text/csv',buffer:Buffer.from(faultyCsv)});
      await page.locator('#measurement-preview').waitFor({state:'visible'});
      await page.locator('#fit-mode').selectOption('graph');await page.locator('#run').click();await fitted(page);
      const rmsWithOutlier=await page.evaluate(()=>selected().rms);assert.ok(rmsWithOutlier>1);
      await page.locator('#preview-nyquist-plot [data-point-index="17"]').click();
      assert.equal(await page.locator('#results').isVisible(),false);
      assert.match(await page.locator('#point-selection-status').innerText(),/39 von 40/);
      assert.equal(await page.locator('#preview-bode-plot .excluded-point').count(),2);
      await page.locator('#point-table-details summary').click();
      const checkbox=page.locator('#point-rows input[data-point-index="17"]');
      await checkbox.focus();await page.keyboard.press('Space');assert.equal(await checkbox.isChecked(),true);
      await page.keyboard.press('Space');assert.equal(await checkbox.isChecked(),false);
      await page.locator('#run').click();await fitted(page);
      const info=await page.evaluate(()=>({n:result.f.length,indices:result.usedIndices,rms:selected().rms,parameters:selected().parameters}));
      assert.equal(info.n,39);assert.ok(!info.indices.includes(17));assert.ok(info.rms<1e-5);
      for(const [key,value] of Object.entries({'R1 R':10,'R2 R':1000,'C1 C':1e-4}))assert.ok(Math.abs(info.parameters[key]/value-1)<1e-5);
      assert.equal(await page.locator('#bode-plot .excluded-point').count(),2);assert.equal(await page.locator('#nyquist-plot .excluded-point').count(),1);
      const selectionCsvWait=page.waitForEvent('download');await page.locator('#export').click();
      const selectionCsv=(await fs.readFile(await (await selectionCsvWait).path(),'utf8')).trim().split('\n');
      assert.equal(selectionCsv.length,41);assert.match(selectionCsv[0],/included_in_fit/);
      const omitted=selectionCsv[18].split(',');assert.equal(omitted[3],'');assert.equal(omitted[4],'');assert.equal(omitted[5],'0');
      await page.locator('[data-export-object]').selectOption('uebersicht');await page.locator('[data-export-format]').selectOption('svg');
      const svgWait=page.waitForEvent('download');await page.locator('[data-export-save]').click();
      const selectionSvg=await fs.readFile(await (await svgWait).path(),'utf8');assert.match(selectionSvg,/39\/40 Punkte im Fit/);assert.match(selectionSvg,/excluded-point/);
      await page.locator('#fit-mode').selectOption('auto');await page.locator('#limit').selectOption('3');await page.locator('#run').click();await fitted(page);
      assert.ok(await page.evaluate(()=>result.f.length===39&&result.fits.every(f=>f.real.length===39)&&selected().rms<1e-5));
      await page.locator('#measurement-preview').screenshot({path:path.join(root,'.test-artifacts','point-selection-'+(origin.includes('8876')?'python':'browser')+'.png')});
      for(let i=0;i<33;i++)if(i!==17)await page.locator(`#point-rows input[data-point-index="${i}"]`).uncheck();
      assert.equal(await page.locator('#run').isEnabled(),false);assert.equal(await page.locator('#results').isVisible(),false);
      assert.match(await page.locator('#point-selection-status').innerText(),/7 von 40/);
      await page.locator('#include-all').click();assert.match(await page.locator('#point-selection-status').innerText(),/40 von 40/);
      assert.equal(await page.locator('#run').isEnabled(),true);
      await page.locator('#point-rows input[data-point-index="17"]').uncheck();
      await page.locator('#file').setInputFiles({name:'replacement.csv',mimeType:'text/csv',buffer:Buffer.from(faultyCsv)});
      await page.waitForFunction(()=>document.getElementById('preview-summary').textContent.includes('replacement.csv'));
      assert.match(await page.locator('#point-selection-status').innerText(),/40 von 40/);
      console.log('PASS: point exclusion recovers known RC values, matches all model data, invalidates stale fits, survives mode changes, restores points, rejects <8 points and preserves CSV/SVG provenance ('+origin+').');
    }
    const {CIRCUIT_PRESETS}=require('./circuit-presets.js');
    const normalize=node=>typeof node==='string'?node:JSON.stringify([node[0],...node.slice(1).flatMap(child=>Array.isArray(child)&&child[0]===node[0]?child.slice(1):[child]).map(normalize).sort()]);
    if(!await page.locator('#point-table-details').evaluate(e=>e.open))await page.locator('#point-table-details summary').click();
    await page.locator('#point-rows input[data-point-index="17"]').uncheck();
    for(const mode of ['custom','graph']){
      await page.locator('#fit-mode').selectOption(mode);
      assert.equal(await page.locator('#preset-controls').isVisible(),true);
      for(const preset of CIRCUIT_PRESETS){
        await page.locator('#preset-category').selectOption(preset.category);await page.locator('#preset-model').selectOption(preset.id);await page.locator('#preset-apply').click();
        const topology=await page.evaluate(()=>document.getElementById('fit-mode').value==='graph'?graph.topology():editor.topology());
        assert.equal(normalize(topology),normalize(preset.tree),preset.id+' '+mode);
        assert.ok(await page.locator('#preset-sources a').count());
        assert.match(await page.locator('#point-selection-status').innerText(),/39 von 40/);
      }
    }
    await page.locator('#preset-controls details summary').click();
    const topologyWait=page.waitForEvent('download');await page.locator('#circuit-save').click();const topologyFile=await fs.readFile(await (await topologyWait).path(),'utf8');
    const saved=JSON.parse(topologyFile);assert.equal(saved.format,'werkzeugdeck-eis-circuit');assert.deepEqual(Object.keys(saved).sort(),['format','topology','version']);
    await page.locator('#circuit-load').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"topology":"X"}')});
    await page.waitForFunction(()=>document.getElementById('preset-status').textContent.includes('nicht geladen'));
    const rcTopology=['s','R',['p','R','C']];
    await page.locator('#circuit-load').setInputFiles({name:'saved-rc.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'werkzeugdeck-eis-circuit',version:1,topology:rcTopology}))});
    await page.waitForFunction(()=>document.getElementById('preset-status').textContent.includes('geladen und geprüft'));
    assert.equal(normalize(await page.evaluate(()=>graph.topology())),normalize(rcTopology));
    await page.locator('#run').click();await fitted(page);
    assert.ok(await page.evaluate(()=>result.f.length===39&&selected().rms<1e-5));
    assert.ok((await page.locator('#nyquist-plot polyline').getAttribute('points')).split(' ').length>=401);
    await page.locator('#preset-controls').screenshot({path:path.join(root,'.test-artifacts','preset-library.png')});
    await page.locator('#fit-to-editor').click();assert.equal(await page.locator('#results').isVisible(),false);
    assert.equal(normalize(await page.evaluate(()=>graph.topology())),normalize(rcTopology));
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log('PASS: all 13 sourced presets in both editors, preserved exclusions, JSON export/import rejection and round-trip, fixed-topology fit, dense Nyquist curve and fit reuse.');
    assert.deepEqual(errors,[]);
    console.log('PASS: graphical table, keyboard/touch model selection, single active row, matching detail circuit/CSV, return focus, projection and mobile overflow; no browser errors.');
  } finally {if(browser)await browser.close();api.kill();web.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
