import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.resolve(rootDir, "public");

describe("Quizy Brand Assets & Visual Identity Integrity", () => {
  test("All production brand assets exist in public/ with non-zero size", () => {
    const requiredAssets = [
      "favicon.svg",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "favicon-48x48.png",
      "favicon.png",
      "apple-touch-icon.png",
      "icon-192.png",
      "icon-512.png",
      "og-image.jpg",
      "logo-icon.svg",
      "logo.svg",
      "manifest.json",
    ];

    for (const asset of requiredAssets) {
      const fullPath = path.join(publicDir, asset);
      assert.ok(fs.existsSync(fullPath), `Expected brand asset to exist: ${asset}`);
      const stats = fs.statSync(fullPath);
      assert.ok(stats.size > 0, `Expected brand asset to be non-empty: ${asset}`);
    }
  });

  test("PWA manifest.json is valid and contains new brand identity", () => {
    const manifestPath = path.join(publicDir, "manifest.json");
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    assert.equal(manifest.short_name, "Quizy");
    assert.ok(manifest.name.includes("Quizy"));
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

    const has192 = manifest.icons.some((i: { sizes: string }) => i.sizes === "192x192");
    const has512 = manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512");
    const hasSvg = manifest.icons.some((i: { type: string }) => i.type === "image/svg+xml");

    assert.ok(has192, "Manifest must contain 192x192 icon");
    assert.ok(has512, "Manifest must contain 512x512 icon");
    assert.ok(hasSvg, "Manifest must contain SVG vector icon");
  });

  test("SVG brand assets are well-formed vector XML", () => {
    const svgFiles = ["favicon.svg", "logo-icon.svg", "logo.svg"];
    for (const file of svgFiles) {
      const content = fs.readFileSync(path.join(publicDir, file), "utf-8");
      assert.ok(content.includes("<svg"), `${file} must contain <svg> element`);
      assert.ok(content.includes("</svg>"), `${file} must properly close </svg>`);
      assert.ok(content.includes("viewBox"), `${file} must define viewBox for responsiveness`);
    }
  });

  test("No obsolete logo files exist in public/", () => {
    const files = fs.readdirSync(publicDir);
    const obsoleteFiles = ["favicon.ico", "old-logo.svg", "old-logo.png", "vite.svg"];
    for (const obsolete of obsoleteFiles) {
      assert.ok(!files.includes(obsolete), `Obsolete file should not exist: ${obsolete}`);
    }
  });
});
