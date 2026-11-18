/* Rocket Launcher 0.2.4 unit checks for fixes found by the simulation corpus (test/sim): two-color icons are artwork, transparent
   App Store icons, comment stripping keeps URLs, missing iOS purpose strings are added by the Info.plist patch. Run: node test/fixes024.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import zlib from 'node:zlib';
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-024-'));
process.env.ROCKETLAUNCHER_HOME = HOME; process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons'; process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
const E = await import('../lib/engine.mjs'); const I = await import('../lib/icons.mjs'); const { Gen } = await import('../lib/runtime.mjs');
let pass = 0, failN = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ''); } };
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(CRC(td)); return Buffer.concat([l, td, c]); };
const png = (w, h, f) => { const rows = []; for (let y = 0; y < h; y++) { const r = Buffer.alloc(w * 4 + 1); for (let x = 0; x < w; x++) f(x, y).forEach((v, k) => { r[1 + x * 4 + k] = v; }); rows.push(r); } const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]); };

console.log('\n[1] icons');
const flat = png(64, 64, (x, y) => (x > 20 && x < 44 && y > 12 && y < 52 ? [255, 255, 255, 255] : [15, 118, 110, 255]));   // white glyph on teal, exactly two colors
const u = I.uniformity(await I.pixels(flat));
check(!u.blank && u.unique_colors === 2, 'a flat two-color icon (white glyph on a solid background) is artwork, not blank', u);
const round = png(64, 64, (x, y) => ((x - 32) ** 2 + (y - 32) ** 2 > 32 ** 2 ? [0, 0, 0, 0] : x > 20 && x < 44 ? [255, 255, 255, 255] : [200, 30, 40, 255]));
const ic = await I.iconCheck({ ios: { path: 'AppIcon-1024.png', dataUrl: 'data:image/png;base64,' + round.toString('base64') } });
check(ic.ios.transparent_share > 0.1 && !ic.ios.blank, 'transparent corners are measured (transparent_share)', ic.ios);

console.log('\n[2] project checks');
let n = 0; const project = files => { const dir = path.join(HOME, 'p' + (++n)); for (const [p, c] of Object.entries(files)) { const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); } return dir; };
const PL = (extra = '') => `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleDisplayName</key><string>Fx</string>${extra}<key>ITSAppUsesNonExemptEncryption</key><false/></dict></plist>`;
let { st } = await E.connect({ source: 'path', path: project({ 'pubspec.yaml': 'name: fx\nversion: 2.3.4+56\ndependencies:\n  flutter:\n    sdk: flutter\n  geolocator: ^12.0.0\n  # firebase_analytics: ^11.0.0\n', 'ios/Runner/Info.plist': PL(), 'ios/Runner.xcodeproj/project.pbxproj': 'PRODUCT_BUNDLE_IDENTIFIER = com.fx.app;', 'lib/main.dart': "// FirebaseAnalytics.instance.logEvent(name: 'x');\nconst url = 'https://api.fx.app/v1'; // comment\n", 'README.md': '# Fx\n\nParking finder.\n' }) }, { allowPath: true });
const mu = st.A.issues.filter(i => i.id === 'missingUsage').map(i => i.vars.key);
check(mu.includes('NSLocationWhenInUseUsageDescription'), 'geolocator without an iOS location purpose string → missingUsage', mu);
check(!st.A.sdk.analytics, 'commented-out analytics (pubspec and Dart) does not count');
check(st.A.version === '2.3.4', 'Flutter version from pubspec', st.A.version);
const patch = Gen.patches(st.A, 'en')['patch-plist'];
check(patch && /\+\s*<key>NSLocationWhenInUseUsageDescription<\/key>/.test(patch.diff), 'Info.plist patch adds the missing purpose string', patch);

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
