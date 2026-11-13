import assert from 'node:assert/strict';
import {HoldemTable,BlackjackGame,evaluateCards,blackjackTotal,themedSpin,themedMultiplier,themedRTP,shuffledDeck} from '../src/hrcasinogames.js';
let seed=42;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
const c=(r,s=0)=>s*13+r-2;
assert.equal(evaluateCards([c(14),c(2,1),c(3),c(4),c(5)]).category,4);
assert(evaluateCards([c(10),c(11),c(12),c(13),c(14)]).score>evaluateCards([c(9),c(10),c(11),c(12),c(13)]).score);
assert.equal(evaluateCards([c(9),c(9,1),c(9,2),c(9,3),c(14),c(12),c(2)]).score,evaluateCards([c(9),c(9,1),c(9,2),c(9,3),c(14),c(8),c(3)]).score);
assert.equal(evaluateCards([c(14),c(14,1),c(14,2),c(13),c(13,1),c(13,2),c(2)]).category,6);
for(let n=0;n<400;n++){const a=shuffledDeck(rng).slice(0,7);let best=-1;for(let i=0;i<7;i++)for(let j=i+1;j<7;j++)best=Math.max(best,evaluateCards(a.filter((_,k)=>k!==i&&k!==j)).score);assert.equal(evaluateCards(a).score,best);}
for(let theme=0;theme<3;theme++){assert(themedRTP(theme)>0&&themedRTP(theme)<1);for(let n=0;n<100;n++)assert(themedSpin(rng,theme).every(x=>x>=0&&x<5));assert(themedMultiplier([4,4,4],theme)>0);console.log('Theme',theme,'RTP',themedRTP(theme));}
// 300 randomized betting hands: legal action guards, progress, integer chip conservation.
for(let hand=0;hand<300;hand++){const t=new HoldemTable({rng});t.join('H','Human');t.players.forEach((p,i)=>{p.bot=false;p.stack=20+Math.floor(rng()*1300);});assert(t.startHand());const total=t.players.reduce((a,p)=>a+p.stack,0)+t.pot;let actions=0;while(t.phase!=='complete'&&actions++<200){const p=t.players[t.actor],l=t.legal(p.id);assert(l);assert.equal(t.act('not-the-actor','call'),false);let ok;if(l.canRaise&&rng()<.25)ok=t.act(p.id,'raise',rng()<.2?l.maxTo:Math.min(l.maxTo,l.minTo));else if(!l.canCheck&&rng()<.15)ok=t.act(p.id,'fold');else ok=t.act(p.id,l.canCheck?'check':'call');assert(ok);assert.equal(t.players.reduce((a,p)=>a+p.stack,0)+t.pot,total);}assert.equal(t.phase,'complete');assert(t.players.every(p=>Number.isInteger(p.stack)&&p.stack>=0));}
// Explicit unequal all-ins: main + side pots, including uncalled return.
{const t=new HoldemTable({seats:3});t.players=['A','B','C'].map(id=>t.addPlayer(id));t.players[0].hole=[c(14),c(14,1)];t.players[1].hole=[c(13),c(13,1)];t.players[2].hole=[c(12),c(12,1)];t.board=[c(2),c(4,1),c(7,2),c(9,3),c(11)];[100,300,500].forEach((n,i)=>{t.players[i].total=n;t.players[i].stack=0;});t.pot=900;t.phase='river';t.showdown();assert.deepEqual(t.players.map(p=>p.stack),[300,400,200]);}
// Short all-in does not reopen the raise right of an already-acted player.
{const t=new HoldemTable({seats:3});t.players=['A','B','C'].map(id=>t.addPlayer(id));t.phase='flop';t.actor=1;t.currentBet=100;t.minRaise=100;t.players[0].street=100;t.players[0].total=100;t.players[1].stack=150;t.pending=new Set([1,2]);t.acted=new Set([0]);assert(t.act('B','allin'));assert(t.act('C','call'));assert.equal(t.legal('A').canRaise,false);assert.equal(t.act('A','raise',250),false);}
// Private cards do not leak; late human replaces a bot only between hands.
{const t=new HoldemTable({rng});t.join('P1');t.startHand();assert(t.view('P1').players.filter(p=>p.id!=='P1').every(p=>p.hole.every(c=>c===null)));assert(t.join('P2'));assert(!t.players.some(p=>p.id==='P2'));assert(t.waiting.some(p=>p.id==='P2'));}
// Blackjack: ace handling, natural, split, double, dealer stand-soft-17.
assert.deepEqual(blackjackTotal([c(14),c(6)]),{value:17,soft:true});assert.deepEqual(blackjackTotal([c(14),c(14,1),c(9)]),{value:21,soft:true});
{const b=new BlackjackGame();b.shoe=new Array(80).fill(c(2));b.shoe.push(c(8),c(13),c(9),c(14));assert(b.bet(100));assert.equal(b.balance,1150);assert.equal(b.phase,'complete');}
{const b=new BlackjackGame();b.shoe=new Array(80).fill(c(2));b.shoe.push(c(10),c(8),c(6),c(8));assert(b.bet(100));assert(b.action('split'));assert.equal(b.hands.length,2);assert(b.action('double'));assert(b.action('stand'));assert.equal(b.phase,'complete');assert(b.balance>=0);}
for(let n=0;n<300;n++){const b=new BlackjackGame({rng});b.bet(100);let actions=0;while(b.phase==='playing'&&actions++<50){const h=b.hands[b.active];assert(b.action(blackjackTotal(h.cards).value<17?'hit':'stand'));}assert.equal(b.phase,'complete');assert(Number.isFinite(b.balance)&&b.balance>=0);}
console.log('PASS: evaluator (400 seven-card cross-checks), 300 poker hands, side pots, uncalled returns, short raises, privacy, late seats, three slot themes, 300 blackjack hands.');

// All-in disconnected players retain eligibility; no meaningless bet into all-ins.
{const t=new HoldemTable({seats:2,rng});t.join('P');t.players[1].stack=7;t.players.forEach(p=>p.bot=false);t.startHand();assert.equal(t.phase,'complete');}
{const t=new HoldemTable({seats:3,rng});t.join('P');t.players.forEach(p=>{p.bot=false;p.stack=100;});t.startHand();const a=t.players[t.actor];t.act(a.id,'allin');t.leave(a.id);assert.equal(a.folded,false);}
for(let n=0;n<12;n++){const t=new HoldemTable({rng});t.join('P');t.startHand();let steps=0;while(t.phase!=='complete'&&steps++<600){const p=t.players[t.actor];if(p&&!p.bot){const l=t.legal(p.id);t.act(p.id,l.canCheck?'check':'call');}else t.tick(1);}assert.equal(t.phase,'complete');}
console.log('PASS: bot-only seat decisions through 12 complete human/bot hands; short blind all-in runout; disconnect all-in eligibility.');
