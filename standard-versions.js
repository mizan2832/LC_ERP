// Saved standards are immutable: every subsequent save creates a distinct revision.
const StandardVersions={
 prepare(records,data,currentNumber){const source=records.find(r=>r.setupNumber===currentNumber&&r.fields?.sku===data.fields.sku);const number='SC-'+String(records.reduce((max,r)=>Math.max(max,Number(String(r.setupNumber||'').replace('SC-',''))||0),0)+1).padStart(6,'0');const revision=source?Math.max(...records.filter(r=>r.fields?.sku===data.fields.sku).map(r=>r.standardRevision||1))+1:1;return {...JSON.parse(JSON.stringify(data)),setupNumber:number,standardRevision:revision,standardId:source?.standardId||source?.setupNumber||number,supersedesSetupNumber:source?.setupNumber||null,fields:{...data.fields,version:'STD-'+String(revision).padStart(3,'0')},createdAt:data.savedAt}}
};
