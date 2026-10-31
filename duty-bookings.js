// Government summary payable and stable per-cost bookings, saved with the source duty.
const DutyBookings={
 key:'lc-duty-calculations-v1',landedKey:'lc-landed-costs-v1',
 accountsBookings(){return GLPayables.read(this.key).flatMap(r=>r.costBookings||[])},
 block(record){return record?GLPayables.accountBlock(record,this.key):''},
 cancelReason(key,record){
  if(key===this.key)return this.block(record);
  if(key!==this.landedKey)return '';
  const own=GLPayables.accountBlock(record,key);if(own)return own;
  const dutyId=record.dutyCalculationId||record.basis?.dutyCalculationId;
  if(!dutyId)return '';
  const duty=GLPayables.read(this.key).find(r=>r.id===dutyId);return this.block(duty);
 },
 sync(record,old,records){
  AccountingReversals.prepare(record,old);record.payables=JSON.parse(JSON.stringify(old?.payables||[]));record.costBookings=JSON.parse(JSON.stringify(old?.costBookings||[]));
  if(record.status!=='Saved')return record;
  const amount=Number(record.totalActual);if(!Number.isFinite(amount)||amount<0)throw Error('Enter the complete actual duty total before creating Government bookings.');
  const party=DUTY_PARTIES.find(p=>p.id===record.header.dutyParty);if(!party)throw Error('Select Government Duty before saving.');
  const sums=new Map();record.rows.forEach(row=>Object.entries(row.heads||{}).forEach(([id,head])=>{const actual=Number(head.actual);if(head.actual===null||!Number.isFinite(actual)||actual<0)throw Error('Actual duty cost is incomplete.');sums.set(id,(sums.get(id)||0)+actual)}));
  const round=value=>Math.round((value+Number.EPSILON)*100)/100,heads=DutyStore.heads(record.basis),values=heads.map(head=>({...head,amount:round(sums.get(head.id)||0)})).filter(head=>head.amount>0);
  if(round(values.reduce((sum,h)=>sum+h.amount,0))!==round(amount))throw Error('Duty cost bookings do not reconcile with the actual summary.');
  const previous=record.payables.find(p=>p.sourceType==='duty-calculation'&&p.status!=='Voided'),now=new Date().toISOString(),payableId=previous?.id||'duty-calculation:'+record.id+':government';
  const payable={...previous,id:payableId,bookingNumber:previous?.bookingNumber||'GOV-'+record.number,sourceType:'duty-calculation',sourceId:record.id,sourceNumber:record.number,sourceRowId:'summary',partyCode:party.id,partyName:party.name,headName:'Total duty and customs processing expenses',currency:'BDT',amountBDT:round(amount),paidBDT:0,outstandingBDT:round(amount),status:'Open',createdAt:previous?.createdAt||now,updatedAt:now};
  record.payables=record.payables.filter(p=>p.id!==payableId);record.payables.push(payable);
  let sequence=records.flatMap(r=>r.costBookings||[]).reduce((max,b)=>Math.max(max,Number(String(b.number||'').replace('DBK-',''))||0),0);
  const active=new Set(values.map(head=>head.id));record.costBookings.forEach(b=>{if(!active.has(b.headId)){b.status='Voided';b.voidedAt=now}});
  values.forEach(head=>{let booking=record.costBookings.find(b=>b.headId===head.id);if(!booking){booking={id:record.id+':'+head.id,number:'DBK-'+String(++sequence).padStart(6,'0'),headId:head.id,createdAt:now};record.costBookings.push(booking)}Object.assign(booking,{sourceType:'duty-calculation',sourceId:record.id,sourceNumber:record.number,payableId,partyCode:party.id,partyName:party.name,headName:head.name,amountBDT:head.amount,currency:'BDT',status:'Open',updatedAt:now});delete booking.voidedAt});
  delete payable.postingLines;AccountingReversals.capture(payable,record,values.map(head=>({reference:'duty-calculation:'+head.id,amountBDT:head.amount})));
  record.governmentBookingNumber=payable.bookingNumber;return record;
 },
 cancelled(key,record){if(key===this.key){const now=record.cancelledAt;record.payables=(record.payables||[]).map(p=>({...p,status:'Voided',voidedAt:now}));record.costBookings=(record.costBookings||[]).map(b=>({...b,status:'Voided',voidedAt:now,reversalNumber:record.payables?.find(p=>p.id===b.payableId)?.reversalNumber||''}))}return record}
};
