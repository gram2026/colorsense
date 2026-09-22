import { dailyKey } from './quiz-session.js';
import { validateNickname } from './nickname.js';

const koFirst = ['달빛','햇살','민트','노란','푸른','초록','분홍','보라','하얀','작은','느긋한','졸린','씩씩한','반짝','새벽','우주','구름','바람','여름','겨울','봄날','가을','레몬','유자','복숭아','말랑','동그란','산책하는','꿈꾸는','웃는'];
const koLast = ['고양이','강아지','여우','토끼','고래','참새','다람쥐','수달','펭귄','곰','별','연필','물감','팔레트','우산','모자','쿠키','푸딩','젤리','라떼','파도','나무','꽃','구슬','종이','스케치','망고','체리','구름','도토리'];
const enFirst = ['Mint','Sunny','Lunar','Coral','Azure','Golden','Silver','Peach','Mango','Velvet','Tiny','Sleepy','Happy','Cozy','Lucky','Gentle','Quiet','Brave','Neon','Pastel','Pixel','Sketch','Cloud','Ocean','Maple','Winter','Summer','Misty','Amber','Lemon'];
const enLast = ['Fox','Cat','Otter','Bear','Bunny','Whale','Panda','Robin','Finch','Deer','Leaf','Star','Moon','Wave','Pebble','Brush','Canvas','Pencil','Doodle','Cookie','Berry','Petal','Comet','Sprout','Melon','Tea','Bean','Pearl','Kite','Owl'];

// Deterministic daily fixtures, not real users. No scheduled writes or database inserts.
export function createTestRankings(category, date = new Date()) {
  const day = dailyKey(date);
  let seed = 2166136261;
  for (const ch of `${day}/${category}/test-v1`) seed = Math.imul(seed ^ ch.charCodeAt(0),16777619);
  const random = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ seed >>> 15,seed | 1);
    t ^= t + Math.imul(t ^ t >>> 7,t | 61);
    return ((t ^ t >>> 14) >>> 0)/4294967296;
  };
  const pick = list => list[Math.floor(random()*list.length)];
  const count = 25 + Math.floor(random()*11);
  const names = new Set(), rows = [];
  const midnight = Date.parse(`${day}T00:00:00+09:00`);
  while(rows.length < count) {
    const style = rows.length % 3;
    let name = style === 0 ? pick(koFirst)+pick(koLast) : style === 1 ? pick(enFirst)+pick(enLast) : pick(koFirst)+pick(enLast);
    if(random()<0.3) name += String(10+Math.floor(random()*90));
    if(names.has(name) || !validateNickname(name).ok) continue;
    names.add(name);
    rows.push({name,score:Math.round((35+Math.pow(random(),0.55)*59.9)*10)/10,time:midnight,isTest:true});
  }
  return {day,fixture:true,rows:rows.sort((a,b)=>b.score-a.score)};
}
