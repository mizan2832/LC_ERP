(()=>{
 const legacyCategory=$('category');legacyCategory.closest('label').hidden=true;
 const grid=$('productSelect').closest('.fields');const brandLabel=document.createElement('label');brandLabel.textContent='Brand';const brand=document.createElement('select');brand.id='brandName';brandLabel.append(brand);const categoryLabel=document.createElement('label');categoryLabel.textContent='Category';const category=document.createElement('select');category.id='itemCategory';categoryLabel.append(category);grid.prepend(brandLabel,categoryLabel);fields.push('brandName','itemCategory');
 brand.add(new Option('Select brand',''));Object.keys(BRAND_CATEGORIES).forEach(name=>brand.add(new Option(name,name)));
 const partLabel=document.createElement('label');partLabel.textContent='Part number';const partInput=document.createElement('input');partInput.id='partNumber';partInput.readOnly=true;partLabel.append(partInput);grid.append(partLabel);
 const gradeLabel=document.createElement('label');gradeLabel.textContent='Item grade';const gradeInput=document.createElement('input');gradeInput.id='itemGrade';gradeInput.readOnly=true;gradeLabel.append(gradeInput);grid.append(gradeLabel);fields.push('partNumber','itemGrade');
 function fillCategories(value=''){category.replaceChildren(new Option('Select category',''));(BRAND_CATEGORIES[brand.value]||[]).forEach(name=>category.add(new Option(name,name)));category.value=value;category.disabled=!brand.value}
 function family(){return category.value==='Spare parts'?'Spare parts':brand.value==='Goodyear'?'Goodyear lubricants':brand.value==='Vmoto'?'Bike':'Vehicle'}
 if(![...legacyCategory.options].some(o=>o.value==='Vehicle'))legacyCategory.add(new Option('Vehicle','Vehicle'));
 syncProducts=function(){const select=$('productSelect'),sku=$('sku').value;select.replaceChildren(new Option('Select an item…',''));catalog().filter(p=>{const c=itemClassification(p);return c.brand===brand.value&&c.itemCategory===category.value}).forEach(p=>select.add(new Option(p.product,p.sku)));select.value=sku;if(select.selectedIndex<0)select.value='';select.disabled=!brand.value||!category.value;const p=catalog().find(p=>p.sku===select.value);applyProduct(p);partInput.value=p?.partNumber||'';gradeInput.value=p?.grade||'';partLabel.hidden=category.value!=='Spare parts';gradeLabel.hidden=category.value!=='Spare parts'};
 $('productSelect').addEventListener('change',()=>{const p=catalog().find(p=>p.sku===$('productSelect').value);partInput.value=p?.partNumber||'';gradeInput.value=p?.grade||''});
 const load=loadSetup;loadSetup=function(data){const c=itemClassification({...data.fields,brand:data.fields.brandName});
 // Legacy versions may lack these fields. Populate them before the inner loader
 // synchronizes item options, otherwise it clears the SKU while retaining costs.
 const prepared={...data,fields:{...data.fields,brandName:c.brand,itemCategory:c.itemCategory}};
 brand.value=c.brand;fillCategories(c.itemCategory);load(prepared);brand.value=c.brand;fillCategories(c.itemCategory);legacyCategory.value=data.fields.category||family();syncProducts()};
 function resetSelection(){legacyCategory.value=family();$('new').onclick();syncProducts();list()}
 brand.onchange=()=>{fillCategories();resetSelection()};category.onchange=resetSelection;
 const validateStandard=valid;valid=function(){if(!brand.value||!category.value){$('notice').textContent='Select brand, category and item name.';return false}return validateStandard()};
 fillCategories();syncProducts();
})();

