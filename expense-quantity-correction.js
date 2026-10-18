// Explicit user-requested, one-time correction for LC 1250000123 only.
// Runs in the same browser storage as the ERP; never rewrites master standards.
try {
 const targetLC=LCStore.read().find(lc=>lc.number==='1250000123'&&lc.status==='Opened');
 if(targetLC){
  const documents=ExpenseStore.read().filter(record=>record.lcOpeningId===targetLC.id&&record.status==='Saved');
  const pending=documents.filter(record=>!record.quantityActualCorrection);
  let corrected;
  for(const document of pending) corrected=ExpenseStore.correctQuantityActuals(document.id,document.revision);
  if(corrected){loadSavedExpense(corrected);expenseList();expMessage('LC 1250000123 corrected: each actual cost = saved standard rate × full LC quantity + BDT 25,000. Previous actual values are retained in history.');}
 }
} catch(error){expMessage('LC 1250000123 cost correction: '+error.message,true)}
