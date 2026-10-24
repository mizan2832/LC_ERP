const fg=id=>document.getElementById(id),fgEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fgFmt=v=>Number(v||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});let fgBasis=null,fgSaved=false;
function fgMessage(text,error=false){fg('message').textContent=text;fg('message').className=error?'error':'success'}
let fgPickerMode='manifest';
function fgPendingManifests(){const receipts=FinishedStore.read();return LandedStore.read().filter(record=>record.status==='Saved'&&!receipts.some(receipt=>receipt.status!=='Cancelled'&&(receipt.portReceiptId===record.portReceiptId||receipt.landedCostId===record.id)))}
function fgLists(){
 fg('manifest').value=fgBasis?.manifest||fgBasis?.header?.manifest||'';
 fg('saved').value=fgSaved?fgBasis.number:'';
 if(fg('fgPicker').open)fgDrawPicker();
}
function fgDrawPicker(){
 try{
  const saved=fgPickerMode==='saved',query=fg('fgPickerSearch').value.trim().toLowerCase();
  fg('fgPickerTitle').textContent=saved?'Open saved finished goods receipt':'Select manifest awaiting finished goods receipt';
  const headings=saved?['Receipt number','Manifest','LC number','Receive date','Status','Action']:['Manifest','Landed cost number','LC number','Landed cost date','Action'];
  fg('fgPickerHead').innerHTML='<tr>'+headings.map(text=>'<th>'+text+'</th>').join('')+'</tr>';fg('fgPickerRows').replaceChildren();
  const records=(saved?FinishedStore.read():fgPendingManifests()).filter(record=>[record.number,record.manifest,record.manifestNumber,record.basis?.manifestNumber,record.lcNumber,record.basis?.lcNumber,record.status].join(' ').toLowerCase().includes(query));
  records.forEach(record=>{
   const manifest=record.manifest||record.manifestNumber||record.basis?.manifestNumber||record.portReceiptId;
   const values=saved?[record.number,manifest,record.lcNumber,record.receiveDate,record.status]:[manifest,record.number,record.basis?.lcNumber||record.lcNumber,record.header?.costDate];
   const tr=document.createElement('tr');tr.innerHTML=values.map(value=>'<td>'+fgEscape(value)+'</td>').join('')+'<td></td>';
   const button=document.createElement('button');button.type='button';button.textContent=saved?'Open':'Select';
   button.onclick=()=>{try{
    if(saved){const current=FinishedStore.read().find(receipt=>receipt.id===record.id);if(!current)throw Error('Receipt no longer exists. Refresh the list.');fgLoad(current);fgMessage(current.number+' loaded.')}
    else{
     if(fgSaved)throw Error('Click New / Clear before selecting another manifest.');
     if(!fgPendingManifests().some(manifest=>manifest.id===record.id))throw Error('This manifest is no longer awaiting finished goods receipt.');
     const basis=FinishedStore.basis(record.id);fgBasis=basis;fgSaved=false;fg('number').value='';fg('receiveRemarks').value=basis.header.remarks||'';fgLists();fgRender();fgMessage('Manifest '+basis.manifest+' loaded.');
    }
    fg('fgPicker').close();
   }catch(error){fgMessage(error.message,true);fgDrawPicker()}};
   tr.cells[values.length].append(button);fg('fgPickerRows').append(tr);
  });
  if(!records.length)fg('fgPickerRows').innerHTML='<tr><td colspan="'+headings.length+'">'+(saved?'No matching saved receipts.':'No matching manifests awaiting finished goods receipt. Save landed costing first.')+'</td></tr>';
 }catch(error){fgMessage(error.message,true)}
}
function fgOpenPicker(mode){if(mode==='manifest'&&fgSaved)return;fgPickerMode=mode;fg('fgPickerSearch').value='';fgDrawPicker();fg('fgPicker').showModal();fg('fgPickerSearch').focus()}

