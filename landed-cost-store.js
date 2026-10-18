const LandedStore={
 key:'lc-landed-costs-v1',
 read(){const rows=JSON.parse(localStorage.getItem(this.key)||'[]');if(!Array.isArray(rows))throw Error('Invalid landed cost storage.');return rows},
 round(n){return Math.round((n+Number.EPSILON)*100)/100},
 paymentMode(basis){return basis.paymentMode||LCStore.read().find(r=>r.id===basis.lcOpeningId)?.header.pay||''},
 blocked(id){return Rollback.active('lc-finished-goods-receipts-v1',r=>r.landedCostId===id)?'Finished goods receive entry exists.':''},
 basis(bankId){
  const bank=BankCustomsStore.read().find(r=>r.id===bankId&&r.status==='Saved');if(!bank)throw Error('Select a manifest with saved Bank & Customs expenses.');
  const duty=DutyStore.read().find(r=>r.id===bank.dutyCalculationId&&r.status==='Saved');if(!duty)throw Error('Saved duty calculation not found.');
  const receipt=PortStore.read().find(r=>r.id===bank.portReceiptId&&r.status==='Received');if(!receipt)throw Error('Received manifest not found.');
  const expenses=ExpenseStore.read().filter(e=>e.lcOpeningId===bank.lcOpeningId&&e.status==='Saved');
  const previous=new Map(),received=new Map();receipt.rows.forEach(r=>received.set(r.sourceKey,(received.get(r.sourceKey)||0)+Number(r.qty)));
  for(const prior of PortStore.read()){if(prior.id===receipt.id)break;if(prior.lcOpeningId===bank.lcOpeningId&&prior.status==='Received')prior.rows.forEach(r=>previous.set(r.sourceKey,(previous.get(r.sourceKey)||0)+Number(r.qty)))}
  const rows=JSON.parse(JSON.stringify(bank.basis.rows)).map(row=>{
   const setup=row.standardSnapshot;if(!setup)throw Error(row.itemCode+': saved standard setup missing.');
   const norm=u=>String(u||'').toUpperCase().replace('LITRE','LTR');
   const factor=norm(setup.fields.unit)===norm(row.uom)?1:norm(setup.fields.unit)===norm(row.convertedUom)?Number(row.factor):NaN;
   if(!Number.isFinite(factor)||factor<=0)throw Error(row.itemCode+': invalid saved stock unit conversion.');
   const qty=Number(row.qty),stockQty=qty*Number(row.factor||1),costs=[];
   const add=(key,name,source,actual,standard,party='')=>{if(!Number.isFinite(actual)||!Number.isFinite(standard))throw Error(row.itemCode+': invalid '+name+' valuation.');costs.push({key,name,source,actual:this.round(actual),standard:this.round(standard),partyCode:party})};
   add('fob','PI FOB / invoice value','Invoice',Number(row.amountLC),Number(setup.fields.pi)*Number(setup.fields.fx)*factor*qty);
   const dutyRow=duty.rows.find(r=>r.itemCode===row.itemCode&&r.uom===row.uom);if(!dutyRow)throw Error('Duty SKU missing: '+row.itemCode);
   add('freight','Freight','Duty valuation input',Number(dutyRow.freight)*Number(bank.basis.rate)*qty,Number(setup.fields.freight||0)*Number(setup.fields.fx)*factor*qty);
   (setup.costs||[]).filter(c=>c.included&&!/assembl/i.test(c.name)).forEach(cost=>{
    const amount=Number(setup.calculation?.amounts?.[cost.id]??(cost.method==='fixed'?cost.value:NaN));
    if(!Number.isFinite(amount))throw Error(row.itemCode+': calculated standard missing for '+cost.name);
    if(amount>0)add('head:'+ExpenseStore.headKey(cost),cost.name,'Standard setup',0,amount*factor*qty);
   });
   const assembly=0;
   return {...row,qty,stockQty,standardFactor:factor,costs,standardTT:this.round(Number(setup.fields.tt||0)*Number(setup.fields.ttfx||0)*factor*qty),standardAssembly:this.round(assembly)};
  });
  const addActual=(sku,uom,key,name,source,amount,party='')=>{
   const item=rows.find(r=>r.itemCode===sku&&r.uom===uom);if(!item)throw Error('Expense SKU missing in manifest: '+sku);
   let cost=item.costs.find(c=>c.key===key);if(!cost){cost={key,name,source,actual:0,standard:0,partyCode:party};item.costs.push(cost)}
   cost.actual=this.round(cost.actual+amount);cost.source=cost.source==='Standard setup'?source:cost.source.includes(source)?cost.source:cost.source+'; '+source;cost.partyCode=[...new Set([cost.partyCode,party].filter(Boolean))].join(', ');
  };
  expenses.forEach(exp=>{
   const allocation=exp.allocation||CostAllocation.calculate(exp.allocationBasis,exp.rows);
   allocation.lines.forEach((line,index)=>{
    const key=line.piId+':'+index,qty=received.get(key)||0;if(!qty)return;
    const before=previous.get(key)||0,ordered=Number(line.qty);
    line.allocations.forEach(head=>{
     const cents=Math.round(Number(head.amount)*100),portion=(Math.round(cents*Math.min(ordered,before+qty)/ordered)-Math.round(cents*Math.min(ordered,before)/ordered))/100;
     const original=exp.rows.find(r=>r.headKey===head.headKey);
     addActual(line.itemCode,line.uom,'head:'+head.headKey,head.headName,exp.number,portion,original?.partyCode||'');
    });
   });
  });
  duty.rows.forEach(line=>DUTY_HEADS.forEach(head=>{
   const item=rows.find(r=>r.itemCode===line.itemCode&&r.uom===line.uom),cost=item?.standardSnapshot.costs.find(c=>head.match?head.match.test(c.name||''):c.id===head.standard);
   const amount=line.heads[head.id]?.actual;if(amount===null||amount===undefined)throw Error('Actual duty missing for '+line.itemCode+' '+head.name);
   addActual(line.itemCode,line.uom,cost?'head:'+ExpenseStore.headKey(cost):'duty:'+head.id,head.name,duty.number,Number(amount),duty.header.dutyParty||'');
  }));
  bank.allocation.lines.forEach(line=>line.allocations.forEach(head=>{const source=bank.rows.find(r=>r.headKey===head.headKey);addActual(line.itemCode,line.uom,'head:'+head.headKey,head.headName,bank.number,Number(head.amount),source?.partyCode||'')}));
  // Assembly is entered here; reserve its standard only once, even if a prior bill exists.
  rows.forEach(row=>{
   let priorAssembly=false;row.costs.forEach(cost=>{if(/assembl/i.test(cost.name)){if(cost.actual>0)priorAssembly=true;else{row.standardAssembly=this.round(row.standardAssembly);cost.standard=0}}});
   if(priorAssembly)row.standardAssembly=0;
   row.costs=row.costs.filter(c=>c.actual!==0||c.standard!==0);
  });
  return {...JSON.parse(JSON.stringify(bank.basis)),paymentMode:LCStore.read().find(r=>r.id===bank.lcOpeningId)?.header.pay||'',bankCustomsExpenseId:bank.id,bankNumber:bank.number,dutyCalculationId:duty.id,dutyNumber:duty.number,sourceDate:bank.header.costDate,rows,sourceVersions:{bank:bank.revision,duty:duty.revision,openingExpenses:expenses.map(e=>({id:e.id,revision:e.revision}))}};
 },
 allocateTT(basis,extras,ttInput){if(ttInput.total===''||ttInput.total===null||!Number.isFinite(Number(ttInput.total))||Number(ttInput.total)<0)throw Error('Enter a non-negative total TT amount.');const allocation=CostAllocation.calculate(basis.rows,[{headKey:'extra:tt',headName:'TT amount',amount:Number(ttInput.total)}]);return extras.map(extra=>{const line=allocation.lines.find(r=>r.itemCode===extra.itemCode&&r.uom===extra.uom);if(!line)throw Error('TT allocation item missing.');return {...extra,tt:line.allocatedExpense,ttParty:String(ttInput.party||'').trim()}})},
 calculate(basis,extras,ttInput=null){
  if(ttInput)extras=this.allocateTT(basis,extras,ttInput);
  if(extras.length!==basis.rows.length)throw Error('Enter TT and assembly values for each manifest SKU.');const seen=new Set();
  const rows=basis.rows.map(item=>{
   const key=item.itemCode+'|'+item.uom,input=extras.find(r=>r.itemCode===item.itemCode&&r.uom===item.uom);if(!input||seen.has(key))throw Error('Invalid additional-cost SKU.');seen.add(key);
   const values={};for(const name of ['tt','assembly']){const value=Number(input[name]);if(input[name]===''||!Number.isFinite(value)||value<0)throw Error('Enter non-negative '+name+' amount for '+item.itemCode);values[name]=value}
   const costs=[...JSON.parse(JSON.stringify(item.costs)),{key:'extra:tt',name:'TT amount',source:'Landed cost entry',actual:values.tt,standard:item.standardTT,partyCode:String(input.ttParty||'').trim()},{key:'extra:assembly',name:'Assembly cost',source:'Landed cost entry',actual:values.assembly,standard:item.standardAssembly,partyCode:String(input.assemblyParty||'').trim()}].map(c=>({...c,actual:this.round(c.actual),standard:this.round(c.standard),variance:this.round(c.actual-c.standard)}));
   const totalActual=this.round(costs.reduce((s,c)=>s+c.actual,0)),totalStandard=this.round(costs.reduce((s,c)=>s+c.standard,0));
   return {...item,costs,totalActual,totalStandard,variance:this.round(totalActual-totalStandard),actualPerUnit:totalActual/item.qty,standardPerUnit:totalStandard/item.qty,actualPerStockUnit:totalActual/item.stockQty,standardPerStockUnit:totalStandard/item.stockQty};
  });
  return {rows,totalActual:this.round(rows.reduce((s,r)=>s+r.totalActual,0)),totalStandard:this.round(rows.reduce((s,r)=>s+r.totalStandard,0)),totalVariance:this.round(rows.reduce((s,r)=>s+r.variance,0))};
 },
 save(input,revision){
  const records=this.read(),index=records.findIndex(r=>r.id===input.id),old=records[index];
  if(old&&(old.revision!==revision||old.status==='Cancelled'||this.blocked(old.id)))throw Error('Landed cost changed or is locked. Reload it.');
  if(old&&old.bankCustomsExpenseId!==input.bankCustomsExpenseId)throw Error('Cannot change manifest on a saved landed cost.');
  if(!['Draft','Saved'].includes(input.status))throw Error('Invalid landed cost status.');if(old?.status==='Saved'&&input.status==='Draft')throw Error('Saved landed cost cannot return to draft.');
  const bank=BankCustomsStore.read().find(r=>r.id===input.bankCustomsExpenseId&&r.status==='Saved');if(!bank)throw Error('Select a saved Bank & Customs expense.');
  if(records.some(r=>r.id!==input.id&&r.portReceiptId===bank.portReceiptId&&r.status!=='Cancelled'))throw Error('Landed cost already exists for this manifest.');
  const basis=old?.basis||this.basis(bank.id),date=input.header.costDate;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<basis.sourceDate)throw Error('Enter a valid cost date on or after Bank & Customs expense date.');
  if(input.ttInput){input={...input,extras:this.allocateTT(basis,input.extras,input.ttInput),ttInput:{total:this.round(Number(input.ttInput.total)),party:String(input.ttInput.party||'').trim(),method:'Invoice value weighted'}}}
  if(input.status==='Saved'&&this.paymentMode(basis)==='L/C + TT'&&!input.extras.some(row=>Number(row.tt)>0))throw Error('LC payment mode is L/C + TT. Enter a positive TT amount before saving landed cost.');
  if(input.status==='Saved')input.extras.forEach(row=>{if(Number(row.tt)>0&&!String(row.ttParty||'').trim())throw Error('TT party code is required for '+row.itemCode);if(Number(row.assembly)>0&&!String(row.assemblyParty||'').trim())throw Error('Assembly party code is required for '+row.itemCode)});
  if(!old){const fresh=this.basis(bank.id);if(JSON.stringify(fresh.sourceVersions)!==JSON.stringify(input.sourceVersions))throw Error('Source costs changed. Reselect the manifest before saving.')}
  const result=this.calculate(basis,input.extras),now=new Date().toISOString();
  const record={...input,...result,basis,portReceiptId:basis.portReceiptId,manifestNumber:basis.manifestNumber,lcOpeningId:basis.lcOpeningId,number:old?.number||'LAND-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.number).replace('LAND-',''))||0),0)+1).padStart(6,'0'),id:input.id||crypto.randomUUID(),revision:(revision||0)+1,updatedAt:now,history:old?[...(old.history||[]),{action:'Modified',at:now,before:{header:old.header,extras:old.extras,rows:old.rows},after:{header:input.header,extras:input.extras,rows:result.rows}}]:[]};
  if(index>=0)records[index]=record;else records.push(record);localStorage.setItem(this.key,JSON.stringify(records));return record;
 }
};
