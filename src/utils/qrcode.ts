/**
 * Minimal QR Code SVG generator.
 *
 * Adapted from the public-domain "QR Code generator library (TypeScript)"
 * by Project Nayuki, simplified for byte-mode encoding and SVG output.
 * Source: https://www.nayuki.io/page/qr-code-generator-library
 */

/* eslint-disable no-bitwise */

class QrSegment {
  static makeBytes(data: number[]): QrSegment {
    const bb: number[] = [];
    for (const b of data) {
      QrSegment.appendBits(b, 8, bb);
    }
    return new QrSegment(QrSegment.MODE_BYTE, data.length, bb);
  }

  static appendBits(val: number, len: number, bb: number[]): void {
    if (len < 0 || len > 31 || val >>> len !== 0) throw new Error('Bit value out of range');
    for (let i = len - 1; i >= 0; i -= 1) bb.push((val >>> i) & 1);
  }

  static MODE_BYTE = 0x4;

  constructor(public readonly mode: number, public readonly numChars: number, public readonly bitData: number[]) {}

  getTotalBits(version: number): number {
    return 4 + QrSegment.numCharCountBits(this.mode, version) + this.bitData.length;
  }

  static numCharCountBits(mode: number, ver: number): number {
    if (mode !== QrSegment.MODE_BYTE) throw new Error('Unsupported mode');
    if (ver < 10) return 8;
    if (ver < 27) return 16;
    return 16;
  }
}

const ECC_LEVEL = { L: 0, M: 1, Q: 2, H: 3 } as const;

const ECC_CODEWORDS_PER_BLOCK = [
  // L         M         Q         H
  [-1, -1, -1, -1],
  [7, 10, 13, 17], [10, 16, 22, 28], [15, 26, 18, 22], [20, 18, 26, 16],
  [26, 24, 18, 22], [18, 16, 24, 28], [20, 18, 18, 26], [24, 22, 22, 26],
  [30, 22, 20, 24], [18, 26, 24, 28],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, -1, -1, -1],
  [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 2, 2], [1, 2, 2, 4],
  [1, 2, 4, 4], [2, 4, 4, 4], [2, 4, 6, 5], [2, 4, 6, 6],
  [2, 5, 8, 8], [4, 5, 8, 8],
];

class QrCode {
  static encodeBinary(data: number[], ecl: 0|1|2|3 = ECC_LEVEL.M): QrCode {
    const seg = QrSegment.makeBytes(data);
    return QrCode.encodeSegments([seg], ecl);
  }

  static encodeSegments(segs: QrSegment[], ecl: 0|1|2|3): QrCode {
    let version = 1;
    let dataUsedBits = -1;
    while (version <= 10) {
      const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
      let used = 0;
      for (const seg of segs) used += seg.getTotalBits(version);
      if (used <= dataCapacityBits) {
        dataUsedBits = used;
        break;
      }
      version += 1;
    }
    if (dataUsedBits < 0) throw new Error('Data too long for QR (max v10)');

    const bb: number[] = [];
    for (const seg of segs) {
      QrSegment.appendBits(seg.mode, 4, bb);
      QrSegment.appendBits(seg.numChars, QrSegment.numCharCountBits(seg.mode, version), bb);
      for (const b of seg.bitData) bb.push(b);
    }

    const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
    QrSegment.appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
    QrSegment.appendBits(0, (8 - bb.length % 8) % 8, bb);
    for (let pad = 0xEC; bb.length < dataCapacityBits; pad ^= 0xEC ^ 0x11) {
      QrSegment.appendBits(pad, 8, bb);
    }

    const dataCodewords: number[] = [];
    for (let i = 0; i < bb.length; i += 8) {
      let v = 0;
      for (let k = 0; k < 8; k += 1) v = (v << 1) | bb[i + k];
      dataCodewords.push(v);
    }
    return new QrCode(version, ecl, dataCodewords);
  }

