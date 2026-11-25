import { getGetQrSvgUrl } from '@workspace/api-client-react';

type CardImageOptions = {
  customerName: string;
  shopName: string;
  cardUrl: string;
  logoUrl: string;
  program?: { goal: number; reward: string } | null;
};

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Non riesco a preparare l’immagine della tessera.'));
    image.src = url;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export async function createCustomerCardImage(options: CardImageOptions) {
  const qrResponse = await fetch(getGetQrSvgUrl({ d: options.cardUrl }), { credentials: 'same-origin' });
  if (!qrResponse.ok) throw new Error('Non riesco a generare il QR della tessera. Riprova tra poco.');

  const qrBlob = await qrResponse.blob();
  const qrObjectUrl = URL.createObjectURL(qrBlob);
  let qrImage: HTMLImageElement | undefined;
  let logoImage: HTMLImageElement | undefined;
  try {
    [qrImage, logoImage] = await Promise.all([loadImage(qrObjectUrl), loadImage(options.logoUrl)]);
  } finally {
    URL.revokeObjectURL(qrObjectUrl);
  }
  if (!qrImage || !logoImage) throw new Error('Non riesco a preparare la tessera.');

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Il telefono non riesce a preparare l’immagine.');

  ctx.fillStyle = '#101115';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(270, 180, 20, 540, 500, 950);
  glow.addColorStop(0, '#282117');
  glow.addColorStop(1, '#101115');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundedRect(ctx, 28, 28, 1024, 1384, 34);
  ctx.strokeStyle = '#82683a';
  ctx.lineWidth = 3;
  ctx.stroke();

  const stripeX = 56;
  const stripeY = 51;
  const stripeWidth = 968;
  const segmentWidth = stripeWidth / 3;
  ctx.fillStyle = '#2359ae';
  ctx.fillRect(stripeX, stripeY, segmentWidth, 8);
  ctx.fillStyle = '#f7f6f3';
  ctx.fillRect(stripeX + segmentWidth, stripeY, segmentWidth, 8);
  ctx.fillStyle = '#c92739';
  ctx.fillRect(stripeX + segmentWidth * 2, stripeY, segmentWidth, 8);

  const logoRatio = logoImage.width / logoImage.height;
  const logoWidth = Math.min(968, 950 * logoRatio);
  const logoHeight = logoWidth / logoRatio;
  ctx.drawImage(logoImage, (canvas.width - logoWidth) / 2, 80, logoWidth, logoHeight);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0ce82';
  ctx.font = '600 24px Poppins, Arial, sans-serif';
  ctx.fillText('TESSERA PUNTI DIGITALE', 540, 670);

  let nameSize = 58;
  ctx.fillStyle = '#fffaf0';
  ctx.font = `600 ${nameSize}px Poppins, Arial, sans-serif`;
  while (ctx.measureText(options.customerName).width > 940 && nameSize > 34) {
    nameSize -= 2;
    ctx.font = `600 ${nameSize}px Poppins, Arial, sans-serif`;
  }
  ctx.fillText(options.customerName, 540, 742, 940);

  ctx.fillStyle = '#c9c1b4';
  ctx.font = '500 24px Poppins, Arial, sans-serif';
  ctx.fillText(options.shopName, 540, 790);

  const programLine = options.program
    ? `${options.program.goal} timbri · ${options.program.reward}`
    : 'La tua tessera fedeltà';
  ctx.fillStyle = '#f0ce82';
  ctx.font = '600 26px Poppins, Arial, sans-serif';
  ctx.fillText(programLine, 540, 850, 950);

  roundedRect(ctx, 338, 876, 404, 404, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.drawImage(qrImage, 363, 901, 354, 354);

  ctx.fillStyle = '#fffaf0';
  ctx.font = '600 27px Poppins, Arial, sans-serif';
  ctx.fillText('Mostra il QR al tuo barbiere', 540, 1338);
  ctx.fillStyle = '#c9c1b4';
  ctx.font = '400 19px Poppins, Arial, sans-serif';
  ctx.fillText('Inquadralo per aprire la tessera aggiornata', 540, 1374);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Non riesco a esportare la tessera come immagine.'));
    }, 'image/png');
  });
}
