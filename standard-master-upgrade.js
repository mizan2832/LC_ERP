// Recalculate derived master totals from existing inputs; frozen transaction snapshots stay intact.
(()=>{
 const key='lc-standards-v1',raw=localStorage.getItem(key);if(!raw)return;
 const records=JSON.parse(raw);if(!Array.isArray(records))throw Error('Invalid standard cost storage.');
 let changed=false;
 const upgraded=records.map(record=>{
  if(record.calculation?.valuationVersion>=9&&record.calculation?.expenseUnitBasis==='stock')return record;
  const prepared=normalizeStandardValuation(record),calculation=StandardCostMath.calculate(prepared);changed=true;
  return {...prepared,calculation,unitBasisCorrection:{at:new Date().toISOString(),from:record.calculation?.expenseUnitBasis||'legacy',to:'stock',version:9}};
 });
 if(changed){const backup='lc-standard-unit-basis-backup-v9';if(localStorage.getItem(backup)===null)localStorage.setItem(backup,raw);localStorage.setItem(key,JSON.stringify(upgraded))}
})();
