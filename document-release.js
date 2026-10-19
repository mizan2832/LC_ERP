const dr=id=>document.getElementById(id),drFields=['documentType','releaseDate','policy','nocDate','rate','loanType','loanValue','loanNumber','surveyBill','remarks'];
let releaseId='',releaseRevision=0,releaseStatus='New',releaseBasis=null,releaseEditing=false;
const drFmt=value=>Number(value||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});
const drEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function drMessage(text,error=false){dr('message').textContent=text;dr('message').className=error?'error':'success'}
function releaseLists(){
 const selected=dr('manifest').value,query=dr('manifestSearch').value.toLowerCase(),records=ReleaseStore.read();
 dr('manifest').replaceChildren(new Option('Select received manifest',''));
 PortStore.read().filter(r=>r.status==='Received'&&(!records.some(d=>d.portReceiptId===r.id&&d.id!==releaseId&&d.status!=='Cancelled'))).forEach(receipt=>{
  const lc=LCStore.read().find(l=>l.id===receipt.lcOpeningId),label=receipt.header.manifest+' · LC '+(lc?.number||'')+' · '+receipt.number;
  if(label.toLowerCase().includes(query)||receipt.id===selected)dr('manifest').add(new Option(label,receipt.id));
 });dr('manifest').value=selected;
 dr('savedRelease').replaceChildren(new Option('Select saved release',''));records.forEach(r=>dr('savedRelease').add(new Option(r.number+' · '+r.manifestNumber+' · '+r.status+' · '+r.glStatus,r.id)));
}
function renderManifestDetails(calc){
 const rows=calc.rows.filter(row=>row.manifestQty>0);
 const valueTotal=field=>rows.every(row=>row[field]!==null&&row[field]!==undefined)?drFmt(rows.reduce((sum,row)=>sum+Number(row[field]),0)):'Not captured';
 rows.forEach(row=>{
  const tr=document.createElement('tr');
  tr.innerHTML=`<td>${drEscape(row.itemName)}</td><td>${drFmt(row.ordered)} ${drEscape(row.uom)}</td><td>${drFmt(row.manifestQty)} ${drEscape(row.uom)}</td><td>${row.totalOrderLC===null||row.totalOrderLC===undefined?'Not captured':drFmt(row.totalOrderLC)}</td><td>${row.manifestOpeningLC===null?'Not captured':drFmt(row.manifestOpeningLC)}</td><td>${drFmt(row.amountLC)}</td><td>${row.exchangeDifference===null?'Not captured':drFmt(row.exchangeDifference)}</td><td>${row.standardManifestMargin===null?'Not captured':drFmt(row.standardManifestMargin)}</td><td>${drFmt(row.margin)}</td><td class="margin-variance">${row.marginVariance===null?'Not captured':drFmt(row.marginVariance)}</td>`;
  dr('releaseRows').append(tr);
 });
 const units=new Map();rows.forEach(row=>{const quantities=units.get(row.uom)||{ordered:0,manifestQty:0};quantities.ordered+=row.ordered;quantities.manifestQty+=row.manifestQty;units.set(row.uom,quantities)});
 const quantityTotal=field=>[...units].map(([unit,quantities])=>drFmt(quantities[field])+' '+drEscape(unit)).join('<br>');
 dr('releaseTotals').innerHTML=`<tr><td>Total</td><td>${quantityTotal('ordered')}</td><td>${quantityTotal('manifestQty')}</td><td>${rows.every(row=>row.totalOrderLC!==null&&row.totalOrderLC!==undefined)?drFmt(rows.reduce((sum,row)=>sum+row.totalOrderLC,0)):'Not captured'}</td><td>${valueTotal('manifestOpeningLC')}</td><td>${drFmt(rows.reduce((sum,row)=>sum+row.amountLC,0))}</td><td>${valueTotal('exchangeDifference')}</td><td>${calc.totalStandardManifestMargin===null?'Not captured':drFmt(calc.totalStandardManifestMargin)}</td><td>${drFmt(calc.margin)}</td><td class="margin-variance">${calc.totalMarginVariance===null?'Not captured':drFmt(calc.totalMarginVariance)}</td></tr>`;
}
function renderRelease(){
 const old=releaseId?ReleaseStore.read().find(r=>r.id===releaseId):null;
 const blocked=old?ReleaseStore.blocked(old.id):'',locked=Boolean(old&&(old.glStatus==='Posted'||old.status==='Cancelled'||blocked||!releaseEditing));
 dr('releaseStatus').textContent=releaseEditing?'Editing':releaseStatus;
 dr('releaseRows').replaceChildren();dr('releaseTotals').replaceChildren();
 if(releaseBasis){
  ['lcNumber','customInvoice','party','currency'].forEach(id=>dr(id).value=releaseBasis[id]||'');
  try{
   const calc=ReleaseStore.calculate(releaseBasis,dr('rate').value,dr('loanType').value,releaseId,dr('loanValue').value);
   renderManifestDetails(calc);
   dr('cashMargin').value=drFmt(calc.cashMargin);dr('usedMargin').value=drFmt(calc.usedMargin);dr('remainingMargin').value=drFmt(calc.remainingCashMargin);dr('margin').value=drFmt(calc.margin);
   dr('releaseNote').textContent='Opening-rate values remain fixed. Bank-rate value = manifest foreign-currency value times the entered bank conversion rate; exchange difference = bank-rate value minus opening-rate value (positive means an increase in BDT). Until confirmed by the bank, this is an estimate. Cash margins remain unchanged; LATR is entered manually from bank advice.';
  }catch(e){drMessage(e.message,true)}
 }
 dr('loanNote').textContent=dr('loanType').value==='LATR'?'Enter the LATR amount manually in BDT.':'';
 drFields.forEach(id=>dr(id).disabled=locked);document.querySelectorAll('[name="releaseGL"]').forEach(input=>input.disabled=locked);
 dr('manifest').disabled=Boolean(releaseId);dr('draftRelease').disabled=locked;dr('saveRelease').disabled=locked;
 dr('modifyRelease').disabled=!old||old.glStatus==='Posted'||old.status==='Cancelled'||Boolean(blocked);
 updateReleaseHistoryButtons();
 dr('modifyRelease').textContent=releaseEditing?'Save Changes':'Modify';dr('cancelRelease').disabled=!old||old.status==='Cancelled'||old.glStatus==='Posted'||Boolean(blocked);
}
function loadRelease(record){releaseId=record.id;releaseRevision=record.revision;releaseStatus=record.status;releaseEditing=false;releaseBasis=JSON.parse(JSON.stringify(record.basis));drFields.forEach(id=>dr(id).value=record.header[id]??(id==='loanValue'?record.loanValue??'':''));document.querySelectorAll('[name="releaseGL"]').forEach(input=>input.checked=input.value===record.glStatus);dr('releaseNumber').value=record.number;dr('manifestSearch').value='';releaseLists();dr('manifest').value=record.portReceiptId;renderRelease();drMessage(record.number+' loaded.');resetReleaseHistory();}
function saveRelease(status){try{if(!releaseBasis)throw Error('Select a received manifest.');const record=ReleaseStore.save({id:releaseId,status,portReceiptId:releaseBasis.receiptId,header:Object.fromEntries(drFields.map(id=>[id,dr(id).value])),glStatus:document.querySelector('[name="releaseGL"]:checked').value},releaseRevision);loadRelease(record);drMessage(record.number+' saved as '+record.status+'.')}catch(e){drMessage(e.message,true)}}
function newRelease(){releaseId='';releaseRevision=0;releaseStatus='New';releaseEditing=false;releaseBasis=null;drFields.forEach(id=>dr(id).value='');['releaseNumber','lcNumber','customInvoice','party','currency','margin','loanValue','cashMargin','usedMargin','remainingMargin','manifestSearch'].forEach(id=>dr(id).value='');dr('documentType').value='Original';dr('loanType').value='LATR';dr('releaseDate').value=LCDateRules.today();document.querySelector('[name="releaseGL"][value="Unposted"]').checked=true;releaseLists();dr('manifest').value='';renderRelease();drMessage('');resetReleaseHistory();}
dr('manifestSearch').oninput=()=>{try{releaseLists()}catch(e){drMessage(e.message,true)}};
dr('manifest').onchange=()=>{try{releaseBasis=dr('manifest').value?ReleaseStore.basis(dr('manifest').value):null;dr('rate').value=releaseBasis?.rate||'';dr('loanValue').value='';if(!releaseBasis)['lcNumber','customInvoice','party','currency','margin','loanValue','cashMargin','usedMargin','remainingMargin'].forEach(id=>dr(id).value='');renderRelease();drMessage('');resetReleaseHistory()}catch(e){releaseBasis=null;drMessage(e.message,true)}};
dr('rate').oninput=renderRelease;dr('loanType').onchange=renderRelease;dr('newRelease').onclick=newRelease;dr('draftRelease').onclick=()=>saveRelease('Draft');dr('saveRelease').onclick=()=>saveRelease('Released');
dr('modifyRelease').onclick=()=>{if(releaseEditing){saveRelease(releaseStatus==='Released'?'Released':'Draft');return}releaseEditing=true;renderRelease();drMessage('Modify mode. Update fields, then click Save Changes.');};
dr('savedRelease').onchange=()=>{try{const r=ReleaseStore.read().find(r=>r.id===dr('savedRelease').value);if(r)loadRelease(r)}catch(e){drMessage(e.message,true)}};
dr('cancelRelease').onclick=()=>{try{const record=Rollback.cancel(ReleaseStore,releaseId,releaseRevision,id=>ReleaseStore.blocked(id));loadRelease(record);drMessage(record.number+' cancelled. The manifest is available again.')}catch(e){drMessage(e.message,true)}};
window.addEventListener('storage',event=>{if([ReleaseStore.key,PortStore.key,ExpenseStore.key,LCStore.key,'lc-duty-calculations-v1'].includes(event.key)){releaseLists();renderRelease();drMessage('Related records changed. Reload before saving.',true)}});

