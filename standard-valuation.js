function normalizeStandardValuation(data){
 const copy={...data,fields:{...data.fields},costs:(data.costs||[]).map(cost=>({...cost}))},f=copy.fields,c=data.calculation||{};
 f.lcType=f.lcType||'LC';f.tt=f.tt??0;f.ttfx=f.ttfx??f.fx??124;f.ttParty=f.ttParty||'';
 if(f.totalAssessableBDT===undefined){
  const saved=c.customsAssessableValue;
  f.totalAssessableBDT=saved!==undefined&&saved!==null?saved:f.assUsd!==undefined&&f.assUsd!==''?Number(f.assUsd)*Number(f.cfx??f.fx??0)+Number(f.landingBDT??c.landingCharge??0)+Number(f.psiBDT??c.psiAssessableValue??0):'';
 }

 // Convert an old foreign-currency freight input to a BDT stock-unit head in memory.
 const freight=Number(f.freight||0),fx=Number(f.fx||0);
 if(freight>0&&fx>0){
  const existing=copy.costs.find(cost=>cost.key==='cf'&&String(cost.name||'').trim().toLowerCase()==='freight cost');
  const converted=Math.round(freight*fx*100)/100;
  if(!existing)copy.costs.push({id:'cf-freight',key:'cf',name:'Freight cost',method:'fixed',value:converted,included:true});
  else if(existing.method==='fixed'){existing.value=converted+(existing.included?Number(existing.value||0):0);existing.included=true}
  else copy.costs.push({id:'cf-legacy-freight',key:'cf',name:'Legacy freight cost',custom:true,method:'fixed',value:converted,included:true});
 }
 delete f.freight;
 return copy;
}
