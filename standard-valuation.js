function normalizeStandardValuation(data){
 const copy={...data,fields:{...data.fields},costs:(data.costs||[]).map(cost=>({...cost}))},f=copy.fields,c=data.calculation||{},rate=Number(f.cfx??f.fx),legacy=(c.valuationVersion||0)<5;
 if(f.cfx===undefined)f.cfx=f.fx||'';
 if(!['LC','LC+TT','TT'].includes(f.lcType))f.lcType='LC';
 if(f.landingBDT===undefined)f.landingBDT=c.landingCharge??(Number(c.cifValue||0)*Number(f.landingPercent||0)/100);
 if(f.psiBDT===undefined)f.psiBDT=c.psiAssessableValue??Number(f.psiAV||0);
 if(legacy&&f.assUsd===undefined&&rate>0){
  const base=c.cifValue??(c.customsAssessableValue!==undefined?Number(c.customsAssessableValue)-Number(f.landingBDT||0)-Number(f.psiBDT||0):null);
  f.assUsd=base===null?'':Math.max(0,Number(base)/rate);
 }
 // Convert an old foreign-currency freight input to a BDT order-unit head in memory.
 const freight=Number(f.freight||0),fx=Number(f.fx||0),unit=String(f.unit||'').toUpperCase();
 const factor=/LTR|LITRE|LITER|KG|KILOGRAM/.test(unit)?Number(f.pack||1):1;
 if(freight>0&&fx>0){
  const existing=copy.costs.find(cost=>cost.key==='cf'&&String(cost.name||'').trim().toLowerCase()==='freight cost');
  const converted=Math.round(freight*fx*factor*100)/100;
  if(!existing)copy.costs.push({id:'cf-freight',key:'cf',name:'Freight cost',method:'fixed',value:converted,included:true});
  else if(existing.method==='fixed'){existing.value=converted+(existing.included?Number(existing.value||0):0);existing.included=true}
  else copy.costs.push({id:'cf-legacy-freight',key:'cf',name:'Legacy freight cost',custom:true,method:'fixed',value:converted,included:true});
 }
 delete f.freight;
 return copy;
}
