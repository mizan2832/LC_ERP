function xmlDecode(v){return String(v??'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function colIndex(ref){const m=String(ref||'').match(/^([A-Z]+)/i);if(!m)return 0;let n=0;for(const ch of m[1].toUpperCase())n=n*26+ch.charCodeAt(0)-64;return n-1}
async function unzipXlsx(buffer){
 const u8=new Uint8Array(buffer),dv=new DataView(buffer),td=new TextDecoder('utf-8');let eocd=-1;
 for(let p=u8.length-22;p>=Math.max(0,u8.length-65557);p--){if(dv.getUint32(p,true)===0x06054b50){eocd=p;break}}
 if(eocd<0)throw new Error('Not a valid XLSX ZIP file');
 const count=dv.getUint16(eocd+10,true),cdOffset=dv.getUint32(eocd+16,true);let p=cdOffset;const entries={};
 for(let i=0;i<count;i++){
  if(dv.getUint32(p,true)!==0x02014b50)throw new Error('Invalid XLSX directory');
  const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),fnlen=dv.getUint16(p+28,true),xlen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),loff=dv.getUint32(p+42,true);
  const name=td.decode(u8.slice(p+46,p+46+fnlen));
  if(dv.getUint32(loff,true)!==0x04034b50)throw new Error('Invalid XLSX entry');
  const lfn=dv.getUint16(loff+26,true),lex=dv.getUint16(loff+28,true),ds=loff+30+lfn+lex,comp=u8.slice(ds,ds+csize);let raw;
  if(method===0)raw=comp;else if(method===8){if(typeof DecompressionStream==='undefined')throw new Error('Browser does not support XLSX decompression');const stream=new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));raw=new Uint8Array(await new Response(stream).arrayBuffer())}else throw new Error('Unsupported XLSX compression');
  entries[name]=raw;p+=46+fnlen+xlen+clen;
 }
 return entries;
}
// XLSX writers may qualify spreadsheet element names (for example x:row).
function spreadsheetXml(xml){return String(xml||'').replace(/(<\/?)[A-Za-z_][\w.-]*:/g,'$1')}
function extractSharedStrings(xml){if(!xml)return[];xml=spreadsheetXml(xml);const out=[];for(const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){let s='';for(const t of m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))s+=xmlDecode(t[1]);out.push(s)}return out}
function xlsxCellValue(cellXml,type,shared){
 if(type==='inlineStr'){let s='';for(const t of cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))s+=xmlDecode(t[1]);return s}
 const vm=cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);if(!vm)return'';const v=xmlDecode(vm[1]);if(type==='s')return shared[Number(v)]??'';return v;
}
async function parseXlsx(buffer){
 const entries=await unzipXlsx(buffer),td=new TextDecoder('utf-8');const sheetBytes=entries['xl/worksheets/sheet1.xml'];if(!sheetBytes)throw new Error('Worksheet not found');
 const sheet=spreadsheetXml(td.decode(sheetBytes)),shared=extractSharedStrings(entries['xl/sharedStrings.xml']?td.decode(entries['xl/sharedStrings.xml']):'');const rowsOut=[];
 for(const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){const vals=[];for(const cm of rm[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const attrs=cm[1],body=cm[2],r=(attrs.match(/\br="([^"]+)"/)||[])[1]||'',t=(attrs.match(/\bt="([^"]+)"/)||[])[1]||'';vals[colIndex(r)]=xlsxCellValue(body,t,shared)}while(vals.length<4)vals.push('');if(vals.some(v=>String(v??'').trim()!==''))rowsOut.push(vals.map(v=>String(v??'').trim()))}
 if(!rowsOut.length)return null;return{headers:rowsOut[0].slice(0,4),data:rowsOut.slice(1).map(r=>r.slice(0,4))};
}
function parseDelimited(text){
 text=String(text||'').replace(/^\uFEFF/,'');const first=text.trimStart()[0];
 if(first==='<'){if(/Excel Workbook Frameset/i.test(text)&&/sheet001\.htm/i.test(text))throw new Error('OLD_EXCEL_HTML');const doc=new DOMParser().parseFromString(text,'text/html');const table=doc.querySelector('table');if(!table)return null;const trs=[...table.querySelectorAll('tr')];if(!trs.length)return null;const headers=[...trs[0].querySelectorAll('th,td')].map(c=>c.textContent.trim());const data=trs.slice(1).map(tr=>[...tr.querySelectorAll('td,th')].map(c=>c.textContent.trim())).filter(r=>r.some(v=>v!==''));return{headers,data}}
 const lines=text.replace(/\r/g,'').split('\n').filter(x=>x.trim()!=='');if(!lines.length)return null;const firstLine=lines[0];const delimiter=['\t',';',','].sort((a,b)=>(firstLine.split(b).length-firstLine.split(a).length))[0];
 function parseLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===delimiter&&!q){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out}
 return{headers:parseLine(lines[0]),data:lines.slice(1).map(parseLine)};
}

function downloadInvoiceWorkbook(data,filename,headers=['Item Code','PI Qty','Unit Price','Colour']){const xmlEscape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));const matrix=[headers,...data];const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+matrix.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t>'+xmlEscape(value)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';const files={
 '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Requisition Items" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml':sheet};
const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0};
for(const [path,text] of Object.entries(files)){const name=encoder.encode(path),bytes=encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+text),crc=crc32(bytes);const local=new Uint8Array(30+name.length),view=new DataView(local.buffer);view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(12,33,true);view.setUint32(14,crc,true);view.setUint32(18,bytes.length,true);view.setUint32(22,bytes.length,true);view.setUint16(26,name.length,true);local.set(name,30);parts.push(local,bytes);const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=local.length+bytes.length}
const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,directory.length,true);ev.setUint16(10,directory.length,true);ev.setUint32(12,directory.reduce((sum,x)=>sum+x.length,0),true);ev.setUint32(16,offset,true);const blob=new Blob([...parts,...directory,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