  static getNumRawDataModules(ver: number): number {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  static getNumDataCodewords(ver: number, ecl: number): number {
    return Math.floor(QrCode.getNumRawDataModules(ver) / 8)
      - ECC_CODEWORDS_PER_BLOCK[ver][ecl] * NUM_ERROR_CORRECTION_BLOCKS[ver][ecl];
  }

  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(public readonly version: number, public readonly ecl: number, dataCodewords: number[]) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));

    this.drawFunctionPatterns();
    const allCodewords = this.addEccAndInterleave(dataCodewords);
    this.drawCodewords(allCodewords);
    const mask = this.handleConstructorMasking(-1);
    this.applyMask(mask);
    this.drawFormatBits(mask);
  }

  private drawFunctionPatterns(): void {
    for (let i = 0; i < this.size; i += 1) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);
    const alignPos = this.getAlignmentPatternPositions();
    for (let i = 0; i < alignPos.length; i += 1) {
      for (let j = 0; j < alignPos.length; j += 1) {
        if ((i === 0 && j === 0) || (i === 0 && j === alignPos.length - 1) || (i === alignPos.length - 1 && j === 0)) continue;
        this.drawAlignmentPattern(alignPos[i], alignPos[j]);
      }
    }
    this.drawFormatBits(0);
    if (this.version >= 7) this.drawVersion();
  }

  private drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= this.size || yy < 0 || yy >= this.size) continue;
        this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignmentPattern(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  private getAlignmentPatternPositions(): number[] {
    if (this.version === 1) return [];
    const numAlign = Math.floor(this.version / 7) + 2;
    const step = this.version === 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  private drawFormatBits(mask: number): void {
    const data = this.ecl << 3 | mask;
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (data << 10 | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) this.setFunctionModule(8, i, ((bits >>> i) & 1) !== 0);
    this.setFunctionModule(8, 7, ((bits >>> 6) & 1) !== 0);
    this.setFunctionModule(8, 8, ((bits >>> 7) & 1) !== 0);
    this.setFunctionModule(7, 8, ((bits >>> 8) & 1) !== 0);
    for (let i = 9; i < 15; i += 1) this.setFunctionModule(14 - i, 8, ((bits >>> i) & 1) !== 0);
    for (let i = 0; i < 8; i += 1) this.setFunctionModule(this.size - 1 - i, 8, ((bits >>> i) & 1) !== 0);
    for (let i = 8; i < 15; i += 1) this.setFunctionModule(8, this.size - 15 + i, ((bits >>> i) & 1) !== 0);
    this.setFunctionModule(8, this.size - 8, true);
  }

  private drawVersion(): void {
    let rem = this.version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + i % 3;
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, bit);
      this.setFunctionModule(b, a, bit);
    }
  }

  private setFunctionModule(x: number, y: number, isDark: boolean): void {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  private addEccAndInterleave(data: number[]): number[] {
    const ver = this.version;
    const ecl = this.ecl;
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ver][ecl];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ver][ecl];
    const rawCodewords = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks: number[][] = [];
    const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);
    let k = 0;
    for (let i = 0; i < numBlocks; i += 1) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const result: number[] = [];
    for (let i = 0; i < blocks[0].length; i += 1) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
      });
    }
    return result;
  }

  private drawCodewords(data: number[]): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i += 1;
          }
        }
      }
    }
  }

  private applyMask(mask: number): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = x * y % 2 + x * y % 3 === 0; break;
          case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
          case 7: invert = ((x + y) % 2 + x * y % 3) % 2 === 0; break;
          default: invert = false;
        }
        if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  private handleConstructorMasking(mask: number): number {
    if (mask === -1) {
      let minPenalty = 1e9;
      let bestMask = 0;
      for (let m = 0; m < 8; m += 1) {
        this.applyMask(m);
        this.drawFormatBits(m);
        const penalty = this.getPenaltyScore();
        if (penalty < minPenalty) {
          bestMask = m;
          minPenalty = penalty;
        }
        this.applyMask(m); // undo
      }
      return bestMask;
    }
    return mask;
  }

  private getPenaltyScore(): number {
    let result = 0;
    for (let y = 0; y < this.size; y += 1) {
      let runColor = false;
      let runLen = 0;
      for (let x = 0; x < this.size; x += 1) {
        if (this.modules[y][x] === runColor) {
          runLen += 1;
          if (runLen === 5) result += 3;
          else if (runLen > 5) result += 1;
        } else {
          runColor = this.modules[y][x];
          runLen = 1;
        }
      }
    }
    for (let x = 0; x < this.size; x += 1) {
      let runColor = false;
      let runLen = 0;
      for (let y = 0; y < this.size; y += 1) {
        if (this.modules[y][x] === runColor) {
          runLen += 1;
          if (runLen === 5) result += 3;
          else if (runLen > 5) result += 1;
        } else {
          runColor = this.modules[y][x];
          runLen = 1;
        }
      }
    }
    for (let y = 0; y < this.size - 1; y += 1) {
      for (let x = 0; x < this.size - 1; x += 1) {
        const c = this.modules[y][x];
        if (c === this.modules[y][x + 1] && c === this.modules[y + 1][x] && c === this.modules[y + 1][x + 1]) result += 3;
      }
    }
    let dark = 0;
    for (const row of this.modules) for (const v of row) if (v) dark += 1;
    const total = this.size * this.size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * 10;
    return result;
  }

  private static reedSolomonComputeDivisor(degree: number): number[] {
    if (degree < 1 || degree > 255) throw new Error('Degree out of range');
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i += 1) {
      for (let j = 0; j < result.length; j += 1) {
        result[j] = QrCode.reedSolomonMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = QrCode.reedSolomonMultiply(root, 0x02);
    }
    return result;
  }

  private static reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
    const result = new Array(divisor.length).fill(0);
    for (const b of data) {
      const factor = b ^ (result.shift() as number);
      result.push(0);
      for (let j = 0; j < divisor.length; j += 1) result[j] ^= QrCode.reedSolomonMultiply(divisor[j], factor);
    }
    return result;
  }

  private static reedSolomonMultiply(x: number, y: number): number {
    let z = 0;
    for (let i = 7; i >= 0; i -= 1) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
}

