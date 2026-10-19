const ReleaseStore={
 key:'lc-document-releases-v1',
 read(){const records=JSON.parse(localStorage.getItem(this.key)||'[]');if(!Array.isArray(records))throw Error('Invalid document release storage.');return records},
 blocked(id){return Rollback.active('lc-duty-calculations-v1',r=>r.documentReleaseId===id)?'Duty calculation already exists.':''},
 basis(receiptId){
  const receipts=PortStore.read(),receipt=receipts.find(r=>r.id===receiptId&&r.status==='Received');
  if(!receipt)throw Error('Select a completed goods receive manifest.');
  const lc=PortStore.lc(receipt.lcOpeningId);
  const expenses=ExpenseStore.read().filter(e=>e.lcOpeningId===lc.id&&e.status==='Saved');
  const marginBySource=new Map(),marginMissing=[];
  const totalCashMargin=expenses.reduce((sum,exp)=>sum+exp.rows.filter(r=>/\bmargin\b/i.test(r.headName||r.headKey)).reduce((s,r)=>s+Number(r.amount),0),0);
  lc.rows.forEach((line,index)=>{
   const amounts=expenses.flatMap(exp=>exp.rows.filter(r=>/\bmargin\b/i.test(r.headName||r.headKey)).map(head=>{
    const saved=head.standards?.find(s=>s.sku===line.itemCode&&s.valid);
    if(saved)return {amount:Number(saved.standard),unit:line.uom};
    const setup=exp.standardSnapshots?.find(s=>s.fields?.sku===line.itemCode);
    const cost=setup?.costs?.find(c=>c.included&&ExpenseStore.headKey(c)===head.headKey);
    return cost?{amount:Number(setup.calculation?.amounts?.[cost.id]??cost.value),unit:line.uom}:null;
   }));
   if(!amounts.length||amounts.some(a=>!a||!Number.isFinite(a.amount)||a.amount<0)){marginMissing.push(line.itemCode);marginBySource.set(line.piId+':'+index,null);return}
   const norm=u=>String(u||'').toUpperCase().replace('LITRE','LTR');
   let total=0;
   for(const a of amounts){const factor=norm(a.unit)===norm(line.uom)?1:norm(a.unit)===norm(line.convertedUom)?Number(line.factor):NaN;if(!Number.isFinite(factor)){marginMissing.push(line.itemCode);total=null;break}total+=a.amount*factor}
   marginBySource.set(line.piId+':'+index,total);
  });
  // Use actual paid margin for financing; standard margins remain comparison values.
  const actualShares=new Map(lc.rows.map((line,index)=>[line.piId+':'+index,0]));
  expenses.forEach(exp=>{
   const heads=exp.rows.filter(r=>/\bmargin\b/i.test(r.headName||r.headKey));
   if(!heads.length)return;
   const allocation=CostAllocation.calculate(exp.allocationBasis||lc.rows,heads);
   allocation.lines.forEach((line,index)=>{
    const current=lc.rows[index];
    if(!current||current.piId!==line.piId||current.itemCode!==line.itemCode)throw Error('Saved margin allocation does not match LC items.');
    const key=line.piId+':'+index;actualShares.set(key,actualShares.get(key)+line.allocatedExpense);
   });
  });
  // Allocate both full LC margin pools using the same PI value weights.
  const standardCashMargin=marginMissing.length?null:lc.rows.reduce((sum,line,index)=>sum+marginBySource.get(line.piId+':'+index)*Number(line.qty),0);
  const piBasis=lc.rows.map(line=>({...line,amountLC:Number(line.amountFC)}));
  const weightedShares=amount=>CostAllocation.calculate(piBasis,[{headKey:'margin',headName:'Margin',amount}]).lines.map(line=>line.allocatedExpense);
  const actualWeighted=weightedShares(totalCashMargin),standardWeighted=standardCashMargin===null?null:weightedShares(standardCashMargin);
  lc.rows.forEach((line,index)=>actualShares.set(line.piId+':'+index,actualWeighted[index]));
  const priorQuantities=new Map();
  for(const earlier of receipts){
   if(earlier.id===receipt.id)break;
   if(earlier.status!=='Received'||earlier.lcOpeningId!==lc.id)continue;
   earlier.rows.forEach(row=>priorQuantities.set(row.sourceKey,(priorQuantities.get(row.sourceKey)||0)+Number(row.qty)));
  }
  const received=new Map();receipt.rows.forEach(r=>received.set(r.sourceKey,(received.get(r.sourceKey)||0)+Number(r.qty)));
  const standards=expenses.flatMap(e=>e.standardSnapshots||[]);
  const groups=new Map();
  lc.rows.forEach((line,index)=>{
   const key=line.piId+':'+index,qty=received.get(key)||0;
   const groupKey=line.itemCode+'|'+line.uom;
   let group=groups.get(groupKey);
   const setup=standards.find(s=>s.fields?.sku===line.itemCode);
   const sameUnit=String(setup?.fields?.unit||'').toUpperCase()===String(line.uom||'').toUpperCase();
   const standard=setup&&Number.isFinite(Number(setup.calculation?.total))?Number(setup.calculation.total)*(sameUnit?1:Number(line.factor||1)):null;
   if(!group){group={itemCode:line.itemCode,itemName:line.itemName,uom:line.uom,ordered:0,manifestQty:0,amountFC:0,totalOrderLC:0,manifestOpeningLC:0,margin:0,standardManifestMargin:standardWeighted?0:null,actualLCItemMargin:0,standardMarginUnit:marginBySource.get(key),standardUnit:standard,standardSetup:setup?.setupNumber||''};groups.set(groupKey,group)}
   group.totalOrderLC+=Number(line.amountLC);
   group.actualLCItemMargin+=actualShares.get(key)||0;group.ordered+=Number(line.qty);group.manifestQty+=qty;group.amountFC+=qty*Number(line.amountFC)/Number(line.qty);
   const cents=Math.round((actualShares.get(key)||0)*100),before=priorQuantities.get(key)||0,ordered=Number(line.qty);
   if(standardWeighted){const standardCents=Math.round(standardWeighted[index]*100);group.standardManifestMargin+=(Math.round(standardCents*Math.min(ordered,before+qty)/ordered)-Math.round(standardCents*Math.min(ordered,before)/ordered))/100;}
   const openingCents=Math.round(Number(line.amountLC)*100);group.manifestOpeningLC+=(Math.round(openingCents*Math.min(ordered,before+qty)/ordered)-Math.round(openingCents*Math.min(ordered,before)/ordered))/100;
   group.margin+=(Math.round(cents*Math.min(ordered,before+qty)/ordered)-Math.round(cents*Math.min(ordered,before)/ordered))/100;
  });
  return {receiptId:receipt.id,manifest:receipt.header.manifest,customInvoice:receipt.header.customInvoice||'',lcOpeningId:lc.id,lcNumber:lc.number,currency:receipt.currency||lc.header.currency,openingRate:Number(lc.header.rate),rate:Number(receipt.exchangeRate||lc.header.rate),party:lc.header.party,receiptDate:receipt.header.receiptDate,rows:[...groups.values()],totalCashMargin,marginMissing:[...new Set(marginMissing)],marginMethod:'Actual LC cash margin allocated by item value and manifest quantity',marginAvailable:expenses.some(e=>e.rows.some(r=>/\bmargin\b/i.test(r.headName||r.headKey)))};
 },
 savedItemMarginTotals(basis){
  const totals=new Map();
  try{
   const expenses=ExpenseStore.read().filter(e=>e.lcOpeningId===basis.lcOpeningId&&e.status==='Saved');
   const cash=expenses.reduce((sum,e)=>sum+e.rows.filter(r=>/\bmargin\b/i.test(r.headName||r.headKey)).reduce((s,r)=>s+Number(r.amount),0),0);
   // Recover the new display field only when the source still matches the saved pool.
   if(Math.round(cash*100)!==Math.round(Number(basis.totalCashMargin)*100))return totals;
   for(const expense of expenses){
    const heads=expense.rows.filter(r=>/\bmargin\b/i.test(r.headName||r.headKey));if(!heads.length)continue;
    const allocation=expense.allocation||CostAllocation.calculate(expense.allocationBasis,heads);
    allocation.lines.forEach(line=>{
     const key=line.itemCode+'|'+line.uom;
     const amount=line.allocations.filter(a=>/\bmargin\b/i.test(a.headName||a.headKey)).reduce((sum,a)=>sum+Number(a.amount),0);
     totals.set(key,(totals.get(key)||0)+amount);
    });
   }
   if(Math.round([...totals.values()].reduce((s,n)=>s+n,0)*100)!==Math.round(cash*100))return new Map();
  }catch{return new Map()}
  return totals;
 },
 calculate(basis,rate,loanType,excludingId='',manualLoanValue=null){
  rate=Number(rate);if(!Number.isFinite(rate)||rate<=0)throw Error('Enter a positive updated exchange rate.');
  let openingRate=Number(basis.openingRate);
  if(!(openingRate>0)){try{openingRate=Number(LCStore.read().find(lc=>lc.id===basis.lcOpeningId)?.header?.rate)}catch{}}
  const rows=basis.rows.map(r=>({...r,amountLC:Math.round(r.amountFC*rate*100)/100,totalStandardLC:r.standardUnit===null?null:Math.round(r.standardUnit*r.manifestQty*100)/100}));
  // Older release snapshots did not capture the full item LC value.
  if(rows.some(row=>row.totalOrderLC===undefined)){
   let sourceRows=[];try{sourceRows=LCStore.read().find(lc=>lc.id===basis.lcOpeningId)?.rows||[]}catch{}
   rows.forEach(row=>{
    if(row.totalOrderLC!==undefined)return;
    const sources=sourceRows.filter(line=>line.itemCode===row.itemCode&&line.uom===row.uom);
    row.totalOrderLC=sources.length&&Math.abs(sources.reduce((sum,line)=>sum+Number(line.qty),0)-Number(row.ordered))<0.000001?sources.reduce((sum,line)=>sum+Number(line.amountLC),0):null;
   });
  }
  rows.forEach(row=>{
   row.manifestOpeningLC=row.manifestOpeningLC??(openingRate>0?Math.round(row.amountFC*openingRate*100)/100:null);
   row.exchangeDifference=row.manifestOpeningLC===null?null:Math.round((row.amountLC-row.manifestOpeningLC)*100)/100;
  });
  if(rows.some(row=>row.actualLCItemMargin===undefined)){
   const recovered=this.savedItemMarginTotals(basis);
   rows.forEach(row=>{if(row.actualLCItemMargin===undefined&&recovered.has(row.itemCode+'|'+row.uom))row.actualLCItemMargin=Math.round(recovered.get(row.itemCode+'|'+row.uom)*100)/100});
  }
  rows.forEach(row=>{row.actualMarginPerUnit=row.manifestQty>0?Number(row.margin)/Number(row.manifestQty):null;row.standardManifestMargin=row.standardManifestMargin!==undefined?row.standardManifestMargin:row.standardMarginUnit===null||row.standardMarginUnit===undefined?null:Math.round(row.standardMarginUnit*row.manifestQty*100)/100;row.marginVariance=row.standardManifestMargin===null?null:Math.round((row.margin-row.standardManifestMargin)*100)/100});
  const marginVarianceComplete=rows.filter(row=>row.manifestQty>0).every(row=>row.marginVariance!==null);
  const totalFC=rows.reduce((s,r)=>s+r.amountFC,0),totalLC=rows.reduce((s,r)=>s+r.amountLC,0),margin=Math.round(rows.reduce((s,r)=>s+r.margin,0)*100)/100;
  const cashMargin=Number(basis.totalCashMargin||0),usedMargin=Math.round(this.read().filter(r=>r.id!==excludingId&&r.lcOpeningId===basis.lcOpeningId&&r.status!=='Cancelled').reduce((s,r)=>s+Number(r.margin||0),0)*100)/100;
  const remainingCashMargin=Math.round((cashMargin-usedMargin-margin)*100)/100;
  return {totalActualLCItemMargin:rows.every(row=>row.actualLCItemMargin!==undefined)?Math.round(rows.reduce((sum,row)=>sum+Number(row.actualLCItemMargin),0)*100)/100:null,totalStandardManifestMargin:marginVarianceComplete?Math.round(rows.reduce((sum,row)=>sum+(row.standardManifestMargin||0),0)*100)/100:null,totalMarginVariance:marginVarianceComplete?Math.round(rows.reduce((sum,row)=>sum+(row.marginVariance||0),0)*100)/100:null,cashMargin,usedMargin,remainingCashMargin,rows,totalFC,totalLC,margin,standardComplete:rows.filter(r=>r.manifestQty>0).every(r=>r.standardUnit!==null),totalStandardLC:rows.reduce((s,r)=>s+(r.totalStandardLC||0),0),loanValue:loanType==='LATR'?(manualLoanValue===null||manualLoanValue===''?null:Number(manualLoanValue)):0};
 },
 save(input,revision){
  const records=this.read(),index=records.findIndex(r=>r.id===input.id),old=records[index];
  if(old){if(old.revision!==revision)throw Error('Release changed. Reload it.');if(old.status==='Cancelled'||old.glStatus==='Posted')throw Error('This release is locked.');if(this.blocked(old.id))throw Error(this.blocked(old.id))}
  if(records.some(r=>r.id!==input.id&&r.portReceiptId===input.portReceiptId&&r.status!=='Cancelled'))throw Error('A document release already exists for this manifest.');
  const receipt=PortStore.read().find(r=>r.id===input.portReceiptId&&r.status==='Received');if(!receipt)throw Error('Select a received manifest.');
  if(!['Draft','Released'].includes(input.status)||!['Original','Copy'].includes(input.header.documentType)||!['LATR','PAD','None'].includes(input.header.loanType)||!['Unposted','Posted'].includes(input.glStatus))throw Error('Select valid document, loan and GL options.');
  const date=input.header.releaseDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<receipt.header.receiptDate)throw Error('Release date must be valid and on or after receipt date.');
  if(input.status==='Released'&&!input.header.nocDate)throw Error('Enter Bank NOC date.');
  if(input.header.nocDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.header.nocDate)||!Number.isFinite(Date.parse(input.header.nocDate+'T00:00:00Z'))||input.header.nocDate>date))throw Error('Bank NOC date must be valid and no later than release date.');
  const basis=old?.basis||this.basis(input.portReceiptId),calculated=this.calculate(basis,input.header.rate,input.header.loanType,input.id,input.header.loanValue);
  if(input.header.loanType==='LATR'){
   const value=input.header.loanValue;
   if(input.status==='Released'&&(value===undefined||value===null||value===''))throw Error('Enter the LATR amount manually.');
   if(value!==undefined&&value!==null&&value!==''&&(!Number.isFinite(Number(value))||Number(value)<0))throw Error('Enter a valid non-negative LATR amount.');
  }
  if(calculated.remainingCashMargin<0)throw Error('Manifest margin exceeds the remaining actual cash margin. Check existing releases and the actual LC cash margin.');
  const record={...input,basis,...calculated,manifestNumber:basis.manifest,lcOpeningId:basis.lcOpeningId,id:input.id||crypto.randomUUID(),number:old?.number||'DR-'+String(records.length+1).padStart(6,'0'),revision:(revision||0)+1,updatedAt:new Date().toISOString(),history:old?[...(old.history||[]),{action:'Modified',at:new Date().toISOString(),before:{header:old.header,rows:old.rows}}]:[]};
  if(index>=0)records[index]=record;else records.push(record);localStorage.setItem(this.key,JSON.stringify(records));return record;
 }
};
