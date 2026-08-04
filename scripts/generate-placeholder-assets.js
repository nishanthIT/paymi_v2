/* One-off: regenerate placeholder brand images (originals were corrupted). */
const Jimp = require('jimp-compact');
const path = require('path');

const IMG = path.join(__dirname, '..', 'assets', 'images');
const GOLD = 0xb88a3bff;
const CREAM = 0xf7f3ecff;
const WHITE = 0xffffffff;
const TRANSPARENT = 0x00000000;

function drawMark(image, size, fg) {
  // Simple "P" coin mark: filled circle with a P-like block letter.
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  image.scan(0, 0, size, size, function (x, y, idx) {
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (d <= r) {
      this.bitmap.data.writeUInt32BE(fg, idx);
    }
    // Letter P carved out in background color
    const lx = (x - cx) / r;
    const ly = (y - cy) / r;
    const inStem = lx > -0.35 && lx < -0.13 && ly > -0.5 && ly < 0.5;
    const inBowl =
      ly > -0.5 &&
      ly < 0.08 &&
      lx > -0.35 &&
      lx < 0.38 &&
      !(lx > -0.13 && lx < 0.16 && ly > -0.28 && ly < -0.14);
    if (d <= r && (inStem || inBowl)) {
      this.bitmap.data.writeUInt32BE(0x00000000 | (this.bg >>> 0), idx);
    }
  });
}

async function make(size, bg, fg, file) {
  const image = new Jimp(size, size, bg);
  image.bg = bg;
  drawMark(image, size, fg);
  await image.writeAsync(path.join(IMG, file));
  console.log('wrote', file);
}

(async () => {
  await make(1024, CREAM, GOLD, 'icon.png');
  await make(1024, TRANSPARENT, GOLD, 'splash-icon.png');
  await make(1024, TRANSPARENT, GOLD, 'android-icon-foreground.png');
  await make(1024, TRANSPARENT, WHITE, 'android-icon-monochrome.png');
  await make(48, CREAM, GOLD, 'favicon.png');
})();
