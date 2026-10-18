// Keep save behavior and edit locking without the test controls or performance panel.
$('saveRequisitionBtn').onclick=()=>persistPr('Saved');
const renderBeforeSaveLock=render;
render=function(){renderBeforeSaveLock();$('saveRequisitionBtn').disabled=approved};
render();