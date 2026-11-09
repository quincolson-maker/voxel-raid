const puppeteer=require('puppeteer-core');const assert=require('node:assert/strict');
(async()=>{const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{for(const mobile of [false,true]){
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1280,height:720});await p.goto((process.argv[2]||'http://localhost:8767')+'/?auto=zombies&zmap=night&zbuild=0&dev=1&q=low'+(mobile?'&touch=1':''),{waitUntil:'networkidle0'});
 if(!mobile){await p.click('canvas');await p.waitForFunction(()=>document.pointerLockElement);}
 await p.evaluate(()=>{__sim(8);const u=__G.units.find(u=>u.hp>0);for(const o of __G.units)if(o!==u){o.pos.set(30,1,30);o.d.spd=0;}u.pos.set(40,1,48);u.d.spd=0;u.hp=50;__P.pos.set(40,1,52);__P.yaw=0;__P.pitch=0;__P.cd=0;__P.swap=0;__P.reload=0;__zombies.state.lastHurt=__G.t;});
 await new Promise(r=>setTimeout(r,250));
 const before=await p.evaluate(()=>({ammo:__P.ammo,points:__zombies.state.points,kills:__zombies.state.kills,heads:__zombies.state.heads}));
 if(mobile){const r=await p.$eval('#tFire',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}});const c=await p.createCDPSession();await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x,y:r.y,id:1}]});await new Promise(r=>setTimeout(r,250));await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await p.mouse.down();await new Promise(r=>setTimeout(r,250));await p.mouse.up();}
 const shot=await p.evaluate(()=>({ammo:__P.ammo,points:__zombies.state.points,kills:__zombies.state.kills,heads:__zombies.state.heads}));assert.equal(shot.ammo,before.ammo-1);assert.equal(shot.kills,before.kills+1);assert.equal(shot.heads,before.heads+1);assert(shot.points>before.points);
 await p.evaluate(()=>{__P.ammo=5;__P.ammoOf.pistol=5;__P.reserve.pistol=10;});
 if(mobile)await p.tap('#tReload');else await p.keyboard.press('KeyR');
 const reload=await p.evaluate(()=>{__sim(2);return{ammo:__P.ammo,reserve:__P.reserve.pistol};});assert.equal(reload.ammo,15);assert.equal(reload.reserve,0);
 const health=await p.evaluate(()=>{const u=__G.units.find(u=>u.hp>0);u.pos.set(40,1,51);u.cd=0;u.d.spd=0;__P.hp=100;__sim(.1);const hurt=__P.hp;u.pos.set(30,1,30);__P.pos.set(40,1,52);__sim(6);return{hurt,regen:__P.hp};});assert(health.hurt<100);assert(health.regen>health.hurt);
 const drop=await p.evaluate(()=>{__zombies.dropPower(__P.pos.clone(),'ammo');__P.reserve.pistol=0;__sim(.1);return __P.reserve.pistol;});assert(drop>0);
 // Actual keyboard/USE purchase, not just calling economy directly.
 await p.evaluate(()=>{__P.pos.set(30,1,48);__zombies.state.points=500;});
 if(mobile)await p.tap('#tAct');else await p.keyboard.press('KeyE');
 const buy=await p.evaluate(()=>({points:__zombies.state.points,gun:__P.slots[__P.w]}));assert.equal(buy.points,0);assert.equal(buy.gun,'carbine');assert.deepEqual(errors,[]);console.log({mobile,before,shot,reload,health,drop,buy,errors});await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
