// Copy a previous setup's costing into the selected target item.
(()=>{
 let selectedSource=null,confirmed=false,selectedTargetSKU='';
 const identityFields=['brandName','itemCategory','category','sku','product','hs','unit','pack'];
 const crossItem=document.createElement('details');crossItem.className='create-standard-head';
 const crossTitle=document.createElement('summary');crossTitle.textContent='Copy standard cost from another item';crossItem.append(crossTitle);
 const searchLabel=document.createElement('label');searchLabel.className='savedlabel';searchLabel.textContent='Search source item or version';
 const otherSearch=document.createElement('input');otherSearch.id='otherItemCostSearch';otherSearch.type='search';otherSearch.placeholder='Search item name, SKU, setup number or version';searchLabel.append(otherSearch);
 const sourceLabel=document.createElement('label');sourceLabel.className='savedlabel';sourceLabel.textContent='Source item and standard version';
 const otherSource=document.createElement('select');otherSource.id='otherItemCostSource';sourceLabel.append(otherSource);
 const otherCopy=document.createElement('button');otherCopy.type='button';otherCopy.id='copyOtherItemCost';otherCopy.textContent='Copy costing to selected item';
 const help=document.createElement('p');help.className='muted';help.textContent='Select the destination item above. Copy replaces its current costing values; review amounts and units before saving a new version.';
 crossItem.append(help,searchLabel,sourceLabel,otherCopy);$('saved').closest('section').append(crossItem);
 function refreshOtherSources(){
  const previous=otherSource.value,target=String($('sku').value||'').trim().toUpperCase(),query=otherSearch.value.trim().toLowerCase();
  otherSource.replaceChildren(new Option(target?'Select another item and version':'Select the destination item first',''));otherSource.disabled=!target;otherCopy.disabled=!target;
  if(target)readStorage().forEach((record,index)=>{if(!record.fields?.sku||String(record.fields.sku).trim().toUpperCase()===target)return;
   const label=[record.fields.product,record.fields.sku,record.setupNumber,record.fields.version||'STD-'+String(record.standardRevision||1).padStart(3,'0')].join(' ? ');
   if(!query||label.toLowerCase().includes(query))otherSource.add(new Option(label,String(index)));
  });
  if([...otherSource.options].some(option=>option.value===previous))otherSource.value=previous;
  if(target&&otherSource.options.length===1)otherSource.options[0].textContent='No matching standards from other items';
 }
 otherSearch.oninput=refreshOtherSources;
 otherCopy.onclick=()=>{const source=otherSource.value!==''?readStorage()[Number(otherSource.value)]:null;if(!source){$('notice').textContent='Select a standard version from another item first.';return}copyCosting(source,true)};
 const baseList=list;
 list=function(){const select=$('saved'),previous=select.value,query=$('search').value.trim().toLowerCase(),sku=String($('sku').value||'').trim().toUpperCase();select.disabled=!sku;select.replaceChildren(new Option('Select a previous setup to use as source',''));if(sku)readStorage().forEach((record,index)=>{if(String(record.fields?.sku||'').trim().toUpperCase()!==sku)return;const text=[record.setupNumber,record.status,...Object.values(record.fields||{})].join(' ').toLowerCase();if(!query||text.includes(query))select.add(new Option(record.setupNumber+' · '+record.fields.sku+' · '+record.fields.product+' · '+(record.fields.version||'STD-'+String(record.standardRevision||1).padStart(3,'0')),String(index)))});if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;else{const loaded=readStorage().findIndex(record=>record.setupNumber===currentSetupNumber&&record.fields?.sku===$('sku').value);if(loaded>=0&&[...select.options].some(option=>option.value===String(loaded)))select.value=String(loaded)};if(select.options.length===1)select.options[0].textContent=sku?'No matching versions for this item':'Select an item first';refreshOtherSources()};
 function copyCosting(source,isConfirmed){if(!$('sku').value||!$('productSelect').value){$('notice').textContent='Select the target item in Product selection first, then select a previous setup.';return false}const identity=Object.fromEntries(identityFields.map(id=>[id,$(id).value]));
 // The preview already loaded this source. Confirm it without overwriting edits.
 if(isConfirmed&&selectedSource?.setupNumber===source.setupNumber&&selectedSource?.sku===source.fields.sku&&selectedTargetSKU===identity.sku){confirmed=true;if(window.beginStandardVersionCopy)window.beginStandardVersionCopy();showSetupStatus('Unsaved copy');$('notice').textContent='Copy confirmed. Your edited values are retained. Save to create a new version for '+identity.sku+'.';return true}
 const targetRecords=readStorage().filter(r=>r.fields?.sku===identity.sku).sort((a,b)=>Number(b.standardRevision||1)-Number(a.standardRevision||1)||String(b.savedAt||'').localeCompare(String(a.savedAt||'')));const target=targetRecords[0];const data=JSON.parse(JSON.stringify(source));data.fields={...data.fields,...identity,version:target?.fields.version||'STD-001'};data.setupNumber=target?.setupNumber||'';window.standardVersionCopyMode=isConfirmed;try{loadSetup(data)}finally{window.standardVersionCopyMode=false}selectedSource={setupNumber:source.setupNumber,sku:source.fields.sku};confirmed=isConfirmed;selectedTargetSKU=identity.sku;currentSetupNumber=target?.setupNumber||'';showSetupStatus(isConfirmed?'Unsaved copy':'Source preview');$('notice').textContent=(isConfirmed?'Copied costing from ':'Previewing costing from ')+source.setupNumber+' ('+source.fields.sku+') for target '+identity.sku+'. '+(isConfirmed?'Save to create a new version for the target item. Source remains unchanged.':'Click Copy selected setup to apply it.');return true}
 $('saved').onchange=()=>{if($('saved').value===''){selectedSource=null;return}const source=readStorage()[Number($('saved').value)];if(source?.status==='draft'&&source.fields.sku===$('sku').value){selectedSource=null;confirmed=false;selectedTargetSKU='';loadSetup(source);$('notice').textContent='Draft '+source.setupNumber+' loaded. Save Draft updates this draft without changing its version.'}else if(source)copyCosting(source,false)};
 $('copy').onclick=()=>{const source=$('saved').value!==''?readStorage()[Number($('saved').value)]:null;if(!source){$('notice').textContent='Search and select a previous setup to copy.';return}copyCosting(source,true)};
 const load=loadSetup;loadSetup=function(data){load(data);list()};
 const takeSnapshot=snapshot;snapshot=function(){const data=takeSnapshot();if(selectedSource&&confirmed)data.copiedFrom={...selectedSource};return data};
 const save=saveSetup;saveSetup=function(status){if(selectedSource&&!confirmed){$('notice').textContent='Click Copy selected setup to apply the preview before saving.';return}const previous=currentSetupNumber;save(status);if(currentSetupNumber&&currentSetupNumber!==previous){selectedSource=null;confirmed=false;selectedTargetSKU='';const records=readStorage(),index=records.findIndex(record=>record.setupNumber===currentSetupNumber);if(index>=0)$('saved').value=String(index)}};
 const newSetup=$('new').onclick;$('new').onclick=()=>{selectedSource=null;confirmed=false;selectedTargetSKU='';newSetup();list()};
 const itemChange=$('productSelect').onchange;$('productSelect').onchange=()=>{selectedSource=null;confirmed=false;selectedTargetSKU='';$('saved').value='';$('search').value='';itemChange();list()};
 $('search').addEventListener('input',()=>list());
 list();
})();
