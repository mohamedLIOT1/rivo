const https = require('https');
const http = require('http');

function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = (u.protocol === 'https:' ? https : http).request(u, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve({ url, status: res.statusCode });
      });
      req.on('error', (err) => resolve({ url, status: 0, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ url, status: 408 }); });
      req.end();
    } catch (e) {
      resolve({ url, status: 0, error: e.message });
    }
  });
}

async function test() {
  const urls = [
    "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/b8/01/5e/b8015e1f-13a8-44d4-20b1-ce3cb6ea861a/196626466989.jpg/1200x1200bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/b8/01/5e/b8015e1f-13a8-44d4-20b1-ce3cb6ea861a/196626466989.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/1200x1200bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/1200x1200bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/600x600bb.jpg",
  ];

  for (const u of urls) {
    const res = await checkUrl(u);
    console.log(`${res.status} | ${res.url}`);
  }
}

test();
