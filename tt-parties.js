// Shared TT counterparties for standard costing and landed cost entry.
const TT_PARTIES=[{code:'TT-001',name:'Sample Import Supplier A'},{code:'TT-002',name:'Sample Import Supplier B'},{code:'TT-003',name:'Sample Overseas Trading Co.'},{code:'TT-004',name:'Sample Motor Parts Supplier'}];
const TTPartyCatalog={
 fill(select,savedCode=''){
  select.replaceChildren(new Option('Select TT party',''));
  TT_PARTIES.forEach(p=>select.add(new Option(p.code+' - '+p.name,p.code)));
  if(savedCode&&!TT_PARTIES.some(p=>p.code===savedCode))select.add(new Option(savedCode+' - Saved party',savedCode));
  select.value=savedCode;
 }
};
