const dt=id=>document.getElementById(id),dutyFields=['costDate','rate','reference','referenceDate','boeNumber','boeDate','dutyParty','cnfParty','remarks'];
let dutyId='',dutyRevision=0,dutyStatus='New',dutyEditing=false,dutyBasis=null,dutyRows=[];
const df=value=>Number(value||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});
const dx=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const da=value=>value===null||value===undefined?'Enter actual':df(value);
const ds=value=>value===null||value===undefined?'Not captured':df(value);
function dutyMessage(text,error=false){dt('message').textContent=text;dt('message').className=error?'error':'success'}
function dutyQuantityLabel(lines){const units={};lines.forEach(r=>units[r.uom]=(units[r.uom]||0)+r.qty);return Object.entries(units).map(([unit,qty])=>df(qty)+' '+unit).join(' · ')}
function dutyLists(){
 const selected=dt('manifest').value,query=dt('manifestSearch').value.trim().toLowerCase(),records=DutyStore.read();
 dt('manifest').replaceChildren(new Option('Select released manifest',''));
 ReleaseStore.read().filter(r=>r.status==='Released'&&!records.some(d=>d.id!==dutyId&&d.portReceiptId===r.portReceiptId&&d.status!=='Cancelled')).forEach(r=>{const label=r.manifestNumber+' · LC '+r.basis.lcNumber+' · '+r.number;if(label.toLowerCase().includes(query)||r.id===selected)dt('manifest').add(new Option(label,r.id))});dt('manifest').value=selected;
}
function dutyLocked(){const old=DutyStore.read().find(r=>r.id===dutyId);return Boolean(old&&(old.status==='Cancelled'||DutyStore.blocked(old.id)||!dutyEditing))}
function dutyTotals(){
 if(!dutyBasis)return;
 try{
  const result=DutyStore.calculate(dutyBasis,dutyRows,dt('rate').value);
  result.rows.forEach((row,index)=>{
   const tr=dt('dutyRows').children[index];if(!tr)return;
   const avInput=tr.querySelector('[data-actual-av]');if(avInput&&document.activeElement!==avInput)avInput.value=row.actualAV??'';
   tr.querySelector('[data-av-variance]').textContent=row.assessableVariance===null?'—':df(row.assessableVariance);
   DUTY_HEADS.forEach(head=>{const charge=row.heads[head.id];tr.querySelector('[data-standard-charge="'+head.id+'"]').textContent=ds(charge.standard);tr.querySelector('[data-variance="'+head.id+'"]').textContent=charge.variance===null?'—':df(charge.variance)});
   tr.querySelector('[data-row-total]').textContent=da(row.totalActual);tr.querySelector('[data-row-standard]').textContent=ds(row.totalStandard);tr.querySelector('[data-row-variance]').textContent=row.totalVariance===null?'—':df(row.totalVariance);
  });
  ['totalAV','totalStandardAV','totalActual','totalStandard'].forEach(id=>dt(id).textContent=['totalActual','totalAV'].includes(id)?da(result[id]):ds(result[id]));
  dt('dutyFoot').innerHTML=`<tr><td colspan="4">Totals by manifest</td><td>${dx(dutyQuantityLabel(result.rows))}</td><td colspan="2"></td><td>${df(result.rows.reduce((sum,row)=>sum+row.orderUnitPrice,0))}</td><td>${da(result.totalAV)}</td><td>${ds(result.totalStandardAV)}</td><td class="variance-cell">${result.totalAssessableVariance===null?'—':df(result.totalAssessableVariance)}</td>${DUTY_HEADS.map(head=>`<td>${result.rows.every(r=>r.heads[head.id].actual!==null)?df(result.rows.reduce((s,r)=>s+r.heads[head.id].actual,0)):'Enter actual'}</td><td>${result.rows.every(r=>r.heads[head.id].standard!==null)?df(result.rows.reduce((s,r)=>s+r.heads[head.id].standard,0)):'Not captured'}</td><td class="variance-cell">${result.rows.every(r=>r.heads[head.id].variance!==null)?df(result.rows.reduce((s,r)=>s+r.heads[head.id].variance,0)):'—'}</td>`).join('')}<td>${da(result.totalActual)}</td><td>${ds(result.totalStandard)}</td><td class="variance-cell">${result.totalVariance===null?'—':df(result.totalVariance)}</td></tr>`;
  dt('saveDuty').disabled=dutyLocked()||result.totalActual===null||result.totalAV===null;dt('draftDuty').disabled=dutyLocked();
 }catch(error){dutyMessage(error.message,true);dt('saveDuty').disabled=true;dt('draftDuty').disabled=true}
}
function renderDuty(){
 const locked=dutyLocked();dt('dutyStatus').textContent=dutyEditing?'Editing':dutyStatus;dt('dutyRows').replaceChildren();dt('dutyFoot').replaceChildren();
 if(dutyBasis){
  ['manifestDate','releaseNumber','lcNumber','lcDate','poInfo','piInfo','currency','party','customInvoice','commercialInvoice','commercialDate'].forEach(id=>dt(id).value=dutyBasis[id]||'');dt('manifestQty').value=dutyQuantityLabel(dutyBasis.rows);dt('lcQty').value=dutyQuantityLabel(dutyBasis.orderQuantities);dt('hsCodes').value=[...new Set(dutyBasis.rows.map(r=>r.hs))].join(', ');
  dutyRows.forEach((row,index)=>{
   const source=dutyBasis.rows[index],tr=document.createElement('tr');
   tr.innerHTML=`<td>${index+1}</td><td>${dx(source.itemCode)}</td><td>${dx(source.itemName)}<small>${dx(source.standardSetup||'Saved standard missing')}</small></td><td>${dx(source.hs)}</td><td>${df(source.qty)} ${dx(source.uom)}</td><td></td><td class="standard-cell">${ds(source.standardFOB)} ${dx(source.standardCurrency)}</td><td></td><td data-av></td><td class="standard-cell">${source.standardAV===null?'Not captured':df(source.standardAV*source.qty)}</td><td class="variance-cell" data-av-variance></td>`+DUTY_HEADS.map(head=>`<td data-head="${head.id}"></td><td class="standard-cell"><strong data-standard-charge="${head.id}"></strong><small>${source.heads[head.id].standard===null?'Not captured':df(source.heads[head.id].standard)+' × '+df(source.qty)+' '+dx(source.uom)}</small></td><td class="variance-cell" data-variance="${head.id}"></td>`).join('')+`<td class="duty-total" data-row-total></td><td class="standard-cell" data-row-standard></td><td class="variance-cell" data-row-variance></td>`;
   const avInput=document.createElement('input');avInput.type='number';avInput.min='0';avInput.step='any';avInput.placeholder='Total BDT';avInput.dataset.actualAv='';avInput.disabled=locked;avInput.value=row.actualAV??'';avInput.setAttribute('aria-label','Actual assessable value BDT total for '+row.itemCode);avInput.title='Enter the actual total assessable value in BDT for this SKU in the manifest, including any PSI adjustment.';avInput.oninput=()=>{row.actualAV=avInput.value===''?null:avInput.value;dutyTotals()};avInput.onblur=dutyTotals;tr.cells[8].append(avInput);
   [['rate',5],['orderUnitPrice',7]].forEach(([field,col])=>{
    const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.value=field==='orderUnitPrice'?DutyStore.orderValue(row):row[field];input.readOnly=true;input.disabled=locked;input.setAttribute('aria-label',(field==='rate'?'Item rate':'Order unit Price')+' for '+row.itemCode);tr.cells[col].append(input);
   });
   DUTY_HEADS.forEach(head=>{
    const cell=tr.querySelector('[data-head="'+head.id+'"]'),input=document.createElement('input');
    input.type='number';input.min='0';input.step='0.01';input.value=row.heads[head.id].value;input.placeholder='Total BDT';input.disabled=locked||!DutyStore.headConfigured(source,head);
    input.setAttribute('aria-label',head.name+' total BDT for '+row.itemCode);input.title=DutyStore.headConfigured(source,head)?'Enter the total amount for this SKU in the manifest. Quantity is not multiplied again.':'Not configured in the saved LC standard. Reverse downstream entries and cancel/recreate the LC opening to use a new standard.';
    input.oninput=()=>{row.heads[head.id].method='total';row.heads[head.id].value=input.value;dutyTotals()};cell.append(input);
   });dt('dutyRows').append(tr);
  });
 }else dt('dutyRows').innerHTML='<tr><td colspan="44">Select a released manifest to load its SKU items.</td></tr>';
 dutyFields.forEach(id=>dt(id).disabled=locked);dt('manifest').disabled=Boolean(dutyId);dt('draftDuty').disabled=locked||!dutyBasis;dt('saveDuty').disabled=locked||!dutyBasis;
 const blocked=dutyId?DutyStore.blocked(dutyId):'';dt('modifyDuty').disabled=!dutyId||dutyStatus==='Cancelled'||Boolean(blocked);dt('modifyDuty').textContent=dutyEditing?'Save Changes':'Modify';dt('cancelDuty').disabled=!dutyId||dutyStatus==='Cancelled'||Boolean(blocked);dutyTotals();
}
function newDuty(){dutyId='';dutyRevision=0;dutyStatus='New';dutyEditing=false;dutyBasis=null;dutyRows=[];dutyFields.forEach(id=>dt(id).value='');dt('costDate').value=LCDateRules.today();['dutyNumber','manifestSearch','manifestDate','manifestQty','releaseNumber','lcNumber','lcDate','lcQty','poInfo','piInfo','currency','party','customInvoice','commercialInvoice','commercialDate','hsCodes'].forEach(id=>dt(id).value='');['totalAV','totalStandardAV','totalActual','totalStandard'].forEach(id=>dt(id).textContent='0.00');dutyLists();dt('manifest').value='';renderDuty();dutyMessage('');}
// Convert legacy rate/per-unit inputs to their computed totals in memory only.
function dutyRowsAsTotals(basis,rows,rate){
 const computed=DutyStore.calculate(basis,rows,rate);
 return rows.map((row,index)=>({...row,heads:Object.fromEntries(DUTY_HEADS.map(head=>{
  const saved=row.heads[head.id],actual=Object.prototype.hasOwnProperty.call(saved,'actual')?saved.actual:computed.rows[index].heads[head.id].actual;
  return [head.id,{...saved,method:'total',value:actual===null||actual===undefined?(basis.rows[index].heads[head.id].standard==null||Number(basis.rows[index].heads[head.id].standard)===0?0:''):actual}];
 }))}));
}
function loadDuty(record){dutyId=record.id;dutyRevision=record.revision;dutyStatus=record.status;dutyEditing=false;dutyBasis=JSON.parse(JSON.stringify(record.basis));dutyRows=JSON.parse(JSON.stringify(record.rows));dutyFields.forEach(id=>dt(id).value=record.header[id]||'');dutyRows=dutyRowsAsTotals(dutyBasis,dutyRows,record.header.rate);dutyBasis=DutyStore.orderStandards(dutyBasis);dt('dutyNumber').value=record.number;dt('manifestSearch').value='';dutyLists();dt('manifest').value=record.documentReleaseId;renderDuty();dutyMessage(record.number+' loaded. Click Modify to update.');}
function saveDuty(status){try{if(!dutyBasis||dutyLocked())throw Error('Select an editable duty calculation.');const record=DutyStore.save({id:dutyId,documentReleaseId:dutyBasis.documentReleaseId,status,header:Object.fromEntries(dutyFields.map(id=>[id,dt(id).value])),rows:dutyRows},dutyRevision);loadDuty(record);dutyMessage(record.number+' saved as '+record.status+'.');}catch(error){dutyMessage(error.message,true)}}
function drawDutyPicker(){try{const query=dt('dutySearch').value.toLowerCase();dt('dutyChoices').replaceChildren();DutyStore.read().filter(r=>[r.number,r.manifestNumber,r.basis.lcNumber].join(' ').toLowerCase().includes(query)).forEach(record=>{const button=document.createElement('button');button.textContent=record.number+' · '+record.manifestNumber+' · LC '+record.basis.lcNumber+' · '+record.status;button.onclick=()=>{try{const current=DutyStore.read().find(r=>r.id===record.id);if(!current)throw Error('Duty record no longer exists.');loadDuty(current);dt('dutyPicker').close()}catch(error){dutyMessage(error.message,true)}};dt('dutyChoices').append(button)});if(!dt('dutyChoices').children.length)dt('dutyChoices').textContent='No matching saved duty calculations.';}catch(error){dutyMessage(error.message,true)}}
function openDutyPicker(){dt('dutySearch').value='';drawDutyPicker();dt('dutyPicker').showModal();dt('dutySearch').focus()}
dt('dutyNumber').ondblclick=openDutyPicker;dt('dutyNumber').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openDutyPicker()}};dt('closeDutyPicker').onclick=()=>dt('dutyPicker').close();dt('dutySearch').oninput=drawDutyPicker;
dt('manifestSearch').oninput=()=>{try{dutyLists()}catch(error){dutyMessage(error.message,true)}};
dt('manifest').onchange=()=>{try{dutyBasis=dt('manifest').value?DutyStore.basis(dt('manifest').value):null;dutyRows=dutyBasis?JSON.parse(JSON.stringify(dutyBasis.rows)):[];dutyRows.forEach(row=>DUTY_HEADS.forEach(head=>{row.heads[head.id].value=row.heads[head.id].standard==null||Number(row.heads[head.id].standard)===0?0:'';row.heads[head.id].method='total'}));dt('rate').value=dutyBasis?.rate||'';renderDuty();dutyMessage(dutyBasis?.rows.some(r=>!r.standardSnapshot)?'Saved standard setup is missing for one or more items. You can save a draft; completing duty requires the saved standards.':'Manifest items loaded. Enter actual duties separately; use 0 for heads that do not apply. Standard values remain fixed.',dutyBasis?.rows.some(r=>!r.standardSnapshot));}catch(error){dutyBasis=null;dutyRows=[];renderDuty();dutyMessage(error.message,true)}};
dt('rate').oninput=dutyTotals;dt('newDuty').onclick=newDuty;dt('draftDuty').onclick=()=>saveDuty('Draft');dt('saveDuty').onclick=()=>saveDuty('Saved');dt('modifyDuty').onclick=()=>{if(dutyEditing){saveDuty(dutyStatus==='Saved'?'Saved':'Draft');return}dutyEditing=true;renderDuty();dutyMessage('Modify mode. Update the costing and click Save Changes.');};
dt('cancelDuty').onclick=()=>{try{loadDuty(Rollback.cancel(DutyStore,dutyId,dutyRevision,id=>DutyStore.blocked(id)));dutyMessage('Duty calculation cancelled.')}catch(error){dutyMessage(error.message,true)}};
dt('dutyHead').innerHTML='<tr>'+['SL','Item code','Item description','HS code','Manifest quantity','Item rate (FC / order unit)','Standard FOB / order unit','Order unit Price (FC total)','Assessable value — actual','Assessable value — standard','Assessable value — variance (BDT)'].map(label=>'<th>'+label+'</th>').join('')+DUTY_HEADS.map(head=>'<th>'+dx(head.name)+' — actual total</th><th>'+dx(head.name)+' — standard total</th><th>'+dx(head.name)+' — variance</th>').join('')+'<th>Total government payment — actual</th><th>Total government payment — standard</th><th>Total government payment — variance</th></tr>';
[[dt('dutyParty'),DUTY_PARTIES],[dt('cnfParty'),CNF_PARTIES]].forEach(([select,parties])=>{select.add(new Option('Select party',''));parties.forEach(p=>select.add(new Option(p.id+' · '+p.name,p.id)))});
window.addEventListener('storage',event=>{if([DutyStore.key,ReleaseStore.key,'lc-bank-customs-expenses-v1'].includes(event.key)){dutyLists();renderDuty();if(dt('dutyPicker').open)drawDutyPicker();dutyMessage('Related records changed. Reload before saving.',true)}});
newDuty();
