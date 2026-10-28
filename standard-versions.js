// Drafts are editable work records; completed saves create immutable revisions.
const StandardVersions={
 revision(record){const value=Number(record.standardRevision||String(record.fields?.version||'').replace(/^STD-/,''));return Number.isFinite(value)&&value>0?value:1},
 nextNumber(records){return 'SC-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.setupNumber||'').replace('SC-',''))||0),0)+1).padStart(6,'0')},
 nextRevision(records,sku){const completed=records.filter(r=>r.fields?.sku===sku&&r.status!=='draft');return completed.length?Math.max(...completed.map(record=>this.revision(record)))+1:1},
 prepare(records,data,currentNumber){
  const versions=records.filter(r=>r.fields?.sku===data.fields.sku),current=versions.find(r=>r.setupNumber===currentNumber),source=current||versions.at(-1),completed=versions.filter(r=>r.status!=='draft').sort((a,b)=>this.revision(b)-this.revision(a))[0];
  const promote=data.status==='completed'&&current?.status==='draft'&&current.setupNumber!==data.copiedFrom?.setupNumber;const number=promote?current.setupNumber:this.nextNumber(records),revision=this.nextRevision(records,data.fields.sku);
  return {...JSON.parse(JSON.stringify(data)),setupNumber:number,standardRevision:revision,standardId:source?.standardId||source?.setupNumber||number,supersedesSetupNumber:completed?.setupNumber||null,fields:{...data.fields,version:'STD-'+String(revision).padStart(3,'0')},createdAt:data.savedAt};
 },
 prepareDraft(records,data,currentNumber){
  const drafts=records.filter(r=>r.status==='draft'&&r.fields?.sku===data.fields.sku&&r.setupNumber!==data.copiedFrom?.setupNumber);
  const current=drafts.find(r=>r.setupNumber===currentNumber)||drafts.slice().sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0];
  if(current)return {...current,...JSON.parse(JSON.stringify(data)),setupNumber:current.setupNumber,standardRevision:current.standardRevision||this.revision(current),standardId:current.standardId||current.setupNumber,supersedesSetupNumber:current.supersedesSetupNumber||null,createdAt:current.createdAt||current.savedAt,fields:{...data.fields,version:current.fields.version}};
  return this.prepare(records,data,currentNumber);
 }
};
