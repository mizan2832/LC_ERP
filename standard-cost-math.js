// Standard amounts share the item's KG/LTR/PCS basis; pack conversion occurs once.
const StandardCostMath={
 isMargin(cost){return cost?.id==='bank-9'||cost?.key==='bank'&&/^(?:(?:lc|l\/c|cash)\s+)?margin(?:\s+deposit)?$/i.test(String(cost.name||'').trim())},
 normalize(unit){return String(unit||'').trim().toUpperCase().replace(/LITRES?|LITERS?/,'LTR').replace(/KILOGRAMS?/,'KG').replace(/PIECES?/,'PCS')},
 factor(setup,line){
  if(setup?.calculation?.expenseUnitBasis!=='stock')return 1;
  const unit=this.normalize(setup.fields.unit);
  if(unit===this.normalize(line.uom))return 1;
  const factor=Number(line.factor??line.conversionFactor??setup.fields.pack);
  if(unit!==this.normalize(line.convertedUom)||!Number.isFinite(factor)||factor<=0)throw Error('Invalid standard unit conversion for '+(line.itemCode||setup.fields.sku));
  return factor;
 },
 calculate(data){
  const f=data.fields||{},costs=(data.costs||[]).filter(c=>!/assembl/i.test(c.name||'')),n=value=>Number(value||0);
  const lcType=f.lcType||'LC',ttIncluded=lcType!=='TT',ttAmountBDT=ttIncluded?n(f.tt)*n(f.ttfx):0,purchase=n(f.pi)*n(f.fx)+ttAmountBDT,av=n(f.totalAssessableBDT),amounts={},totals={},dutyBases={};
  const amount=(cost,base)=>!cost?.included?0:cost.id==='bank-9'&&(f.marginMode==='percent'||(f.marginPercent!==undefined&&f.marginPercent!=='')||(cost.method==='percent'&&f.marginMode!=='fixed'))?n(f.pi)*n(f.fx)*n(f.marginPercent!==undefined&&f.marginPercent!==''?f.marginPercent:cost.value)/100:cost.method==='fixed'?n(cost.value):base*n(cost.value)/100;
  ['duty-0','duty-1','duty-2','duty-3','duty-4','duty-5'].forEach(id=>{const base=id==='duty-2'?av+amounts['duty-0']+amounts['duty-1']:['duty-3','duty-5'].includes(id)?av+amounts['duty-0']+amounts['duty-1']+amounts['duty-2']:av;dutyBases[id]=base;amounts[id]=amount(costs.find(c=>c.id===id),base)});
  const cf=amount(costs.find(c=>c.id==='cf-2'),purchase);
  costs.forEach(cost=>{const base=cost.key==='duty'?av:cost.key==='global'&&['global-1','global-2'].includes(cost.id)?cf:purchase;const value=Object.hasOwn(dutyBases,cost.id)?amounts[cost.id]:amount(cost,base);amounts[cost.id]=value;totals[cost.key]=(totals[cost.key]||0)+(this.isMargin(cost)?0:value)});
  const unit=this.normalize(f.unit),stockFactor=['KG','LTR'].includes(unit)?Number(f.pack||1):1;
  if(!Number.isFinite(stockFactor)||stockFactor<=0)throw Error('Enter a positive pack conversion factor.');
  const cashMargin=costs.filter(cost=>this.isMargin(cost)).reduce((sum,cost)=>sum+(amounts[cost.id]||0),0);
  const total=purchase+Object.values(totals).reduce((sum,value)=>sum+value,0);
  return {lcType,ttParty:f.ttParty||'',ttIncluded,ttAmountBDT,total,amounts,totals,purchase,orderPurchase:purchase*stockFactor,orderTotal:total*stockFactor,stockFactor,expenseUnitBasis:'stock',customsAssessableValue:av,assessableBaseBDT:av,landingCharge:0,psiAssessableValue:0,valuationVersion:10,marginIncludedInLandedCost:false,cashMargin,dutyBases};
 }
};
