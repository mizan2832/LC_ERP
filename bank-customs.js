const bc=id=>document.getElementById(id),bcFmt=n=>Number(n||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2}),bcEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let bcId='',bcRevision=0,bcStatus='New',bcEditing=false,bcBasis=null,bcRows=[],bcActive=-1;
function bcMessage(text,error=false){bc('message').textContent=text;bc('message').className=error?'error':'success'}
function bcLocked(){return Boolean(bcId&&(bcStatus==='Cancelled'||BankCustomsStore.blocked(bcId)||!bcEditing))}
function bcQty(rows){const units={};rows.forEach(r=>units[r.uom]=(units[r.uom]||0)+r.qty);return Object.entries(units).map(([unit,qty])=>bcFmt(qty)+' '+unit).join(' · ')}
function bcStandardFormula(check){return bcFmt(check.unitStandard)+' BDT / '+check.standardUom+' x '+bcFmt(check.standardQty)+' '+check.standardUom+' = '+bcFmt(check.total)+' BDT'}
function bcStandardBreakdown(cell,total,headKey){
 const opened=cell.querySelector('details')?.open||false;
 cell.replaceChildren();
 if(total===null){cell.textContent='Select cost head';return}
 const amount=document.createElement('strong');amount.textContent=bcFmt(total);cell.append(amount);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Item-wise calculation';details.open=opened;details.append(summary);
 BankCustomsStore.checks(bcBasis,headKey).forEach(check=>{
  const line=document.createElement('div');line.className='bc-standard-breakdown';
  line.textContent=check.sku+': '+bcStandardFormula(check);
  line.title='Saved standard setup '+check.setupNumber;details.append(line);
 });cell.append(details);
}
function bcTotals(){
 let actual=0,standard=0,complete=true;
 bcRows.forEach((row,index)=>{
  let amount=null,total=null;try{total=BankCustomsStore.standardTotal(bcBasis,row.headKey)}catch{complete=false}
  if(row.amount!==''&&Number.isFinite(Number(row.amount)))amount=Number(row.amount);else complete=false;
  actual+=amount||0;standard+=total||0;
  const tr=bc('expenseRows').children[index];if(tr){bcStandardBreakdown(tr.cells[2],total,row.headKey);tr.cells[4].textContent=total===null||amount===null?'—':bcFmt(amount-total)}
 });
 bc('expenseTotal').textContent=bcFmt(actual);bc('standardTotal').textContent=bcFmt(standard);bc('varianceTotal').textContent=complete?bcFmt(actual-standard):'—';
 bc('allocationRows').replaceChildren();if(!bcBasis)return;
 try{
  const prior=bcId?BankCustomsStore.read().find(r=>r.id===bcId):null;
  const result=prior&&!bcEditing?prior.allocation:CostAllocation.calculate(bcBasis.rows,bcRows.filter(r=>r.headKey&&Number.isFinite(Number(r.amount))).map(r=>({...r,amount:Number(r.amount)||0})));
  result.lines.forEach(line=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${bcEsc(line.itemCode)}</td><td>${bcEsc(line.itemName)}</td><td>${bcFmt(line.qty)} ${bcEsc(line.uom)}</td><td>${bcFmt(line.baselineValue)}</td><td>${(line.weight*100).toFixed(2)}%</td><td>${line.allocations.map(a=>bcEsc(a.headName)+': '+bcFmt(a.amount)).join('<br>')}</td><td>${bcFmt(line.allocatedExpense)}</td><td>${bcFmt(line.allocatedExpense/line.qty)} BDT / ${bcEsc(line.uom)}</td>`;bc('allocationRows').append(tr)});
 }catch(error){bcMessage(error.message,true)}
}
function renderBC(){
 const locked=bcLocked();bc('expenseStatus').textContent=bcEditing?'Editing':bcStatus;bc('expenseRows').replaceChildren();
 if(bcBasis){
  ['releaseNumber','dutyNumber','manifestNumber','manifestDate','lcNumber','lcDate','releaseDate','party','currency','rate','customInvoice','commercialInvoice','piInfo','documentType','policy','nocDate','loanType','loanNumber'].forEach(id=>bc(id).value=bcBasis[id]??'');
  ['margin','cashMargin','remainingCashMargin','loanValue'].forEach(id=>bc(id).value=bcBasis[id]===undefined?'Not captured':bcFmt(bcBasis[id]));bc('manifestQty').value=bcQty(bcBasis.rows);
 }
 bcRows.forEach((row,index)=>{
  const rowLocked=locked||row.glStatus==='Posted',tr=document.createElement('tr');tr.innerHTML=`<td>${index+1}</td><td></td><td></td><td></td><td class="bc-variance"></td><td></td><td>${bcEsc(row.glStatus||'Unposted')}</td><td></td><td></td>`;
  const head=document.createElement('input');head.readOnly=true;head.value=row.headName||'';head.placeholder='Double-click to select cost head';head.disabled=rowLocked;head.setAttribute('aria-label','Cost head row '+(index+1));head.ondblclick=()=>openBCHeads(index);head.onkeydown=e=>{if(e.key==='Enter')openBCHeads(index)};tr.cells[1].append(head);
  const amountInput=document.createElement('input');amountInput.type='number';amountInput.min='0';amountInput.step='0.01';amountInput.value=row.amount??'';amountInput.disabled=rowLocked;amountInput.setAttribute('aria-label','Actual amount for '+(row.headName||'row '+(index+1)));amountInput.oninput=()=>{row.amount=amountInput.value;bcTotals()};tr.cells[3].append(amountInput);
  tr.cells[5].append(ExpenseParties.createSelect(row,{required:true,disabled:rowLocked,label:'Party code and name for '+(row.headName||'row '+(index+1)),onchange:bcTotals}));
  const post=document.createElement('button');post.textContent=row.glStatus==='Posted'?'Posted':'GL Post';post.disabled=!bcId||bcEditing||bcStatus!=='Saved'||row.glStatus==='Posted'||Boolean(bcId&&BankCustomsStore.blocked(bcId));post.title='Save changes first. Posting records GL status in this browser and locks this row.';post.onclick=()=>{try{loadBC(BankCustomsStore.post(bcId,row.id,bcRevision));bcMessage('Cost row posted and locked.')}catch(error){bcMessage(error.message,true)}};tr.cells[7].append(post);
  const remove=document.createElement('button');remove.textContent='Remove';remove.disabled=rowLocked;remove.onclick=()=>{bcRows.splice(index,1);renderBC()};tr.cells[8].append(remove);bc('expenseRows').append(tr);
 });
 if(!bcRows.length)bc('expenseRows').innerHTML='<tr><td colspan="9">Click Add Row, then double-click its cost-head field.</td></tr>';
 ['costDate','reference','remarks','addCost'].forEach(id=>bc(id).disabled=locked);['draftExpense','saveExpense'].forEach(id=>bc(id).disabled=locked||!bcBasis);if(bcStatus==='Saved')bc('draftExpense').disabled=true;
 bc('selectManifest').disabled=Boolean(bcId);bc('modifyExpense').disabled=!bcId||bcStatus==='Cancelled'||Boolean(bcId&&BankCustomsStore.blocked(bcId));bc('modifyExpense').textContent=bcEditing?'Save Changes':'Modify';bc('cancelExpense').disabled=!bcId||bcStatus==='Cancelled'||Boolean(bcId&&BankCustomsStore.cancelBlock(bcId));bcTotals();
}
function newBC(){bcId='';bcRevision=0;bcStatus='New';bcEditing=false;bcBasis=null;bcRows=[];document.querySelectorAll('main input,main textarea').forEach(input=>input.value='');bc('costDate').value=LCDateRules.today();renderBC();bcMessage('Double-click Manifest number to choose a manifest with a saved duty calculation.');}
function loadBC(record){bcId=record.id;bcRevision=record.revision;bcStatus=record.status;bcEditing=false;bcBasis=JSON.parse(JSON.stringify(record.basis));bcRows=JSON.parse(JSON.stringify(record.rows));bc('expenseNumber').value=record.number;['costDate','reference','remarks'].forEach(id=>bc(id).value=record.header[id]||'');renderBC();bcMessage(record.number+' loaded. Click Modify to update unposted rows.');}
function saveBC(status){try{if(!bcBasis||bcLocked())throw Error('Select an editable manifest expense.');const record=BankCustomsStore.save({id:bcId,dutyCalculationId:bcBasis.dutyCalculationId,status,header:Object.fromEntries(['costDate','reference','remarks'].map(id=>[id,bc(id).value])),rows:bcRows},bcRevision);loadBC(record);bcMessage(record.number+' saved.')}catch(error){bcMessage(error.message,true)}}
function drawBCManifests(){
 try{const query=bc('manifestSearch').value.trim().toLowerCase();bc('manifestChoices').replaceChildren();RecordPickerOrder.latest(DutyStore.read()).filter(d=>d.status==='Saved'&&[d.manifestNumber,d.basis.lcNumber,d.number].join(' ').toLowerCase().includes(query)).forEach(duty=>{
  const saved=BankCustomsStore.read().find(r=>r.portReceiptId===duty.portReceiptId&&r.status!=='Cancelled'),button=document.createElement('button');button.textContent=duty.manifestNumber+' · LC '+duty.basis.lcNumber+' · '+(saved?saved.number+' · '+saved.status:'New expense');button.onclick=()=>{try{if(saved)loadBC(saved);else{newBC();bcBasis=BankCustomsStore.basis(duty.id);bcRows=BankCustomsStore.initialRows(bcBasis);renderBC();bcMessage('Standard cost heads loaded automatically. Enter actual amounts and use Add Row for additional costs.')}bc('manifestPicker').close()}catch(error){bcMessage(error.message,true)}};bc('manifestChoices').append(button)
 });if(!bc('manifestChoices').children.length)bc('manifestChoices').textContent='No matching manifests with a saved duty calculation. Save the duty entry first.'}catch(error){bcMessage(error.message,true)}
}
function openBCManifests(){if(bcId)return;bc('manifestSearch').value='';drawBCManifests();bc('manifestPicker').showModal();bc('manifestSearch').focus()}
function drawBCSaved(){const query=bc('savedSearch').value.toLowerCase();bc('savedChoices').replaceChildren();RecordPickerOrder.latest(BankCustomsStore.read()).filter(r=>[r.number,r.manifestNumber,r.basis.lcNumber].join(' ').toLowerCase().includes(query)).forEach(record=>{const button=document.createElement('button');button.textContent=record.number+' · '+record.manifestNumber+' · '+record.status;button.onclick=()=>{const current=BankCustomsStore.read().find(r=>r.id===record.id);if(current){loadBC(current);bc('savedPicker').close()}};bc('savedChoices').append(button)});if(!bc('savedChoices').children.length)bc('savedChoices').textContent='No matching saved expense entries.'}
function openBCSaved(){try{bc('savedSearch').value='';drawBCSaved();bc('savedPicker').showModal()}catch(error){bcMessage(error.message,true)}}
function drawBCHeads(){const query=bc('headSearch').value.toLowerCase();bc('headChoice').replaceChildren(new Option('Select cost head',''));BankCustomsStore.heads(bcBasis).filter(head=>(head.name+' '+BANK_CUSTOMS_GROUPS[head.group]).toLowerCase().includes(query)).forEach(head=>bc('headChoice').add(new Option(BANK_CUSTOMS_GROUPS[head.group]+' · '+head.name,head.headKey)));checkBCHead();if(bc('headChoice').options.length===1){const note=document.createElement('div');note.className='standard-check missing';note.textContent='No matching cost heads.';bc('headChecks').append(note)}}
function checkBCHead(){bc('headChecks').replaceChildren();bc('confirmHead').disabled=true;const key=bc('headChoice').value;if(!key)return;const checks=BankCustomsStore.checks(bcBasis,key);checks.forEach(check=>{const div=document.createElement('div');div.className=check.valid?'standard-check valid':'standard-check missing';div.textContent=check.missingStandard?check.message:check.valid?check.sku+' · '+bcStandardFormula(check):check.message;bc('headChecks').append(div)});const duplicate=bcRows.some((r,i)=>i!==bcActive&&r.headKey===key);if(duplicate){const div=document.createElement('div');div.textContent='This cost head is already added.';bc('headChecks').append(div)}bc('confirmHead').disabled=duplicate||checks.some(c=>!c.valid)}
function openBCHeads(index){if(bcLocked()||bcRows[index].glStatus==='Posted')return;bcActive=index;bc('headSearch').value='';drawBCHeads();bc('costPicker').showModal()}
bc('manifestNumber').ondblclick=openBCManifests;bc('manifestNumber').onkeydown=e=>{if(e.key==='Enter')openBCManifests()};bc('selectManifest').onclick=openBCManifests;bc('closeManifest').onclick=()=>bc('manifestPicker').close();bc('manifestSearch').oninput=drawBCManifests;
bc('expenseNumber').ondblclick=openBCSaved;bc('expenseNumber').onkeydown=e=>{if(e.key==='Enter')openBCSaved()};bc('closeSaved').onclick=()=>bc('savedPicker').close();bc('savedSearch').oninput=drawBCSaved;
bc('headSearch').oninput=drawBCHeads;bc('headChoice').onchange=checkBCHead;bc('closeCost').onclick=()=>bc('costPicker').close();
bc('confirmHead').onclick=()=>{try{const key=bc('headChoice').value;BankCustomsStore.standardTotal(bcBasis,key);if(bcRows.some((r,i)=>i!==bcActive&&r.headKey===key))throw Error('Duplicate cost head.');const head=BankCustomsStore.heads(bcBasis).find(h=>h.headKey===key);if(!head)throw Error('Select a cost head.');bcRows[bcActive]={...bcRows[bcActive],headKey:key,headName:head.name};renderBC();bc('costPicker').close()}catch(error){bcMessage(error.message,true)}};
bc('addCost').onclick=()=>{if(!bcBasis)return bcMessage('Select a manifest first.',true);bcRows.push({id:crypto.randomUUID(),headKey:'',headName:'',amount:'',partyCode:'',partyName:'',glStatus:'Unposted'});renderBC()};
bc('newExpense').onclick=newBC;bc('draftExpense').onclick=()=>saveBC('Draft');bc('saveExpense').onclick=()=>saveBC('Saved');bc('modifyExpense').onclick=()=>{if(bcEditing){saveBC(bcStatus==='Saved'?'Saved':'Draft');return}bcEditing=true;renderBC();bcMessage('Modify mode. Posted cost rows remain locked.');};
bc('cancelExpense').onclick=()=>{try{loadBC(Rollback.cancel(BankCustomsStore,bcId,bcRevision,id=>BankCustomsStore.cancelBlock(id)));bcMessage('Expense cancelled.')}catch(error){bcMessage(error.message,true)}};
window.addEventListener('storage',event=>{if([BankCustomsStore.key,DutyStore.key,ReleaseStore.key,'lc-finished-goods-receipts-v1'].includes(event.key)){renderBC();bcMessage('Related records changed. Reload before saving.',true)}});
newBC();
