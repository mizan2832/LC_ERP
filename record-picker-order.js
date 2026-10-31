// Display newest saved documents first without changing storage or receipt chronology.
const RecordPickerOrder={latest(records){return records.map((record,index)=>({record,index,time:Date.parse(record.updatedAt||record.savedAt||record.createdAt||'')||0})).sort((a,b)=>b.time-a.time||b.index-a.index).map(entry=>entry.record)}};