// CBU and CKD standards share the item master. CKD standards are separated
// further by KIT or Cabin, while legacy standards remain CBU records.
(()=>{
 const grid=$('productSelect').closest('.fields');
 const processLabel=document.createElement('label');processLabel.textContent='Process type';
 const process=document.createElement('select');process.id='processType';process.required=true;
 process.add(new Option('CBU','CBU'));process.add(new Option('CKD','CKD'));processLabel.append(process);
 const componentLabel=document.createElement('label');componentLabel.id='componentTypeLabel';componentLabel.textContent='CKD component';
 const component=document.createElement('select');component.id='componentType';
 component.add(new Option('Select KIT or Cabin',''));component.add(new Option('KIT','KIT'));component.add(new Option('Cabin','CABIN'));componentLabel.append(component);
 const hs=$('hs').closest('label');hs.after(processLabel,componentLabel);fields.push('processType','componentType');
 function normalizedProcess(value){return String(value||'CBU').toUpperCase()==='CKD'?'CKD':'CBU'}
 function normalizedComponent(value){const result=String(value||'').toUpperCase();return ['KIT','CABIN'].includes(result)?result:''}
 function syncComponent(){const isCkd=process.value==='CKD';componentLabel.hidden=!isCkd;component.disabled=!isCkd;component.required=isCkd;if(!isCkd)component.value=''}
 function identityChanged(){
  syncComponent();currentSetupNumber='';$('saved').value='';$('version').value='STD-001';showSetupStatus('New');list();calc();
  $('notice').textContent=process.value==='CKD'&&!component.value?'Select KIT or Cabin for this CKD standard cost.':'New '+(process.value==='CKD'?'CKD / '+component.options[component.selectedIndex].text:'CBU')+' costing identity selected. Enter costs or load a matching previous setup.';
 }
 const baseLoad=loadSetup;
 loadSetup=function(data){const processType=normalizedProcess(data?.fields?.processType),componentType=processType==='CKD'?normalizedComponent(data?.fields?.componentType):'';baseLoad({...data,fields:{...data.fields,processType,componentType}});syncComponent();list()};
 const baseValid=valid;
 valid=function(){if(process.value==='CKD'&&!component.value){$('notice').textContent='Select KIT or Cabin for the CKD standard cost.';component.focus();return false}return baseValid()};
 const baseSaveSetup=saveSetup;
 saveSetup=function(status){if(process.value==='CKD'&&!component.value){$('notice').textContent='Select KIT or Cabin before saving this CKD standard cost.';component.focus();return}return baseSaveSetup(status)};
 list=function(){
  const select=$('saved'),query=$('search').value.trim().toLowerCase(),selectedProcess=normalizedProcess(process.value),selectedComponent=selectedProcess==='CKD'?normalizedComponent(component.value):'';
  select.replaceChildren(new Option('Select a saved setup...',''));
  readStorage().forEach((record,index)=>{
   const recordProcess=normalizedProcess(record.fields?.processType),recordComponent=recordProcess==='CKD'?normalizedComponent(record.fields?.componentType):'';
   if(!$('sku').value||record.fields?.sku!==$('sku').value||recordProcess!==selectedProcess||recordComponent!==selectedComponent)return;
   const searchable=[record.setupNumber,record.status,...Object.values(record.fields||{})].join(' ').toLowerCase();if(!searchable.includes(query))return;
   const identity=recordProcess==='CKD'?'CKD / '+recordComponent:'CBU';select.add(new Option([record.setupNumber,record.status==='draft'?'Draft':'Completed',identity,record.fields?.product||'Item not selected'].join(' - '),String(index)));
  });
  if(select.options.length===1)select.options[0].textContent='No matching saved setups';
 };
 const baseNew=$('new').onclick;
 $('new').onclick=()=>{baseNew();process.value='CBU';component.value='';syncComponent();list()};
 process.addEventListener('change',identityChanged);component.addEventListener('change',identityChanged);
 $('productSelect').addEventListener('change',()=>{process.value='CBU';component.value='';syncComponent();list()});
 syncComponent();
})();
