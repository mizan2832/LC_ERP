function normalizeStandardValuation(data){
 const copy={...data,fields:{...data.fields},costs:(data.costs||[]).map(cost=>({...cost}))},f=copy.fields,c=data.calculation||{};
 f.lcType=f.lcType||'LC';f.tt=f.tt??0;f.ttfx=f.ttfx??f.fx??124;f.ttParty=f.ttParty||'';
 if(f.totalAssessableBDT===undefined){
  const saved=c.customsAssessableValue;
  f.totalAssessableBDT=saved!==undefined&&saved!==null?saved:f.assUsd!==undefined&&f.assUsd!==''?Number(f.assUsd)*Number(f.cfx??f.fx??0)+Number(f.landingBDT??c.landingCharge??0)+Number(f.psiBDT??c.psiAssessableValue??0):'';
 }

 // Move the retired government penalty to Customs processing when opening an old setup.
 const legacyPenalty=copy.costs.find(cost=>cost.id==='duty-6');
 if(legacyPenalty){
  if(legacyPenalty.included&&Number(legacyPenalty.value)>0){
   const calculated=StandardCostMath.calculate(copy).amounts,existing=copy.costs.find(cost=>cost.id==='global-4');
   const amount=Number(calculated['duty-6']||0)+Number(calculated['global-4']||0);
   const replacement={id:'global-4',key:'global',name:'Penalty fee',method:'fixed',value:amount,included:true};
   if(existing)Object.assign(existing,replacement);else copy.costs.push(replacement);
  }
  copy.costs=copy.costs.filter(cost=>cost.id!=='duty-6');
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
 // Preserve the calculated BDT amount when loading historical percentage processing heads.
 const processingPercent=copy.costs.filter(cost=>cost.key==='global'&&cost.method!=='fixed');
 if(processingPercent.length){
  const calculated=StandardCostMath.calculate(copy).amounts;
  processingPercent.forEach(cost=>{cost.value=Number(calculated[cost.id]||0);cost.method='fixed'});
 }
 delete f.freight;
 return copy;
}
