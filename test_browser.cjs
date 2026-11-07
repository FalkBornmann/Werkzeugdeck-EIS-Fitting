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
    const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8876/');
    const examples=JSON.parse(await fs.readFile(path.join(root,'examples.json'),'utf8'));
    const upload=async(key,name='measurement.csv')=>{const e=examples[key];await page.locator('#file').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from('frequency_Hz,Zreal_ohm,Zimag_ohm\n'+e.f.map((f,i)=>[f,e.real[i],e.imag[i]].join(',')).join('\n'))});await page.locator('#measurement-preview').waitFor({state:'visible'});};
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
    assert.equal(await page.locator('#f-min').inputValue(),'0.01');
    assert.equal(await page.locator('#f-max').inputValue(),'1000000');
    assert.equal(await page.locator('#rows').innerText(),rms);
    assert.equal(await page.locator('#bode-plot rect').count(),2);
    assert.equal(await page.locator('#bode-plot polyline[stroke-dasharray]').count(),4);
    await page.locator('#f-min').fill('0');await page.locator('#project-apply').click();
    assert.match(await page.locator('#projection-status').innerText(),/positive Grenzen/);
    await page.locator('#f-min').fill('0.001');await page.locator('#project-apply').click();
    const csvPromise=page.waitForEvent('download');await page.locator('#export-projection').click();const csv=await csvPromise;
    assert.match(await fs.readFile(await csv.path(),'utf8'),/extrapolation/);
    for(const id of ['save-bode','save-nyquist','save-schaltbild','save-uebersicht']){
      const pending=page.waitForEvent('download');await page.locator('#'+id).click();const d=await pending,buf=await fs.readFile(await d.path());assert.equal(buf.subarray(1,4).toString(),'PNG');assert.ok(buf.length>3000);
    }
    await page.locator('#results').screenshot({path:path.join(root,'.test-artifacts','results.png')});
    await page.locator('#project-reset').click();assert.equal(await page.locator('#bode-plot rect').count(),0);
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
    await page.waitForFunction(()=>document.getElementById('preview-summary').textContent.includes('gr4_4_3'));
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
    await page.locator('#model').selectOption({index:1});
    assert.match(await page.locator('#projection-status').innerText(),/Kein erneuter Fit/);
    assert.deepEqual(errors,[]);
    console.log('PASS: model switching recomputes projection; no browser errors.');
  } finally {if(browser)await browser.close();api.kill();web.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
