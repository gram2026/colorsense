import assert from 'node:assert/strict';
import { validateNickname } from '../src/js/nickname.js';
for (const name of ['피카츄', '색깔왕123', 'Jimmy', 'Classical', '별빛_여행자', 'Player-1']) assert(validateNickname(name).ok, name);
for (const name of ['씨발', '씨 발', '씨1발', 'ㅅㅂ', 'ＦＵＣＫ', 'f.u.c.k', 'sh1t', 'b1tch', '<script>', 'a\u200bb', '', 'a'.repeat(17)]) assert(!validateNickname(name).ok, name);
console.log('Nickname validation checks passed.');
