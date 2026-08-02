/**
 * 아주 작은 PNG 인코더 (외부 패키지 없이 Node 내장 zlib만 사용)
 * 테스트용 샘플 이미지/마스크/썸네일/커버 이미지를 생성하기 위한 용도.
 * RGBA(Uint8ClampedArray, 4바이트/픽셀) 픽셀 버퍼를 받아 PNG 파일 Buffer를 반환한다.
 */
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Buffer|Uint8Array} rgba 길이 width*height*4 인 RGBA 픽셀 버퍼
 */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // 각 스캔라인 앞에 필터 타입(0 = None) 1바이트를 붙인다.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const srcStart = y * stride;
    const dstStart = y * (stride + 1);
    raw[dstStart] = 0;
    rgba.copy
      ? rgba.copy(raw, dstStart + 1, srcStart, srcStart + stride)
      : raw.set(rgba.subarray(srcStart, srcStart + stride), dstStart + 1);
  }

  const idatData = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdrData),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export { encodePng };
