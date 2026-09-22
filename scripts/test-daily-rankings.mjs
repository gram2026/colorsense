import assert from 'node:assert/strict';
import {createTestRankings} from '../src/js/test-rankings.js';
import {validateNickname} from '../src/js/nickname.js';
const before = new Date('2026-09-22T14:59:59Z');
const after = new Date('2026-09-22T15:00:00Z');
for(const id of ['daily','brand-logo','sports','country','animation','meme','pokemon']) {
  const a=createTestRankings(id,before), b=createTestRankings(id,after);
  assert.equal(a.day,'2026-09-22'); assert.equal(b.day,'2026-09-23');
  assert.notDeepEqual(a.rows,b.rows);
  assert.deepEqual(a,createTestRankings(id,new Date('2026-09-22T01:00:00Z')));
  assert.notDeepEqual(a.rows,createTestRankings(id+'-other',before).rows);
  for(const result of [a,b]) {
    assert(result.rows.length>=25 && result.rows.length<=35);
    assert.equal(new Set(result.rows.map(r=>r.name)).size,result.rows.length);
    assert(result.rows.every(r=>r.isTest && validateNickname(r.name).ok && r.score>=35 && r.score<=94.9));
    assert(result.rows.some(r=>/^[A-Za-z0-9]+$/.test(r.name)));
    assert(result.rows.some(r=>/^[가-힣0-9]+$/.test(r.name)));
  }
}
console.log('Daily fixtures: KST rollover, stability, category variety, unique valid names passed.');
