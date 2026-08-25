import "server-only";
import QRCode from "qrcode";

// PNG en data URL généré localement (pas d'appel à un service tiers) — se
// télécharge et s'imprime directement, colle sur une affiche.
export async function generateQrCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 512 });
}
