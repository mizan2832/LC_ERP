const DUTY_HEADS=[
 {id:'cd',name:'Customs duty',standard:'duty-0',base:'av'},
 {id:'rd',name:'Regulatory duty',standard:'duty-1',base:'av'},
 {id:'sd',name:'Supplementary duty',standard:'duty-2',base:'sd'},
 {id:'vat',name:'VAT',standard:'duty-3',base:'vat'},
 {id:'ait',name:'Advance income tax',standard:'duty-4',base:'av'},
 {id:'at',name:'Advance trade VAT / AT',standard:'duty-5',base:'vat'},
 {id:'psi',name:'PSI commission',match:/\bPSI\b/i,base:'av'},
 {id:'vatcf',name:'VAT on C&F commission',standard:'global-1',base:'cf'},
 {id:'itcf',name:'Income tax on C&F commission',standard:'global-2',base:'cf'},
 {id:'doc',name:'Document processing fee',standard:'global-0',base:'av'}
];
const DUTY_PARTIES=[{id:'DUTY-CTG',name:'Chattogram Customs House'},{id:'DUTY-MGL',name:'Mongla Customs House'},{id:'DUTY-BNP',name:'Benapole Customs House'},{id:'DUTY-ICD',name:'Dhaka ICD Customs House'}];
const CNF_PARTIES=[{id:'CNF-001',name:'Sample C&F Agent — Chattogram'},{id:'CNF-002',name:'Sample C&F Agent — Mongla'},{id:'CNF-003',name:'Sample C&F Agent — Benapole'}];
const DutyStore={
 key:'lc-duty-calculations-v1',
 headConfigured(row,head){const setup=row.standardSnapshot,cost=setup?.costs?.find(c=>head.match?head.match.test(c.name||''):c.id===head.standard);return Boolean(cost?.included)&&cost.value!==''&&cost.value!==null&&Number.isFinite(Number(cost.value))&&Number.isFinite(Number(setup.calculation?.amounts?.[cost.id]??cost.value))},
 validateConfiguredHeads(basis,result,old){for(const row of result.rows){const source=basis.rows.find(r=>r.itemCode===row.itemCode&&r.uom===row.uom);for(const head of DUTY_HEADS){if(this.headConfigured(source,head))continue;const actual=row.heads[head.id].actual,previous=old?.rows.find(r=>r.itemCode===row.itemCode&&r.uom===row.uom)?.heads?.[head.id]?.actual;if(Number(actual)>0&&(!old||Number(previous)!==Number(actual)))throw Error(row.itemCode+': '+head.name+' is not configured in the saved LC standard. Cancel downstream entries in reverse order and cancel/recreate the LC opening to use a new standard.')}}},
 read(){const records=JSON.parse(localStorage.getItem(this.key)||'[]');if(!Array.isArray(records))throw Error('Invalid duty calculation storage.');return records},
 round(v){return Math.round((v+Number.EPSILON)*100)/100},
 orderValue(row){return this.round(this.number(row.qty,'manifest quantity')*this.number(row.rate,'PI item rate per order unit'))},
 number(value,label){const n=Number(value);if(value===''||value===null||value===undefined||!Number.isFinite(n)||n<0)throw Error('Enter a non-negative '+label+'.');return n},
 blocked(id){return Rollback.active('lc-bank-customs-expenses-v1',r=>r.dutyCalculationId===id)?'Bank & customs expense entry exists.':''},
 basis(releaseId){
  const release=ReleaseStore.read().find(r=>r.id===releaseId&&r.status==='Released');if(!release)throw Error('Select a manifest with a saved document release.');
  const receipt=PortStore.read().find(r=>r.id===release.portReceiptId&&r.status==='Received');if(!receipt)throw Error('Received manifest not found.');
  const lc=LCStore.read().find(r=>r.id===receipt.lcOpeningId&&r.status==='Opened');if(!lc)throw Error('Active LC opening not found.');
  const expenses=ExpenseStore.read().filter(r=>r.lcOpeningId===lc.id&&r.status==='Saved'),standards=expenses.flatMap(e=>e.standardSnapshots||[]);
  const grouped=new Map(),insuranceTotal=expenses.reduce((sum,e)=>sum+e.rows.filter(r=>ExpenseStore.isInsurance(r)).reduce((s,r)=>s+Number(r.amount),0),0);
  const lcValue=lc.rows.reduce((s,r)=>s+Number(r.amountFC),0);
  receipt.rows.forEach(line=>{
   const key=line.itemCode+'|'+line.uom,qty=Number(line.qty);let group=grouped.get(key);
   if(!group){group={itemCode:line.itemCode,itemName:line.itemName,hs:line.hs||'',uom:line.uom,qty:0,valueFC:0,insurance:0,factor:Number(line.factor||1),convertedUom:line.convertedUom,sourceKeys:[]};grouped.set(key,group)}
   group.qty+=qty;group.valueFC+=Number(line.amountFC??qty*line.price);group.sourceKeys.push(line.sourceKey);
  });
  const rows=[...grouped.values()].map(group=>{
   const setup=standards.find(s=>s.fields?.sku===group.itemCode),norm=u=>String(u||'').toUpperCase().replace('LITRE','LTR');
   const factor=setup?(norm(setup.fields.unit)===norm(group.uom)?1:norm(setup.fields.unit)===norm(group.convertedUom)?group.factor:NaN):NaN;
   const valid=Boolean(setup)&&Number.isFinite(factor)&&factor>0;
   const costs=setup?.costs||[],amounts=setup?.calculation?.amounts||{};
   const costValue=cost=>cost?.included?Number(amounts[cost.id]??(cost.method==='fixed'?cost.value:NaN)):0;
   const heads={};DUTY_HEADS.forEach(head=>{
    const cost=costs.find(c=>head.match?head.match.test(c.name||''):c.id===head.standard);
    heads[head.id]={method:cost?.included?cost.method:'fixed',value:cost?.included?Number(cost.value)*(cost.method==='fixed'&&valid?factor:1):0,standard:valid?costValue(cost)*factor:null};
   });
   const rate=group.valueFC/group.qty,cf=costs.find(c=>c.id==='cf-2');
   return {...group,hs:group.hs||setup?.fields.hs||'',rate,freight:valid?Number(setup.fields.freight||0)*factor*(setup.fields.currency===release.basis.currency?1:Number(setup.fields.fx)/Number(lc.header.rate)):0,insurance:lcValue>0?insuranceTotal*group.valueFC/lcValue/group.qty:0,cf:valid?costValue(cf)*factor:0,heads,standardFOB:valid?Number(setup.fields.pi)*factor:null,standardCurrency:setup?.fields.currency||'',standardPSI:valid?Number(setup.calculation?.psiAssessableValue??setup.fields.psiAV??0)*factor:null,actualPSI:0,standardAV:valid?Number(setup.calculation.customsAssessableValue)*factor:null,standardSetup:setup?.setupNumber||'',standardSnapshot:valid?JSON.parse(JSON.stringify(setup)):null};
  });
  const pis=[...new Set(lc.rows.map(r=>r.piId))].map(id=>PIStore.read().find(p=>p.id===id)).filter(Boolean);
  const requisitions=pis.map(pi=>PRStore.read().find(r=>r.number===pi.requisitionNumber)).filter(Boolean);
  return {valuationVersion:2,documentReleaseId:release.id,releaseNumber:release.number,portReceiptId:receipt.id,manifestNumber:receipt.header.manifest,manifestDate:receipt.header.manifestDate,lcOpeningId:lc.id,lcNumber:lc.number,lcDate:lc.header.issue,party:lc.header.party,currency:release.basis.currency,rate:Number(release.header.rate),customInvoice:receipt.header.customInvoice||'',commercialInvoice:receipt.header.commercialInvoice||'',commercialDate:receipt.header.commercialDate||'',piInfo:pis.map(p=>p.number+' / '+p.header.piDate).join(', '),poInfo:requisitions.map(r=>r.number+' / '+r.header.planDate).join(', '),orderQuantities:lc.rows.map(r=>({qty:Number(r.qty),uom:r.uom})),rows};
 },
 calculate(basis,inputRows,exchangeRate){
  const fx=this.number(exchangeRate,'customs exchange rate');if(fx<=0)throw Error('Customs exchange rate must be positive.');
  if(inputRows.length!==basis.rows.length)throw Error('Manifest item rows cannot be added or removed.');
  const seen=new Set();const rows=inputRows.map(input=>{
   const original=basis.rows.find(r=>r.itemCode===input.itemCode&&r.uom===input.uom);if(!original||seen.has(input.itemCode+'|'+input.uom))throw Error('Invalid manifest item.');seen.add(input.itemCode+'|'+input.uom);
   const qty=original.qty,rate=this.number(input.rate,'item rate'),freight=this.number(input.freight,'freight per order unit'),insurance=this.number(input.insurance,'insurance per order unit'),cf=this.number(input.cf,'C&F commission per order unit');
   const actualAV=input.actualAV===null||input.actualAV===undefined||input.actualAV===''?null:this.number(input.actualAV,'actual assessable value');
   const actualPSI=this.number(input.actualPSI??0,'actual PSI assessable value');
   const cif=(rate+freight)*fx+insurance,landing=basis.valuationVersion>=2?cif*0.01:0;
   const av=actualAV===null?cif+landing+actualPSI/qty:actualAV/qty,charges={},unit={};
   DUTY_HEADS.forEach(head=>{
    const entry=input.heads[head.id];if(!entry||!['percent','fixed','total'].includes(entry.method))throw Error('Select a valid calculation method.');
    const value=entry.value===''||entry.value===null||entry.value===undefined?(original.heads[head.id].standard==null||Number(original.heads[head.id].standard)===0?0:null):this.number(entry.value,head.name),base=head.base==='sd'?(unit.cd===null||unit.rd===null?null:av+unit.cd+unit.rd):head.base==='vat'?(unit.cd===null||unit.rd===null||unit.sd===null?null:av+unit.cd+unit.rd+unit.sd):head.base==='cf'?cf:av;
    unit[head.id]=value===null?null:entry.method==='percent'?(base===null?null:base*value/100):entry.method==='total'?value/qty:value;
    charges[head.id]={method:entry.method,value:value===null?'':value,actual:unit[head.id]===null?null:this.round(unit[head.id]*qty),standard:original.heads[head.id].standard===null?null:this.round(original.heads[head.id].standard*qty)};
    const charge=charges[head.id];charge.variance=charge.actual===null||charge.standard===null?null:this.round(charge.actual-charge.standard);
   });
   return {...original,rate,orderUnitPrice:this.orderValue({...original,rate}),freight,insurance,cf,actualAV,actualPSI,standardPSI:original.standardPSI??0,heads:charges,assessableValue:this.round(av*qty),standardAssessableValue:original.standardAV===null?null:this.round(original.standardAV*qty),totalActual:Object.values(charges).every(c=>c.actual!==null)?this.round(Object.values(charges).reduce((s,c)=>s+c.actual,0)):null,totalStandard:original.standardSnapshot?this.round(Object.values(charges).reduce((s,c)=>s+(c.standard||0),0)):null};
  });
  rows.forEach(row=>{row.totalVariance=row.totalActual===null||row.totalStandard===null?null:this.round(row.totalActual-row.totalStandard);row.assessableVariance=row.standardAssessableValue===null?null:this.round(row.assessableValue-row.standardAssessableValue)});
  return {totalAssessableVariance:rows.every(row=>row.assessableVariance!==null)?this.round(rows.reduce((sum,row)=>sum+row.assessableVariance,0)):null,totalVariance:rows.every(r=>r.totalVariance!==null)?this.round(rows.reduce((s,r)=>s+r.totalVariance,0)):null,rows,totalActual:rows.every(r=>r.totalActual!==null)?this.round(rows.reduce((s,r)=>s+r.totalActual,0)):null,totalStandard:rows.every(r=>r.totalStandard!==null)?this.round(rows.reduce((s,r)=>s+r.totalStandard,0)):null,totalAV:this.round(rows.reduce((s,r)=>s+r.assessableValue,0)),totalStandardAV:rows.every(r=>r.standardAssessableValue!==null)?this.round(rows.reduce((s,r)=>s+r.standardAssessableValue,0)):null};
 },
 save(input,revision){
  const records=this.read(),index=records.findIndex(r=>r.id===input.id),old=records[index];
  if(old&&(old.revision!==revision||old.status==='Cancelled'||this.blocked(old.id)))throw Error('Duty entry changed or is locked. Reload it.');
  if(old&&old.documentReleaseId!==input.documentReleaseId)throw Error('The manifest cannot be changed on a saved duty calculation.');
  if(!['Draft','Saved'].includes(input.status))throw Error('Invalid duty status.');
  const release=ReleaseStore.read().find(r=>r.id===input.documentReleaseId&&r.status==='Released');if(!release)throw Error('Select a released manifest.');
  if(records.some(r=>r.id!==input.id&&r.portReceiptId===release.portReceiptId&&r.status!=='Cancelled'))throw Error('Duty calculation already exists for this manifest.');
  const basis=old?.basis||this.basis(release.id);
  const date=input.header.costDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<release.header.releaseDate)throw Error('Costing date must be valid and on or after document release date.');
  if(input.status==='Saved'){
   if(!DUTY_PARTIES.some(p=>p.id===input.header.dutyParty)||!CNF_PARTIES.some(p=>p.id===input.header.cnfParty))throw Error('Select duty party and C&F party.');
   if(!input.header.boeNumber||!input.header.boeDate)throw Error('Enter Bill of Entry number and date.');
   if(!basis.rows.every(r=>r.standardSnapshot))throw Error('Saved standard cost snapshot is missing for one or more manifest items.');
  }
  if(input.header.boeDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.header.boeDate)||!Number.isFinite(Date.parse(input.header.boeDate+'T00:00:00Z'))||new Date(input.header.boeDate+'T00:00:00Z').toISOString().slice(0,10)!==input.header.boeDate||input.header.boeDate>date))throw Error('Bill of Entry date must be valid and no later than costing date.');
  const result=this.calculate(basis,input.rows,input.header.rate);this.validateConfiguredHeads(basis,result,old);if(input.status==='Saved'&&result.totalActual===null)throw Error('Enter an actual value for every duty head. Enter 0 for heads that do not apply.');const now=new Date().toISOString();
  const record={...input,...result,basis,portReceiptId:release.portReceiptId,manifestNumber:basis.manifestNumber,lcOpeningId:basis.lcOpeningId,id:input.id||crypto.randomUUID(),number:old?.number||'DUTY-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.number).replace('DUTY-',''))||0),0)+1).padStart(6,'0'),revision:(revision||0)+1,updatedAt:now,history:old?[...(old.history||[]),{action:'Modified',at:now,before:{header:old.header,rows:old.rows},after:{header:input.header,rows:result.rows}}]:[]};
  if(index>=0)records[index]=record;else records.push(record);localStorage.setItem(this.key,JSON.stringify(records));return record;
 }
};
