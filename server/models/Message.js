const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  track: { type: Object, default: null },
  jamInvite: { type: Object, default: null },
  read: { type: Boolean, default: false },
  reactions: {
    type: [{
      emoji: { type: String, required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    }],
    default: []
  }
}, { timestamps: true });

MessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
MessageSchema.index({ sender: 1, recipient: 1, read: 1 });
MessageSchema.index({ recipient: 1, read: 1 });
MessageSchema.index({ recipient: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
