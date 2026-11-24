// Genera un QR code in SVG (encoder incluso in lib/qrcode, licenza in lib/qrcode/LICENSE).
const QRCode = require('./qrcode');
const QRErrorCorrectLevel = require('./qrcode/QRErrorCorrectLevel');

function qrSvg(text, { margin = 2, dark = '#000', light = '#fff' } = {}) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

module.exports = { qrSvg };
