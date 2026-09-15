/**
 * Cloudflare Pages Function
 * 접속자의 국가 코드를 서버(엣지)에서만 알 수 있는 CF-IPCountry 헤더로 알려준다.
 * 클라이언트 JS는 이 엔드포인트를 fetch해서 국가만 받고, IP 자체는 절대 노출되지 않는다.
 * 로컬 개발 서버(scripts/start-local.js)에는 이 경로가 없어서 404가 나는데,
 * 클라이언트 쪽(src/js/i18n.js)에서 그 실패를 기본 언어로 안전하게 처리한다.
 */
export function onRequest(context) {
  const country = context.request.headers.get("CF-IPCountry") || context.request.cf?.country || null;

  return new Response(JSON.stringify({ country }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
