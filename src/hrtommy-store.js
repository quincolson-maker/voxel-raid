// Store transaction adapter. Caller supplies the game's trusted points wallet.
// Fictional game points only. Persist ownership through your existing host save.
export function createTommySuppressorItem({weapon,wallet,price=900,owned=false,equipped=false,onChange=()=>{}}={}){
 if(!weapon?.setSuppressor||typeof wallet?.spend!=='function')throw new TypeError('Need replica weapon and wallet.spend(points)');
 const state={id:'tommy_suppressor',name:'Tommy suppressor',price,owned:!!owned,equipped:!!owned&&!!equipped};weapon.setSuppressor(state.equipped);
 return {state,buy(){if(state.owned||!Number.isSafeInteger(price)||price<=0)return false;if(wallet.spend(price)!==true)return false;state.owned=state.equipped=true;weapon.setSuppressor(true);onChange({...state});return true;},toggle(){if(!state.owned)return false;state.equipped=!state.equipped;weapon.setSuppressor(state.equipped);onChange({...state});return true;},restore(save){state.owned=!!save?.owned;state.equipped=state.owned&&!!save?.equipped;weapon.setSuppressor(state.equipped);}};
}
