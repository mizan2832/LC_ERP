// Shared sample counterparties. Existing saved parties remain selectable.
const ExpenseParties={
 samples:[
  {code:'INS-001',name:'Sample Insurance Company A',group:'insurance'},
  {code:'INS-002',name:'Sample Insurance Company B',group:'insurance'},
  {code:'BANK-001',name:'Sample Bank A',group:'bank'},
  {code:'BANK-002',name:'Sample Bank B',group:'bank'},
  {code:'PORT-001',name:'Sample Chattogram Port Services',group:'port'},
  {code:'PORT-002',name:'Sample Mongla Port Services',group:'port'},
  {code:'CNF-001',name:'Sample C&F Agent - Chattogram',group:'cf'},
  {code:'CNF-002',name:'Sample C&F Agent - Mongla',group:'cf'},
  {code:'TRN-001',name:'Sample Transport Company',group:'local'},
  {code:'TEST-001',name:'Sample Testing and Inspection Services',group:'local'},
  {code:'DUTY-CTG',name:'Chattogram Customs House',group:'duty'},
  {code:'DUTY-MGL',name:'Mongla Customs House',group:'duty'}
 ],
 list(group=''){
  const parties=new Map(this.samples.filter(p=>!group||p.group===group).map(p=>[p.code,{...p}]));
  for(const key of ['lc-opening-expenses-v1','lc-bank-customs-expenses-v1']){
   let records=[];try{records=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
   if(!Array.isArray(records))continue;
   records.forEach(record=>(record.rows||[]).forEach(row=>{
    const code=String(row.partyCode||'').trim(),insurance=String(row.headKey||'').startsWith('insurance|')||/insurance/i.test(row.headName||'');
    if(code&&(!group||group==='insurance'&&insurance)&&!parties.has(code))parties.set(code,{code,name:String(row.partyName||'').trim(),group:insurance?'insurance':row.group||'saved'});
   }));
  }
  return [...parties.values()];
 },
 resolve(row,prior,{required=false,group=''}={}){
  const code=String(row.partyCode||'').trim();
  if(!code){if(required)throw Error('Select a party (code and name) for '+(row.headName||'this cost head')+'.');return {partyCode:'',partyName:''}}
  if(prior&&code===String(prior.partyCode||'').trim()&&String(row.partyName||'')===String(prior.partyName||''))return {partyCode:code,partyName:prior.partyName||''};
  const party=this.list(group).find(p=>p.code===code);
  if(!party)throw Error('Select a valid party from the dropdown.');
  return {partyCode:party.code,partyName:party.name};
 },
 createSelect(row,{required=false,group='',disabled=false,label='Party (code and name)',onchange=()=>{}}={}){
  const select=document.createElement('select'),parties=this.list(group),code=String(row.partyCode||'').trim();
  if(code){const existing=parties.find(p=>p.code===code);if(existing){if(row.partyName)existing.name=row.partyName}else parties.push({code,name:row.partyName||''})}
  select.add(new Option('Select party - code and name',''));
  parties.forEach(p=>select.add(new Option(p.code+' - '+(p.name||'Saved party'),p.code)));
  select.value=code;select.required=required;select.disabled=disabled;select.setAttribute('aria-label',label);
  select.onchange=()=>{const party=parties.find(p=>p.code===select.value);row.partyCode=party?.code||'';row.partyName=party?.name||'';onchange()};
  return select;
 }
};
