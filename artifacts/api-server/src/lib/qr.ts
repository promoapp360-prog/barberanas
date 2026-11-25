import QRCode from "qrcode";

export function qrSvg(
  text: string,
  { margin = 2, dark = "#000", light = "#fff" } = {},
): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin,
    color: { dark, light },
    errorCorrectionLevel: "M",
  });
}
