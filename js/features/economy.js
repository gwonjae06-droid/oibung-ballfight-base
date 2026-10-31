/* Compatibility-only financial hooks. The points, wager, shop and item
 * reservation systems have been retired. The old localStorage save is left
 * intact deliberately, but nothing reads, changes or earns currency here.
 * The battle engine still calls these names, so keep inert functions. */
function formatGold(){return '';}
function saveEconomyState(){return true;}
function setEconomyMessage(){}
function selectBetPlayer(){return false;}
function setMaxBet(){return false;}
function buyItem(){return false;}
function toggleItemTarget(){return false;}
function applyReservedItem(){return false;}
function beginRoundEconomy(){activeBet=null;roundSettled=false;return true;}
function settleRound(){roundSettled=true;activeBet=null;}
function renderEconomyUI(){}
