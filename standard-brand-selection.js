(()=>{
 const legacyCategory=$('category');legacyCategory.closest('label').hidden=true;
 const grid=$('productSelect').closest('.fields');const brandLabel=document.createElement('label');brandLabel.textContent='Brand';const brand=document.createElement('select');brand.id='brandName';brandLabel.append(brand);const categoryLabel=document.createElement('label');categoryLabel.textContent='Category';const category=document.createElement('select');category.id='itemCategory';categoryLabel.append(category);grid.prepend(brandLabel,categoryLabel);fields.push('brandName','itemCategory');
 brand.add(new Option('Select brand',''));Object.keys(BRAND_CATEGORIES).forEach(name=>brand.add(new Option(name,name)));
 function fillCategories(value=''){category.replaceChildren(new Option('Select category',''));(BRAND_CATEGORIES[brand.value]||[]).forEach(name=>category.add(new Option(name,name)));category.value=value;category.disabled=!brand.value}
 function family(){return brand.value==='Goodyear'?'Goodyear lubricants':brand.value==='Vmoto'?'Bike':'Vehicle'}
 if(![...legacyCategory.options].some(o=>o.value==='Vehicle'))legacyCategory.add(new Option('Vehicle','Vehicle'));
 syncProducts=function(){const select=$('productSelect'),sku=$('sku').value;select.replaceChildren(new Option('Select an item…',''));catalog().filter(p=>{const c=itemClassification(p);return c.brand===brand.value&&c.itemCategory===category.value}).forEach(p=>select.add(new Option(p.product,p.sku)));select.value=sku;if(select.selectedIndex<0)select.value='';select.disabled=!brand.value||!category.value;const p=catalog().find(p=>p.sku===select.value);applyProduct(p)};
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
