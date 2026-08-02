const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const PLUM = "#612E82";
const WHITE = "#FFFFFF";

function svgFor(size, { maskable }) {
  // 20% safe zone => monogram lives in the center 60%.
  const content = size * 0.6;
  const fontSize = Math.round(content * 0.72);
  const cy = size / 2 + fontSize * 0.35;
  const rx = maskable ? Math.round(size * 0.22) : Math.round(size * 0.18);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${PLUM}"/>
  <text x="50%" y="${cy}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="${WHITE}">S</text>
</svg>`,
  );
}

async function writePng(file, size, maskable) {
  const out = path.join("public", "icons", file);
  await sharp(svgFor(size, { maskable })).png().toFile(out);
  console.log("wrote", out);
}

async function main() {
  fs.mkdirSync(path.join("public", "icons"), { recursive: true });
  await writePng("siriusai-180.png", 180, false);
  await writePng("siriusai-192.png", 192, false);
  await writePng("siriusai-512.png", 512, false);
  await writePng("siriusai-192-maskable.png", 192, true);
  await writePng("siriusai-512-maskable.png", 512, true);
  fs.writeFileSync(
    path.join("public", "icon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#612E82"/>
  <text x="256" y="345" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="280" font-weight="700" fill="#FFFFFF">S</text>
</svg>
`,
  );
  console.log("wrote public/icon.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
