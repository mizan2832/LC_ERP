function normalizeStandardValuation(data){
 const copy={...data,fields:{...data.fields}},f=copy.fields,c=data.calculation||{},rate=Number(f.fx),legacy=(c.valuationVersion||0)<5;
 if(f.landingBDT===undefined)f.landingBDT=c.landingCharge??(Number(c.cifValue||0)*Number(f.landingPercent||0)/100);
 if(f.psiBDT===undefined)f.psiBDT=c.psiAssessableValue??Number(f.psiAV||0);
 if(legacy&&f.assUsd===undefined&&rate>0){
  const base=c.cifValue??(c.customsAssessableValue!==undefined?Number(c.customsAssessableValue)-Number(f.landingBDT||0)-Number(f.psiBDT||0):null);
  f.assUsd=base===null?'':Math.max(0,Number(base)/rate);
 }
 return copy;
}
