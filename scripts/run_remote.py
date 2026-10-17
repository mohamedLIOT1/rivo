import base64
import subprocess
import os

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"

script = '''
const mongoose = require('./server/node_modules/mongoose');
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const Message = mongoose.model('Message', new mongoose.Schema({}, { strict: false }));
const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rivo');
  const users = await User.find({}, '_id name email role isBot avatar bio').lean();
  console.log('=== USERS ===');
  console.log(JSON.stringify(users, null, 2));

  const msgs = await Message.find().sort({ createdAt: -1 }).limit(10).lean();
  console.log('=== RECENT MESSAGES ===');
  console.log(JSON.stringify(msgs, null, 2));

  const trackCount = await Track.countDocuments();
  console.log('=== TOTAL TRACKS ===', trackCount);

  const dupes = await Track.aggregate([
    {
      $group: {
        _id: { $toLower: "$title" },
        count: { $sum: 1 },
        artists: { $push: "$artist" },
        ids: { $push: "$_id" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);
  console.log('=== TOP DUPLICATE TRACKS ===');
  console.log(JSON.stringify(dupes, null, 2));

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
'''

def main():
    b64 = base64.b64encode(script.encode('utf-8')).decode('ascii')
    cmd = ['ssh', '-i', KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', HOST, f'echo {b64} | base64 -d > /home/ubuntu/rivo/inspect_db.js && cd /home/ubuntu/rivo && node inspect_db.js']
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    print('OUTPUT:\n', res.stdout)
    if res.stderr:
        print('STDERR:\n', res.stderr)

if __name__ == '__main__':
    main()
