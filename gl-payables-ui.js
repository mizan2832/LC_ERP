// Posting actions alter only GL status; posted source amounts remain locked.
(()=>{
 const main=document.querySelector('main.app');if(!main)return;
 const panel=document.createElement('section');panel.className='panel';const title=document.createElement('h2');title.textContent='Accounts payables';const note=document.createElement('p');note.className='invoice-hint';note.textContent='GL Post creates internal party-wise payables. Unpost GL before cancelling. Active Accounts entries must be cancelled or reversed before unposting. External accounting software is not connected.';const wrap=document.createElement('div');wrap.className='table-wrap';panel.append(title,note,wrap);main.append(panel);
 function show(record,store){
  wrap.replaceChildren();const payables=(record?.payables||[]).filter(p=>p.status!=='Voided');if(!payables.length){wrap.textContent=record?.glStatus==='Posted'&&!Array.isArray(record.payables)?'This historical posting has no captured payable. Unpost and repost to generate it after clearing any Accounts links.':record?.glStatus==='Posted'?'No payable amount for this posting. Document release creates a payable only for its recorded loan amount; margin is handled in LC opening expenses.':'No active Accounts payable for this entry.';return}
  const table=document.createElement('table');table.innerHTML='<thead><tr><th>Party</th><th>Cost head</th><th>Amount (BDT)</th><th>Outstanding (BDT)</th><th>Status</th></tr></thead>';const body=document.createElement('tbody');payables.forEach(p=>{const tr=document.createElement('tr');[p.partyCode+' - '+p.partyName,p.headName,Number(p.amountBDT).toLocaleString('en-BD',{minimumFractionDigits:2}),Number(p.outstandingBDT).toLocaleString('en-BD',{minimumFractionDigits:2}),p.status].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});body.append(tr)});table.append(body);wrap.append(table);
 }
 function documentControls(config){
  const button=document.createElement('button');button.type='button';button.textContent='Save GL status';document.querySelector(config.radio).closest('fieldset').after(button);
  function update(){
   const record=config.current(),radios=[...document.querySelectorAll(config.radio)],saved=record?.status===config.status,editing=config.editing();let block='';
   try{if(record)block=GLPayables.accountBlock(record,config.store.key)}catch(e){block=e.message}
   if(saved&&!editing)radios.forEach(r=>r.disabled=Boolean(block));
   const selected=radios.find(r=>r.checked)?.value;
   button.disabled=!saved||editing||Boolean(block)||selected===record?.glStatus;button.title=block||'Save only GL status; costing values remain unchanged.';
   const cancel=document.getElementById(config.cancel);if(record){const reason=GLPayables.cancelReason(config.store.key,record);if(reason){cancel.disabled=true;cancel.title=reason}}
   show(record,config.store);
  }
  document.querySelectorAll(config.radio).forEach(r=>r.addEventListener('change',update));
  button.onclick=()=>{try{const record=config.current(),status=document.querySelector(config.radio+':checked').value;const updated=GLPayables.setGL(config.store,record.id,record.revision,status);config.load(updated);config.message(status==='Posted'?'GL posted; Accounts payable created.':'GL unposted; unpaid Accounts payables voided.')}catch(e){config.message(e.message,true)}update()};return update;
 }
 let refresh;
 if(document.getElementById('glPosted')){
  const update=documentControls({store:ExpenseStore,status:'Saved',radio:'[name="glStatus"]',cancel:'cancelExpense',current:()=>expenseId?ExpenseStore.read().find(r=>r.id===expenseId):null,editing:()=>expenseEditing,load:loadSavedExpense,message:expMessage});const render=renderExpense;renderExpense=function(){render();update()};refresh=renderExpense;
 }else if(document.querySelector('[name="releaseGL"]')){
  const update=documentControls({store:ReleaseStore,status:'Released',radio:'[name="releaseGL"]',cancel:'cancelRelease',current:()=>releaseId?ReleaseStore.read().find(r=>r.id===releaseId):null,editing:()=>releaseEditing,load:loadRelease,message:drMessage});const render=renderRelease;renderRelease=function(){render();update()};refresh=renderRelease;
 }else{
  const render=renderBC;renderBC=function(){render();show(bcId?BankCustomsStore.read().find(r=>r.id===bcId):null,BankCustomsStore)};refresh=renderBC;
 }
 window.addEventListener('storage',event=>{if(GLPayables.activityKeys.includes(event.key))refresh()});refresh();
})();
