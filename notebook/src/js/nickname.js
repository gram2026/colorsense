// Normalize common separator, case, full-width and leetspeak evasions.
export function validateNickname(value) {
  const name = String(value ?? '').normalize('NFKC').trim();
  if (!name || [...name].length > 16 || !/^[\p{L}\p{N} _.-]+$/u.test(name)) return { ok: false, reason: 'format' };
  const compact = name.toLowerCase().replace(/[\s_.-]/g, '');
  const latin = compact.replace(/[013457]/g, ch => ({0:'o',1:'i',3:'e',4:'a',5:'s',7:'t'}[ch]));
  const korean = compact.replace(/[0-9]/g, '').replace(/[ᄉᄊᄇᄌᄅ]/g, ch => ({'ᄉ':'ㅅ','ᄊ':'ㅆ','ᄇ':'ㅂ','ᄌ':'ㅈ','ᄅ':'ㄹ'}[ch]));
  const blocked = /씨발|시발|씨빨|시빨|씨팔|시팔|씹새|씹년|씹놈|개새끼|개색끼|개세끼|병신|븅신|빙신|좆|존나|좃|지랄|새끼|애미|애비|느금|니미|ㅅㅂ|ㅆㅂ|ㅂㅅ|ㅈㄹ/.test(korean)
    || /fuck|fuk|fck|shit|sh!t|bitch|biatch|asshole|bastard|cunt|nigg|dickhead|motherf/.test(latin);
  return blocked ? { ok: false, reason: 'profanity' } : { ok: true, name };
}
