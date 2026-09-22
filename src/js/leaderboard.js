import { getLang } from './i18n.js';
import { dailyKey } from './quiz-session.js';
import { validateNickname } from './nickname.js';

// Browser-local scores; this UI explicitly identifies its scope.
export function mountLeaderboard(root, { categoryId, day, average, runId, rounds = [], readOnly = false }) {
  const en = getLang() === 'en';
  const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '5173';
  let onlineRows = [], submitted = false, busy = false, disposed = false, rowsDay = dailyKey();
  const read = () => rowsDay === dailyKey() ? onlineRows : [];
  const endpoint = `/api/rankings?category=${encodeURIComponent(categoryId)}`;
  root.innerHTML = `<div class="ranking-heading"><div><div class="ranking-eyebrow">${en ? 'TOP 100' : '상위 100명'}</div><h2>${categoryId === 'daily' ? (en ? 'Daily Ranking' : '데일리 랭킹') : (en ? 'Today’s Ranking' : '오늘의 랭킹')}</h2></div><span class="ranking-local">${en ? 'LOCAL' : '내 기록'}</span></div>
    <div class="ranking-period"><span>${en ? 'Today' : '오늘'}</span><span data-role="ranking-date"></span></div>
    <div class="ranking-countdown"><span>${en ? 'Resets in' : '초기화까지'}</span><time data-role="countdown" aria-label="${en ? 'Time until midnight in Korea' : '한국 시간 자정까지 남은 시간'}"></time></div>
    ${readOnly ? '' : `<form class="ranking-form"><input class="ranking-name" aria-label="${en ? 'Nickname' : '닉네임'}" placeholder="${en ? 'Nickname' : '닉네임'}" maxlength="16" required />
    <button class="btn btn--primary" type="submit">${en ? 'Save score' : '점수 등록'}</button></form>`}
    <p data-role="ranking-status" role="status"></p><ol class="ranking-list" tabindex="0" aria-label="${en ? 'Today’s top 100 scores' : '오늘의 상위 100개 기록'}"></ol>
    <p class="ranking-footer">${en ? 'Top 100 today · Scroll for more ↓' : '오늘의 상위 100명 · 아래로 스크롤 ↓'}</p>
    <p class="ranking-scope">${en ? 'Saved in this browser · resets at midnight KST' : '이 브라우저에 저장 · 한국 시간 자정 초기화'}</p>`;
  let lastSignature = '';
  root.querySelector('.ranking-local').textContent = en ? 'ONLINE' : '공용';
  root.querySelector('.ranking-scope').textContent = en ? 'Shared leaderboard · resets at midnight KST' : '전체 방문자 랭킹 · 한국 시간 자정 초기화';
  const refresh = async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (disposed) return;
      const fixture = data.fixture === true;
      root.querySelector('.ranking-local').textContent = fixture ? (en ? 'TEST' : '테스트') : (en ? 'ONLINE' : '공용');
      root.querySelector('.ranking-scope').textContent = fixture
        ? (en ? 'Includes labeled test players and scores' : '테스트로 표시된 가상 닉네임·점수가 포함되어 있습니다')
        : (en ? 'Shared leaderboard · resets at midnight KST' : '전체 방문자 랭킹 · 한국 시간 자정 초기화');
      onlineRows = data.rows; rowsDay = data.day;
      render();
    } catch { if (!disposed) root.querySelector('[role="status"]').textContent = en ? 'Online ranking is unavailable. Please try again later.' : '온라인 랭킹에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'; }
  };
  const render = () => {
    const now = Date.now();
    const seconds = Math.ceil((86400000 - ((now + 9 * 3600000) % 86400000)) / 1000);
    root.querySelector('[data-role="countdown"]').textContent = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
    const rows = read().sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 100);
    const list = root.querySelector('ol');
    root.querySelector('[data-role="ranking-date"]').textContent = dailyKey();
    const button = root.querySelector('button');
    if (button) button.disabled = localPreview || busy || submitted || rounds.length !== 5 || (categoryId === 'daily' && day !== dailyKey());
    if (button && localPreview) root.querySelector('[role="status"]').textContent = en ? 'Local preview: play on colorsguesser.com to submit a score.' : '로컬 미리보기입니다. 점수 등록은 colorsguesser.com에서 가능합니다.';
    const signature = JSON.stringify([dailyKey(), Math.floor(now / 60000), rows]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    list.replaceChildren();
    for (const [index, row] of rows.entries()) {
      const item = document.createElement('li');
      item.className = 'ranking-entry';
      const rank = document.createElement('span');
      rank.className = 'ranking-number';
      rank.textContent = String(index + 1);
      const details = document.createElement('div');
      details.className = 'ranking-person';
      const name = document.createElement('b');
      name.textContent = row.name + (row.isTest ? (en ? ' · TEST' : ' · 테스트') : '');
      const time = document.createElement('small');
      const minutes = Math.max(0, Math.floor((now - row.time) / 60000));
      time.textContent = minutes < 1 ? (en ? 'Just now' : '방금 전') : minutes < 60 ? (en ? `${minutes}m ago` : `${minutes}분 전`) : (en ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 60)}시간 전`);
      details.append(name, time);
      if (row.isTest) time.textContent = en ? 'Daily test record' : '오늘의 테스트 기록';
      const score = document.createElement('strong');
      score.textContent = row.score.toFixed(1);
      item.append(rank, details, score);
      list.append(item);
    }
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'ranking-empty';
      empty.textContent = en ? 'Be the first to leave a score today!' : '오늘의 첫 기록을 남겨보세요!';
      list.append(empty);
    }
  };
  root.querySelector('form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const validation = validateNickname(root.querySelector('input').value);
    if (!validation.ok) {
      root.querySelector('[role="status"]').textContent = validation.reason === 'profanity'
        ? (en ? 'Please choose a nickname without offensive language.' : '욕설이나 비하 표현이 없는 닉네임을 입력해 주세요.')
        : (en ? 'Use 1–16 letters or numbers, spaces, periods, hyphens or underscores.' : '닉네임은 1~16자의 글자·숫자·공백·마침표·하이픈·밑줄만 사용할 수 있습니다.');
      return;
    }
    const name = validation.name;
    if (!name || busy || submitted || rounds.length !== 5 || (categoryId === 'daily' && day !== dailyKey())) return;
    busy = true; render();
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, runId, day, rounds }) });
      if (!response.ok) throw new Error();
      submitted = true;
      root.querySelector('[role="status"]').textContent = en ? 'Score saved!' : '점수를 등록했습니다!';
      await refresh();
    } catch { root.querySelector('[role="status"]').textContent = en ? 'Unable to save. Check your connection; duplicate or excessive submissions are blocked.' : '등록하지 못했습니다. 연결을 확인해 주세요. 중복·과도한 등록은 제한됩니다.'; }
    finally { busy = false; render(); }
  });
  render();
  refresh();
  const poll = setInterval(refresh, 15000);
  const timer = setInterval(render, 1000);
  return () => { disposed = true; clearInterval(timer); clearInterval(poll); };
}
