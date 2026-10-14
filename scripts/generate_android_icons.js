const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// High quality bilinear scaling function
function scalePNG(src, targetWidth, targetHeight) {
  const dst = new PNG({ width: targetWidth, height: targetHeight });
  const xRatio = src.width / targetWidth;
  const yRatio = src.height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;
      const xFloor = Math.floor(srcX);
      const yFloor = Math.floor(srcY);
      const xCeil = Math.min(src.width - 1, Math.ceil(srcX));
      const yCeil = Math.min(src.height - 1, Math.ceil(srcY));
      const xWeight = srcX - xFloor;
      const yWeight = srcY - yFloor;

      const idx00 = (yFloor * src.width + xFloor) << 2;
      const idx10 = (yFloor * src.width + xCeil) << 2;
      const idx01 = (yCeil * src.width + xFloor) << 2;
      const idx11 = (yCeil * src.width + xCeil) << 2;

      const dstIdx = (y * targetWidth + x) << 2;

      for (let c = 0; c < 4; c++) {
        const top = src.data[idx00 + c] * (1 - xWeight) + src.data[idx10 + c] * xWeight;
        const bottom = src.data[idx01 + c] * (1 - xWeight) + src.data[idx11 + c] * xWeight;
        dst.data[dstIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }
  return dst;
}

// Center an image within a transparent canvas
function centerOnCanvas(scaled, canvasWidth, canvasHeight) {
  const canvas = new PNG({ width: canvasWidth, height: canvasHeight });
  // All pixels initialized to RGBA 0,0,0,0

  const offsetX = Math.floor((canvasWidth - scaled.width) / 2);
  const offsetY = Math.floor((canvasHeight - scaled.height) / 2);

  for (let y = 0; y < scaled.height; y++) {
    for (let x = 0; x < scaled.width; x++) {
      const targetX = offsetX + x;
      const targetY = offsetY + y;
      if (targetX >= 0 && targetX < canvasWidth && targetY >= 0 && targetY < canvasHeight) {
        const srcIdx = (y * scaled.width + x) << 2;
        const dstIdx = (targetY * canvasWidth + targetX) << 2;
        canvas.data[dstIdx] = scaled.data[srcIdx];
        canvas.data[dstIdx + 1] = scaled.data[srcIdx + 1];
        canvas.data[dstIdx + 2] = scaled.data[srcIdx + 2];
        canvas.data[dstIdx + 3] = scaled.data[srcIdx + 3];
      }
    }
  }
  return canvas;
}

function writePNG(pngObj, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const buffer = PNG.sync.write(pngObj);
  fs.writeFileSync(targetPath, buffer);
  console.log(`Saved: ${targetPath} (${pngObj.width}x${pngObj.height}, ${buffer.length} bytes)`);
}

async function run() {
  const iconPath = path.resolve(__dirname, '../assets/icon.png');
  const srcBuffer = fs.readFileSync(iconPath);
  const src = PNG.sync.read(srcBuffer);
  console.log(`Loaded source icon: ${src.width}x${src.height}`);

  // 1. Generate Expo adaptive-icon.png (512x512 canvas, 340x340 logo centered = 66.4% safe ratio)
  const adaptive512Scaled = scalePNG(src, 340, 340);
  const adaptive512 = centerOnCanvas(adaptive512Scaled, 512, 512);
  writePNG(adaptive512, path.resolve(__dirname, '../assets/adaptive-icon.png'));

  // 2. Android Adaptive Icon Foregrounds (Standard 108dp canvas, ~72dp safe zone)
  const mipmapForegrounds = [
    { dir: 'mipmap-mdpi', canvas: 108, logo: 72 },
    { dir: 'mipmap-hdpi', canvas: 162, logo: 108 },
    { dir: 'mipmap-xhdpi', canvas: 216, logo: 144 },
    { dir: 'mipmap-xxhdpi', canvas: 324, logo: 216 },
    { dir: 'mipmap-xxxhdpi', canvas: 432, logo: 288 },
  ];

  for (const { dir, canvas, logo } of mipmapForegrounds) {
    const scaledLogo = scalePNG(src, logo, logo);
    const foreground = centerOnCanvas(scaledLogo, canvas, canvas);
    const outPath = path.resolve(__dirname, `../android/app/src/main/res/${dir}/ic_launcher_foreground.png`);
    writePNG(foreground, outPath);
  }

  // 3. Android Legacy / Fallback Launcher Icons (48, 72, 96, 144, 192)
  const mipmapLegacies = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const { dir, size } of mipmapLegacies) {
    const legacyIcon = scalePNG(src, size, size);
    writePNG(legacyIcon, path.resolve(__dirname, `../android/app/src/main/res/${dir}/ic_launcher.png`));
    writePNG(legacyIcon, path.resolve(__dirname, `../android/app/src/main/res/${dir}/ic_launcher_round.png`));
  }

  console.log('All launcher icons generated successfully!');
}

run().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
