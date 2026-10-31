// Append-only internal accounting references; real chart-of-accounts mapping is external.
const AccountingReversals={
 clone(value){return JSON.parse(JSON.stringify(value))},
 prepare(record,old){record.accountingReversals=this.clone(old?.accountingReversals||record.accountingReversals||[])},
 capture(payable,record,details=[]){
  if(payable.postingLines?.length)return payable;
  const amount=Number(payable.amountBDT),type=payable.sourceType||'tt-opening',row=payable.sourceRowId||payable.partyCode||'summary';
  payable.postingLines=(details.length?details:[{reference:type+':'+row,amountBDT:amount}]).filter(d=>Number(d.amountBDT)>0).map(d=>({accountRef:'source:'+d.reference,partyCode:'',debitBDT:Number(d.amountBDT),creditBDT:0}));
  payable.postingLines.push({accountRef:'payable:'+payable.partyCode,partyCode:payable.partyCode,debitBDT:0,creditBDT:amount});
  payable.sourceType=type;payable.sourceId=payable.sourceId||record.id;payable.sourceNumber=payable.sourceNumber||record.number;return payable;
 },
 reverse(record,reference,lines,reason,now){
  const reversals=record.accountingReversals||(record.accountingReversals=[]),existing=reversals.find(r=>r.originalReference===reference);if(existing)return existing;
  if(!Array.isArray(lines)||!lines.length)throw Error('Original accounting lines are required before reversal.');
  let debit=0,credit=0;const reversed=lines.map(line=>{const dr=Number(line.debitBDT||0),cr=Number(line.creditBDT||0);if(!Number.isFinite(dr)||!Number.isFinite(cr)||dr<0||cr<0||!line.accountRef)throw Error('Original accounting impact is invalid.');debit+=dr;credit+=cr;return {...line,debitBDT:cr,creditBDT:dr}});
  if(Math.round(debit*100)!==Math.round(credit*100))throw Error('Original accounting impact is not balanced.');
  const reversal={id:'reversal:'+reference,number:'REV-'+record.number+'-'+String(reversals.length+1).padStart(3,'0'),sourceId:record.id,sourceNumber:record.number,originalReference:reference,reason,date:now,currency:'BDT',lines:reversed,totalDebitBDT:Math.round(credit*100)/100,totalCreditBDT:Math.round(debit*100)/100,status:'Recorded'};
  reversals.push(reversal);return reversal;
 },
 voidPayable(record,payable,reason,now=new Date().toISOString()){
  if(['Voided','Cancelled'].includes(payable.status))return;
  if(Number(payable.paidBDT)>0||Number(payable.appliedBDT)>0||['paid','settled','partially paid','partiallypaid','processed'].includes(String(payable.status).toLowerCase()))throw Error('Reverse linked Accounts work before reversing this payable.');
  if(!(Number(payable.amountBDT)>0)){payable.status='Voided';payable.voidedAt=now;payable.outstandingBDT=0;return}
  this.capture(payable,record);const reversal=this.reverse(record,payable.id,payable.postingLines,reason,now);
  payable.status='Voided';payable.voidedAt=now;payable.reversalNumber=reversal.number;payable.reversalId=reversal.id;payable.outstandingBDT=0;
 },
 cancel(record,old){
  this.prepare(record,old);record.payables=this.clone(record.payables||[]);
  record.payables.forEach(p=>this.voidPayable(record,p,'Source cancelled',record.cancelledAt));
  if(record.accountingPostings){record.accountingPostings=this.clone(record.accountingPostings);record.accountingPostings.filter(p=>p.status!=='Reversed'&&p.status!=='Voided').forEach(p=>{const reversal=this.reverse(record,p.id,p.lines,'Source cancelled',record.cancelledAt);p.status='Reversed';p.reversalNumber=reversal.number})}
  return record;
 }
};
