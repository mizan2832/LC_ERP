// Capture purchase standards on new item selection, never refresh saved snapshots.
function captureRequisitionStandard(row, records, date) {
  const standard = records.filter(s => s.status === 'completed' &&
    String(s.fields?.sku || '').toUpperCase() === String(row.item.code).toUpperCase() &&
    (!s.fields.date || s.fields.date <= date))
    .sort((a,b) => String(b.fields.date || '').localeCompare(String(a.fields.date || '')) ||
      String(b.savedAt || '').localeCompare(String(a.savedAt || '')) ||
      String(b.setupNumber || '').localeCompare(String(a.setupNumber || '')))[0];
  if (!standard) return null;
  const f = standard.fields;
  const normalize = unit => String(unit || '').toUpperCase().replace('LITRE','LTR');
  const factor = normalize(f.unit) === normalize(row.item.uom) ? 1 :
    normalize(f.unit) === normalize(row.item.convertedUom) ? Number(row.item.factor) : NaN;
  const price = Number(f.pi) * factor;
  if (!Number.isFinite(price) || price < 0) return null;
  return {itemCode:row.item.code, setupNumber:standard.setupNumber,
    unitPrice:price, currency:f.currency || 'USD', unit:row.item.uom};
}
const pickBeforeStandardPrices = pick;
pick = function(code) {
  const row = rows.find(r=>r.id===active);
  const item = catalog.find(r=>r.code===code);
  if (row && row.item?.code !== code && item?.active &&
      item.productType === $('productType').value &&
      !rows.some(r=>r.id!==active && r.item?.code===code)) {
    delete row.standardPriceSnapshot;
  }
  pickBeforeStandardPrices(code);
};
const renderBeforeStandardPrices = render;
render = function() {
  let standards;
  rows.forEach(row => {
    if (!row.item) return;
    const snapshot = row.standardPriceSnapshot;
    if (!Object.prototype.hasOwnProperty.call(row,'standardPriceSnapshot') ||
        (snapshot && snapshot.itemCode !== row.item.code)) {
      if (!standards) {
        try { standards = JSON.parse(localStorage.getItem('lc-standards-v1') || '[]'); }
        catch { standards = []; }
        if (!Array.isArray(standards)) standards = [];
      }
      row.standardPriceSnapshot = captureRequisitionStandard(row,standards,$('planDate').value);
    }
  });
  renderBeforeStandardPrices();
  document.querySelectorAll('[data-standard-price]').forEach((cell,index) => {
    const snapshot = rows[index]?.standardPriceSnapshot;
    cell.textContent = snapshot ? `${fmt(snapshot.unitPrice)} ${snapshot.currency}` : 'Not captured';
    cell.title = snapshot ? `PI FOB per ${snapshot.unit}; saved standard ${snapshot.setupNumber}` :
      'No standard price captured. Historical entries are not recalculated from the current master.';
  });
};
const totalsBeforeLocalAmount = updateTotals;
updateTotals = function() {
  totalsBeforeLocalAmount();
  const total = rows.filter(rowCountsInTotals).reduce((sum,row)=>sum+amount(row),0);
  $('totalAmount').textContent = `${fmt(total)} ${$('currency').value || ''}`.trim();
  $('totalAmountLC').textContent = `${fmt(total * Number($('exchangeRate').value || 0))} BDT`;
};
function refreshRequisitionLocalAmounts() {
  Array.from($('rows').children).forEach((tr,index)=>{
    if (tr.cells[16]) tr.cells[16].textContent = rows[index]?.item ?
      fmt(amount(rows[index]) * Number($('exchangeRate').value || 0)) : '';
  });
  updateTotals();
}
$('exchangeRate').addEventListener('input',refreshRequisitionLocalAmounts);
$('currency').addEventListener('change',refreshRequisitionLocalAmounts);
render();
