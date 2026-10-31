const TTOpeningStore={
 key:'lc-tt-openings-v1',
 parties:TT_PARTIES,
 banks:IMPORT_BANK_ACCOUNTS,
 read(){const a=JSON.parse(localStorage.getItem(this.key)||'[]');if(!Array.isArray(a))throw Error('Invalid TT opening storage.');return a},
 links(record){
 const read=key=>{const a=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(a))throw Error('Invalid linked record storage.');return a};
 const matches=r=>[r.ttOpeningId,r.ttReference,r.header?.ttOpeningId,r.header?.ttReference,...(r.ttOpeningIds||[]),...(r.header?.ttOpeningIds||[]),...(r.ttReferences||[]),...(r.ttAllocations||[]).map(a=>a.ttOpeningId)].some(v=>v===record.id||v===record.number);
 const payments=read('lc-tt-payments-v1').filter(r=>matches(r)&&['Paid','Completed','Posted'].includes(r.status)&&Number(r.amountBDT??r.amount)>0);
 const lcs=read('lc-opening-entries-v1').filter(r=>matches(r)&&r.status==='Opened');
 return {paymentDone:payments.length>0||(record.payables||[]).some(p=>Number(p.paidBDT)>0||p.status==='Paid'),lcOpened:lcs.length>0,payments,lcs};
 },
 blocked(record){const l=this.links(record);return [record.status==='Cancelled'?'TT opening is cancelled.':'',l.paymentDone?'Payment has been made against this TT reference.':'',l.lcOpened?'An LC opening exists against this TT reference.':''].filter(Boolean).join(' ')},
 cancel(id,revision){const records=this.read(),i=records.findIndex(r=>r.id===id),old=records[i];if(!old||old.revision!==revision)throw Error('TT opening changed. Reload it.');const blocked=this.blocked(old);if(blocked)throw Error(blocked);if(old.glStatus==='Posted')throw Error('Unpost GL before cancelling.');const now=new Date().toISOString(),record={...old,status:'Cancelled',revision:old.revision+1,updatedAt:now,history:[...old.history,{action:'Cancelled',at:now}]};records[i]=record;localStorage.setItem(this.key,JSON.stringify(records));return record},
 payableEntries(record,status,now){
 const entries=(record.payables||[]).map(p=>({...p}));
 if(status==='Unposted')return entries.map(p=>p.status==='Open'?{...p,status:'Voided',voidedAt:now}:p);
 if(entries.some(p=>p.status==='Open'))throw Error('An open payable already exists for this TT posting.');
 return [...entries,...record.rows.map(row=>({id:record.id+':'+record.revision+':'+row.partyCode,ttOpeningId:record.id,ttReference:record.number,postingRevision:record.revision,partyCode:row.partyCode,partyName:row.partyName,currency:record.currency,amount:row.amount,rate:record.rate,amountBDT:row.amountBDT,paidBDT:0,outstandingBDT:row.amountBDT,status:'Open',createdAt:now}))];
 },
 accountsPayable(){return this.read().flatMap(r=>r.payables||[])},
 round(n){return Math.round((n+Number.EPSILON)*100)/100},
 save(input,revision){const records=this.read(),i=records.findIndex(r=>r.id===input.id),old=records[i];if(old&&(old.revision!==revision||old.glStatus==='Posted'))throw Error('TT opening is posted or changed. Unpost or reload before editing.');
 if(old){const blocked=this.blocked(old);if(blocked)throw Error(blocked);}
 const glStatus=input.glStatus??'Unposted';if(!['Posted','Unposted'].includes(glStatus))throw Error('Select a valid GL status.');
 if(!['TT','LC+TT'].includes(input.type))throw Error('Select TT or LC + TT.');
 const brand=String(input.brand??old?.brand??'').trim();if(brand&&!Object.hasOwn(BRAND_CATEGORIES,brand))throw Error('Select a valid brand.');
 const bankTTNumber=input.type==='TT'?String(input.bankTTNumber||'').trim():'';if(input.type==='TT'&&!bankTTNumber)throw Error('Enter the bank-provided TT number.');
 const bank=input.type==='TT'?this.banks.find(b=>b.id===input.bank):null;if(input.type==='TT'&&!bank)throw Error('Select the bank name and account for TT.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date+'T00:00:00Z'))||new Date(input.date+'T00:00:00Z').toISOString().slice(0,10)!==input.date)throw Error('Enter a valid TT date.');
 if(!['USD','BDT','EUR','CNY'].includes(input.currency))throw Error('Select currency.');const rate=Number(input.rate);if(!Number.isFinite(rate)||rate<=0||input.currency==='BDT'&&rate!==1)throw Error('Enter a positive exchange rate; use 1 for BDT.');
 if(!Array.isArray(input.rows)||!input.rows.length)throw Error('Add at least one TT party.');const seen=new Set();const rows=input.rows.map(row=>{const party=this.parties.find(p=>p.code===row.partyCode);if(!party)throw Error('Select a TT party for every row.');if(seen.has(party.code))throw Error('Use one row per TT party.');seen.add(party.code);const amount=Number(row.amount);if(!Number.isFinite(amount)||amount<=0)throw Error('Enter a positive TT amount for every party.');const rounded=this.round(amount);if(!rounded)throw Error('TT amount must be at least 0.01.');return {partyCode:party.code,partyName:party.name,amount:rounded,amountBDT:this.round(rounded*rate)}});
 const now=new Date().toISOString(),record={id:old?.id||crypto.randomUUID(),number:old?.number||'TT-'+String(records.reduce((m,r)=>Math.max(m,Number(r.number.replace('TT-',''))||0),0)+1).padStart(6,'0'),status:'Saved',type:input.type,brand,bankTTNumber,bank:bank?.id||'',bankLabel:bank?.label||'',date:input.date,currency:input.currency,rate,remarks:String(input.remarks||'').trim(),rows,total:this.round(rows.reduce((s,r)=>s+r.amount,0)),totalBDT:this.round(rows.reduce((s,r)=>s+r.amountBDT,0)),glStatus,payables:old?.payables||[],revision:(old?.revision||0)+1,updatedAt:now,history:[...(old?.history||[]),{action:old?'Modified':'Created',at:now},...(glStatus==='Posted'?[{action:'GL posted; accounts payable created',at:now}]:[])]};record.payables=this.payableEntries(record,glStatus,now);if(i<0)records.push(record);else records[i]=record;localStorage.setItem(this.key,JSON.stringify(records));return record},
 setGL(id,revision,status){if(!['Posted','Unposted'].includes(status))throw Error('Invalid GL status.');const records=this.read(),i=records.findIndex(r=>r.id===id),old=records[i];if(!old||old.revision!==revision)throw Error('TT opening changed. Reload it.');const blocked=this.blocked(old);if(blocked)throw Error(blocked);if(old.glStatus===status)throw Error('TT opening is already '+status.toLowerCase()+'.');const now=new Date().toISOString(),record={...old,glStatus:status,revision:old.revision+1,updatedAt:now,history:[...old.history,{action:status==='Posted'?'GL posted':'GL unposted',at:now}]};record.payables=this.payableEntries(record,status,now);records[i]=record;localStorage.setItem(this.key,JSON.stringify(records));return record}
};