function fgGrandTotals(){
 fg('receivedTotals').replaceChildren();fg('valuationTotals').replaceChildren();if(!fgBasis)return;
 const quantities=rows=>{const totals=new Map();rows.forEach(r=>totals.set(r.uom||'unit',(totals.get(r.uom||'unit')||0)+Number(r.qty||0)));return [...totals].map(([unit,qty])=>fgFmt(qty)+' '+unit).join(' / ')};
 const sum=(rows,key)=>fgFmt(rows.reduce((total,row)=>total+Number(row[key]||0),0));
 fg('receivedTotals').innerHTML='<tr><th colspan="10" scope="row">Grand total</th><td>'+fgEscape(quantities(fgBasis.rows))+'</td><td></td><td>'+sum(fgBasis.rows,'amountFC')+' '+fgEscape(fgBasis.currency)+'</td><td colspan="3"></td></tr>';
 fg('valuationTotals').innerHTML='<tr><th colspan="2" scope="row">Grand total</th><td>'+fgEscape(quantities(fgBasis.valuation))+'</td><td></td><td>'+sum(fgBasis.valuation,'totalActual')+'</td><td>'+sum(fgBasis.valuation,'totalStandard')+'</td><td>'+sum(fgBasis.valuation,'variance')+'</td></tr>';
}
function fgReceiverProfile(){
 ['receivedBy','receiverMobile'].forEach(id=>fg(id).readOnly=true);
 if(fgSaved)return;
 try{const profile=LoginProfile.current();fg('receivedBy').value=profile.name;fg('receivedBy').title='Login ID: '+profile.id;fg('receiverMobile').value=profile.mobile;fg('receiverMobile').placeholder=profile.mobile?'':'No mobile configured in login profile';return true}
 catch(error){fg('receivedBy').value='';fg('receiverMobile').value='';fgMessage(error.message,true);return false}
}
function fgRender(){const validReceiver=fgReceiverProfile();fgGrandTotals();fg('details').replaceChildren();fg('rows').replaceChildren();fg('valuation').replaceChildren();fg('status').textContent=fgSaved?fgBasis.status:'New';fg('cancelReceipt').disabled=!fgSaved||fgBasis.status==='Cancelled';fg('receiveDate').disabled=fgSaved;['receivedBy','receiverMobile','receiveRemarks'].forEach(id=>fg(id).disabled=fgSaved);fg('manifest').disabled=fgSaved;fg('save').disabled=!fgBasis||fgSaved||!validReceiver;if(!fgBasis){fg('total').textContent='0.00';return}const add=(name,value)=>{const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.readOnly=true;input.value=value??'';label.append(input);fg('details').append(label)};add('LC number',fgBasis.lcNumber);add('LC date',fgBasis.lcDate);add('Port receipt number',fgBasis.portNumber);add('Landed cost number',fgBasis.landedNumber);add('Landed cost date',fgBasis.landedDate);add('Currency / exchange rate',fgBasis.currency+' / '+fgBasis.exchangeRate);const names={receiptDate:'Port receipt date',customInvoice:'Customs invoice number',customDate:'Customs invoice date',commercialInvoice:'Commercial invoice number',commercialDate:'Commercial invoice date',manifest:'Manifest number',manifestDate:'Manifest date',arrivalDate:'Shipment arrival date',arrivalTime:'Arrival time',port:'Port',vessel:'Vessel / carrier',container:'Container number',bl:'BL / AWB number',warehouse:'Warehouse',supplier:'Supplier',contact:'Contact person',address:'Address',email:'Email',phone:'Phone',remarks:'Remarks'};Object.entries(fgBasis.header).filter(([key])=>!['contact','address','email','phone','remarks'].includes(key)).forEach(([key,value])=>add(names[key]||key.replace(/([A-Z])/g,' $1'),value));fgBasis.rows.forEach((r,i)=>{const tr=document.createElement('tr');tr.innerHTML=[i+1,r.piNumber,r.itemCode,r.itemName,r.model,r.colour,r.grade||'—',r.packSize||r.skuType||'—',r.uom,fgFmt(r.orderedQty),fgFmt(r.qty),fgFmt(PortStore.pricing(r).unitPrice)+' / '+PortStore.pricing(r).priceUnit,fgFmt(r.amountFC),r.engine||'—',r.chassis||'—',r.battery||'—'].map(v=>'<td>'+fgEscape(v)+'</td>').join('');fg('rows').append(tr)});fgBasis.valuation.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=[r.itemCode,r.itemName,fgFmt(r.qty)+' '+r.uom,fgFmt(r.actualPerUnit),fgFmt(r.totalActual),fgFmt(r.totalStandard),fgFmt(r.variance)].map(v=>'<td>'+fgEscape(v)+'</td>').join('');fg('valuation').append(tr)});fg('total').textContent=fgFmt(fgBasis.totalActual)+' BDT'}
[['manifest','manifest'],['saved','saved']].forEach(([id,mode])=>{
 fg(id).ondblclick=()=>fgOpenPicker(mode);
 fg(id).onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();fgOpenPicker(mode)}};
});
fg('fgPickerClose').onclick=()=>fg('fgPicker').close();fg('fgPickerSearch').oninput=fgDrawPicker;
fg('save').onclick=()=>{try{const record=FinishedStore.save(fgBasis.landedCostId,fg('receiveDate').value,fgBasis,{remarks:fg('receiveRemarks').value});fgLoad(record);fgMessage(record.number+' saved. Manifest quantities and landed costs captured.')}catch(e){fgMessage(e.message,true)}};
function fgLoad(record){fgBasis=record;fgSaved=true;fg('number').value=record.number;fg('receiveDate').value=record.receiveDate;fg('receiveRemarks').value=record.remarks??record.header.remarks??'';fg('receivedBy').value=record.receivedBy||'';fg('receiverMobile').value=record.receiverMobile||'';fgLists();fgRender()}

function fgNew(){fgBasis=null;fgSaved=false;fg('number').value='';['receivedBy','receiverMobile','receiveRemarks'].forEach(id=>fg(id).value='');fg('receiveDate').value=LCDateRules.today();fgLists();fgRender();fgMessage('')}
fg('new').onclick=fgNew;window.addEventListener('storage',()=>{fgLists();if(!fgSaved){fgRender();fgMessage('Related records changed. Reselect the manifest before saving.')}});fgNew();
fg('cancelReceipt').onclick=()=>{try{const record=Rollback.cancel(FinishedStore,fgBasis?.id,fgBasis?.revision,()=> '');fgLoad(record);fgMessage(record.number+' cancelled. Landed cost can now be modified or cancelled.')}catch(error){fgMessage(error.message,true)}};