// Recalculate derived master totals from existing inputs; frozen transaction snapshots stay intact.
(()=>{
 const key='lc-standards-v1',raw=localStorage.getItem(key);if(!raw)return;
 const records=JSON.parse(raw);if(!Array.isArray(records))throw Error('Invalid standard cost storage.');
 let changed=false;
 const upgraded=records.map(record=>{
  if(record.calculation?.valuationVersion>=10&&record.calculation?.expenseUnitBasis==='stock'&&record.calculation?.marginIncludedInLandedCost===false)return record;
  const prepared=normalizeStandardValuation(record),calculation=StandardCostMath.calculate(prepared);changed=true;
  return {...prepared,calculation,unitBasisCorrection:record.unitBasisCorrection||{at:new Date().toISOString(),from:record.calculation?.expenseUnitBasis||'legacy',to:'stock',version:9},marginExclusionCorrection:{at:new Date().toISOString(),previousTotal:record.calculation?.total,correctedTotal:calculation.total,version:10}};
 });
 if(changed){const backup='lc-standard-margin-exclusion-backup-v10';if(localStorage.getItem(backup)===null)localStorage.setItem(backup,raw);localStorage.setItem(key,JSON.stringify(upgraded))}
})();
