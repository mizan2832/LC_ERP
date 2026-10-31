// Item selection loads metadata only; saved costing requires explicit version selection.
const selectStandardItem=$('productSelect').onchange;
$('productSelect').onchange=()=>{
 if(window.beginStandardVersionCopy)window.beginStandardVersionCopy();
 selectStandardItem();if(!$('sku').value)return;
 currentSetupNumber='';$('saved').value='';$('version').value='STD-001';
 removeCustomRows();rows.forEach(r=>{$('v-'+r.id).value=0;$('i-'+r.id).checked=true;$('m-'+r.id).value='fixed'});
 $('totalAssessableBDT').value='';$('pi').value=0;$('lcType').value='LC';
 $('tt').value=0;$('ttfx').value=124;$('ttParty').value='';$('currency').value='USD';$('fx').value=124;
 $('marginBank').value='';$('marginMode').value='percent';$('marginPercent').value='';
 showSetupStatus('New');list();calc();
 $('notice').textContent='New costing for the selected item. Enter costs, or select a version from Load previous setup to fetch its saved values.';
};
const changeStandardCategory=$('category').onchange;$('category').onchange=()=>{changeStandardCategory();currentSetupNumber='';showSetupStatus('New')};
// Dated reference default; editable bank/customs rates may differ. No saved records are rewritten.
const CNY_REFERENCE={rate:18.3968,date:'2026-10-16',source:'https://wise.com/us/currency-converter/cny-to-bdt-rate/history'};
$('currency').addEventListener('change',()=>{const cny=$('currency').value==='CNY';['fx'].forEach(id=>$(id).value=cny?CNY_REFERENCE.rate:'');updateStandardCurrency();calc();$('notice').textContent=cny?'CNY reference: 1 CNY = '+CNY_REFERENCE.rate+' BDT ('+CNY_REFERENCE.date+', mid-market). Defaults filled; bank rate remains editable.':'Currency changed to USD. Enter the bank exchange rate in BDT per USD.'});
