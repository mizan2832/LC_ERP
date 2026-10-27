// Protect exact standard versions referenced by saved LC records.
(()=>{
 let locked=null,baseline=new Map();
 const identity=new Set(['brandName','itemCategory','category','sku','product','hs','unit','pack']);
 const banner=document.createElement('p');banner.className='hint';banner.id='standardLCLock';banner.hidden=true;banner.setAttribute('role','status');$('notice').after(banner);
 function usedBy(number){
  if(!number)return [];
  const read=key=>{const data=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(data))throw Error('Invalid LC reference data');return data};
  const expenses=read('lc-opening-expenses-v1');
  return read('lc-opening-entries-v1').filter(lc=>{
   const snapshots=[...(lc.standardSnapshots||[]),...expenses.filter(e=>e.lcOpeningId===lc.id).flatMap(e=>e.standardSnapshots||[])];
   return snapshots.some(s=>s.setupNumber===number)||(lc.rows||[]).some(r=>r.standardPriceSnapshot?.setupNumber===number);
  }).map(lc=>lc.number||lc.id||'LC entry');
 }
 function message(){return locked?'This standard cost version is locked because it is used by '+locked.join(', ')+'. You cannot modify or delete its costs. Use Copy selected setup to create a new version.':''}
 function notify(){ $('notice').textContent=message();banner.textContent=message() }
 function controls(){return [...document.querySelectorAll('#groups input,#groups select,#groups button'),...fields.filter(id=>!identity.has(id)).map(id=>$(id)).filter(Boolean)]}
 function update(data){
  controls().forEach(el=>{if(el.dataset.lcReadonly==='true'){el.readOnly=false;delete el.dataset.lcReadonly}el.classList.remove('standard-lc-locked')});
  locked=null;baseline=new Map();
  if(!window.standardVersionCopyMode&&data?.setupNumber){try{const refs=usedBy(data.setupNumber);if(refs.length)locked=refs}catch{locked=['LC records that could not be verified']}}
  banner.hidden=!locked;
  if(locked){controls().forEach(el=>{baseline.set(el,{value:el.value,checked:el.checked});el.classList.add('standard-lc-locked');if(el.tagName==='INPUT'&&!el.readOnly){el.readOnly=true;el.dataset.lcReadonly='true'}});notify()}
 }
 window.beginStandardVersionCopy=()=>update(null);
 const load=loadSetup;loadSetup=function(data){load(data);update(data)};
 const save=saveSetup;saveSetup=function(status){if(locked){notify();return}return save(status)};
 const clear=$('new').onclick;$('new').onclick=()=>{update(null);clear()};
 function protectedTarget(target){return locked&&target instanceof Element&&(target.closest('#groups')||baseline.has(target))}
 ['click','pointerdown','keydown','beforeinput','paste','drop','change','input'].forEach(type=>document.addEventListener(type,event=>{
  if(!protectedTarget(event.target)||event.type==='keydown'&&event.key==='Tab')return;
  event.preventDefault();event.stopImmediatePropagation();const previous=baseline.get(event.target);if(previous){event.target.value=previous.value;if(event.target.type==='checkbox')event.target.checked=previous.checked}notify();
 },true));
 window.addEventListener('storage',event=>{if(['lc-opening-entries-v1','lc-opening-expenses-v1'].includes(event.key)&&currentSetupNumber&&!window.standardVersionCopyMode)update({setupNumber:currentSetupNumber})});
})();
