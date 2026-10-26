const LCDateRules={
 today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())},
 check(header,{isNew=false,required=false,today=this.today()}={}){const {issue,shipment,expiry}=header;const errors={};const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 for(const [key,value] of Object.entries({issue,shipment,expiry}))if(value&&!valid(value))errors[key]='Enter a valid '+({issue:'LC issue',shipment:'last shipment',expiry:'LC expiry'}[key])+' date.';
 if(required&&!issue)errors.issue='Enter LC issue date.';if(required&&header.pay!=='TT'){if(!shipment)errors.shipment='Enter last shipment date.';if(!expiry)errors.expiry='Enter LC expiry date.'}
 if(shipment&&valid(shipment)&&((issue&&valid(issue)&&shipment<issue)||(expiry&&valid(expiry)&&shipment>expiry)))errors.shipment='Last shipment date cannot be earlier than the LC issue date or later than the LC expiry date.';
 if(expiry&&valid(expiry)&&shipment&&valid(shipment)&&expiry<shipment)errors.expiry='LC expiry date cannot be earlier than the last shipment date.';
 if(expiry&&valid(expiry)&&issue&&valid(issue)&&expiry<issue&&!errors.expiry)errors.expiry='LC expiry date cannot be earlier than the LC issue date.';
 let warning='';if(!Object.keys(errors).length&&shipment&&expiry){const days=(Date.parse(expiry+'T00:00:00Z')-Date.parse(shipment+'T00:00:00Z'))/86400000;if(days<21)warning='Presentation window reminder: only '+days+' day(s) between last shipment and LC expiry. Consider allowing 21 days for document presentation.'}return {errors,warning}}
};
