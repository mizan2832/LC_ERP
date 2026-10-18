// Reopen saved releases directly from the release-number field.
const releasePicker=document.createElement('dialog');
releasePicker.className='release-picker';
releasePicker.innerHTML='<div class="invoice-heading"><h2>Select document release</h2><button id="closeReleasePicker" type="button">Close</button></div><label>Search release, manifest or LC<input id="releasePickerSearch" type="search" placeholder="Release number, manifest number or LC number"></label><div class="table-wrap"><table><thead><tr><th>Release number</th><th>Manifest</th><th>LC number</th><th>Status</th><th>GL status</th><th>Action</th></tr></thead><tbody id="releasePickerRows"></tbody></table></div>';
document.body.append(releasePicker);
function drawReleasePicker(){
 try{
  const query=dr('releasePickerSearch').value.trim().toLowerCase(),body=dr('releasePickerRows');body.replaceChildren();
  ReleaseStore.read().filter(record=>[record.number,record.manifestNumber,record.basis?.lcNumber,record.status].join(' ').toLowerCase().includes(query)).forEach(record=>{
   const tr=document.createElement('tr');
   tr.innerHTML=`<td>${drEscape(record.number)}</td><td>${drEscape(record.manifestNumber)}</td><td>${drEscape(record.basis?.lcNumber)}</td><td>${drEscape(record.status)}</td><td>${drEscape(record.glStatus)}</td><td><button type="button">Open</button></td>`;
   tr.querySelector('button').onclick=()=>{
    try{
     const current=ReleaseStore.read().find(r=>r.id===record.id);if(!current)throw Error('This release no longer exists.');
     loadRelease(current);releasePicker.close();
     const reason=current.status==='Cancelled'?'Cancelled release.':current.glStatus==='Posted'?'GL is posted.':ReleaseStore.blocked(current.id);
     drMessage(current.number+' loaded. '+(reason||'Click Modify to update, then Save Changes.'));
    }catch(error){drMessage(error.message,true)}
   };
   body.append(tr);
  });
  if(!body.children.length)body.innerHTML='<tr><td colspan="6">No matching saved releases.</td></tr>';
 }catch(error){drMessage(error.message,true)}
}
function openReleasePicker(){dr('releasePickerSearch').value='';drawReleasePicker();releasePicker.showModal();dr('releasePickerSearch').focus()}
dr('releaseNumber').ondblclick=openReleasePicker;
dr('releaseNumber').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();openReleasePicker()}};
dr('releaseNumber').placeholder='Double-click to open a saved release';
dr('releaseNumber').title='Double-click or press Enter to search saved releases.';
dr('closeReleasePicker').onclick=()=>releasePicker.close();
dr('releasePickerSearch').oninput=drawReleasePicker;
window.addEventListener('storage',event=>{if(event.key===ReleaseStore.key&&releasePicker.open)drawReleasePicker()});
