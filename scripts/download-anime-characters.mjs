import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const out=fileURLToPath(new URL('../anime-characters/',import.meta.url));
await fs.mkdir(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,options={}) {
  for(let attempt=0;attempt<4;attempt++) {
    try {
      const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
      if(r.status===429){await sleep(Math.max(30000,(Number(r.headers.get('retry-after'))||0)*1000));continue;}
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      return r;
    }catch(e){if(attempt===3)throw e;await sleep(2000*(attempt+1));}
  }
  throw Error('Rate limited');
}
const list=[];
for(let page=1;list.length<100 && page<=5;page++) {
  const query=`{ Page(page:${page},perPage:50) { characters(sort:FAVOURITES_DESC) { id name { full } image { large } siteUrl media(type:ANIME,perPage:1) { nodes { title { romaji english } } } } } }`;
  const data=await(await request('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})})).json();
  if(data.errors)throw Error(JSON.stringify(data.errors));
  for(const c of data.data.Page.characters){if(c.media.nodes.length && !list.some(x=>x.id===c.id))list.push(c);if(list.length===100)break;}
  await sleep(1200);
}
if(list.length!==100)throw Error('Incomplete list');
const manifest=[];let cursor=0,done=0;
await Promise.all(Array.from({length:3},async()=>{
  while(cursor<list.length){const index=cursor++,c=list[index];
    const item={rank:index+1,id:c.id,name:c.name.full,anime:c.media.nodes[0].title,source:c.image.large,page:c.siteUrl};
    try {
      const bytes=Buffer.from(await(await request(c.image.large)).arrayBuffer());
      const meta=await sharp(bytes).metadata();
      if(!['jpeg','png','webp'].includes(meta.format))throw Error('Unsupported image');
      const slug=c.name.full.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      item.file=`${String(index+1).padStart(3,'0')}-${slug}-${c.id}.${meta.format==='jpeg'?'jpg':meta.format}`;
      item.width=meta.width;item.height=meta.height;
      await fs.writeFile(path.join(out,item.file),bytes,{flag:'wx'});
    }catch(e){item.error=e.message;}
    manifest.push(item);done++;if(done%20===0)console.log(`Downloaded ${done}/100`);
    await sleep(300);
  }
}));
manifest.sort((a,b)=>a.rank-b.rank);
await fs.writeFile(path.join(out,'characters.json'),JSON.stringify(manifest,null,2));
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
await fs.writeFile(path.join(out,'characters.csv'),'\uFEFF'+[['Rank','Name','Anime','File','Source','Error'],...manifest.map(c=>[c.rank,c.name,c.anime.english||c.anime.romaji,c.file,c.source,c.error])].map(row=>row.map(csv).join(',')).join('\r\n'));
const errors=manifest.filter(c=>c.error);
console.log(JSON.stringify({successful:100-errors.length,errors}));
if(errors.length)process.exitCode=1;
