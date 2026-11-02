/* Stable version-3 character persistence adapter.
 * Keep existing localStorage key, JSON format and graceful handling of invalid
 * or disabled storage. Persistence does not normalize or mutate definitions.
 */
(function(global){'use strict';
global.SkillForgeStoreFactory=function({STORE,getDefs}){
function saved(){
  try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v:[];}catch(_){return [];}
}
function persist(){
  try{localStorage.setItem(STORE,JSON.stringify(getDefs().filter(d=>d.forgeData).map(d=>d.forgeData)));}catch(_){}
}

return Object.freeze({saved,persist});
};
})(typeof window!=='undefined'?window:globalThis);
