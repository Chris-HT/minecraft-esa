// Writes the poster QR code for the sign-up page into assets/.
//   npm run qr
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const URL_TO_ENCODE = "https://join.myminecraft.party";
const asset = (name) => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));
// High error correction, so it still scans if the poster gets scuffed.
const options = { errorCorrectionLevel: "H", margin: 2 };

await QRCode.toFile(asset("join-qr.png"), URL_TO_ENCODE, { ...options, width: 1200 });
await QRCode.toFile(asset("join-qr.svg"), URL_TO_ENCODE, { ...options, type: "svg" });
console.log(`Wrote assets/join-qr.png and assets/join-qr.svg for ${URL_TO_ENCODE}`);
