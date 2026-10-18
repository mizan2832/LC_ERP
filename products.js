// Demonstration item master. Confirm classifications against approved item data.
const PRODUCT_DATASET = [
  {category:'Bike',sku:'EMAX-ES4',product:'Emax-ES4',hs:'87116000',unit:'PCS',pack:'1',uom:'PCS',model:'Emax-ES4',grade:'Standard',colour:'STANDARD'},
  {category:'Bike',sku:'EMAX-F50',product:'Emax-F50',hs:'87116000',unit:'PCS',pack:'1',uom:'PCS',model:'Emax-F50',grade:'Standard',colour:'STANDARD'},
  {category:'Bike',sku:'EMAX-E11',product:'Emax-E11',hs:'87116000',unit:'PCS',pack:'1',uom:'PCS',model:'Emax-E11',grade:'Standard',colour:'STANDARD'},
  {category:'Goodyear lubricants',sku:'GY-ENGINE-LTR',product:'Goodyear engine oil — sample litre item',hs:'27101931',unit:'LTR',pack:'1'},
  {category:'Goodyear lubricants',sku:'GY-GREASE-KG',product:'Goodyear grease — sample kilogram item',hs:'27101989',unit:'KG',pack:'1'},
  {category:'Bike',sku:'BIKE-125-CBU',product:'125cc motorcycle — CBU, four-stroke',hs:'87112011',unit:'Piece',pack:'1'},
  {category:'Bike',sku:'BIKE-150-CKD',product:'150cc motorcycle — CKD, four-stroke',hs:'87112021',unit:'Piece',pack:'1'},
  {category:'Goodyear lubricants',sku:'GY-VIGOR-208L',product:'Goodyear Vigor CI 4 15W40 208L',hs:'27101931',unit:'Litre',pack:'208'},
  {category:'Goodyear lubricants',sku:'GY-VIGOR-20L',product:'Goodyear Vigor CI 4 15W40 20L (sample)',hs:'27101931',unit:'Litre',pack:'20'},
  {category:'Spare parts',sku:'SP-MC-SADDLE',product:'Motorcycle saddle',hs:'87141010',unit:'Piece',pack:'1'},
  {category:'Spare parts',sku:'SP-MC-TANK',product:'Motorcycle fuel tank',hs:'87141020',unit:'Piece',pack:'1'}
];

const LEGACY_PRODUCT_ITEMS=[
 {code:'LUB001',hs:'27101931',description:'ENGINE OIL 10 LTR PACK',grade:'15W-40',packSize:'1*10 Ltr',category:'Engine Oil',colour:'GOLD',model:'Premium Diesel',productType:'Lubricant',uom:'PACK',convertedUom:'Ltr',factor:10,active:true},
 {code:'LUB002',hs:'27101931',description:'ENGINE OIL 4 X 5 LTR PACK',grade:'20W-50',packSize:'4*5 Ltr',category:'Engine Oil',colour:'AMBER',model:'Heavy Duty',productType:'Lubricant',uom:'PACK',convertedUom:'Ltr',factor:20,active:true},
 {code:'LUB003',hs:'27101989',description:'INDUSTRIAL GREASE 12 KG',grade:'NLGI-2',packSize:'1*12 KG',category:'Grease',colour:'STANDARD',model:'Industrial',productType:'Lubricant',uom:'KG',convertedUom:'KG',factor:12,active:true},
 {code:'FM27',hs:'87042290',description:'FM27 CAPTAIN V',grade:'Standard',packSize:'1 PCS',category:'Vehicle',colour:'WHITE',model:'CAPTAIN V',productType:'Finished Good',uom:'PCS',convertedUom:'PCS',factor:1,active:true},
 {code:'FG560',hs:'87032319',description:'GLORY 560 VEHICLE',grade:'Standard',packSize:'1 PCS',category:'Vehicle',colour:'BLACK',model:'GLORY 560',productType:'Finished Good',uom:'PCS',convertedUom:'PCS',factor:1,active:true},
 {code:'SP1045',hs:'87083000',description:'FRONT BRAKE PAD SET',grade:'OEM',packSize:'1 Set',category:'Brake Parts',colour:'STANDARD',model:'CAPTAIN V',productType:'Spare Parts',uom:'SET',convertedUom:'SET',factor:1,active:true},
 {code:'SP1078',hs:'84212300',description:'OIL FILTER ASSEMBLY',grade:'OEM',packSize:'10 PCS',category:'Filter',colour:'STANDARD',model:'GLORY 560',productType:'Spare Parts',uom:'BOX',convertedUom:'PCS',factor:10,active:true}
];
// Include the original demonstration items so previous entry codes stay available.
LEGACY_PRODUCT_ITEMS.forEach(item=>{if(!PRODUCT_DATASET.some(p=>p.sku===item.code))PRODUCT_DATASET.push({category:item.productType==='Lubricant'?'Goodyear lubricants':item.productType==='Finished Good'?'Bike':'Spare parts',sku:item.code,product:item.description,hs:item.hs||'',unit:item.convertedUom,pack:String(item.factor),uom:item.uom,grade:item.grade,colour:item.colour,model:item.model,packSize:item.packSize})});
// Test classifications are provisional; specifications and import condition must be confirmed.
PRODUCT_DATASET.forEach(item=>item.hsStatus='Provisional — verify before customs use');
function getProductDataset(){const items=[...PRODUCT_DATASET];const standards=JSON.parse(localStorage.getItem('lc-standards-v1')||'[]');if(Array.isArray(standards))standards.forEach(s=>{if(s.fields?.sku)items.push({...s.fields,category:!s.fields.category||s.fields.category==='Lubricants'?'Goodyear lubricants':s.fields.category})});return items.filter((p,i,a)=>a.findIndex(q=>q.sku===p.sku)===i)}
function productToRequisition(p){return {code:p.sku,description:p.product,hs:p.hs||'',grade:p.grade||(p.category==='Goodyear lubricants'?'15W-40':'Standard'),packSize:p.packSize||p.pack+' '+p.unit,category:p.category,colour:p.colour||'STANDARD',model:p.model||p.product,productType:p.category==='Goodyear lubricants'?'Lubricant':p.category==='Bike'?'Finished Good':'Spare Parts',uom:p.uom||(p.unit==='Litre'?'PACK':['LTR','KG'].includes(p.unit)?p.unit:'PCS'),convertedUom:p.unit,factor:Number(p.pack),active:true}}

// Sample choices for margin entry; no bank agreement rates are implied.
const MARGIN_BANK_NAMES=['Sonali Bank','Janata Bank','Agrani Bank','Rupali Bank','BRAC Bank','Eastern Bank','Dutch-Bangla Bank','The City Bank','Prime Bank','Bank Asia'];
