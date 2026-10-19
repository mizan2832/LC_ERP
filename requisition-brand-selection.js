(()=>{
 const brand=$('brand');brand.replaceChildren(new Option('Select brand',''));Object.keys(BRAND_CATEGORIES).forEach(name=>brand.add(new Option(name,name)));
 const field=document.createElement('div');field.className='field';const label=document.createElement('label');label.className='required';label.textContent='Category';const category=document.createElement('select');category.id='itemCategory';field.append(label,category);brand.closest('.field').after(field);prFields.push('itemCategory');$('productType').closest('.field').hidden=true;
 function categories(value=''){category.replaceChildren(new Option('Select category',''));(BRAND_CATEGORIES[brand.value]||[]).forEach(name=>category.add(new Option(name,name)));category.value=value;category.disabled=approved||!brand.value}
 function matches(item){const c=itemClassification(item);return c.brand===brand.value&&c.itemCategory===category.value}
 const draw=drawCatalog;drawCatalog=function(items){draw(items.filter(matches))};
 const open=openItems;openItems=function(id){if(!brand.value||!category.value)return notify('Select Brand and Category before selecting an item.','err');open(id)};
 const selectItem=pick;pick=function(code){const item=catalog.find(r=>r.code===code);if(!item||!matches(item))return notify('Select an item from the chosen Brand and Category.','err');selectItem(code)};
 function change(){if(approved)return;const type=brand.value==='Goodyear'?'Lubricant':'Finished Good';$('productType').value=category.value?type:'';$('productType').onchange();}
 brand.onchange=()=>{categories();change()};category.onchange=change;
 const lock=applyLock;applyLock=function(){lock();category.disabled=approved||!brand.value};
 const load=loadPr;loadPr=function(record){const savedBrand=record.header.brand;if(savedBrand&&![...brand.options].some(o=>o.value===savedBrand))brand.add(new Option(savedBrand+' (saved)',savedBrand));categories();const savedCategory=record.header.itemCategory;if(savedCategory&&![...category.options].some(o=>o.value===savedCategory))category.add(new Option(savedCategory,savedCategory));load(record);if(BRAND_CATEGORIES[brand.value]){categories(savedCategory||itemClassification(record.rows.find(r=>r.item)?.item||{}).itemCategory)}category.disabled=approved||!brand.value};
 const clear=clearAll;clearAll=function(){clear();categories()};$('clearBtn').onclick=clearAll;$('newPr').onclick=clearAll;
 const validateSelection=validate;validate=function(){const error=validateSelection();if(error)return error;if(!BRAND_CATEGORIES[brand.value]||!category.value)return 'Select Brand and Category.';if(rows.some(r=>r.item&&!matches(r.item)))return 'Every item must belong to the selected Brand and Category.';return ''};
 $('callout').textContent='Select Brand, then Category. Add an item row and open its searchable item list. Only items for the selected brand and category are shown.';
 categories();
})();
