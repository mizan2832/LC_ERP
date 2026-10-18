// Open without selecting or loading any saved item. Storage remains unchanged.
const blankStartNew=$('new').onclick;
$('new').onclick=()=>{blankStartNew();list();$('notice').textContent='Select an item name to view its saved standard costing.'};
const blankStartProduct=$('productSelect').onchange;
$('productSelect').onchange=()=>{if(!$('productSelect').value){$('new').onclick();return}blankStartProduct();list()};
const blankStartCategory=$('category').onchange;
$('category').onchange=()=>{blankStartCategory();$('new').onclick()};
$('new').onclick();
