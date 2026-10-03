// Builds the compressed landing-page derivatives in public/img from the original uploads.
// Usage: node scripts/images.mjs <dir with 1000712777.jpg ... and Setlo-Aligned-Selected-Concept.png>
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/images.mjs <source dir>");
const out = new URL("../public/img/", import.meta.url).pathname;
await mkdir(out, { recursive: true });

const photos = {
  "1000712777": "hero",
  "1000712778": "lounge",
  "1000712780": "tables",
  "1000712779": "coast",
};
const widths = [640, 960, 1280, 1536];

for (const [file, name] of Object.entries(photos)) {
  const img = sharp(join(src, `${file}.jpg`));
  const { width, height } = await img.metadata();
  for (const w of widths.filter((w) => w <= width)) {
    await img.clone().resize({ width: w }).avif({ quality: 50 }).toFile(join(out, `${name}-${w}.avif`));
    await img.clone().resize({ width: w }).webp({ quality: 72 }).toFile(join(out, `${name}-${w}.webp`));
    await img.clone().resize({ width: w }).jpeg({ quality: 76, mozjpeg: true }).toFile(join(out, `${name}-${w}.jpg`));
  }
  console.log(name, width, height);
}

const logo = sharp(join(src, "Setlo-Aligned-Selected-Concept.png"));
const meta = await logo.metadata();
console.log("logo", meta.width, meta.height);
for (const s of [64, 128, 256, 512]) await logo.clone().resize(s, s, { fit: "cover" }).png().toFile(join(out, `logo-${s}.png`));
