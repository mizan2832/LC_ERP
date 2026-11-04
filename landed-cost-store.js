const LandedStore={
 key:'lc-landed-costs-v1',
 read(){const rows=JSON.parse(localStorage.getItem(this.key)||'[]');if(!Array.isArray(rows))throw Error('Invalid landed cost storage.');return rows},
 isCashMargin(cost){const key=String(cost.headKey||cost.key||'').replace(/^head:/,'').split('|')[0];return StandardCostMath.isMargin({id:cost.id,key,name:cost.headName||cost.name||''})},
 round(n){return Math.round((n+Number.EPSILON)*100)/100},
 includesStandardTT(setup){const type=String(setup?.fields?.lcType||'').trim().toUpperCase();return type?type!=='TT':setup?.calculation?.ttIncluded!==false},
 standardTTAmount(row){return this.includesStandardTT(row.standardSnapshot)?Number(row.standardTT||0):0},
 standardTTParty(basis){
  const relevant=basis.rows.filter(row=>this.includesStandardTT(row.standardSnapshot)&&Number(row.standardSnapshot?.fields?.tt)>0);
  if(!relevant.length||relevant.some(row=>!String(row.standardSnapshot?.fields?.ttParty||'').trim()))return '';
  const parties=[...new Set(relevant.map(row=>String(row.standardSnapshot.fields.ttParty).trim()))];return parties.length===1?parties[0]:'';
 },
 paymentMode(basis){return basis.paymentMode||LCStore.read().find(r=>r.id===basis.lcOpeningId)?.header.pay||''},
 blocked(id){const record=this.read().find(r=>r.id===id),accounts=record?DutyBookings.cancelReason(this.key,record):'';if(accounts)return accounts;return Rollback.active('lc-finished-goods-receipts-v1',r=>r.landedCostId===id)?'Finished goods receive entry exists.':''},
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
   if(Number(setup.fields.freight)>0)add('freight','Freight (legacy input)','Duty valuation input',Number(dutyRow.freight)*Number(bank.basis.rate)*qty,Number(setup.fields.freight)*Number(setup.fields.fx)*factor*qty);
   (setup.costs||[]).filter(c=>c.included&&!/assembl/i.test(c.name)&&!StandardCostMath.isMargin(c)).forEach(cost=>{
    const amount=Number(setup.calculation?.amounts?.[cost.id]??(cost.method==='fixed'?cost.value:NaN));
    if(!Number.isFinite(amount))throw Error(row.itemCode+': calculated standard missing for '+cost.name);
    if(amount>0)add('head:'+ExpenseStore.headKey(cost),cost.name,'Standard setup',0,amount*qty*StandardCostMath.factor(setup,row));
   });
   const assembly=0;
   return {...row,qty,stockQty,standardFactor:factor,costs,standardTT:this.includesStandardTT(setup)?this.round(Number(setup.fields.tt||0)*Number(setup.fields.ttfx||0)*factor*qty):0,standardAssembly:this.round(assembly)};
  });
  const addActual=(sku,uom,key,name,source,amount,party='')=>{
   if(this.isCashMargin({key,name}))return;
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
  duty.rows.forEach(line=>DutyStore.heads(duty.basis).forEach(head=>{
   const item=rows.find(r=>r.itemCode===line.itemCode&&r.uom===line.uom),cost=DutyStore.costForHead(item?.standardSnapshot,head);
   const amount=line.heads[head.id]?.actual??(head.processing?0:null);if(amount===null||amount===undefined)throw Error('Actual duty missing for '+line.itemCode+' '+head.name);
   addActual(line.itemCode,line.uom,cost?'head:'+ExpenseStore.headKey(cost):'duty:'+head.id,head.name,duty.number,Number(amount),duty.header.dutyParty||'');
  }));
  bank.allocation.lines.forEach(line=>line.allocations.forEach(head=>{const source=bank.rows.find(r=>r.headKey===head.headKey);addActual(line.itemCode,line.uom,'head:'+head.headKey,head.headName,bank.number,Number(head.amount),source?.partyCode||'')}));
  // Assembly is entered here; reserve its standard only once, even if a prior bill exists.
  rows.forEach(row=>{
   let priorAssembly=false;row.costs.forEach(cost=>{if(/assembl/i.test(cost.name)){if(cost.actual>0)priorAssembly=true;else{row.standardAssembly=this.round(row.standardAssembly);cost.standard=0}}});
   if(priorAssembly)row.standardAssembly=0;
   row.costs=row.costs.filter(c=>c.actual!==0||c.standard!==0);
  });
  const sourceLC=LCStore.read().find(r=>r.id===bank.lcOpeningId),linkedTT=sourceLC?.ttSnapshot?LCTTCosting.manifest(sourceLC,receipt,PortStore.read()):null;
  if(linkedTT)rows.forEach(row=>{const allocation=linkedTT.rows.find(r=>r.key===row.itemCode+'|'+row.uom);(allocation?.parties||[]).forEach(p=>row.costs.push({key:'linked-tt:'+p.partyCode,name:'TT amount - '+p.partyName,source:linkedTT.reference,actual:p.amountBDT,standard:p.amountBDT,partyCode:p.partyCode}));row.standardTT=0});
  return {...JSON.parse(JSON.stringify(bank.basis)),linkedTT,paymentMode:LCStore.read().find(r=>r.id===bank.lcOpeningId)?.header.pay||'',bankCustomsExpenseId:bank.id,bankNumber:bank.number,dutyCalculationId:duty.id,dutyNumber:duty.number,sourceDate:bank.header.costDate,rows,sourceVersions:{bank:bank.revision,duty:duty.revision,openingExpenses:expenses.map(e=>({id:e.id,revision:e.revision}))}};
 },
 allocateTT(basis,extras,ttInput){if(ttInput.total===''||ttInput.total===null||!Number.isFinite(Number(ttInput.total))||Number(ttInput.total)<0)throw Error('Enter a non-negative total TT amount.');const allocation=CostAllocation.calculate(basis.rows,[{headKey:'extra:tt',headName:'TT amount',amount:Number(ttInput.total)}]);return extras.map(extra=>{const line=allocation.lines.find(r=>r.itemCode===extra.itemCode&&r.uom===extra.uom);if(!line)throw Error('TT allocation item missing.');return {...extra,tt:line.allocatedExpense,ttParty:String(ttInput.party||'').trim()}})},
 financingRows(basis){
  const rows=JSON.parse(JSON.stringify(basis.rows));
  if(basis.margin===undefined||basis.margin===null||basis.margin===''||basis.loanType==='LATR'&&(basis.loanValue===undefined||basis.loanValue===null||basis.loanValue===''))throw Error('Manifest margin or LATR is missing from the saved document release. Complete the source release first.');
  const margin=Number(basis.margin),latr=basis.loanType==='LATR'?Number(basis.loanValue):0;
  if(!Number.isFinite(margin)||margin<0||!Number.isFinite(latr)||latr<0)throw Error('The saved document release must contain valid manifest margin and LATR amounts.');
  const heads=[{headKey:'funding:margin',headName:'Manifest margin',amount:margin},{headKey:'funding:latr',headName:'Manifest LATR',amount:latr}];
  const allocation=CostAllocation.calculate(rows,heads);
  rows.forEach((row,i)=>{
   const purchase=row.costs.filter(c=>c.key==='fob'),standard=purchase.reduce((sum,c)=>sum+Number(c.standard||0),0);
   const setup=row.standardSnapshot,marginUnit=Number(setup?.calculation?.cashMargin??(setup?StandardCostMath.calculate(setup).cashMargin:0));
   if(!Number.isFinite(marginUnit)||marginUnit<0)throw Error(row.itemCode+': saved standard LC margin is invalid.');
   const standardMargin=this.round(marginUnit*Number(row.qty)*StandardCostMath.factor(setup,row));
   const standardLATR=this.round(standard-standardMargin);
   if(standardLATR<0)throw Error(row.itemCode+': standard LC margin exceeds the manifest PI value. Check the saved standard setup.');
   row.costs=row.costs.filter(c=>c.key!=='fob'&&!String(c.key).startsWith('funding:'));
   allocation.lines[i].allocations.forEach((part,j)=>row.costs.splice(j,0,{key:part.headKey,name:part.headName,source:basis.releaseNumber||'Document release',actual:part.amount,standard:part.headKey==='funding:margin'?standardMargin:standardLATR,partyCode:''}));
  });return rows;
 },
 calculate(basis,extras,ttInput=null){
  if(basis.linkedTT){extras=extras.map(r=>({...r,tt:0,ttParty:''}));ttInput=null}
  if(ttInput)extras=this.allocateTT(basis,extras,ttInput);
  if(extras.length!==basis.rows.length)throw Error('Enter TT and assembly values for each manifest SKU.');const seen=new Set();
  const rows=this.financingRows(basis).map(item=>{
   const key=item.itemCode+'|'+item.uom,input=extras.find(r=>r.itemCode===item.itemCode&&r.uom===item.uom);if(!input||seen.has(key))throw Error('Invalid additional-cost SKU.');seen.add(key);
   const values={};for(const name of ['tt','assembly']){const value=Number(input[name]);if(input[name]===''||!Number.isFinite(value)||value<0)throw Error('Enter non-negative '+name+' amount for '+item.itemCode);values[name]=value}
   const costs=[...JSON.parse(JSON.stringify(item.costs.filter(cost=>!this.isCashMargin(cost)))),...(!basis.linkedTT&&(values.tt>0||this.standardTTAmount(item)>0)?[{key:'extra:tt',name:'TT amount',source:'Landed cost entry',actual:values.tt,standard:this.standardTTAmount(item),partyCode:String(input.ttParty||'').trim()}]:[]),{key:'extra:assembly',name:'Assembly cost',source:'Landed cost entry',actual:values.assembly,standard:item.standardAssembly,partyCode:String(input.assemblyParty||'').trim()}].map(c=>({...c,actual:this.round(c.actual),standard:this.round(c.standard),variance:this.round(c.actual-c.standard)}));
   const totalActual=this.round(costs.reduce((s,c)=>s+c.actual,0)),totalStandard=this.round(costs.reduce((s,c)=>s+c.standard,0));
   return {...item,standardTT:this.standardTTAmount(item),costs,totalActual,totalStandard,variance:this.round(totalActual-totalStandard),actualPerUnit:totalActual/item.qty,standardPerUnit:totalStandard/item.qty,actualPerStockUnit:totalActual/item.stockQty,standardPerStockUnit:totalStandard/item.stockQty};
  });
  return {rows,marginIncludedInLandedCost:true,purchaseValuationBasis:'manifest-margin-plus-latr',totalActual:this.round(rows.reduce((s,r)=>s+r.totalActual,0)),totalStandard:this.round(rows.reduce((s,r)=>s+r.totalStandard,0)),totalVariance:this.round(rows.reduce((s,r)=>s+r.variance,0))};
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
  if(!old){if(input.status==='Saved'&&['TT','L/C + TT'].includes(this.paymentMode(basis))&&!basis.linkedTT)throw Error('The source LC must have a linked TT Opening before saving landed cost. Correct the source LC first.');if(Number(input.ttInput?.total)>0||input.extras.some(r=>Number(r.tt)>0))throw Error('TT amounts and parties must come from the TT Opening linked to the LC.');input={...input,ttInput:null,extras:input.extras.map(r=>({...r,tt:0,ttParty:''}))};}
  if(old&&!basis.linkedTT){const prior=old.ttInput||null,next=input.ttInput||null;if(Boolean(prior)!==Boolean(next)||prior&&(Number(prior.total)!==Number(next.total)||String(prior.party||'')!==String(next.party||''))||input.extras.some(row=>{const saved=old.extras.find(r=>r.itemCode===row.itemCode&&r.uom===row.uom);return saved&&(Number(row.tt||0)!==Number(saved.tt||0)||String(row.ttParty||'')!==String(saved.ttParty||''))}))throw Error('Historical TT amounts and parties are fixed. Use the linked TT source for new landed costs.');}
  if(basis.linkedTT)input={...input,ttInput:null,extras:input.extras.map(r=>({...r,tt:0,ttParty:''}))};
  if(input.ttInput){input={...input,extras:this.allocateTT(basis,input.extras,input.ttInput),ttInput:{total:this.round(Number(input.ttInput.total)),party:String(input.ttInput.party||'').trim(),method:'Invoice value weighted'}}}
  if(input.status==='Saved'&&!basis.linkedTT&&this.paymentMode(basis)==='L/C + TT'&&!input.extras.some(row=>Number(row.tt)>0))throw Error('LC payment mode is L/C + TT. A linked TT cost is required before saving landed cost.');
  input.extras.forEach(row=>{if(Number(row.tt)>0&&!String(row.ttParty||'').trim())throw Error('Select a TT party for '+row.itemCode+'.')});
  if(input.status==='Saved')input.extras.forEach(row=>{if(Number(row.tt)>0&&!String(row.ttParty||'').trim())throw Error('TT party code is required for '+row.itemCode);if(Number(row.assembly)>0&&!String(row.assemblyParty||'').trim())throw Error('Assembly party code is required for '+row.itemCode)});
  if(!old){const fresh=this.basis(bank.id);if(JSON.stringify(fresh.sourceVersions)!==JSON.stringify(input.sourceVersions))throw Error('Source costs changed. Reselect the manifest before saving.')}
  const result=this.calculate(basis,input.extras),now=new Date().toISOString();
  const record={...input,...result,basis,portReceiptId:basis.portReceiptId,manifestNumber:basis.manifestNumber,lcOpeningId:basis.lcOpeningId,number:old?.number||'LAND-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.number).replace('LAND-',''))||0),0)+1).padStart(6,'0'),id:input.id||crypto.randomUUID(),revision:(revision||0)+1,updatedAt:now,history:old?[...(old.history||[]),{action:'Modified',at:now,before:{header:old.header,extras:old.extras,rows:old.rows},after:{header:input.header,extras:input.extras,rows:result.rows}}]:[]};
  if(index>=0)records[index]=record;else records.push(record);localStorage.setItem(this.key,JSON.stringify(records));return record;
 }
};

