/**
 * 색상 차이(Delta E) 계산
 * - deltaE76: LAB 공간에서의 단순 유클리드 거리 (구현이 쉬움, fallback 용도)
 * - deltaE2000: CIEDE2000 공식 (사람이 느끼는 색 차이에 가장 가까움, 기본값)
 *
 * 두 함수 모두 입력은 { l, a, b } 형태의 LAB 값을 받는다.
 */

export function deltaE76(lab1, lab2) {
  const dl = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * CIEDE2000
 * 참고 공식: Sharma, Wu, Dalal (2005) "The CIEDE2000 Color-Difference Formula"
 * 가중치(kL, kC, kH)는 표준 조건인 1로 고정한다.
 */
export function deltaE2000(lab1, lab2) {
  const kL = 1;
  const kC = 1;
  const kH = 1;

  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const CBar = (C1 + C2) / 2;

  const CBar7 = Math.pow(CBar, 7);
  const G = 0.5 * (1 - Math.sqrt(CBar7 / (CBar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const rad2deg = (rad) => (rad * 180) / Math.PI;
  const deg2rad = (deg) => (deg * Math.PI) / 180;

  const hAngle = (a, b) => {
    if (a === 0 && b === 0) return 0;
    let angle = rad2deg(Math.atan2(b, a));
    if (angle < 0) angle += 360;
    return angle;
  };

  const h1p = hAngle(a1p, b1);
  const h2p = hAngle(a2p, b2);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp) / 2);

  const LBarp = (L1 + L2) / 2;
  const CBarp = (C1p + C2p) / 2;

  let hBarp;
  if (C1p * C2p === 0) {
    hBarp = h1p + h2p;
  } else {
    const diff = Math.abs(h1p - h2p);
    if (diff <= 180) {
      hBarp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      hBarp = (h1p + h2p + 360) / 2;
    } else {
      hBarp = (h1p + h2p - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(hBarp - 30)) +
    0.24 * Math.cos(deg2rad(2 * hBarp)) +
    0.32 * Math.cos(deg2rad(3 * hBarp + 6)) -
    0.2 * Math.cos(deg2rad(4 * hBarp - 63));

  const dTheta = 30 * Math.exp(-Math.pow((hBarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(CBarp, 7) / (Math.pow(CBarp, 7) + Math.pow(25, 7)));
  const SL =
    1 + (0.015 * Math.pow(LBarp - 50, 2)) / Math.sqrt(20 + Math.pow(LBarp - 50, 2));
  const SC = 1 + 0.045 * CBarp;
  const SH = 1 + 0.015 * CBarp * T;
  const RT = -Math.sin(deg2rad(2 * dTheta)) * RC;

  const lTerm = dLp / (kL * SL);
  const cTerm = dCp / (kC * SC);
  const hTerm = dHp / (kH * SH);

  const result = Math.sqrt(
    lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + RT * cTerm * hTerm
  );

  return result;
}
