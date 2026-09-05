import assert from "node:assert/strict";

const BASE_URL = "https://quizkco.pages.dev";

async function verify() {
  console.log(`Checking production live site: ${BASE_URL}...`);

  // 1. Root HTML & SSR check
  const res = await fetch(BASE_URL);
  assert.equal(res.status, 200, `Expected 200 OK from root, got ${res.status}`);
  const html = await res.text();

  assert.ok(
    html.includes("Quizy — كويزي"),
    "Expected HTML to include Quizy — كويزي brand title/meta",
  );
  assert.ok(html.includes("Turn Your Knowledge Into Progress"), "Expected HTML to include tagline");
  assert.ok(
    html.includes('<svg width="38" height="38" viewBox="0 0 512 512"'),
    "Expected HTML to include SSR pre-rendered Quizy SVG mark",
  );

  // 2. Personal identity privacy check
  const forbiddenPatterns = ["aiengmohamedtayal", "mohamedtayal", "netizen"];
  for (const pattern of forbiddenPatterns) {
    assert.ok(!html.toLowerCase().includes(pattern), `Personal info detected in HTML: ${pattern}`);
  }
  console.log("✔ Root SSR & privacy verified.");

  // 3. Brand Assets check
  const assets = [
    { path: "/favicon.svg", mime: "image/svg+xml" },
    { path: "/favicon-32x32.png", mime: "image/png" },
    { path: "/apple-touch-icon.png", mime: "image/png" },
    { path: "/icon-192.png", mime: "image/png" },
    { path: "/icon-512.png", mime: "image/png" },
    { path: "/logo-icon.svg", mime: "image/svg+xml" },
    { path: "/logo.svg", mime: "image/svg+xml" },
    { path: "/manifest.json", mime: "application/json" },
  ];

  for (const asset of assets) {
    const assetRes = await fetch(`${BASE_URL}${asset.path}`);
    assert.equal(assetRes.status, 200, `Expected 200 OK for ${asset.path}, got ${assetRes.status}`);
    const contentType = assetRes.headers.get("content-type") || "";
    assert.ok(
      contentType.includes(asset.mime),
      `Expected ${asset.path} content-type to contain ${asset.mime}, got ${contentType}`,
    );
    console.log(`✔ Asset ${asset.path} (${contentType}) verified.`);
  }

  // 4. Manifest JSON verification
  const manifestRes = await fetch(`${BASE_URL}/manifest.json`);
  const manifest = await manifestRes.json();
  assert.equal(manifest.short_name, "Quizy");
  assert.ok(manifest.name.includes("Quizy"));
  console.log("✔ PWA manifest verified.");

  console.log("\nALL PRODUCTION CHECKS ON https://quizkco.pages.dev PASSED!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
