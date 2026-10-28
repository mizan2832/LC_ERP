// LC-backed standards require an explicit positive cash margin; TT has none.
(()=>{
 const hint=document.createElement('p');hint.className='hint';hint.id='marginTypeRequirement';$('sub-bank').parentElement.querySelector('.sectionhead').after(hint);
 let previousSelection='';
 function sync(){
  const tt=$('lcType').value==='TT',required=!tt&&Boolean($('sku').value);
  hint.textContent=tt?'TT: LC cash margin is not applicable and cannot be entered.':'LC and LC+TT: set a positive LC margin and select its bank for every item. Cash margin is excluded from landed cost.';
  rows.filter(row=>StandardCostMath.isMargin(row)).forEach(row=>{
   const include=$('i-'+row.id),value=$('v-'+row.id),tr=value.closest('tr');
   if(tt){include.checked=false;value.value=0;chosenStandardHeads.delete(row.id)}
   else if(required&&row.id==='bank-9'){include.checked=true;chosenStandardHeads.add(row.id)}
   include.disabled=tt||required;
   value.required=required&&row.id==='bank-9';
   if(tt){value.disabled=true;$('m-'+row.id).disabled=true}
   const select=tr.querySelector('[data-standard-head]');if(select){select.disabled=tt||required;select.standardHeadPickerSync?.()}
   const remove=tr.querySelector('[data-standard-delete]');if(remove){remove.disabled=tt||required;remove.title=required?'LC margin is mandatory for LC and LC+TT.':''}
  });
  $('marginBank').required=required;$('marginBank').disabled=tt;$('marginMode').disabled=tt;
  if(tt){$('marginBank').value='';$('marginMode').value='fixed';$('marginPercent').value=''}
  const selection=$('lcType').value+'|'+$('sku').value;if(selection!==previousSelection){previousSelection=selection;refreshStandardHeadSelects()}
  refreshStandardRowVisibility();
 }
 const resetRows=resetStandardRowSelection;resetStandardRowSelection=function(){resetRows();sync()};
 $('lcType').addEventListener('change',()=>calc());
 const calculate=calc;calc=function(){sync();return calculate()};
 const validate=valid;valid=function(){
  sync();if($('lcType').value!=='TT'){
   syncMarginControls();const value=Number($('v-bank-9').value);
   if(!$('i-bank-9').checked||!Number.isFinite(value)||value<=0){$('notice').textContent='LC margin is mandatory for '+($('sku').value||'this item')+'. Enter a positive margin for LC or LC+TT.';$('v-bank-9').focus();return false}
   if($('marginMode').value==='percent'&&value>100){$('notice').textContent='LC margin percentage must be greater than 0 and no more than 100.';return false}
   if(!$('marginBank').value.trim()){$('notice').textContent='Select the LC margin bank for '+($('sku').value||'this item')+'.';$('marginBank').focus();return false}
  }
  return validate();
 };
 const takeSnapshot=snapshot;snapshot=function(){const data=takeSnapshot();if(data.fields.lcType==='TT'){data.fields={...data.fields,marginBank:'',marginMode:'fixed',marginPercent:''};data.costs=data.costs.map(cost=>StandardCostMath.isMargin(cost)?{...cost,method:'fixed',value:0,included:false}:cost)}return data};
 const savedLoad=loadSetup;loadSetup=function(data){savedLoad(data);calc()};
 calc();
})();
