// Show Government booking references and keep cancellation locks current.
(()=>{
 let refresh;
 if(document.getElementById('saveDuty')){
  const panel=document.createElement('section');panel.className='panel';const title=document.createElement('h2');title.textContent='Government Duty payable and cost bookings';const summary=document.createElement('p');summary.className='invoice-hint';const wrap=document.createElement('div');wrap.className='table-wrap';panel.append(title,summary,wrap);document.querySelector('main.app').append(panel);
  const render=renderDuty;renderDuty=function(){render();const record=dutyId?DutyStore.read().find(r=>r.id===dutyId):null,blocked=record?DutyStore.blocked(record.id):'';dt('cancelDuty').title=blocked;wrap.replaceChildren();const payable=record?.payables?.find(p=>p.sourceType==='duty-calculation'&&p.status!=='Voided');summary.textContent=payable?'Booking '+payable.bookingNumber+' | '+payable.partyCode+' - '+payable.partyName+' | Total payable: '+df(payable.amountBDT)+' BDT | '+payable.status:'Save the completed duty calculation to create its Government payable and booking references. Historical records receive bookings when saved after modification.';
   if(record?.costBookings?.length){const table=document.createElement('table');table.innerHTML='<thead><tr><th>Booking number</th><th>Cost head</th><th>Actual amount (BDT)</th><th>Status</th></tr></thead>';const tbody=document.createElement('tbody');record.costBookings.filter(b=>b.status!=='Voided').forEach(booking=>{const tr=document.createElement('tr');[booking.number,booking.headName,df(booking.amountBDT),booking.status].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});tbody.append(tr)});table.append(tbody);wrap.append(table)}
  };refresh=renderDuty;
 }else{
  const render=renderLanded;renderLanded=function(){render();const block=landedId?LandedStore.blocked(landedId):'';ln('cancelLanded').title=block;ln('modifyLanded').title=block};refresh=renderLanded;
 }
 window.addEventListener('storage',event=>{if([...GLPayables.activityKeys,DutyStore.key].includes(event.key))refresh()});refresh();
})();
