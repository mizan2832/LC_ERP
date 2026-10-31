// Internal Accounts payable lifecycle. Source + payables are committed atomically.
const GLPayables={
 sources:{'lc-duty-calculations-v1':{type:'duty-calculation',status:'Saved'},'lc-landed-costs-v1':{type:'landed-cost',status:'Saved'},'lc-opening-expenses-v1':{type:'lc-expense',status:'Saved'},'lc-document-releases-v1':{type:'document-release',status:'Released'},'lc-bank-customs-expenses-v1':{type:'bank-customs',status:'Saved'}},
 activityKeys:['lc-accounts-entries-v1','lc-accounts-payments-v1','lc-payments-v1'],
 read(key){const records=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(records))throw Error('Cannot verify Accounts records: '+key);return records},
 active(record){return !['cancelled','canceled','voided','deleted'].includes(String(record.status||'').toLowerCase())},
 accountBlock(record,key,rowId=''){
  const spec=this.sources[key];if(!spec)return '';
  const payables=(record.payables||[]).filter(p=>!rowId||p.sourceRowId===rowId),ids=new Set([...payables.map(p=>p.id),...(record.costBookings||[]).flatMap(b=>[b.id,b.number]),...payables.map(p=>p.bookingNumber)].filter(Boolean));
  if(payables.some(p=>this.active(p)&&(Number(p.paidBDT)>0||Number(p.appliedBDT)>0||['paid','partially paid','partiallypaid','settled','processed'].includes(String(p.status).toLowerCase()))))return 'Accounts has processed this payable. Cancel or reverse the linked Accounts entry before GL Unpost.';
  const matches=entry=>{
   if(!this.active(entry))return false;
   const refs=[entry,...(entry.rows||[]),...(entry.allocations||[]),...(entry.lines||[]),entry.header||{}];
   return refs.some(ref=>ids.has(ref.payableId)||ids.has(ref.accountsPayableId)||ids.has(ref.bookingId)||ids.has(ref.bookingNumber)||((ref.sourceId===record.id||ref.sourceNumber===record.number||ref.sourceReference===record.number)&&(!ref.sourceType||ref.sourceType===spec.type)&&(!rowId||!ref.sourceRowId||ref.sourceRowId===rowId))||[ref.lcExpenseId,ref.documentReleaseId,ref.bankCustomsExpenseId,ref.dutyCalculationId,ref.landedCostId].includes(record.id)&&(!rowId||!ref.sourceRowId||ref.sourceRowId===rowId));
  };
  for(const activityKey of this.activityKeys){const entry=this.read(activityKey).find(matches);if(entry)return 'Accounts entry '+(entry.number||entry.reference||entry.id||'exists')+' is active. Cancel that Accounts entry before GL Unpost.'}
  if((record.accountsEntries||[]).some(matches))return 'An Accounts entry is active. Cancel it before GL Unpost.';
  return '';
 },
 cancelReason(key,record){if(!this.sources[key])return '';if(record.glStatus==='Posted'||record.rows?.some(r=>r.glStatus==='Posted'))return 'Unpost GL before cancelling this entry.';return this.accountBlock(record,key)},
 descriptors(record,key){
  if(key==='lc-document-releases-v1'){
   const amount=Number(record.loanValue||0);if(!(amount>0))return [];
   const lc=LCStore.read().find(r=>r.id===record.lcOpeningId),bank=IMPORT_BANK_ACCOUNTS.find(b=>b.id===lc?.header.bank);
   if(!bank)throw Error('The source LC bank is required before posting document release.');
   return [{rowId:'latr',partyCode:bank.id,partyName:bank.label,headName:'LATR / release financing',amount}];
  }
  return (record.rows||[]).filter(r=>key!=='lc-bank-customs-expenses-v1'||r.glStatus==='Posted').map(r=>({rowId:r.id||r.headKey,partyCode:r.partyCode,partyName:r.partyName||r.partyCode,headName:r.headName,amount:Number(r.amount)}));
 },
 sync(record,key,old){
  const spec=this.sources[key];if(!spec)return record;
  if(record.glStatus==='Posted'&&record.status!==spec.status)throw Error('Complete and save the entry before GL posting; drafts cannot be posted.');
  AccountingReversals.prepare(record,old);record.payables=JSON.parse(JSON.stringify(old?.payables||[]));
  const posted=record.status===spec.status&&(key==='lc-bank-customs-expenses-v1'||record.glStatus==='Posted'),heads=posted?this.descriptors(record,key):[],activeRows=new Set(heads.map(h=>h.rowId));
  record.payables.forEach(p=>{if(p.status==='Open'&&!activeRows.has(p.sourceRowId)){const block=this.accountBlock(old||record,key,p.sourceRowId);if(block)throw Error(block);AccountingReversals.voidPayable(record,p,'GL unposted')}});
  for(const head of heads){head.amount=Math.round((head.amount+Number.EPSILON)*100)/100;if(!Number.isFinite(head.amount)||head.amount<=0||!String(head.partyCode||'').trim())throw Error('A party and positive amount are required to create the Accounts payable for '+head.headName+'.');const prior=record.payables.find(p=>p.sourceRowId===head.rowId&&this.active(p));if(prior){if(prior.amountBDT!==head.amount||prior.partyCode!==head.partyCode)throw Error('Unpost GL before changing a payable.');continue}
   record.payables.push({id:spec.type+':'+record.id+':'+record.revision+':'+head.rowId,sourceType:spec.type,sourceId:record.id,sourceNumber:record.number,sourceRowId:head.rowId,postingRevision:record.revision,partyCode:head.partyCode,partyName:head.partyName,headName:head.headName,currency:'BDT',amountBDT:Math.round(head.amount*100)/100,paidBDT:0,outstandingBDT:Math.round(head.amount*100)/100,status:'Open',createdAt:new Date().toISOString()});
  }
  record.payables.filter(p=>p.status!=='Voided').forEach(p=>AccountingReversals.capture(p,record));
  return record;
 },
 setGL(store,id,revision,status,rowId=''){
  if(!['Posted','Unposted'].includes(status))throw Error('Select Post or Unpost.');const records=store.read(),index=records.findIndex(r=>r.id===id),old=records[index],spec=this.sources[store.key];
  if(!old||old.revision!==revision||old.status!==spec?.status)throw Error('Save and reload the entry before changing GL status.');
  const record=JSON.parse(JSON.stringify(old)),row=rowId?record.rows.find(r=>r.id===rowId):null;
  if(rowId&&!row)throw Error('Costing row no longer exists.');if(status==='Posted'&&rowId&&store.blocked?.(id))throw Error('Cancel downstream entries before posting this costing row.');if((row||record).glStatus===status)throw Error('GL is already '+status.toLowerCase()+'.');
  if(status==='Unposted'){const block=this.accountBlock(old,store.key,rowId);if(block)throw Error(block)}
  if(rowId)row.glStatus=status;else record.glStatus=status;record.revision++;record.updatedAt=new Date().toISOString();record.history=[...(record.history||[]),{action:'GL '+status.toLowerCase(),at:record.updatedAt,...(rowId?{rowId}:{})}];this.sync(record,store.key,old);records[index]=record;localStorage.setItem(store.key,JSON.stringify(records));return record;
 },
 accountsPayable(){return Object.keys(this.sources).flatMap(key=>this.read(key).flatMap(record=>record.payables||[]))}
};
