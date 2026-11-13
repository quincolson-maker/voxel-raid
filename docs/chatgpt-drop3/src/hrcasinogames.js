// Frontier casino rules. Fictional chips only; pure JS, deterministic RNG injection.
// No DOM, rendering, timers, networking, or real-money transactions.
export const SLOT_THEMES = [
  { id:'goldrush', name:'GOLD RUSH', subtitle:'The Golden Buffalo', color:0x8a2319, accent:0xe5b94d, names:['cactus','cherry','horseshoe','bell','buffalo'], weights:[10,9,7,4,2], triples:[0,5,10,25,60], two:3, first:1 },
  { id:'ghosttown', name:'GHOST TOWN', subtitle:'Midnight at Hangman Creek', color:0x172e3a, accent:0x85dbc8, names:['moon','raven','lantern','outlaw','ghost'], weights:[12,9,6,3,2], triples:[0,4,18,55,120], two:3, first:1 },
  { id:'sunsilver', name:'SUN & SILVER', subtitle:'The Lost Pyramid', color:0x553027, accent:0xffd56b, names:['sun','gem','scarab','gold','pyramid'], weights:[11,9,7,3,2], triples:[0,4,12,45,150], two:3, first:1 },
];
export function themeOf(id=0){return typeof id==='number'?SLOT_THEMES[id]||SLOT_THEMES[0]:SLOT_THEMES.find(t=>t.id===id)||SLOT_THEMES[0];}
function uniform(rng){return Math.max(0,Math.min(1-Number.EPSILON,Number(rng())||0));}
export function themedSpin(rng=Math.random,id=0){const t=themeOf(id),total=t.weights.reduce((a,b)=>a+b,0),out=[];for(let j=0;j<3;j++){let r=uniform(rng)*total,k=0;while(k<t.weights.length-1&&(r-=t.weights[k])>=0)k++;out.push(k);}return out;}
export function themedMultiplier(r,id=0){if(!Array.isArray(r)||r.length!==3||r.some(x=>!Number.isInteger(x)||x<0||x>4))return 0;const t=themeOf(id);if(r[0]===r[1]&&r[1]===r[2])return t.triples[r[0]];if(r.filter(x=>x===1).length===2)return t.two;return r[0]===1?t.first:0;}
export function themedRTP(id=0){const t=themeOf(id),sum=t.weights.reduce((a,b)=>a+b,0);let e=0;for(let a=0;a<5;a++)for(let b=0;b<5;b++)for(let c=0;c<5;c++)e+=t.weights[a]*t.weights[b]*t.weights[c]/sum**3*themedMultiplier([a,b,c],id);return e;}
export const CARD_SUITS=['♣','♦','♥','♠'];
export function cardText(c){return c==null?'🂠':(['','','2','3','4','5','6','7','8','9','10','J','Q','K','A'][c%13+2]+CARD_SUITS[Math.floor(c/13)]);}
export function shuffledDeck(rng=Math.random,decks=1){const d=Array.from({length:52*decks},(_,i)=>i%52);for(let i=d.length-1;i>0;i--){const j=Math.floor(uniform(rng)*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
const pack=(category,k)=>{let s=category;for(let i=0;i<5;i++)s=s*15+(k[i]||0);return s;};
function straightHigh(ranks){const set=new Set(ranks);if(set.has(14))set.add(1);for(let h=14;h>=5;h--){let ok=true;for(let i=0;i<5;i++)if(!set.has(h-i))ok=false;if(ok)return h;}return 0;}
export function evaluateCards(cards){
  if(!Array.isArray(cards)||cards.length<5||cards.length>7||new Set(cards).size!==cards.length||cards.some(c=>!Number.isInteger(c)||c<0||c>=52))throw new RangeError('Expected 5–7 distinct cards');
  const count=new Array(15).fill(0),suits=[[],[],[],[]];for(const c of cards){const r=c%13+2;count[r]++;suits[Math.floor(c/13)].push(r);}
  const ranks=[],pairs=[],trips=[],quads=[];for(let r=14;r>=2;r--)if(count[r]){ranks.push(r);if(count[r]>=2)pairs.push(r);if(count[r]>=3)trips.push(r);if(count[r]===4)quads.push(r);}
  const flush=suits.find(s=>s.length>=5);if(flush){const high=straightHigh(flush);if(high)return {score:pack(8,[high]),category:8,name:'Straight flush'};}
  if(quads.length)return {score:pack(7,[quads[0],...ranks.filter(r=>r!==quads[0]).slice(0,1)]),category:7,name:'Four of a kind'};
  if(trips.length){const p=pairs.find(r=>r!==trips[0]);if(p)return {score:pack(6,[trips[0],p]),category:6,name:'Full house'};}
  if(flush)return {score:pack(5,flush.sort((a,b)=>b-a).slice(0,5)),category:5,name:'Flush'};
  const high=straightHigh(ranks);if(high)return {score:pack(4,[high]),category:4,name:'Straight'};
  if(trips.length)return {score:pack(3,[trips[0],...ranks.filter(r=>r!==trips[0]).slice(0,2)]),category:3,name:'Three of a kind'};
  if(pairs.length>=2)return {score:pack(2,[pairs[0],pairs[1],ranks.find(r=>r!==pairs[0]&&r!==pairs[1])]),category:2,name:'Two pair'};
  if(pairs.length)return {score:pack(1,[pairs[0],...ranks.filter(r=>r!==pairs[0]).slice(0,3)]),category:1,name:'Pair'};
  return {score:pack(0,ranks.slice(0,5)),category:0,name:'High card'};
}
const BOT_NAMES=['Doc Maddox','Pearl Cassidy','Silas Flint','Coyote Jack','Ada Vale','Elias Crow'];
export class HoldemTable {
  constructor({rng=Math.random,seats=6,smallBlind=10,bigBlind=20,stack=1000}={}){
    this.rng=rng;this.capacity=Math.max(2,Math.min(6,seats|0));this.smallBlind=smallBlind;this.bigBlind=bigBlind;this.initialStack=stack;
    this.players=[];this.waiting=[];this.phase='waiting';this.board=[];this.deck=[];this.button=-1;this.actor=-1;this.currentBet=0;this.minRaise=bigBlind;this.pending=new Set();this.acted=new Set();this.handId=0;this.revision=0;this.log=[];this.result=[];this.clock=0;this.delay=0;this.pot=0;
  }
  note(s){this.log.push(s);if(this.log.length>20)this.log.shift();}
  addPlayer(id,name=id,bot=false){return {id,name:String(name).slice(0,24),bot,stack:this.initialStack,hole:[],total:0,street:0,folded:false,allIn:false,leaving:false};}
  join(id,name=id){if(typeof id!=='string'||!id||id.length>64)return false;let p=this.players.find(p=>p.id===id);if(p){p.leaving=false;return true;}if(this.waiting.some(p=>p.id===id))return true;
    if(!['waiting','complete'].includes(this.phase)){if(this.players.filter(p=>!p.bot&&!p.leaving).length+this.waiting.length>=this.capacity)return false;this.waiting.push({id,name});this.revision++;return true;}
    const i=this.players.findIndex(p=>p.bot||p.leaving);p=this.addPlayer(id,name);if(i>=0)this.players[i]=p;else if(this.players.length<this.capacity)this.players.push(p);else return false;this.fillBots();this.revision++;return true;
  }
  fillBots(){while(this.players.length<this.capacity){const i=this.players.length;this.players.push(this.addPlayer('BOT:'+i,BOT_NAMES[i%BOT_NAMES.length],true));}}
  applyWaiting(){for(const w of this.waiting.splice(0)){let i=this.players.findIndex(p=>p.bot||p.leaving);if(i>=0)this.players[i]=this.addPlayer(w.id,w.name);else if(this.players.length<this.capacity)this.players.push(this.addPlayer(w.id,w.name));}for(let i=0;i<this.players.length;i++)if(this.players[i].leaving)this.players[i]=this.addPlayer('BOT:'+i,BOT_NAMES[i],true);this.fillBots();}
  leave(id){this.waiting=this.waiting.filter(p=>p.id!==id);const p=this.players.find(p=>p.id===id);if(!p)return;p.leaving=true;if(!['waiting','complete'].includes(this.phase)&&!p.folded&&!p.allIn){p.folded=true;this.pending.delete(this.players.indexOf(p));this.note(p.name+' leaves and folds');this.advance();}this.revision++;}
  rebuy(id){if(!['waiting','complete'].includes(this.phase))return false;const p=this.players.find(p=>p.id===id);if(!p||p.stack>=this.bigBlind)return false;p.stack=this.initialStack;this.revision++;return true;}
  next(i,predicate){for(let n=1;n<=this.players.length;n++){const j=(i+n+this.players.length)%this.players.length;if(predicate(this.players[j],j))return j;}return -1;}
  pay(i,n){const p=this.players[i],v=Math.min(p.stack,n);p.stack-=v;p.street+=v;p.total+=v;this.pot+=v;p.allIn=p.stack===0;return v;}
  startHand(){if(!['waiting','complete'].includes(this.phase))return false;this.applyWaiting();if(!this.players.some(p=>!p.bot&&!p.leaving))return false;
    for(const p of this.players){if(p.bot&&p.stack<this.bigBlind)p.stack=this.initialStack;p.hole=[];p.total=p.street=0;p.folded=p.stack===0;p.allIn=false;}
    if(this.players.filter(p=>!p.folded).length<2)return false;
    this.deck=shuffledDeck(this.rng);this.board=[];this.result=[];this.pot=0;this.handId++;this.phase='preflop';this.button=this.next(this.button,p=>!p.folded);this.minRaise=this.bigBlind;this.acted.clear();
    for(let n=0;n<2;n++)for(let k=1;k<=this.players.length;k++){const p=this.players[(this.button+k)%this.players.length];if(!p.folded)p.hole.push(this.deck.pop());}
    const active=this.players.filter(p=>!p.folded).length,sb=active===2?this.button:this.next(this.button,p=>!p.folded),bb=this.next(sb,p=>!p.folded);this.pay(sb,this.smallBlind);this.pay(bb,this.bigBlind);this.currentBet=Math.max(this.bigBlind,...this.players.map(p=>p.street));
    this.pending=new Set(this.players.map((p,i)=>!p.folded&&!p.allIn?i:-1).filter(i=>i>=0));this.actor=this.next(bb,(_,i)=>this.pending.has(i));this.clock=0;this.delay=.8;this.note('Hand '+this.handId+' · blinds '+this.smallBlind+'/'+this.bigBlind);this.advance();this.revision++;return true;
  }
  legal(id){const p=this.players[this.actor];if(!p||p.id!==id||!this.pending.has(this.actor))return null;const call=Math.max(0,this.currentBet-p.street),maxTo=p.street+p.stack;return {call:Math.min(p.stack,call),canCheck:call===0,minTo:this.currentBet+this.minRaise,maxTo,canRaise:!this.acted.has(this.actor)&&maxTo>this.currentBet};}
  act(id,action,amount){const legal=this.legal(id);if(!legal)return false;const i=this.actor,p=this.players[i];
    if(action==='allin'){if(legal.maxTo<=this.currentBet)action='call';else{action='raise';amount=legal.maxTo;}}
    if(action==='check'&&!legal.canCheck)return false;
    if(action==='raise'){
      if(!legal.canRaise||!Number.isSafeInteger(amount)||amount<=this.currentBet||amount>legal.maxTo||(amount<legal.minTo&&amount!==legal.maxTo))return false;
      const old=this.currentBet,full=amount-old>=this.minRaise;this.pay(i,amount-p.street);this.currentBet=amount;
      if(full){this.minRaise=amount-old;this.acted.clear();this.pending=new Set(this.players.map((q,j)=>j!==i&&!q.folded&&!q.allIn?j:-1).filter(j=>j>=0));}
      else for(let j=0;j<this.players.length;j++){const q=this.players[j];if(j!==i&&!q.folded&&!q.allIn&&q.street<this.currentBet)this.pending.add(j);}
      this.note(p.name+' '+(p.allIn?'all-in to ':'raises to ')+amount);
    }else if(action==='fold'){p.folded=true;this.note(p.name+' folds');}
    else if(action==='call'||action==='check'){const paid=this.pay(i,legal.call);this.note(p.name+(paid?' calls '+paid:' checks'));}
    else return false;
    this.pending.delete(i);this.acted.add(i);this.actor=this.next(i,(_,j)=>this.pending.has(j));this.clock=0;this.delay=.6+uniform(this.rng)*.8;this.advance();this.revision++;return true;
  }
  advance(){if(['waiting','complete'].includes(this.phase))return;const alive=this.players.filter(p=>!p.folded);
    if(alive.length===1){const p=alive[0];p.stack+=this.pot;this.result=[{id:p.id,amount:this.pot,name:'Uncontested'}];this.pot=0;this.finish();return;}
    const canBet=alive.filter(p=>!p.allIn);if(canBet.length===1){this.currentBet=Math.max(...alive.map(p=>p.street));const lone=canBet[0];if(lone.street>=this.currentBet)this.pending.delete(this.players.indexOf(lone));}
    for(const i of [...this.pending])if(this.players[i].folded||this.players[i].allIn)this.pending.delete(i);
    if(this.pending.size){if(!this.pending.has(this.actor))this.actor=this.next(this.actor,(_,j)=>this.pending.has(j));return;}
    const betting=alive.filter(p=>!p.allIn).length;
    if(this.phase==='river'||betting<=1){while(this.board.length<5){this.deck.pop();const n=this.board.length===0?3:1;for(let i=0;i<n&&this.board.length<5;i++)this.board.push(this.deck.pop());}this.showdown();return;}
    this.deck.pop();const n=this.phase==='preflop'?3:1;for(let i=0;i<n;i++)this.board.push(this.deck.pop());this.phase=this.phase==='preflop'?'flop':this.phase==='flop'?'turn':'river';for(const p of this.players)p.street=0;this.currentBet=0;this.minRaise=this.bigBlind;this.acted.clear();this.pending=new Set(this.players.map((p,i)=>!p.folded&&!p.allIn?i:-1).filter(i=>i>=0));this.actor=this.next(this.button,(_,i)=>this.pending.has(i));this.clock=0;this.delay=.8;this.note(this.phase.toUpperCase());
  }
  showdown(){const levels=[...new Set(this.players.map(p=>p.total).filter(n=>n>0))].sort((a,b)=>a-b);let prev=0;this.result=[];
    for(const level of levels){const contributors=this.players.filter(p=>p.total>=level),amount=(level-prev)*contributors.length;prev=level;
      if(contributors.length===1){contributors[0].stack+=amount;this.result.push({id:contributors[0].id,amount,name:'Uncalled return'});continue;}
      const eligible=contributors.filter(p=>!p.folded);if(!eligible.length)throw new Error('Invalid side pot: no eligible player');let best=-1,winners=[];
      for(const p of eligible){const hand=evaluateCards([...p.hole,...this.board]);if(hand.score>best){best=hand.score;winners=[p];}else if(hand.score===best)winners.push(p);}
      winners.sort((a,b)=>((this.players.indexOf(a)-this.button-1+this.players.length)%this.players.length)-((this.players.indexOf(b)-this.button-1+this.players.length)%this.players.length));const share=Math.floor(amount/winners.length),odd=amount%winners.length;
      winners.forEach((p,i)=>{const n=share+(i<odd?1:0);p.stack+=n;this.result.push({id:p.id,amount:n,name:evaluateCards([...p.hole,...this.board]).name});});
    }this.pot=0;this.finish();
  }
  finish(){this.phase='complete';this.actor=-1;this.pending.clear();this.clock=0;this.note(this.result.map(r=>(this.players.find(p=>p.id===r.id)?.name||r.id)+' +'+r.amount+' ('+r.name+')').join(' · '));}
  botChoice(p){const l=this.legal(p.id);if(!l)return;const known=new Set([...p.hole,...this.board]),unseen=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c));let equity=0;
    for(let n=0;n<24;n++){const pool=unseen.slice();for(let i=pool.length-1;i>pool.length-10&&i>0;i--){const j=Math.floor(uniform(this.rng)*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}const opp=[pool.pop(),pool.pop()],board=this.board.slice();while(board.length<5)board.push(pool.pop());const a=evaluateCards([...p.hole,...board]).score,b=evaluateCards([...opp,...board]).score;equity+=a>b?1:a===b?.5:0;}equity/=24;
    const aggression=.12+(this.players.indexOf(p)%3)*.1,odds=l.call/Math.max(1,this.pot+l.call);
    if(l.call&&equity<odds+.05&&uniform(this.rng)>.13)return this.act(p.id,'fold');
    if(l.canRaise&&(equity>.68||uniform(this.rng)<aggression*.28)){const target=Math.min(l.maxTo,Math.max(l.minTo,this.currentBet+Math.round((this.pot*.45+this.bigBlind)/this.bigBlind)*this.bigBlind));return this.act(p.id,'raise',target);}
    return this.act(p.id,l.canCheck?'check':'call');
  }
  tick(dt){if(['waiting','complete'].includes(this.phase))return;this.clock+=dt;const p=this.players[this.actor];if(!p)return;if(p.bot&&this.clock>this.delay)this.botChoice(p);else if(!p.bot&&this.clock>30){const l=this.legal(p.id);this.act(p.id,l?.canCheck?'check':'fold');}}
  view(id){return {phase:this.phase,handId:this.handId,revision:this.revision,button:this.button,actor:this.actor,currentBet:this.currentBet,minRaise:this.minRaise,pot:this.pot,board:this.board.slice(),waiting:this.waiting.map(w=>({id:w.id,name:w.name})),players:this.players.map(p=>({id:p.id,name:p.name,bot:p.bot,stack:p.stack,street:p.street,total:p.total,folded:p.folded,allIn:p.allIn,hole:p.id===id||(this.phase==='complete'&&!p.folded)?p.hole.slice():p.hole.map(()=>null)})),legal:this.legal(id),result:this.result.slice(),log:this.log.slice(-7),turnSeconds:Math.max(0,30-this.clock)};}
}
export function blackjackTotal(cards){let n=0,aces=0;for(const c of cards){const r=c%13+2;n+=r===14?11:Math.min(10,r);if(r===14)aces++;}while(n>21&&aces){n-=10;aces--;}return {value:n,soft:aces>0};}
export class BlackjackGame {
  constructor({rng=Math.random,chips=1000}={}){this.rng=rng;this.balance=chips;this.shoe=[];this.hands=[];this.dealer=[];this.active=-1;this.phase='betting';this.message='Dealer stands on all 17s. Blackjack pays 3:2.';this.revision=0;}
  card(){if(!this.shoe.length)this.shoe=shuffledDeck(this.rng,6);return this.shoe.pop();}
  bet(amount){if(this.phase==='playing'||![10,50,100].includes(amount)||this.balance<amount)return false;if(this.shoe.length<78)this.shoe=shuffledDeck(this.rng,6);this.balance-=amount;this.dealer=[];const h={cards:[],bet:amount,done:false,split:false,outcome:''};this.hands=[h];h.cards.push(this.card());this.dealer.push(this.card());h.cards.push(this.card());this.dealer.push(this.card());this.active=0;this.phase='playing';this.message='Your move';this.revision++;
    const playerBJ=blackjackTotal(h.cards).value===21,dealerBJ=blackjackTotal(this.dealer).value===21;if(dealerBJ||playerBJ){h.done=true;this.settle();}return true;}
  action(action){if(this.phase!=='playing')return false;const h=this.hands[this.active];if(!h||h.done)return false;
    if(action==='hit'){h.cards.push(this.card());if(blackjackTotal(h.cards).value>=21)h.done=true;}
    else if(action==='stand')h.done=true;
    else if(action==='double'){if(h.cards.length!==2||this.balance<h.bet||h.splitAce)return false;this.balance-=h.bet;h.bet*=2;h.cards.push(this.card());h.done=true;}
    else if(action==='split'){
      if(h.cards.length!==2||h.cards[0]%13!==h.cards[1]%13||this.hands.length>=4||this.balance<h.bet||h.splitAce)return false;
      this.balance-=h.bet;const second=h.cards.pop(),aces=second%13===12;h.split=true;h.splitAce=aces;h.cards.push(this.card());const other={cards:[second,this.card()],bet:h.bet,done:aces,split:true,splitAce:aces,outcome:''};h.done=aces;this.hands.splice(this.active+1,0,other);
    }else return false;
    this.revision++;if(h.done){let next=this.hands.findIndex((q,i)=>i>this.active&&!q.done);if(next<0)next=this.hands.findIndex(q=>!q.done);if(next<0)this.dealerPlay();else this.active=next;}return true;
  }
  dealerPlay(){if(this.hands.some(h=>blackjackTotal(h.cards).value<=21))while(blackjackTotal(this.dealer).value<17)this.dealer.push(this.card());this.settle();}
  settle(){const d=blackjackTotal(this.dealer).value,dealerBJ=this.dealer.length===2&&d===21;for(const h of this.hands){const v=blackjackTotal(h.cards).value,natural=!h.split&&h.cards.length===2&&v===21;let pay=0;
    if(v>21)h.outcome='Bust';else if(dealerBJ){if(natural){pay=h.bet;h.outcome='Push';}else h.outcome='Dealer blackjack';}
    else if(natural){pay=h.bet*2.5;h.outcome='Blackjack 3:2';}else if(d>21||v>d){pay=h.bet*2;h.outcome='Win';}else if(v===d){pay=h.bet;h.outcome='Push';}else h.outcome='Lose';this.balance+=pay;h.done=true;
    }this.phase='complete';this.active=-1;this.message=this.hands.map(h=>h.outcome).join(' · ');this.revision++;
  }
  rebuy(){if(this.phase==='playing'||this.balance>=10)return false;this.balance=1000;this.revision++;return true;}
  view(){return {phase:this.phase,balance:this.balance,active:this.active,dealer:this.dealer.map((c,i)=>this.phase==='playing'&&i===1?null:c),hands:this.hands.map(h=>({cards:h.cards.slice(),bet:h.bet,done:h.done,outcome:h.outcome})),canSplit:this.phase==='playing'&&this.hands.length<4&&this.hands[this.active]?.cards.length===2&&this.hands[this.active].cards[0]%13===this.hands[this.active].cards[1]%13&&this.balance>=this.hands[this.active].bet&&!this.hands[this.active].splitAce,canDouble:this.phase==='playing'&&this.hands[this.active]?.cards.length===2&&this.balance>=this.hands[this.active].bet&&!this.hands[this.active].splitAce,message:this.message,revision:this.revision};}
}
