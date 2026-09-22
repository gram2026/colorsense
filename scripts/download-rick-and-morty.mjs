import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const out = fileURLToPath(new URL('../rick-and-morty/',import.meta.url));
await fs.mkdir(out,{recursive:true});
async function request(url) {
  let last;
  for(let attempt=0;attempt<4;attempt++) {
    try { const r=await fetch(url,{signal:AbortSignal.timeout(30000)}); if(r.status===429){await new Promise(resolve=>setTimeout(resolve,Math.max(30000,(Number(r.headers.get('retry-after'))||0)*1000)));throw Error('Rate limited');} if(!r.ok)throw Error(`HTTP ${r.status}`);return r; }
    catch(e){last=e;await new Promise(r=>setTimeout(r,500*(attempt+1)));}
  }
  throw last;
}
const characters=[];let next='https://rickandmortyapi.com/api/character';let expected;
while(next){const d=await (await request(next)).json();expected=d.info.count;characters.push(...d.results);next=d.info.next;await new Promise(r=>setTimeout(r,1500));}
if(characters.length!==expected || new Set(characters.map(c=>c.id)).size!==expected) throw Error('Incomplete character list');
console.log(`Characters: ${characters.length}`);
let cursor=0,done=0;const failed=[];
const manifest=characters.map(c=>({id:c.id,name:c.name,source:c.image,file:`${String(c.id).padStart(3,'0')}-${c.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'character'}.jpg`}));
await fs.writeFile(path.join(out,'characters.json'),JSON.stringify(manifest,null,2));
await Promise.all(Array.from({length:2},async()=>{
  while(cursor<manifest.length){const item=manifest[cursor++];
    try {
      const dest=path.join(out,item.file);
      let valid=false;
      try{const m=await sharp(dest).metadata();valid=m.format==='jpeg'&&m.width===300&&m.height===300;}catch{}
      if(!valid){const data=Buffer.from(await(await request(item.source)).arrayBuffer());const m=await sharp(data).metadata();if(m.format!=='jpeg'||m.width!==300||m.height!==300)throw Error('Unexpected image format');await fs.writeFile(dest,data,{flag:'wx'});}
    }catch(e){failed.push({...item,error:e.message});}
    done++;if(done%100===0)console.log(`Checked ${done}/${manifest.length}`);
    await new Promise(r=>setTimeout(r,250));
  }
}));
await fs.writeFile(path.join(out,'characters.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(path.join(out,'download-report.json'),JSON.stringify({total:manifest.length,successful:manifest.length-failed.length,failed},null,2));
console.log(`Complete: ${manifest.length-failed.length}/${manifest.length}; failures: ${failed.length}`);
if(failed.length)process.exitCode=1;
