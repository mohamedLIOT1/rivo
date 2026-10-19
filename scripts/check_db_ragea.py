import subprocess

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"

js = """
require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');
const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const titles = ['LMA TGHEEBY', 'El Neyya', 'Ragea', 'Aks Baad', 'Tayer', 'Chroma'];
  const tracks = await Track.find({
    title: { $in: titles.map(t => new RegExp('^' + t + '$', 'i')) }
  }).lean();
  for (const t of tracks) {
    console.log(JSON.stringify({
      id: t._id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      genre: t.genre,
      source: t.source,
      album: t.album,
      audioUrl: t.audioUrl,
      cover: t.cover
    }));
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
"""

ssh_cmd = ['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', HOST, 'cd /home/ubuntu/rivo && node']
res = subprocess.run(ssh_cmd, input=js, capture_output=True, text=True, encoding='utf-8')
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)
