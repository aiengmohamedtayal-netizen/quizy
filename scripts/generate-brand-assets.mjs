import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const sourceImgPath = path.resolve("public", "brand", "quizy-brand-reference.jpg");
const publicDir = path.resolve("public");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function run() {
  console.log("Generating Quizy brand assets from reference image...");

  if (!fs.existsSync(sourceImgPath)) {
    console.error("Source image not found at", sourceImgPath);
    return;
  }

  const brandDir = path.join(publicDir, "brand");
  if (!fs.existsSync(brandDir)) fs.mkdirSync(brandDir, { recursive: true });
  const destPath = path.join(brandDir, "quizy-brand-reference.jpg");
  if (sourceImgPath !== destPath && fs.existsSync(sourceImgPath)) {
    fs.copyFileSync(sourceImgPath, destPath);
  }

  const img = sharp(sourceImgPath);
  const meta = await img.metadata();
  console.log(`Source image size: ${meta.width}x${meta.height}`);

  // 2. The full image contains:
  // - Top half: The iconic Q with graduation cap (~ y: 70 to 620)
  // - Middle: "Quizy" wordmark (~ y: 620 to 820)
  // - Bottom: "Turn Your Knowledge Into Progress" + curve (~ y: 820 to 950)

  // Extract the icon mark (Q + graduation cap)
  // Crop coordinates roughly: width 700, height 700 centered around the Q
  const iconCrop = await sharp(sourceImgPath)
    .extract({
      left: Math.round((meta.width - 760) / 2),
      top: 60,
      width: 760,
      height: 700,
    })
    .resize(512, 512, { fit: "contain", background: { r: 10, g: 15, b: 29, alpha: 0 } })
    .toBuffer();

  // Save icon PNGs
  await sharp(iconCrop).resize(512, 512).png().toFile(path.join(publicDir, "icon-512.png"));
  await sharp(iconCrop).resize(192, 192).png().toFile(path.join(publicDir, "icon-192.png"));
  await sharp(iconCrop).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));
  await sharp(iconCrop).resize(48, 48).png().toFile(path.join(publicDir, "favicon-48x48.png"));
  await sharp(iconCrop).resize(32, 32).png().toFile(path.join(publicDir, "favicon-32x32.png"));
  await sharp(iconCrop).resize(16, 16).png().toFile(path.join(publicDir, "favicon-16x16.png"));
  await sharp(iconCrop).resize(32, 32).toFormat("png").toFile(path.join(publicDir, "favicon.png"));

  // Save Open Graph Image (1200x630)
  await sharp(sourceImgPath)
    .resize(1200, 630, { fit: "contain", background: { r: 10, g: 15, b: 26, alpha: 1 } })
    .jpeg({ quality: 90 })
    .toFile(path.join(publicDir, "og-image.jpg"));

  console.log("Successfully generated PNG icons, favicon, and OG image!");
}

run().catch(console.error);
