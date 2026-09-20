export function dailyKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function pickFive(questions, seed = null) {
  const copy = [...questions];
  let n = 2166136261;
  if (seed !== null) {
    copy.sort((a, b) => `${a.categoryId}/${a.id}`.localeCompare(`${b.categoryId}/${b.id}`, 'en'));
    for (const ch of seed) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  }
  const random = seed === null ? Math.random : () => {
    n += 0x6D2B79F5;
    let t = Math.imul(n ^ n >>> 15, 1 | n);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 5);
}
