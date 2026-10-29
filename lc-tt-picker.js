// Searchable item picker backed by the existing select and saved-item lifecycle.
(()=>{
 const select=document.getElementById('ttOpeningId');
 const host=document.createElement('div');host.className='standard-item-picker';select.after(host);select.hidden=true;select.tabIndex=-1;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='standard-item-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');host.append(trigger);
 const panel=document.createElement('div');panel.className='standard-item-panel';panel.hidden=true;host.append(panel);
 const search=document.createElement('input');search.type='search';search.placeholder='Search TT number or reference';search.setAttribute('aria-label','Search TT number or reference');panel.append(search);
 const results=document.createElement('div');results.className='standard-item-results';results.id='lc-tt-results';results.setAttribute('role','listbox');results.setAttribute('aria-label','TT openings');panel.append(results);trigger.setAttribute('aria-controls',results.id);
 let active=-1,buttons=[];
 function sync(){const option=select.options[select.selectedIndex];trigger.textContent=select.value&&option?option.textContent:'Select TT number / reference';trigger.title=trigger.textContent;trigger.disabled=select.disabled}
 function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');active=-1}
 function highlight(index){if(!buttons.length)return;active=(index+buttons.length)%buttons.length;buttons.forEach((b,i)=>b.classList.toggle('keyboard-active',i===active));buttons[active].scrollIntoView({block:'nearest'})}
 function draw(){results.replaceChildren();buttons=[];active=-1;const query=search.value.trim().toLowerCase();Array.from(select.options).filter(o=>o.value&&!o.disabled&&(!query||(o.textContent+' '+o.value).toLowerCase().includes(query))).forEach(option=>{const button=document.createElement('button');button.type='button';button.className='standard-item-option';button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===select.value));const name=document.createElement('span');name.textContent=option.textContent;const code=document.createElement('small');code.textContent='';button.append(name,code);button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();trigger.focus()};results.append(button);buttons.push(button)});if(!buttons.length){const empty=document.createElement('p');empty.className='standard-item-empty';empty.textContent='No matching available TT openings.';results.append(empty)}}
 function fit(){const available=window.innerHeight-trigger.getBoundingClientRect().bottom-20;results.style.maxHeight=Math.max(100,Math.min(300,available-65))+'px'}
 function open(){sync();search.value='';draw();panel.hidden=false;trigger.setAttribute('aria-expanded','true');fit();search.focus()}
 trigger.onclick=()=>panel.hidden?open():close();trigger.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();open();highlight(0)}};
 search.oninput=draw;panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();trigger.focus()}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();highlight(active+(e.key==='ArrowDown'?1:-1))}else if(e.key==='Enter'){e.preventDefault();if(buttons.length)buttons[Math.max(0,active)].click()}});
 document.addEventListener('click',e=>{if(!host.contains(e.target))close()});host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))close()});window.addEventListener('resize',fit);
 new MutationObserver(()=>{sync();if(!panel.hidden)draw()}).observe(select,{childList:true,subtree:true,attributes:true});
 select.addEventListener('change',sync);
 sync();
})();
