// Run: node tests/zombies.cjs [base URL]. Uses the box's existing puppeteer-core.
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8767';
(async () => {
  const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const results=[];
  try {
    for (const mobile of [false,true]) {
      const p=await browser.newPage(), errors=[];
      p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await p.setViewport(mobile?{width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true,isLandscape:true}:{width:1280,height:720});
      await p.goto(base+'/?auto=zombies&q=low&dev=1'+(mobile?'&touch=1':''),{waitUntil:'networkidle0'});
      await p.waitForFunction(()=>window.__zombies&&window.__G.phase!=='menu');
      const r=await p.evaluate(()=>{
        const z=__zombies,s=z.state,P=__P,G=__G; const report={};
        __sim(9); report.round=s.round; report.spawned=G.units.length; report.hp=G.units[0]?.hp;
        P.pos.set(30,1,48); const before=s.points; report.bought=z.buy(); report.spent=before-s.points; report.gun=P.slots[P.w]; report.noMoney=!z.buy();
        s.points=10000; P.pos.set(50,1,48); report.door=z.buy()&&s.opened; P.pos.set(64,1,48); report.box=z.buy();
        P.pos.set(58,1,65); z.buy(); report.perk=s.maxHP===180; P.pos.set(58,1,30); z.buy(); report.reloadPerk=s.perks.reload;
        P.reserve[P.slots[P.w]]=0; P.ammo=1; P.pos.set(46,1,65); report.ammo=z.buy()&&P.reserve[P.slots[P.w]]>0&&P.ammo===P.mag;
        z.power('double'); const pts=s.points; z.damage(G.units.find(u=>u.hp>0),1,false); report.double=s.points-pts===20;
        z.power('insta'); const u=G.units.find(u=>u.hp>0),kills=s.kills; z.damage(u,1,true); report.insta=s.kills===kills+1&&s.heads===1;
        // Drain a complete real wave, including queued spawns, then allow intermission.
        for(let i=0;i<50&&s.round===1;i++){ for(const u of G.units)if(u.hp>0)z.damage(u,1e9,false); __sim(1); }
        report.advanced=s.round>=2;
        z.power('nuke'); report.nuke=G.units.every(u=>u.hp<=0);
        // Spawn cap and later variants, while keeping this deterministic test invulnerable.
        s.round=9; s.pending=100; s.maxHP=1e7; P.hp=1e7; __sim(45); report.cap=G.units.filter(u=>u.hp>0).length;
        report.runner=G.units.some(u=>u.kind==='runner');
        // Clear test actors, start round five so the first queued enemy is a brute.
        for(const u of G.units)if(u.hp>0)z.kill(u,false,false); __sim(2); s.round=4; z.nextRound(); __sim(1.5); report.brute=G.units.some(u=>u.kind==='brute');
        // Compose a screenshot from actual actors, not a separate mock scene.
        s.maxHP=180; P.hp=180; P.pos.set(40,1,52); P.yaw=0; P.pitch=-.03;
        let i=0; for(const u of G.units) if(u.hp>0){u.pos.set(35+(i%6)*1.7,1,42-Math.floor(i/6)*4);i++;}
        return report;
      });
      assert.equal(r.round,1); assert(r.spawned>0); for(const k of ['bought','noMoney','door','box','perk','reloadPerk','ammo','double','insta','advanced','nuke','runner','brute'])assert(r[k],k+': '+JSON.stringify(r)); assert.equal(r.spent,500);assert.equal(r.gun,'carbine');assert(r.cap<=(mobile?16:28));
      await new Promise(r=>setTimeout(r,1200));
      await p.screenshot({path:`shot-zombies-${mobile?'mobile':'desktop'}.png`});
      const final=await p.evaluate(()=>{ __P.hp=0; __sim(.1);return{over:__G.over,text:document.getElementById('endS').textContent,best:localStorage.getItem('vr_zombies_best'),loop:window.__loopErr?.message}; });
      assert(final.over&&final.text.includes('Headshots:')&&Number(final.best)>=4);assert(!final.loop);assert.deepEqual(errors,[]);
      results.push({mobile,...r,errors,gameOver:true});await p.close();
    }
    for(const mode of ['attack','defend']){const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(base+`/?auto=${mode}&q=low&build=1`,{waitUntil:'networkidle0'});await p.waitForFunction(()=>window.__G);const r=await p.evaluate(()=>{__sim(2);return{mode:__G.mode,phase:__G.phase,units:__G.units.length,loop:window.__loopErr?.message};});assert.equal(r.mode,mode);assert.equal(r.phase,'raid');assert(r.units>0);assert(!r.loop);assert.deepEqual(errs,[]);results.push(r);await p.close();}
    console.log(JSON.stringify(results,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
