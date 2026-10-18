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
function renderRelease(){
 const old=releaseId?ReleaseStore.read().find(r=>r.id===releaseId):null;
 const blocked=old?ReleaseStore.blocked(old.id):'',locked=Boolean(old&&(old.glStatus==='Posted'||old.status==='Cancelled'||blocked||!releaseEditing));
 dr('releaseStatus').textContent=releaseEditing?'Editing':releaseStatus;
 dr('releaseRows').replaceChildren();dr('releaseTotals').replaceChildren();
 if(releaseBasis){
  ['lcNumber','customInvoice','party','currency'].forEach(id=>dr(id).value=releaseBasis[id]||'');
  try{
   const calc=ReleaseStore.calculate(releaseBasis,dr('rate').value,dr('loanType').value,releaseId,dr('loanValue').value);
   calc.rows.forEach(row=>{
    const tr=document.createElement('tr');tr.innerHTML=`<td>${drEscape(row.itemCode)}</td><td>${drEscape(row.itemName)}</td><td>${drEscape(row.uom)}</td><td>${drFmt(row.ordered)}</td><td>${drFmt(row.manifestQty)}</td><td>${drFmt(row.amountFC)}</td><td>${drFmt(row.amountLC)}</td><td>${row.standardUnit===null?'Not captured':drFmt(row.standardUnit)}<small>${drEscape(row.standardSetup)}</small></td><td>${row.totalStandardLC===null?'Not captured':drFmt(row.totalStandardLC)}</td><td>${row.standardMarginUnit===null||row.standardMarginUnit===undefined?'Not captured':drFmt(row.standardMarginUnit)}</td><td>${row.actualLCItemMargin===undefined?'Not captured':drFmt(row.actualLCItemMargin)}</td><td>${row.actualMarginPerUnit===null?'—':drFmt(row.actualMarginPerUnit)}</td><td>${drFmt(row.margin)}</td><td class="margin-variance" title="Actual manifest margin minus standard margin per unit × manifest quantity">${row.marginVariance===null?'Not captured':drFmt(row.marginVariance)}</td>`;dr('releaseRows').append(tr);
   });
   const units=new Map();calc.rows.forEach(r=>{const group=units.get(r.uom)||{order:0,manifest:0};group.order+=r.ordered;group.manifest+=r.manifestQty;units.set(r.uom,group)});
   const unitTotal=field=>[...units].map(([unit,q])=>drFmt(q[field])+' '+drEscape(unit)).join('<br>');
   dr('releaseTotals').innerHTML=`<tr><td colspan="3">Total</td><td>${unitTotal('order')}</td><td>${unitTotal('manifest')}</td><td>${drFmt(calc.totalFC)} ${drEscape(releaseBasis.currency)}</td><td>${drFmt(calc.totalLC)}</td><td></td><td>${calc.standardComplete?drFmt(calc.totalStandardLC):'Incomplete snapshot'}</td><td></td><td>${calc.totalActualLCItemMargin===null?'Not captured':drFmt(calc.totalActualLCItemMargin)}</td><td></td><td>${drFmt(calc.margin)}</td><td class="margin-variance">${calc.totalMarginVariance===null?'Not captured':drFmt(calc.totalMarginVariance)}</td></tr>`;
   dr('cashMargin').value=drFmt(calc.cashMargin);dr('usedMargin').value=drFmt(calc.usedMargin);dr('remainingMargin').value=drFmt(calc.remainingCashMargin);dr('margin').value=drFmt(calc.margin);
   dr('releaseNote').textContent='Manifest margin = actual LC cash margin allocated by item value and manifest quantity. Standard margin is shown for comparison only. '+(releaseBasis.marginAvailable?'':'No saved actual LC margin head was found. ')+ 'Standard costs use saved LC expense snapshots; later master changes do not update this release.';
  }catch(e){drMessage(e.message,true)}
 }
 dr('loanNote').textContent=dr('loanType').value==='LATR'?'Enter the LATR amount manually in BDT.':'';
 drFields.forEach(id=>dr(id).disabled=locked);document.querySelectorAll('[name="releaseGL"]').forEach(input=>input.disabled=locked);
 dr('manifest').disabled=Boolean(releaseId);dr('draftRelease').disabled=locked;dr('saveRelease').disabled=locked;
 dr('modifyRelease').disabled=!old||old.glStatus==='Posted'||old.status==='Cancelled'||Boolean(blocked);
 dr('modifyRelease').textContent=releaseEditing?'Save Changes':'Modify';dr('cancelRelease').disabled=!old||old.status==='Cancelled'||old.glStatus==='Posted'||Boolean(blocked);
}
function loadRelease(record){releaseId=record.id;releaseRevision=record.revision;releaseStatus=record.status;releaseEditing=false;releaseBasis=JSON.parse(JSON.stringify(record.basis));drFields.forEach(id=>dr(id).value=record.header[id]??(id==='loanValue'?record.loanValue??'':''));document.querySelectorAll('[name="releaseGL"]').forEach(input=>input.checked=input.value===record.glStatus);dr('releaseNumber').value=record.number;dr('manifestSearch').value='';releaseLists();dr('manifest').value=record.portReceiptId;renderRelease();drMessage(record.number+' loaded.');}
function saveRelease(status){try{if(!releaseBasis)throw Error('Select a received manifest.');const record=ReleaseStore.save({id:releaseId,status,portReceiptId:releaseBasis.receiptId,header:Object.fromEntries(drFields.map(id=>[id,dr(id).value])),glStatus:document.querySelector('[name="releaseGL"]:checked').value},releaseRevision);loadRelease(record);drMessage(record.number+' saved as '+record.status+'.')}catch(e){drMessage(e.message,true)}}
function newRelease(){releaseId='';releaseRevision=0;releaseStatus='New';releaseEditing=false;releaseBasis=null;drFields.forEach(id=>dr(id).value='');['releaseNumber','lcNumber','customInvoice','party','currency','margin','loanValue','cashMargin','usedMargin','remainingMargin','manifestSearch'].forEach(id=>dr(id).value='');dr('documentType').value='Original';dr('loanType').value='LATR';dr('releaseDate').value=LCDateRules.today();document.querySelector('[name="releaseGL"][value="Unposted"]').checked=true;releaseLists();dr('manifest').value='';renderRelease();drMessage('');}
dr('manifestSearch').oninput=()=>{try{releaseLists()}catch(e){drMessage(e.message,true)}};
dr('manifest').onchange=()=>{try{releaseBasis=dr('manifest').value?ReleaseStore.basis(dr('manifest').value):null;dr('rate').value=releaseBasis?.rate||'';dr('loanValue').value='';if(!releaseBasis)['lcNumber','customInvoice','party','currency','margin','loanValue','cashMargin','usedMargin','remainingMargin'].forEach(id=>dr(id).value='');renderRelease();drMessage('')}catch(e){releaseBasis=null;drMessage(e.message,true)}};
dr('rate').oninput=renderRelease;dr('loanType').onchange=renderRelease;dr('newRelease').onclick=newRelease;dr('draftRelease').onclick=()=>saveRelease('Draft');dr('saveRelease').onclick=()=>saveRelease('Released');
dr('modifyRelease').onclick=()=>{if(releaseEditing){saveRelease(releaseStatus==='Released'?'Released':'Draft');return}releaseEditing=true;renderRelease();drMessage('Modify mode. Update fields, then click Save Changes.');};
dr('savedRelease').onchange=()=>{try{const r=ReleaseStore.read().find(r=>r.id===dr('savedRelease').value);if(r)loadRelease(r)}catch(e){drMessage(e.message,true)}};
dr('cancelRelease').onclick=()=>{try{const record=Rollback.cancel(ReleaseStore,releaseId,releaseRevision,id=>ReleaseStore.blocked(id));loadRelease(record);drMessage(record.number+' cancelled. The manifest is available again.')}catch(e){drMessage(e.message,true)}};
window.addEventListener('storage',event=>{if([ReleaseStore.key,PortStore.key,ExpenseStore.key,LCStore.key,'lc-duty-calculations-v1'].includes(event.key)){releaseLists();renderRelease();drMessage('Related records changed. Reload before saving.',true)}});
newRelease();
