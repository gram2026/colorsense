/**
 * 문제 결과 화면의 점수 공개 연출:
 * 대포가 병아리·기계체조 선수·개·고양이 중 하나를 쏘고, 포물선을 그리며 무지개 점수 바의 점수 위치에 착지한다.
 */

import { formatScore } from "./dom.js";
import { burstConfetti, TIER_COLORS } from "./effects.js";
import { scoreBarGradient } from "./score-colors.js";

const FLIGHT_MS = 1150;
const FIRE_DELAY_MS = 260;

const FLYER_KINDS = ["chick", "gymnast", "dog", "cat"];
/** 병아리는 한 바퀴 반 굴러 떨어지고, 사람/개는 착지 자세로 서야 하므로 딱 떨어지는 바퀴 수 */
const SPIN_DEG = { chick: 540, gymnast: 720, dog: 360, cat: 360 };

export function pickFlyerKind() {
  return FLYER_KINDS[Math.floor(Math.random() * FLYER_KINDS.length)];
}

/** 동글동글한 까만 눈 + 반짝이 */
const cuteEye = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" class="cute-eye" /><circle cx="${(cx - r * 0.35).toFixed(2)}" cy="${(cy - r * 0.38).toFixed(2)}" r="${(r * 0.36).toFixed(2)}" class="cute-shine" />`;
/** 볼터치 */
const blush = (cx, cy, rx = 2.6, ry = 1.5) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="cute-blush" />`;

const CHICK_SVG = `
  <svg class="score-launch__pose" viewBox="0 0 44 40">
    <path d="M31 19 L43 22 L31 26 Z" class="score-launch__beak" />
    <circle cx="21" cy="22" r="15" class="score-launch__body" />
    <path d="M9 23 q6 8 13 2" class="score-launch__wing" />
    <circle cx="26" cy="17" r="2.2" class="score-launch__eye" />
    <path d="M17 8 q2 -6 5 -1" class="score-launch__tuft" />
  </svg>`;

/** 옆모습. 공중에서는 무릎을 감싸 안은 턱(tuck) 자세, 착지는 두 팔을 번쩍 든 자세. */
const GYMNAST_SVG = `
  <svg class="score-launch__pose score-launch__pose--air" viewBox="0 0 48 48">
    <path d="M26 20 Q15 22 17 33" class="gym-leotard" />
    <path d="M17 33 L31 30" class="gym-limb" />
    <path d="M31 30 L25 40" class="gym-limb" />
    <path d="M25 40 l5 1" class="gym-limb gym-limb--thin" />
    <path d="M25 22 Q32 25 29 33" class="gym-limb gym-limb--thin" />
    <path d="M25.5 11 q-5 -1 -6.5 4" class="gym-hair" />
    <circle cx="30" cy="14" r="5.2" class="gym-head" />
    <path d="M35 13.5 q2.4 1.4 -0.2 2.8" class="gym-nose" />
    ${cuteEye(32.2, 13, 1.35)}
    ${blush(31.4, 16.4, 1.7, 1)}
    <path d="M25 12.5 q3 -6.5 10 -1.8" class="gym-hair" />
  </svg>
  <svg class="score-launch__pose score-launch__pose--land" viewBox="0 0 40 64">
    <path d="M20 21 L8 7" class="gym-limb gym-limb--thin gym-limb--back" />
    <path d="M19 36 L14 47 L18 58" class="gym-limb gym-limb--back" />
    <path d="M20 19 Q17 27 19 36" class="gym-leotard" />
    <path d="M19 36 L25 47 L21 58" class="gym-limb" />
    <path d="M18 58 l6 0 M21 58 l7 0" class="gym-limb gym-limb--thin" />
    <path d="M21 21 L33 7" class="gym-limb gym-limb--thin" />
    <path d="M16.5 10 q-5.5 0.5 -4.5 6" class="gym-hair" />
    <circle cx="21" cy="12" r="4.8" class="gym-head" />
    <path d="M25.6 11 q2.3 1.3 -0.1 2.6" class="gym-nose" />
    <path d="M22.4 14.6 q1.4 1.2 2.8 0" class="cute-mouth" />
    ${cuteEye(23.2, 11, 1.3)}
    ${blush(21.6, 14.2, 1.6, 0.95)}
    <path d="M16.3 11 q3 -6.5 9.6 -2" class="gym-hair" />
  </svg>`;

/** 옆모습. 공중에서는 네 다리를 쫙 벌리고 날고, 착지는 혀를 살짝 내민 채 얌전히 앉는다. */
const DOG_SVG = `
  <svg class="score-launch__pose score-launch__pose--air" viewBox="0 0 64 50">
    <path d="M14 23 q-9 -5 -7 -14" class="dog-line dog-tail" />
    <path d="M39 30 l9 6 M36 32 l5 10 M19 30 l-10 6 M22 32 l-5 10" class="dog-leg" />
    <ellipse cx="27" cy="26" rx="15" ry="9" class="dog-fur" />
    <ellipse cx="22" cy="23" rx="5" ry="3.4" class="dog-spot" />
    <path d="M53 25 q0.5 4 3.2 3.4 q0.5 -2.4 -1.5 -3.4" class="derp-tongue" />
    <circle cx="45" cy="18" r="9.5" class="dog-fur" />
    <ellipse cx="54" cy="21.5" rx="6" ry="4" class="dog-fur" />
    <circle cx="59.5" cy="20" r="2" class="dog-nose" />
    <path d="M40 11 q-9 -7 -14 1 q6 3 12 3" class="dog-ear" />
    ${cuteEye(48, 15.5, 2.3)}
    ${blush(46, 20.5)}
  </svg>
  <svg class="score-launch__pose score-launch__pose--land" viewBox="0 0 58 58">
    <path d="M12 42 q-9 -1 -8 -11" class="dog-line dog-tail dog-tail--wag" />
    <ellipse cx="23" cy="40" rx="12" ry="13" class="dog-fur" />
    <ellipse cx="17" cy="48" rx="8" ry="6" class="dog-fur" />
    <path d="M30 42 L32 55 M34 41 L37 55" class="dog-leg dog-leg--thick" />
    <path d="M29 56 l6 0 M34 56 l6 0" class="dog-leg" />
    <path d="M44 27.5 q0.4 4.4 3.4 3.8 q0.6 -2.6 -1.6 -3.8" class="derp-tongue" />
    <circle cx="35" cy="21" r="10.5" class="dog-fur" />
    <ellipse cx="45" cy="24" rx="6.5" ry="4.2" class="dog-fur" />
    <circle cx="51" cy="22.5" r="2" class="dog-nose" />
    <path d="M27 17 q-8 3 -6 13 q4 -4 7 -8" class="dog-ear" />
    ${cuteEye(38, 18, 2.5)}
    ${blush(35.5, 24)}
  </svg>`;

/** 옆모습. 공중에서는 슈퍼맨처럼 앞발을 쭉 뻗고, 착지는 고개를 갸웃한 채 혀를 살짝 내밀고(블렙) 앉는다. */
const CAT_SVG = `
  <svg class="score-launch__pose score-launch__pose--air" viewBox="0 0 64 50">
    <path d="M13 23 q-9 -8 -4 -17 q3 -3 5 0" class="dog-line" />
    <path d="M40 28 l12 -2 M38 31 l12 3 M18 28 l-10 3 M20 31 l-8 7" class="dog-leg" />
    <ellipse cx="28" cy="26" rx="15" ry="8" class="cat-fur" />
    <path d="M22 19 q2 3 0 6 M28 18 q2 3 0 7 M34 19 q2 3 0 6" class="cat-stripe" />
    <path d="M39 12 L40 2 L46 9 Z M47 9 L53 2 L54 12 Z" class="cat-fur" />
    <circle cx="46" cy="17" r="9" class="cat-fur" />
    <path d="M52 22 q0.5 4.2 3.2 3.5 q0.4 -2.6 -1.5 -3.5" class="derp-tongue" />
    <path d="M53.5 19 l2.6 0 l-1.3 1.7 Z" class="cat-nose" />
    <path d="M55 20.5 l8 -2.5 M55 22 l8 1" class="cat-whisker" />
    ${cuteEye(49, 15.5, 2.2)}
    ${blush(47.5, 20.5)}
  </svg>
  <svg class="score-launch__pose score-launch__pose--land" viewBox="0 0 56 60">
    <path d="M14 53 q-11 -2 -8 -15 q2 -5 6 -3" class="dog-line" />
    <ellipse cx="25" cy="43" rx="13" ry="14" class="cat-fur" />
    <path d="M18 36 q3 2 1 6 M24 33 q3 2 1 7" class="cat-stripe" />
    <path d="M30 45 L31 57 M35 44 L36 57" class="dog-leg cat-leg--thick" />
    <path d="M28 58 l6 0 M33 58 l6 0" class="dog-leg" />
    <g transform="rotate(-14 34 20)">
      <path d="M26 13 L25 1 L33 8 Z M36 8 L44 1 L43 13 Z" class="cat-fur" />
      <circle cx="34" cy="20" r="11" class="cat-fur" />
      <path d="M30 11 q2 3 0 5 M35 10 q2 3 0 5" class="cat-stripe" />
      <path d="M40.5 25.5 q0.4 4.6 3.4 3.8 q0.6 -2.8 -1.6 -3.8" class="derp-tongue" />
      <path d="M41.5 22.5 l2.6 0 l-1.3 1.7 Z" class="cat-nose" />
      <path d="M44 24 l9 -2.5 M44 25.5 l9 1" class="cat-whisker" />
      ${cuteEye(32, 18.5, 2.3)}
      ${cuteEye(39.5, 18, 2.1)}
      ${blush(29.5, 23.5)}
    </g>
  </svg>`;

const FLYER_SVG = { chick: CHICK_SVG, gymnast: GYMNAST_SVG, dog: DOG_SVG, cat: CAT_SVG };

export function perfectDanceMarkup() {
  return `<div class="perfect-dance" aria-hidden="true">${FLYER_KINDS.map((kind, i) =>
    `<div class="perfect-dance__character" style="--dance-delay:${i * -0.17}s">${FLYER_SVG[kind]}</div>`
  ).join('')}</div>`;
}

export function scoreLaunchMarkup(kind = "chick") {
  return `
    <div class="score-launch score-launch--${kind}" data-role="launch" data-kind="${kind}" aria-hidden="true">
      <svg class="score-launch__trail" data-role="trail" preserveAspectRatio="none"><path d="" vector-effect="non-scaling-stroke" /></svg>
      <svg class="score-launch__cannon" data-role="cannon" viewBox="0 0 100 100">
        <g class="score-launch__barrel">
          <g transform="rotate(-40 40 62)">
            <rect x="16" y="48" width="70" height="28" rx="7" />
            <rect x="82" y="43" width="11" height="38" rx="3" />
            <path d="M28 56 q10 -3 20 0" class="score-launch__sketch" />
          </g>
        </g>
        <circle cx="40" cy="75" r="16" />
        <ellipse cx="41" cy="75" rx="6" ry="4.5" class="score-launch__hub" />
        <g class="score-launch__smoke" data-role="smoke">
          <circle cx="80" cy="27" r="7" />
          <circle cx="90" cy="20" r="5" />
          <circle cx="74" cy="17" r="5" />
        </g>
      </svg>
      <div class="score-launch__bar" style="background:${scoreBarGradient()}">
        <span class="score-launch__tick score-launch__tick--start">0</span>
        <span class="score-launch__tick score-launch__tick--end">100</span>
      </div>
      <div class="score-launch__flyer score-launch__flyer--${kind}" data-role="flyer">
        ${FLYER_SVG[kind] ?? CHICK_SVG}
      </div>
      <div class="score-launch__tag" data-role="tag"></div>
    </div>
  `;
}

/**
 * @param {HTMLElement} root  scoreLaunchMarkup()이 들어있는 요소
 * @param {{ score: number, tier: string, onProgress?: (value:number)=>void, onLand?: ()=>void }} opts
 */
export function playScoreLaunch(root, { score, tier, onProgress, onLand }) {
  const stage = root.querySelector('[data-role="launch"]');
  if (!stage) return;
  const cannon = stage.querySelector('[data-role="cannon"]');
  const flyer = stage.querySelector('[data-role="flyer"]');
  const spinDeg = SPIN_DEG[stage.dataset.kind] ?? SPIN_DEG.chick;
  const tag = stage.querySelector('[data-role="tag"]');
  const trailPath = stage.querySelector('[data-role="trail"] path');
  const bar = stage.querySelector(".score-launch__bar");

  const ratio = Math.max(0, Math.min(1, score / 100));
  const land = () => {
    const stageRect = stage.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    return {
      x: barRect.left - stageRect.left + barRect.width * ratio,
      y: barRect.top - stageRect.top,
    };
  };

  const placeAt = (el, x, y, stageRect) => {
    el.style.left = `${(x / stageRect.width) * 100}%`;
    el.style.top = `${(y / stageRect.height) * 100}%`;
  };

  const finish = () => {
    const stageRect = stage.getBoundingClientRect();
    const end = land();
    placeAt(flyer, end.x, end.y, stageRect);
    flyer.style.transform = "";
    flyer.classList.add("is-flying", "is-landed");
    tag.textContent = formatScore(score);
    const halfTag = tag.offsetWidth / 2;
    const tagX = Math.min(Math.max(end.x, halfTag), stageRect.width - halfTag);
    placeAt(tag, tagX, end.y, stageRect);
    tag.classList.add("is-visible");
    onProgress?.(score);

    if (tier === "perfect" || tier === "great") {
      burstConfetti(tag, { colors: TIER_COLORS[tier], count: tier === "perfect" ? 44 : 28, spread: 150 });
    }
    onLand?.();
  };

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return;
  }

  setTimeout(() => {
    if (!stage.isConnected) return;
    const stageRect = stage.getBoundingClientRect();
    const cannonRect = cannon.getBoundingClientRect();
    const start = {
      x: cannonRect.left - stageRect.left + cannonRect.width * 0.8,
      y: cannonRect.top - stageRect.top + cannonRect.height * 0.28,
    };
    const end = land();
    const apexY = 14;
    const control = {
      x: (start.x + end.x) / 2,
      y: 2 * apexY - (start.y + end.y) / 2,
    };

    const pointAt = (t) => {
      const mt = 1 - t;
      return {
        x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
        y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
      };
    };
    const trailUpTo = (t) => {
      const steps = Math.max(2, Math.ceil(t * 40));
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const p = pointAt((t * i) / steps);
        d += `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      }
      return d;
    };
    stage.querySelector('[data-role="trail"]').setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);

    cannon.classList.add("is-firing");
    flyer.classList.add("is-flying");

    let startedAt = null;
    function frame(now) {
      if (!stage.isConnected) return;
      startedAt ??= now;
      const t = Math.min(1, (now - startedAt) / FLIGHT_MS);
      const { x, y } = pointAt(t);

      placeAt(flyer, x, y, stageRect);
      flyer.style.transform = `translate(-50%, -100%) rotate(${Math.round(t * spinDeg)}deg)`;
      trailPath.setAttribute("d", trailUpTo(t));
      onProgress?.(score * t);

      if (t < 1) requestAnimationFrame(frame);
      else finish();
    }
    requestAnimationFrame(frame);
  }, FIRE_DELAY_MS);
}
