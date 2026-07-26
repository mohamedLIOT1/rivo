const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1x1 base64 png
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Png, 'base64');

['icon.png', 'adaptive-icon.png', 'splash.png', 'favicon.png'].forEach(file => {
  fs.writeFileSync(path.join(assetsDir, file), buffer);
});

console.log('✅ App assets generated successfully');