/**
 * Build an SVG string for the given text.
 * Renders a square QR with a quiet zone and CSS-driven fill.
 */
export const qrSvg = (text: string, opts: { size?: number; quiet?: number; dark?: string; light?: string } = {}): string => {
  const dataBytes: number[] = [];
  // UTF-8 encode
  const enc = new TextEncoder().encode(text);
  enc.forEach((b) => dataBytes.push(b));
  const code = QrCode.encodeBinary(dataBytes, ECC_LEVEL.M);
  const quiet = opts.quiet ?? 4;
  const fullSize = code.size + quiet * 2;
  const dark = opts.dark || '#0f172a';
  const light = opts.light || '#ffffff';
  const pixelSize = opts.size || 240;

  let path = '';
  for (let y = 0; y < code.size; y += 1) {
    for (let x = 0; x < code.size; x += 1) {
      if (code.modules[y][x]) {
        path += `M${x + quiet},${y + quiet}h1v1h-1z`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${light}"/>` +
    `<path fill="${dark}" d="${path}"/>` +
    `</svg>`
  );
};

/**
 * Return the raw QR module matrix (true=dark) for the given text.
 * Lets callers draw the QR on any 2D surface (canvas, jsPDF, etc.).
 */
export const qrModules = (text: string): { size: number; modules: boolean[][] } => {
  const dataBytes: number[] = [];
  const enc = new TextEncoder().encode(text);
  enc.forEach((b) => dataBytes.push(b));
  const code = QrCode.encodeBinary(dataBytes, ECC_LEVEL.M);
  return { size: code.size, modules: code.modules };
};