// The merged actual CKD report belongs to the entry that completes the last
// manifest. Earlier manifest entries retain only their individual valuation.
(()=>{
 const baseSave=LandedStore.save;
 LandedStore.ckdActualMerge=function(trigger,records=this.read()){
  if(trigger.status!=='Saved')return null;
  const lcRecords=LCStore.read(),group=LCStore.mergeGroups(lcRecords).find(candidate=>candidate.memberIds.has(trigger.lcOpeningId));
  if(!group)return null;
  const members=group.members,receipts=PortStore.read().filter(r=>r.status==='Received'&&group.memberIds.has(r.lcOpeningId));
  const received=new Map();receipts.forEach(receipt=>receipt.rows.forEach(row=>{const key=receipt.lcOpeningId+'|'+row.sourceKey;received.set(key,(received.get(key)||0)+Number(row.qty||0))}));
  for(const lc of members){for(let index=0;index<(lc.rows||[]).length;index++){const line=lc.rows[index],key=lc.id+'|'+line.piId+':'+index;if(Math.abs((received.get(key)||0)-Number(line.qty||0))>0.000001)return null}}
  const savedByReceipt=new Map(records.filter(r=>r.status==='Saved').map(r=>[r.portReceiptId,r]));
  if(receipts.some(receipt=>!savedByReceipt.has(receipt.id)))return null;
  const buckets=new Map();receipts.forEach(receipt=>{
   const lc=members.find(member=>member.id===receipt.lcOpeningId),component=LCStore.lcClassification(lc).componentType,landed=savedByReceipt.get(receipt.id);
   if(!['KIT','CABIN'].includes(component))return;
   const valuedRows=landed.basis&&Array.isArray(landed.extras)?this.calculate(landed.basis,landed.extras,landed.ttInput||null).rows:landed.rows;
   valuedRows.forEach(row=>{const key=String(row.itemCode||'').toUpperCase(),entry=buckets.get(key)||{itemCode:key,itemName:row.itemName||key,KIT:{qty:0,actual:0,standard:0,heads:new Map(),manifests:[]},CABIN:{qty:0,actual:0,standard:0,heads:new Map(),manifests:[]}};const part=entry[component],assembly=Number(row.costs.find(cost=>cost.key==='extra:assembly')?.actual||0);part.qty+=Number(row.qty||0);part.actual+=Number(row.totalActual||0);part.standard+=Number(row.totalStandard||0);part.manifests.push({lcNumber:lc.number,manifestNumber:receipt.header?.manifest||receipt.number,landedNumber:landed.number,quantity:Number(row.qty||0),actual:Number(row.totalActual||0),assembly});row.costs.forEach(cost=>{const id=String(cost.key||cost.name),head=part.heads.get(id)||{key:id,name:cost.name,actual:0,standard:0};head.actual+=Number(cost.actual||0);head.standard+=Number(cost.standard||0);part.heads.set(id,head)});buckets.set(key,entry)})
  });
  if(!buckets.size||[...buckets.values()].some(entry=>!entry.KIT.qty||!entry.CABIN.qty||Math.abs(entry.KIT.qty-entry.CABIN.qty)>0.000001))return null;
  const items=[...buckets.values()].map(entry=>{
   const quantity=entry.KIT.qty,ids=new Set([...entry.KIT.heads.keys(),...entry.CABIN.heads.keys()]);
   const heads=[...ids].map(id=>{const kit=entry.KIT.heads.get(id),cabin=entry.CABIN.heads.get(id),kitActual=Number(kit?.actual||0),cabinActual=Number(cabin?.actual||0),kitPerUnit=kitActual/quantity,cabinPerUnit=cabinActual/quantity,kitStandard=Number(kit?.standard||0)/quantity,cabinStandard=Number(cabin?.standard||0)/quantity;return {key:id,name:kit?.name||cabin?.name||id,kitActual,cabinActual,kitPerUnit,cabinPerUnit,actualPerVehicle:kitPerUnit+cabinPerUnit,standardPerVehicle:kitStandard+cabinStandard,actualTotal:kitActual+cabinActual,standardTotal:Number(kit?.standard||0)+Number(cabin?.standard||0)}});
   return {itemCode:entry.itemCode,itemName:entry.itemName,quantity,kitActual:entry.KIT.actual,cabinActual:entry.CABIN.actual,kitManifests:entry.KIT.manifests,cabinManifests:entry.CABIN.manifests,actualPerVehicle:(entry.KIT.actual+entry.CABIN.actual)/quantity,standardPerVehicle:(entry.KIT.standard+entry.CABIN.standard)/quantity,actualTotal:entry.KIT.actual+entry.CABIN.actual,standardTotal:entry.KIT.standard+entry.CABIN.standard,heads};
  });
  return {reference:group.reference,triggerLandedId:trigger.id,sourceLandedIds:receipts.map(r=>savedByReceipt.get(r.id).id),memberLCs:members.map(lc=>({id:lc.id,number:lc.number,componentType:LCStore.lcClassification(lc).componentType})),manifestNumbers:receipts.map(r=>r.header?.manifest||r.number),items,totalActual:items.reduce((sum,item)=>sum+item.actualTotal,0),totalStandard:items.reduce((sum,item)=>sum+item.standardTotal,0),generatedAt:new Date().toISOString()};
 };
 LandedStore.save=function(input,revision){const saved=baseSave.call(this,input,revision);if(saved.status!=='Saved')return saved;const records=this.read(),report=this.ckdActualMerge(saved,records);if(!report)return saved;const index=records.findIndex(r=>r.id===saved.id);records[index]={...saved,ckdActualMerge:report};localStorage.setItem(this.key,JSON.stringify(records));return records[index]};
 const baseBlocked=LandedStore.blocked;
 LandedStore.blocked=function(id){const reason=baseBlocked.call(this,id);if(reason)return reason;const final=this.read().find(record=>record.status==='Saved'&&record.id!==id&&record.ckdActualMerge?.sourceLandedIds?.includes(id));return final?'CKD merged actual cost exists on '+final.number+'. Cancel that final merged entry first.':''};
})();