// History covers editable form values only; persisted releases are never rolled back.
let releaseUndo=[],releaseRedo=[],releaseHistoryState=null;
function releaseFormState(){return {fields:Object.fromEntries(drFields.map(id=>[id,dr(id).value])),gl:document.querySelector('[name="releaseGL"]:checked').value}}
function updateReleaseHistoryButtons(){
 const locked=dr('documentType').disabled;
 dr('undoRelease').disabled=locked||!releaseUndo.length;
 dr('redoRelease').disabled=locked||!releaseRedo.length;
}
function resetReleaseHistory(){releaseUndo=[];releaseRedo=[];releaseHistoryState=releaseFormState();updateReleaseHistoryButtons()}
function captureReleaseEdit(){
 if(dr('documentType').disabled)return;
 const next=releaseFormState();
 if(JSON.stringify(next)===JSON.stringify(releaseHistoryState))return;
 if(releaseHistoryState)releaseUndo.push(releaseHistoryState);
 if(releaseUndo.length>100)releaseUndo.shift();
 releaseRedo=[];releaseHistoryState=next;updateReleaseHistoryButtons();
}
function moveReleaseHistory(source,target){
 if(dr('documentType').disabled||!source.length)return;
 target.push(releaseFormState());const state=source.pop();
 drFields.forEach(id=>dr(id).value=state.fields[id]);
 document.querySelectorAll('[name="releaseGL"]').forEach(input=>input.checked=input.value===state.gl);
 releaseHistoryState=state;renderRelease();
}
drFields.forEach(id=>dr(id).addEventListener('change',captureReleaseEdit));
document.querySelectorAll('[name="releaseGL"]').forEach(input=>input.addEventListener('change',captureReleaseEdit));
dr('undoRelease').onclick=()=>{captureReleaseEdit();moveReleaseHistory(releaseUndo,releaseRedo)};
dr('redoRelease').onclick=()=>moveReleaseHistory(releaseRedo,releaseUndo);
newRelease();
