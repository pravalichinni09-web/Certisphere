/**
 * QR codes for certificates and verification links.
 *
 * Uses the widely used `qrcode` library (the earlier hand-written encoder
 * produced codes that phone scanners could not read).
 *  • qrModules(text) → the module matrix (true = dark) to draw anywhere (jsPDF, canvas)
 *  • qrSvg(text)     → a ready SVG string with a quiet zone
 */
import QRCode from 'qrcode';

export const qrModules = (text: string): { size: number; modules: boolean[][] } => {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const modules: boolean[][] = [];
  for (let y = 0; y < size; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x += 1) row.push(!!qr.modules.get(y, x));
    modules.push(row);
  }
  return { size, modules };
};

export const qrSvg = (text: string, opts: { size?: number; quiet?: number; dark?: string; light?: string } = {}): string => {
  const { size, modules } = qrModules(text);
  const quiet = opts.quiet ?? 4;
  const full = size + quiet * 2;
  const dark = opts.dark || '#0f172a';
  const light = opts.light || '#ffffff';
  const px = opts.size || 240;
  let path = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) path += `M${x + quiet},${y + quiet}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" width="${px}" height="${px}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${light}"/>` +
    `<path fill="${dark}" d="${path}"/>` +
    `</svg>`
  );
};
