import base64
import subprocess

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"

script = '''
require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');
const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rivo';
  await mongoose.connect(uri);
  
  // Set album for Amr Diab songs that belong to Ahla W Ahla
  const res = await Track.updateMany(
    { artist: /Amr Diab/i, title: { $in: ["Ragea", "Aks Baad", "Ahla W Ahla", "Ragea | راجع", "عكس بعض"] } },
    { $set: { album: "Ahla W Ahla" } }
  );
  console.log('Updated Ahla W Ahla tracks in DB:', JSON.stringify(res));

  // Count tracks per album for Amr Diab
  const amr = await Track.find({ artist: /Amr Diab/i }, 'title album').lean();
  console.log('Amr Diab sample tracks:', JSON.stringify(amr.slice(0, 5)));

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
'''

def main():
    b64 = base64.b64encode(script.encode('utf-8')).decode('ascii')
    cmd = ['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', HOST, f'echo {b64} | base64 -d > /home/ubuntu/rivo/fix_albums_temp.js && cd /home/ubuntu/rivo && node fix_albums_temp.js && rm -f fix_albums_temp.js']
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', stdin=subprocess.DEVNULL)
    print('OUTPUT:\n', res.stdout)
    if res.stderr:
        print('STDERR:\n', res.stderr)

if __name__ == '__main__':
    main()
