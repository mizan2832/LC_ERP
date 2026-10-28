const DUTY_HEADS=[
 {id:'cd',name:'Customs duty',standard:'duty-0',base:'av'},
 {id:'rd',name:'Regulatory duty',standard:'duty-1',base:'av'},
 {id:'sd',name:'Supplementary duty',standard:'duty-2',base:'sd'},
 {id:'vat',name:'VAT',standard:'duty-3',base:'vat'},
 {id:'ait',name:'Advance income tax',standard:'duty-4',base:'av'},
 {id:'at',name:'Advance trade VAT / AT',standard:'duty-5',base:'vat'},
 {id:'psi',name:'PSI commission',match:/\bPSI\b/i,base:'av'},
 {id:'vatcf',name:'VAT on C&F commission',standard:'global-1',base:'cf',processing:true},
 {id:'itcf',name:'Income tax on C&F commission',standard:'global-2',base:'cf',processing:true},
 {id:'doc',name:'Document processing fee',standard:'global-0',base:'av',processing:true},
 {id:'scan',name:'Container scanning fee',standard:'global-3',base:'av',processing:true},
 {id:'penalty',name:'Penalty fee',standard:'global-4',base:'av',processing:true}
];
const DUTY_PARTIES=[{id:'DUTY-CTG',name:'Chattogram Customs House'},{id:'DUTY-MGL',name:'Mongla Customs House'},{id:'DUTY-BNP',name:'Benapole Customs House'},{id:'DUTY-ICD',name:'Dhaka ICD Customs House'}];
const CNF_PARTIES=[{id:'CNF-001',name:'Sample C&F Agent — Chattogram'},{id:'CNF-002',name:'Sample C&F Agent — Mongla'},{id:'CNF-003',name:'Sample C&F Agent — Benapole'}];
const DutyStore={
 key:'lc-duty-calculations-v1',
 heads(basis){
  if(Array.isArray(basis?.processingHeads)){
   const ids=new Set(basis.processingHeads.map(head=>head.id));return [...DUTY_HEADS.filter(head=>!head.processing&&!ids.has(head.id)),...basis.processingHeads];
  }
  const heads=DUTY_HEADS.map(head=>({...head}));
  let costs=(basis?.rows||[]).flatMap(row=>row.standardSnapshot?.costs||[]);
  if(basis?.includeMasterProcessingHeads){const masters=JSON.parse(localStorage.getItem('lc-standards-v1')||'[]');if(!Array.isArray(masters))throw Error('Invalid standard cost storage.');costs=[...costs,...masters.flatMap(setup=>setup.costs||[])];}
  costs.filter(cost=>cost.key==='global'&&!/assembl/i.test(cost.name||'')).forEach(cost=>{
   const key=ExpenseStore.headKey(cost);let head=heads.find(head=>head.standard===cost.id||head.costKey===key||head.processing&&head.name.trim().toLowerCase()===String(cost.name).trim().toLowerCase()||head.id==='psi'&&head.match?.test(cost.name||''));
   if(!head){head={id:'processing-'+Array.from(key).map(char=>char.codePointAt(0).toString(16)).join('-'),name:cost.name,base:'av'};heads.push(head)}
   head.processing=true;head.costKey=key;delete head.match;
  });return heads;
 },
 costForHead(setup,head){return setup?.costs?.find(cost=>head.processing?cost.key==='global'&&(head.standard===cost.id||head.costKey===ExpenseStore.headKey(cost)):head.match?head.match.test(cost.name||''):cost.id===head.standard)},
 headConfigured(row,head){const setup=row.standardSnapshot,cost=this.costForHead(setup,head);return Boolean(cost?.included)&&cost.value!==''&&cost.value!==null&&Number.isFinite(Number(cost.value))&&Number.isFinite(Number(setup.calculation?.amounts?.[cost.id]??cost.value))},
 processingAllocation(basis,totals,fx){
  const heads=this.heads(basis).filter(head=>head.processing),normalized={};
  heads.forEach(head=>{const value=totals[head.id],standard=basis.rows.some(row=>Number(row.heads?.[head.id]?.standard)>0);normalized[head.id]=value===''||value===null||value===undefined?(standard?null:0):this.number(value,head.name+' manifest total')});
  const lines=basis.rows.map(row=>({...row,amountLC:Number(row.valueFC??Number(row.qty)*Number(row.rate))*fx}));
  const allocation=CostAllocation.calculate(lines,heads.map(head=>({headKey:head.id,headName:head.name,amount:normalized[head.id]??0})));
  return {totals:normalized,lines:allocation.lines.map(line=>Object.fromEntries(line.allocations.map(part=>[part.headKey,normalized[part.headKey]===null?null:part.amount])))};
 },

 // Normalize either stock-unit or legacy pack-unit snapshots to one order unit.
 orderStandards(basis){
  return {...basis,standardUnitBasis:'order',rows:basis.rows.map(row=>{
   const setup=row.standardSnapshot;if(!setup)return {...row,heads:Object.fromEntries(this.heads(basis).map(head=>[head.id,{...row.heads?.[head.id],standard:null,method:'fixed',value:0}]))};const unitFactor=StandardCostMath.factor(setup,row);
   const amounts=setup.calculation?.amounts||{},costValue=cost=>cost?.included?Number(amounts[cost.id]??(cost.method==='fixed'?cost.value:NaN)):0;
   const heads=Object.fromEntries(this.heads(basis).map(head=>{
    const cost=this.costForHead(setup,head);
    return [head.id,{...row.heads?.[head.id],method:cost?.included?cost.method:'fixed',value:cost?.included?Number(cost.value):0,standard:costValue(cost)*unitFactor}];
   }));
   const cf=setup.costs?.find(cost=>cost.id==='cf-2');
   return {...row,heads,cf:costValue(cf)*unitFactor,standardAV:Number(setup.calculation?.customsAssessableValue)*unitFactor,standardPSI:Number(setup.calculation?.psiAssessableValue??setup.fields?.psiAV??0)*unitFactor};
  })};
 },
 validateConfiguredHeads(basis,result,old){for(const row of result.rows){const source=basis.rows.find(r=>r.itemCode===row.itemCode&&r.uom===row.uom);for(const head of this.heads(basis)){if(head.processing||this.headConfigured(source,head))continue;const actual=row.heads[head.id].actual,previous=old?.rows.find(r=>r.itemCode===row.itemCode&&r.uom===row.uom)?.heads?.[head.id]?.actual;if(Number(actual)>0&&(!old||Number(previous)!==Number(actual)))throw Error(row.itemCode+': '+head.name+' is not configured in the saved LC standard. Cancel downstream entries in reverse order and cancel/recreate the LC opening to use a new standard.')}}},
 read(){const records=JSON.parse(localStorage.getItem(this.key)||'[]');if(!Array.isArray(records))throw Error('Invalid duty calculation storage.');return records},
 round(v){return Math.round((v+Number.EPSILON)*100)/100},
 boeExists(number,excludingId=''){const normalized=String(number||'').trim().toUpperCase();return Boolean(normalized)&&this.read().some(record=>record.id!==excludingId&&String(record.header?.boeNumber||'').trim().toUpperCase()===normalized)},
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
  const definitions=this.heads({rows:standards.map(standardSnapshot=>({standardSnapshot})),includeMasterProcessingHeads:true});
  const rows=[...grouped.values()].map(group=>{
   const setup=standards.find(s=>s.fields?.sku===group.itemCode),norm=u=>String(u||'').toUpperCase().replace('LITRE','LTR');
   const factor=setup?(norm(setup.fields.unit)===norm(group.uom)?1:norm(setup.fields.unit)===norm(group.convertedUom)?group.factor:NaN):NaN;
   const valid=Boolean(setup)&&Number.isFinite(factor)&&factor>0;
   const costs=setup?.costs||[],amounts=setup?.calculation?.amounts||{};
   const costValue=cost=>cost?.included?Number(amounts[cost.id]??(cost.method==='fixed'?cost.value:NaN)):0;
   const heads={};definitions.forEach(head=>{
    const cost=this.costForHead(setup,head);
    heads[head.id]={method:cost?.included?cost.method:'fixed',value:cost?.included?Number(cost.value):0,standard:valid?costValue(cost):null};
   });
   const rate=group.valueFC/group.qty,cf=costs.find(c=>c.id==='cf-2');
   return {...group,hs:group.hs||setup?.fields.hs||'',rate,freight:valid?Number(setup.fields.freight||0)*factor*(setup.fields.currency===release.basis.currency?1:Number(setup.fields.fx)/Number(lc.header.rate)):0,insurance:lcValue>0?insuranceTotal*group.valueFC/lcValue/group.qty:0,cf:valid?costValue(cf):0,heads,standardFOB:valid?Number(setup.fields.pi)*factor:null,standardCurrency:setup?.fields.currency||'',standardPSI:valid?Number(setup.calculation?.psiAssessableValue??setup.fields.psiAV??0):null,actualPSI:0,standardAV:valid?Number(setup.calculation.customsAssessableValue):null,standardSetup:setup?.setupNumber||'',standardSnapshot:valid?JSON.parse(JSON.stringify(setup)):null};
  });
  const pis=[...new Set(lc.rows.map(r=>r.piId))].map(id=>PIStore.read().find(p=>p.id===id)).filter(Boolean);
  const requisitions=pis.map(pi=>PRStore.read().find(r=>r.number===pi.requisitionNumber)).filter(Boolean);
  return this.orderStandards({processingHeads:definitions.filter(head=>head.processing),valuationVersion:2,documentReleaseId:release.id,releaseNumber:release.number,portReceiptId:receipt.id,manifestNumber:receipt.header.manifest,manifestDate:receipt.header.manifestDate,lcOpeningId:lc.id,lcNumber:lc.number,lcDate:lc.header.issue,party:lc.header.party,currency:release.basis.currency,rate:Number(release.header.rate),customInvoice:receipt.header.customInvoice||'',commercialInvoice:receipt.header.commercialInvoice||'',commercialDate:receipt.header.commercialDate||'',piInfo:pis.map(p=>p.number+' / '+p.header.piDate).join(', '),poInfo:requisitions.map(r=>r.number+' / '+r.header.planDate).join(', '),orderQuantities:lc.rows.map(r=>({qty:Number(r.qty),uom:r.uom})),rows});
 },
 calculate(basis,inputRows,exchangeRate,processingTotals=null){
  basis=this.orderStandards(basis);
  const fx=this.number(exchangeRate,'customs exchange rate');if(fx<=0)throw Error('Customs exchange rate must be positive.');
  if(inputRows.length!==basis.rows.length)throw Error('Manifest item rows cannot be added or removed.');
  const definitions=this.heads(basis),processing=processingTotals===null?null:this.processingAllocation(basis,processingTotals,fx);
  const seen=new Set();const rows=inputRows.map(input=>{
   const original=basis.rows.find(r=>r.itemCode===input.itemCode&&r.uom===input.uom);if(!original||seen.has(input.itemCode+'|'+input.uom))throw Error('Invalid manifest item.');seen.add(input.itemCode+'|'+input.uom);
   const sourceIndex=basis.rows.indexOf(original);
   const qty=original.qty,rate=this.number(input.rate,'item rate'),freight=this.number(input.freight,'freight per order unit'),insurance=this.number(input.insurance,'insurance per order unit'),cf=this.number(input.cf,'C&F commission per order unit');
   const actualAV=input.actualAV===null||input.actualAV===undefined||input.actualAV===''?null:this.number(input.actualAV,'actual assessable value');
   const actualPSI=this.number(input.actualPSI??0,'actual PSI assessable value');
   const av=actualAV===null?null:actualAV/qty,charges={},unit={};
   definitions.forEach(head=>{
    const entry=input.heads?.[head.id]||(head.processing?{method:'total',value:0}:null);if(!entry||!['percent','fixed','total'].includes(entry.method))throw Error('Select a valid calculation method.');
    if(head.processing&&processing){const actual=processing.lines[sourceIndex][head.id],standard=original.heads[head.id].standard===null?null:this.round(original.heads[head.id].standard*qty);charges[head.id]={method:'total',value:actual===null?'':actual,actual,standard,variance:actual===null||standard===null?null:this.round(actual-standard)};return}
    const value=entry.value===''||entry.value===null||entry.value===undefined?(original.heads[head.id].standard==null||Number(original.heads[head.id].standard)===0?0:null):this.number(entry.value,head.name),base=head.base==='sd'?(av===null||unit.cd===null||unit.rd===null?null:av+unit.cd+unit.rd):head.base==='vat'?(av===null||unit.cd===null||unit.rd===null||unit.sd===null?null:av+unit.cd+unit.rd+unit.sd):head.base==='cf'?cf:av;
    unit[head.id]=value===null?null:entry.method==='percent'?(base===null?null:base*value/100):entry.method==='total'?value/qty:value;
    charges[head.id]={method:entry.method,value:value===null?'':value,actual:unit[head.id]===null?null:this.round(unit[head.id]*qty),standard:original.heads[head.id].standard===null?null:this.round(original.heads[head.id].standard*qty)};
    const charge=charges[head.id];charge.variance=charge.actual===null||charge.standard===null?null:this.round(charge.actual-charge.standard);
   });
   return {...original,rate,orderUnitPrice:this.orderValue({...original,rate}),freight,insurance,cf,actualAV,actualPSI,standardPSI:original.standardPSI??0,heads:charges,assessableValue:actualAV,standardAssessableValue:original.standardAV===null?null:this.round(original.standardAV*qty),totalActual:Object.values(charges).every(c=>c.actual!==null)?this.round(Object.values(charges).reduce((s,c)=>s+c.actual,0)):null,totalStandard:original.standardSnapshot?this.round(Object.values(charges).reduce((s,c)=>s+(c.standard||0),0)):null};
  });
  rows.forEach(row=>{row.totalVariance=row.totalActual===null||row.totalStandard===null?null:this.round(row.totalActual-row.totalStandard);row.assessableVariance=row.assessableValue===null||row.standardAssessableValue===null?null:this.round(row.assessableValue-row.standardAssessableValue)});
  return {processingTotals:processing?.totals||null,processingExpenseVersion:processing?1:0,totalAssessableVariance:rows.every(row=>row.assessableVariance!==null)?this.round(rows.reduce((sum,row)=>sum+row.assessableVariance,0)):null,totalVariance:rows.every(r=>r.totalVariance!==null)?this.round(rows.reduce((s,r)=>s+r.totalVariance,0)):null,rows,totalActual:rows.every(r=>r.totalActual!==null)?this.round(rows.reduce((s,r)=>s+r.totalActual,0)):null,totalStandard:rows.every(r=>r.totalStandard!==null)?this.round(rows.reduce((s,r)=>s+r.totalStandard,0)):null,totalAV:rows.every(r=>r.assessableValue!==null)?this.round(rows.reduce((s,r)=>s+r.assessableValue,0)):null,totalStandardAV:rows.every(r=>r.standardAssessableValue!==null)?this.round(rows.reduce((s,r)=>s+r.standardAssessableValue,0)):null};
 },
 save(input,revision){
  const records=this.read(),index=records.findIndex(r=>r.id===input.id),old=records[index];
  if(old&&(old.revision!==revision||old.status==='Cancelled'||this.blocked(old.id)))throw Error('Duty entry changed or is locked. Reload it.');
  if(old&&old.documentReleaseId!==input.documentReleaseId)throw Error('The manifest cannot be changed on a saved duty calculation.');
  if(!['Draft','Saved'].includes(input.status))throw Error('Invalid duty status.');
  const release=ReleaseStore.read().find(r=>r.id===input.documentReleaseId&&r.status==='Released');if(!release)throw Error('Select a released manifest.');
  if(records.some(r=>r.id!==input.id&&r.portReceiptId===release.portReceiptId&&r.status!=='Cancelled'))throw Error('Duty calculation already exists for this manifest.');
  const basis=this.orderStandards(old?.basis||this.basis(release.id));
  const date=input.header.costDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<release.header.releaseDate)throw Error('Costing date must be valid and on or after document release date.');
  const boeNumber=String(input.header.boeNumber||'').trim();
  if(!boeNumber)throw Error('Enter the Bill of Entry number.');
  if(this.boeExists(boeNumber,input.id))throw Error('This Bill of Entry number already exists. Enter a unique BOE number.');
  if(!input.header.boeDate)throw Error('Enter the Bill of Entry date.');
  if(!DUTY_PARTIES.some(p=>p.id===input.header.dutyParty))throw Error('Select the Duty party.');
  if(!CNF_PARTIES.some(p=>p.id===input.header.cnfParty))throw Error('Select the C&F party.');
  if(input.status==='Saved'){
   if(!basis.rows.every(r=>r.standardSnapshot))throw Error('Saved standard cost snapshot is missing for one or more manifest items.');
  }
  if(input.header.boeDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.header.boeDate)||!Number.isFinite(Date.parse(input.header.boeDate+'T00:00:00Z'))||new Date(input.header.boeDate+'T00:00:00Z').toISOString().slice(0,10)!==input.header.boeDate||input.header.boeDate>date))throw Error('Bill of Entry date must be valid and no later than costing date.');
  const result=this.calculate(basis,input.rows,input.header.rate,input.processingTotals??null);this.validateConfiguredHeads(basis,result,old);if(input.status==='Saved'&&result.totalAV===null)throw Error('Enter the actual assessable value for every manifest item.');if(input.status==='Saved'&&result.totalActual===null)throw Error('Enter an actual value for every duty head. Enter 0 for heads that do not apply.');const now=new Date().toISOString();
  const record={...input,header:{...input.header,boeNumber},...result,basis,portReceiptId:release.portReceiptId,manifestNumber:basis.manifestNumber,lcOpeningId:basis.lcOpeningId,id:input.id||crypto.randomUUID(),number:old?.number||'DUTY-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.number).replace('DUTY-',''))||0),0)+1).padStart(6,'0'),revision:(revision||0)+1,updatedAt:now,history:old?[...(old.history||[]),{action:'Modified',at:now,before:{header:old.header,rows:old.rows},after:{header:input.header,rows:result.rows}}]:[]};
  if(index>=0)records[index]=record;else records.push(record);localStorage.setItem(this.key,JSON.stringify(records));return record;
 }
};
