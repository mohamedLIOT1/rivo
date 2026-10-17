import subprocess
import os

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"

def run_remote_script(js_code):
    ssh_cmd = ["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", HOST, "cd /home/ubuntu/rivo && node"]
    r_res = subprocess.run(ssh_cmd, input=js_code, capture_output=True, text=True, encoding="utf-8")
    print("STDOUT:\n", r_res.stdout)
    if r_res.stderr:
        print("STDERR:\n", r_res.stderr)

if __name__ == '__main__':
    js = """
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
"""
    run_remote_script(js)
