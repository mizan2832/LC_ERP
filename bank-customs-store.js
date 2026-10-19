const BANK_CUSTOMS_GROUPS={port:'Port & shipping expenses',cf:'C&F expenses',local:'Transport, testing & retirement'};
const BankCustomsStore={
 key:'lc-bank-customs-expenses-v1',
 read(){const records=JSON.parse(localStorage.getItem(this.key)||'[]');if(!Array.isArray(records))throw Error('Invalid bank/customs expense storage.');return records},
 round(n){return Math.round((n+Number.EPSILON)*100)/100},
 blocked(id){if(Rollback.active('lc-landed-costs-v1',r=>r.bankCustomsExpenseId===id))return 'Landed cost entry exists.';return Rollback.active('lc-finished-goods-receipts-v1',r=>r.bankCustomsExpenseId===id)?'Finished goods receive entry exists.':''},
 basis(dutyId){
  const duty=DutyStore.read().find(r=>r.id===dutyId&&r.status==='Saved');if(!duty)throw Error('Select a manifest with a saved duty calculation.');
  const release=ReleaseStore.read().find(r=>r.id===duty.documentReleaseId&&r.status==='Released');if(!release)throw Error('Active document release not found.');
  const receipt=PortStore.read().find(r=>r.id===duty.portReceiptId&&r.status==='Received');if(!receipt)throw Error('Received manifest not found.');
  const rows=duty.basis.rows.map(row=>({...JSON.parse(JSON.stringify(row)),qty:Number(row.qty),amountFC:Number(row.valueFC),amountLC:Number(row.valueFC)*Number(release.header.rate),convertedQty:Number(row.qty)*Number(row.factor||1)}));
  return {dutyCalculationId:duty.id,dutyNumber:duty.number,documentReleaseId:release.id,releaseNumber:release.number,portReceiptId:receipt.id,lcOpeningId:duty.lcOpeningId,manifestNumber:duty.manifestNumber,manifestDate:receipt.header.manifestDate,lcNumber:duty.basis.lcNumber,lcDate:duty.basis.lcDate,party:duty.basis.party,currency:release.basis.currency,rate:Number(release.header.rate),piInfo:duty.basis.piInfo,customInvoice:receipt.header.customInvoice||'',commercialInvoice:receipt.header.commercialInvoice||'',policy:release.header.policy||'',nocDate:release.header.nocDate||'',loanType:release.header.loanType,loanNumber:release.header.loanNumber||'',margin:release.margin,loanValue:release.loanValue,cashMargin:release.cashMargin??release.basis.totalCashMargin,remainingCashMargin:release.remainingCashMargin,documentType:release.header.documentType,releaseDate:release.header.releaseDate,dutyDate:duty.header.costDate,rows};
 },
 heads(basis){
  const found=new Map();
  basis.rows.forEach(row=>{const setup=row.standardSnapshot;(setup?.costs||[]).filter(c=>BANK_CUSTOMS_GROUPS[c.key]&&c.included).forEach(cost=>{
   const amount=Number(setup.calculation?.amounts?.[cost.id]??(cost.method==='fixed'?cost.value:NaN));
   if(Number.isFinite(amount)&&amount>0)found.set(ExpenseStore.headKey(cost),{headKey:ExpenseStore.headKey(cost),name:cost.name,group:cost.key});
  })});return [...found.values()].sort((a,b)=>a.group.localeCompare(b.group)||a.name.localeCompare(b.name));
 },
 checks(basis,headKey){
  const normalize=u=>PriceUnits.normalize(u);
  return basis.rows.map(row=>{
   const setup=row.standardSnapshot,cost=setup?.costs?.find(c=>BANK_CUSTOMS_GROUPS[c.key]&&c.included&&ExpenseStore.headKey(c)===headKey);
   const amount=cost?Number(setup.calculation?.amounts?.[cost.id]??(cost.method==='fixed'?cost.value:NaN)):NaN;
   // BDT expense standards are per order unit; only FOB pricing converts LTR/KG.
   const factor=1;
   const valid=Number.isFinite(amount)&&amount>0&&Number.isFinite(factor)&&factor>0&&Number.isFinite(Number(row.qty))&&Number(row.qty)>0;
   return {sku:row.itemCode,qty:row.qty,uom:row.uom,setupNumber:setup?.setupNumber,valid,unitStandard:valid?amount:null,standardQty:valid?Number(row.qty)*factor:null,standardUom:normalize(row.uom),standard:valid?amount*factor:null,total:valid?this.round(amount*factor*row.qty):null,message:valid?'':row.itemCode+': no positive saved standard for this cost head or unit mapping is missing.'};
  });
 },
 standardTotal(basis,headKey){const checks=this.checks(basis,headKey);if(checks.some(c=>!c.valid))throw Error(checks.filter(c=>!c.valid).map(c=>c.message).join(' '));return this.round(checks.reduce((sum,c)=>sum+c.total,0))},
 calculate(basis,rows){
  const calculated=rows.map(row=>{const standard=this.standardTotal(basis,row.headKey),amount=Number(row.amount);if(row.amount===''||!Number.isFinite(amount)||amount<0)throw Error('Enter a non-negative actual cost.');return {...row,amount,standardTotal:standard,variance:this.round(amount-standard)}});
  return {rows:calculated,total:this.round(calculated.reduce((s,r)=>s+r.amount,0)),totalStandard:this.round(calculated.reduce((s,r)=>s+r.standardTotal,0)),totalVariance:this.round(calculated.reduce((s,r)=>s+r.variance,0)),allocation:CostAllocation.calculate(basis.rows,calculated)};
 },
 save(input,revision){
  const records=this.read(),index=records.findIndex(r=>r.id===input.id),old=records[index];
  if(old&&(old.revision!==revision||old.status==='Cancelled'||this.blocked(old.id)))throw Error('Entry changed or is locked. Reload it.');
  if(old&&old.dutyCalculationId!==input.dutyCalculationId)throw Error('Cannot change manifest on a saved entry.');
  if(!['Draft','Saved'].includes(input.status))throw Error('Invalid expense status.');
  if(old?.status==='Saved'&&input.status==='Draft')throw Error('A saved entry cannot be changed back to draft.');
  const duty=DutyStore.read().find(d=>d.id===input.dutyCalculationId&&d.status==='Saved');if(!duty)throw Error('Select a saved manifest duty calculation.');
  if(records.some(r=>r.id!==input.id&&r.portReceiptId===duty.portReceiptId&&r.status!=='Cancelled'))throw Error('An expense entry already exists for this manifest.');
  const basis=old?.basis||this.basis(duty.id),date=input.header.costDate;
  if(old?.rows.some(row=>row.glStatus==='Posted')&&date!==old.header.costDate)throw Error('Cost date cannot change after a costing row is posted.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<basis.dutyDate)throw Error('Enter a valid cost date on or after the duty calculation date.');
  if(!input.rows.length)throw Error('Add at least one costing row.');
  const seen=new Set(),heads=this.heads(basis);
  const rows=input.rows.map(row=>{
   if(!row.headKey||seen.has(row.headKey))throw Error('Select a unique cost head for each row.');seen.add(row.headKey);
   const head=heads.find(h=>h.headKey===row.headKey);if(!head)throw Error('Only positive Port, C&F and Transport standard cost heads are allowed.');
   if(!String(row.partyCode||'').trim())throw Error('Party code is mandatory for '+head.name+'.');
   const previous=old?.rows.find(r=>r.id===row.id);
   if(previous?.glStatus==='Posted'){
    if(previous.headKey!==row.headKey||Number(previous.amount)!==Number(row.amount)||previous.partyCode!==row.partyCode||previous.partyName!==row.partyName)throw Error('Posted costing rows cannot be changed.');
    return JSON.parse(JSON.stringify(previous));
   }
   if(input.status==='Saved'&&!(Number(row.amount)>0))throw Error('Enter a positive actual amount for '+head.name+'.');
   const party=ExpenseParties.resolve({...row,headName:head.name},previous,{required:true});
   return {...row,...party,id:previous?.id||row.id||crypto.randomUUID(),headName:head.name,group:head.group,glStatus:'Unposted'};
  });
  if(old?.rows.some(row=>row.glStatus==='Posted'&&!rows.some(r=>r.id===row.id)))throw Error('Posted rows cannot be removed.');
  const result=this.calculate(basis,rows),now=new Date().toISOString();
  const record={...input,...result,basis,portReceiptId:basis.portReceiptId,documentReleaseId:basis.documentReleaseId,lcOpeningId:basis.lcOpeningId,manifestNumber:basis.manifestNumber,currency:'BDT',number:old?.number||'BCE-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.number).replace('BCE-',''))||0),0)+1).padStart(6,'0'),id:input.id||crypto.randomUUID(),revision:(revision||0)+1,updatedAt:now,history:old?[...(old.history||[]),{action:'Modified',at:now,before:{header:old.header,rows:old.rows},after:{header:input.header,rows:result.rows}}]:[]};
  if(index>=0)records[index]=record;else records.push(record);localStorage.setItem(this.key,JSON.stringify(records));return record;
 },
 post(id,rowId,revision){
  const records=this.read(),index=records.findIndex(r=>r.id===id),record=records[index];
  if(!record||record.revision!==revision||record.status!=='Saved'||this.blocked(id))throw Error('Save and reload an unlocked expense entry before posting.');
  const row=record.rows.find(r=>r.id===rowId);if(!row||row.glStatus==='Posted')throw Error('This row is missing or already posted.');
  if(!String(row.partyCode||'').trim()||!(Number(row.amount)>0))throw Error('Party code and positive amount are required before posting.');
  const now=new Date().toISOString();row.glStatus='Posted';row.postedAt=now;row.postedBy='DEMO-001 · Rahim Ahmed';record.revision++;record.updatedAt=now;record.history=[...(record.history||[]),{action:'GL row posted',at:now,rowId,headKey:row.headKey,amount:row.amount,partyCode:row.partyCode,user:row.postedBy}];
  localStorage.setItem(this.key,JSON.stringify(records));return record;
 },
 cancelBlock(id){const record=this.read().find(r=>r.id===id);return record?.rows.some(r=>r.glStatus==='Posted')?'Posted costing rows exist.':this.blocked(id)}
};
