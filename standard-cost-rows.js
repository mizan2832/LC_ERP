// Keep calculation inputs and stable head IDs; show only chosen costing rows.
// Share one editor while retaining historical port/cf keys for saved snapshots.
const portExpenseSection=$('sub-port').parentElement;
const cfExpenseSection=$('sub-cf').parentElement;
portExpenseSection.querySelector('h2').lastChild.textContent='Port, C & F Expenses';
portExpenseSection.querySelector('tbody').append(...cfExpenseSection.querySelector('tbody').children);
$('sub-cf').hidden=true;portExpenseSection.append($('sub-cf'));cfExpenseSection.remove();
const standardEditorGroup=key=>key==='cf'?'port':key==='insurance'?'bank':key;
const defaultStandardHeads=new Set(['duty-0','duty-1','duty-2','duty-3','duty-4','duty-5','global-0','global-1','global-2']);
const chosenStandardHeads=new Set();
const standardHeadCatalog=new Map();
function rememberStandardHeads(){
 rows.forEach(row=>standardHeadCatalog.set(row.id,{...row}));
 readStorage().forEach(setup=>(setup.costs||[]).forEach(row=>{
  if(row.id==='duty-6')return;
  if(!standardHeadCatalog.has(row.id))standardHeadCatalog.set(row.id,{...row});
 }));
}
function standardRowHasCost(row){return Boolean($('i-'+row.id)?.checked)&&Number($('v-'+row.id)?.value)>0}
function standardRowVisible(row){if(/assembl/i.test(row.name)||row.id==='duty-6')return false;if(defaultStandardHeads.has(row.id))return true;return Boolean($('i-'+row.id)?.checked)&&(standardRowHasCost(row)||chosenStandardHeads.has(row.id))}
function standardHeadChoices(key,currentId=''){
 key=standardEditorGroup(key);
 const names=new Set(),choices=[];
 // Prefer the definitions already loaded in this setup when custom IDs differ.
 [...rows,...standardHeadCatalog.values()].filter(row=>standardEditorGroup(row.key)===key&&!/assembl/i.test(row.name)).forEach(row=>{
  const name=row.name.trim().toLowerCase();if(names.has(name))return;names.add(name);
  const occupied=rows.some(other=>standardEditorGroup(other.key)===key&&other.id!==currentId&&other.name.trim().toLowerCase()===name&&standardRowVisible(other));
  choices.push({...row,disabled:occupied});
 });return choices;
}
function fillStandardHeadSelect(select,key,currentId=''){
 select.replaceChildren(new Option('Select cost head…',''));
 standardHeadChoices(key,currentId).forEach(row=>{const option=new Option(row.name,row.id);option.disabled=row.disabled;select.add(option)});
 select.value=currentId;
 if(window.installStandardHeadPicker&&select.isConnected)window.installStandardHeadPicker(select);
}
function refreshStandardHeadSelects(){
 document.querySelectorAll('[data-standard-head]').forEach(select=>fillStandardHeadSelect(select,select.dataset.group,select.dataset.standardHead));
}
function appendStandardDelete(tr,label,onDelete){
 const cell=document.createElement('td');cell.className='standard-cost-action';
 const button=document.createElement('button');button.type='button';button.className='standard-cost-delete';button.textContent='Delete';button.setAttribute('aria-label','Delete '+label);button.dataset.standardDelete='';button.onclick=onDelete;
 cell.append(button);tr.append(cell);
}
function installStandardDelete(row,tr){
 if(tr.querySelector('[data-standard-delete]'))return;
 // Keep stable calculation controls so dependent duties and saved versions remain valid.
 tr.cells[4]?.querySelectorAll('button').forEach(button=>button.remove());
 appendStandardDelete(tr,row.name,()=>{
  $('v-'+row.id).value=0;$('i-'+row.id).checked=false;chosenStandardHeads.delete(row.id);
  calc();refreshStandardHeadSelects();showSetupStatus(currentSetupNumber?'Editing':'New');
 });
}
function installStandardHeadSelect(row){
 const tr=$('v-'+row.id)?.closest('tr');if(!tr)return;installStandardDelete(row,tr);if(tr.querySelector('[data-standard-head]'))return;
 const cell=tr.cells[0],hint=cell.querySelector('small');
 const select=document.createElement('select');select.dataset.standardHead=row.id;select.dataset.group=standardEditorGroup(row.key);
 select.setAttribute('aria-label','Cost head in '+row.key);fillStandardHeadSelect(select,row.key,row.id);
 cell.replaceChildren(select);if(hint)cell.append(hint);if(window.installStandardHeadPicker)window.installStandardHeadPicker(select);
 select.onchange=()=>{
  const targetId=select.value;if(!targetId||targetId===row.id){select.value=row.id;return}
  const target=standardHeadCatalog.get(targetId)||rows.find(r=>r.id===targetId);
  if(!target||standardHeadChoices(row.key,row.id).find(r=>r.id===targetId)?.disabled){select.value=row.id;return}
  const value=$('v-'+row.id).value,method=$('m-'+row.id).value,included=$('i-'+row.id).checked;
  if(!rows.some(r=>r.id===targetId))addCostRow({...target,value:0,included:true});
  $('v-'+targetId).value=value;$('m-'+targetId).value=method;$('i-'+targetId).checked=included;
  $('v-'+row.id).value=0;$('i-'+row.id).checked=false;chosenStandardHeads.delete(row.id);chosenStandardHeads.add(targetId);
  installStandardHeadSelect(rows.find(r=>r.id===targetId));calc();refreshStandardHeadSelects();showSetupStatus(currentSetupNumber?'Editing':'New');
 };
}
function refreshStandardRowVisibility(){
 rows.forEach(row=>{const tr=$('v-'+row.id)?.closest('tr');if(tr)tr.hidden=!standardRowVisible(row)});
 groups.filter(([key])=>key!=='cf').forEach(([key])=>{
  const section=$('sub-'+key).parentElement,empty=section.querySelector('.empty-standard-heads');
  if(empty)empty.hidden=rows.some(r=>standardEditorGroup(r.key)===key&&standardRowVisible(r))||Boolean(section.querySelector('.pending-standard-head'));
 });
}
function resetStandardRowSelection(){
 chosenStandardHeads.clear();document.querySelectorAll('.pending-standard-head').forEach(tr=>tr.remove());
 rememberStandardHeads();rows.forEach(installStandardHeadSelect);refreshStandardRowVisibility();refreshStandardHeadSelects();
}
function addStandardCostRow(key){
 const section=$('sub-'+key).parentElement,tr=document.createElement('tr');tr.className='pending-standard-head';
 const cell=document.createElement('td'),select=document.createElement('select');select.dataset.standardHead='';select.dataset.group=key;select.setAttribute('aria-label','Select new cost head for '+key);fillStandardHeadSelect(select,key);cell.append(select);tr.append(cell);
 for(let i=0;i<4;i++){const td=document.createElement('td');td.textContent=i===0?'Select a cost head first':'';tr.append(td)}
 appendStandardDelete(tr,'empty cost row',()=>{tr.remove();refreshStandardRowVisibility();refreshStandardHeadSelects()});
 section.querySelector('tbody').append(tr);if(window.installStandardHeadPicker)window.installStandardHeadPicker(select);refreshStandardRowVisibility();(select.nextElementSibling?.querySelector('button')||select).focus();
 select.onchange=()=>{
  const id=select.value,target=standardHeadCatalog.get(id)||rows.find(r=>r.id===id);
  if(!target||standardHeadChoices(key).find(r=>r.id===id)?.disabled)return;
  if(!rows.some(r=>r.id===id))addCostRow({...target,method:'fixed',value:0,included:true});
  chosenStandardHeads.add(id);$('i-'+id).checked=true;tr.remove();installStandardHeadSelect(rows.find(r=>r.id===id));calc();refreshStandardHeadSelects();$('v-'+id).focus();showSetupStatus(currentSetupNumber?'Editing':'New');
 };
}
rememberStandardHeads();
groups.filter(([key])=>key!=='cf').forEach(([key])=>{
 const section=$('sub-'+key).parentElement,head=section.querySelector('.sectionhead');
 const action=document.createElement('th');action.textContent='Action';action.className='standard-cost-action';section.querySelector('thead tr').append(action);
 const add=document.createElement('button');add.type='button';add.textContent='+ Add Row';add.onclick=()=>addStandardCostRow(key);head.append(add);
 const empty=document.createElement('p');empty.className='empty-standard-heads muted';empty.textContent='No costing rows selected. Click Add Row to choose a cost head.';section.insertBefore(empty,$('sub-'+key));
 const oldControls=section.querySelector('.addhead');
 if(oldControls){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Create a new cost head';details.className='create-standard-head';details.append(summary);oldControls.before(details);details.append(oldControls);
  const button=oldControls.querySelector('button'),original=button.onclick;
  button.onclick=()=>{const before=new Set(rows.map(r=>r.id));original();rows.filter(r=>!before.has(r.id)).forEach(r=>{chosenStandardHeads.add(r.id);standardHeadCatalog.set(r.id,{...r});installStandardHeadSelect(r)});calc();refreshStandardHeadSelects()};
 }
});
const calculateBeforeCostRowSelection=calc;
calc=function(){rows.filter(row=>/assembl/i.test(row.name)).forEach(row=>{$('i-'+row.id).checked=false;$('v-'+row.id).value=0});const result=calculateBeforeCostRowSelection();refreshStandardRowVisibility();return result};
const loadBeforeCostRowSelection=loadSetup;
loadSetup=function(data){chosenStandardHeads.clear();loadBeforeCostRowSelection(data);resetStandardRowSelection()};
const saveBeforeCostRowSelection=saveSetup;
saveSetup=function(status){const previous=currentSetupNumber;saveBeforeCostRowSelection(status);if(previous!==currentSetupNumber)resetStandardRowSelection()};
const snapshotBeforeCostRowSelection=snapshot;
snapshot=function(){const data=snapshotBeforeCostRowSelection();data.costs=data.costs.filter(cost=>!/assembl/i.test(cost.name)).map(cost=>({...cost,included:Boolean(cost.included)&&Number(cost.value)>0}));return data};
const newBeforeCostRowSelection=$('new').onclick;
$('new').onclick=()=>{newBeforeCostRowSelection();resetStandardRowSelection()};
const categoryBeforeCostRowSelection=$('category').onchange;
$('category').onchange=()=>{categoryBeforeCostRowSelection();resetStandardRowSelection()};
const productBeforeCostRowSelection=$('productSelect').onchange;
$('productSelect').onchange=()=>{chosenStandardHeads.clear();productBeforeCostRowSelection();resetStandardRowSelection()};
resetStandardRowSelection();
