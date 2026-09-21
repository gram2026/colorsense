// Register complete asset folders absent from category JSON; never replace existing questions.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { validateQuestionShape } from '../src/js/utils/validation.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const categories = JSON.parse(await fs.readFile(path.join(root,'src/data/categories.json'),'utf8')).categories;
const updates = [];
for (const c of categories.filter(c=>c.enabled && c.questionFile)) {
  const target = path.join(root,c.questionFile);
  const doc = JSON.parse(await fs.readFile(target,'utf8'));
  const base = `assets/questions/${c.id}`;
  const dirs = await fs.readdir(path.join(root,base),{withFileTypes:true});
  const known = new Set(doc.questions.map(q=>q.id));
  const added = [];
  for(const dir of dirs.filter(d=>d.isDirectory() && !known.has(d.name))) {
    const relative = `${base}/${dir.name}`;
    const files = await fs.readdir(path.join(root,relative));
    const original = files.find(f=>/^original\.(webp|png|jpe?g)$/i.test(f));
    const thumbnail = files.find(f=>/^thumbnail\.(webp|png|jpe?g)$/i.test(f));
    if(!original || !thumbnail || !files.includes('mask.png')) throw Error(`Incomplete folder: ${relative}`);
    const {data,info} = await sharp(path.join(root,relative,original)).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const maskImage = sharp(path.join(root,relative,'mask.png'));
    const meta = await maskImage.metadata();
    if(meta.width!==info.width || meta.height!==info.height) throw Error(`Mask dimensions differ: ${relative}`);
    const mask = await maskImage.toColourspace('srgb').ensureAlpha().raw().toBuffer();
    const sum = [0,0,0]; let weight=0;
    for(let i=0;i<data.length;i+=4) {
      const w = mask[i]/255 * mask[i+3]/255 * data[i+3]/255;
      weight+=w;
      for(let channel=0;channel<3;channel++) sum[channel]+=data[i+channel]*w;
    }
    if(!weight) throw Error(`Empty mask: ${relative}`);
    const q = {schemaVersion:1,id:dir.name,categoryId:c.id,title:dir.name,
      originalImage:`${relative}/${original}`,maskImage:`${relative}/mask.png`,thumbnail:`${relative}/${thumbnail}`,
      answerColor:'#'+sum.map(v=>Math.round(v/weight).toString(16).padStart(2,'0')).join('').toUpperCase(),
      startColor:null,renderMode:'preserve-lightness',enabled:true,difficulty:1,tags:[],
      metadata:{createdAt:new Date().toISOString().slice(0,10),answerSource:'masked-original-average'}};
    const errors = validateQuestionShape(q);
    if(errors.length) throw Error(`${relative}: ${errors.join(', ')}`);
    added.push(q);
  }
  if(added.length) updates.push({target,doc:{...doc,questions:[...doc.questions,...added]},category:c.id,added});
}
// Finish validation of every folder before writing any category document.
for(const update of updates) {
  await fs.writeFile(update.target,JSON.stringify(update.doc,null,2)+'\n');
  console.log(`${update.category}: +${update.added.length} (${update.added.map(q=>q.id).join(', ')})`);
}
if(!updates.length) console.log('No unregistered folders.');
