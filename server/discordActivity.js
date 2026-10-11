const crypto = require('crypto');
const { Client: BotClient, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { Client: SelfClient, RichPresence } = require('discord.js-selfbot-v13');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '6f9ad4b2c1e8f3a59d7b0c4e1f8a2b3c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a';
const BOT_TOKEN = process.env.BOT_TOKEN;

// 🔒 Token Encryption & Decryption
function encryptToken(text) {
  if (!text) return '';
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    return text;
  }
}

function decryptToken(text) {
  if (!text) return '';
  if (!text.includes(':')) return text;
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

// 🎧 Active Selfbots Management (Per-user sessions)
const activeUserBots = new Map();
const userIdleTimers = new Map();

function disconnectUserSession(userId) {
  if (userIdleTimers.has(userId)) {
    clearTimeout(userIdleTimers.get(userId));
    userIdleTimers.delete(userId);
  }
  const session = activeUserBots.get(userId);
  if (session) {
    try {
      if (session.client) {
        if (session.client.user) session.client.user.setActivity(null);
        session.client.destroy();
      }
    } catch (e) {}
    activeUserBots.delete(userId);
  }
}

function applyTrackPresence(client, track) {
  if (!client || !client.user || !track) return;
  try {
    const startTs = Date.now();
    const durationSec = track.duration && track.duration > 0 ? Math.round(track.duration) : 0;

    const r = new RichPresence(client)
      .setApplicationId('1440997674630250506')
      .setType('LISTENING')
      .setName('Rivo')
      .setDetails(track.title || 'Unknown Title')
      .setState(track.artist ? `by ${track.artist}` : 'Rivo Music')
      .setAssetsLargeImage(track.cover && track.cover.startsWith('http') ? track.cover : 'https://rivo-m.duckdns.org/icon-192.png')
      .setAssetsLargeText(track.album || track.title || 'Rivo')
      .setAssetsSmallImage('https://rivo-m.duckdns.org/icon-192.png')
      .setAssetsSmallText('Rivo Music')
      .setStartTimestamp(startTs);

    if (durationSec > 0) {
      r.setEndTimestamp(startTs + durationSec * 1000);
    }

    try {
      r.addButton('Listen on Rivo', 'https://rivo-m.duckdns.org');
    } catch (e) {}

    client.user.setActivity(r);
  } catch (err) {
    console.warn('[Discord Activity] applyTrackPresence error:', err.message);
  }
}

async function handleUserListening(user, track, isPlaying) {
  if (!user || !user._id) return;
  const uidStr = String(user._id);

  if (!user.discord || !user.discord.token || user.discord.enabled === false) {
    if (activeUserBots.has(uidStr)) {
      disconnectUserSession(uidStr);
    }
    return;
  }

  // If stopped or paused:
  if (!isPlaying || !track) {
    const session = activeUserBots.get(uidStr);
    if (session && session.client && session.client.user) {
      try {
        session.client.user.setActivity(null);
      } catch (e) {}
    }
    // Schedule clean disconnect after 5 minutes of inactivity to conserve RAM
    if (!userIdleTimers.has(uidStr)) {
      userIdleTimers.set(uidStr, setTimeout(() => {
        disconnectUserSession(uidStr);
      }, 5 * 60 * 1000));
    }
    return;
  }

  // Clear idle disconnect timer if user plays again
  if (userIdleTimers.has(uidStr)) {
    clearTimeout(userIdleTimers.get(uidStr));
    userIdleTimers.delete(uidStr);
  }

  const rawToken = decryptToken(user.discord.token);
  if (!rawToken) {
    console.warn(`[Discord Activity] Decryption failed for user ${uidStr}`);
    return;
  }

  let session = activeUserBots.get(uidStr);

  // If already ready, update presence directly
  if (session && session.status === 'ready' && session.client && session.client.user) {
    session.currentTrack = track;
    applyTrackPresence(session.client, track);
    return;
  }

  // If currently connecting, save track for ready event
  if (session && session.status === 'connecting') {
    session.currentTrack = track;
    return;
  }

  // Otherwise, create new client instance
  try {
    const client = new SelfClient({ checkUpdate: false });
    session = { client, status: 'connecting', currentTrack: track };
    activeUserBots.set(uidStr, session);

    client.on('ready', () => {
      console.log(`[Discord Activity] User ${uidStr} logged in to Discord as: ${client.user.tag}`);
      session.status = 'ready';
      if (session.currentTrack) {
        applyTrackPresence(client, session.currentTrack);
      }
    });

    client.login(rawToken).catch((err) => {
      console.warn(`[Discord Activity] Login failed for user ${uidStr}:`, err.message);
      disconnectUserSession(uidStr);
    });
  } catch (err) {
    console.error(`[Discord Activity] Error starting client for user ${uidStr}:`, err.message);
  }
}

// 🤖 Helper Discord Bot Integration
let botClient = null;

function initDiscordBot(UserModel) {
  if (!BOT_TOKEN || BOT_TOKEN.includes('ضع_التوكن')) {
    console.log('[Discord Bot] BOT_TOKEN not configured, skipping helper bot listener.');
    return;
  }

  if (botClient) return;

  try {
    botClient = new BotClient({
      intents: ['GUILDS', 'GUILD_MESSAGES', 'DIRECT_MESSAGES'],
      partials: ['CHANNEL']
    });

    const awaitingUserStep = new Map();

    botClient.on('ready', () => {
      console.log(`[Discord Bot] Ready and listening as: ${botClient.user.tag}`);
    });

    botClient.on('messageCreate', async (msg) => {
      if (msg.author.bot || msg.channel.type !== 'DM') return;
      const discordId = msg.author.id;

      // Handle interactive steps
      if (awaitingUserStep.has(discordId)) {
        const stepData = awaitingUserStep.get(discordId);

        if (stepData.step === 'LINK_CODE') {
          const input = msg.content.trim();
          // Find user by link code or email
          const user = await UserModel.findOne({
            $or: [
              { 'discord.linkCode': input, 'discord.linkCodeExpires': { $gt: new Date() } },
              { email: input.toLowerCase() }
            ]
          });

          if (!user) {
            await msg.reply('❌ لم يتم العثور على حساب Rivo بهذا الكود أو الإيميل. تأكد من الكود وحاول ثانية أو افتح الإعدادات في الموقع.');
            return;
          }

          stepData.rivoUserId = user._id;
          stepData.rivoUserName = user.name;
          stepData.step = 'TOKEN';

          await msg.reply(`✅ تم التعرف على حسابك: **${user.name}**!\n\n🔑 الآن أرسل توكن حسابك الشخصي في ديسكورد لحفظه مشفراً:`);
          return;
        }

        if (stepData.step === 'TOKEN') {
          const tokenInput = msg.content.replace(/^token:\s*/i, '').trim();
          if (tokenInput.length < 40) {
            await msg.reply('❌ صيغة التوكن غير صحيحة. يرجى التأكد من نسخه بالكامل.');
            return;
          }

          // Test token validity
          const testClient = new SelfClient({ checkUpdate: false });
          testClient.login(tokenInput).then(async () => {
            const discordTag = testClient.user.tag;
            testClient.destroy();

            const encrypted = encryptToken(tokenInput);
            await UserModel.findByIdAndUpdate(stepData.rivoUserId, {
              $set: {
                'discord.id': discordId,
                'discord.username': discordTag,
                'discord.token': encrypted,
                'discord.enabled': true,
                'discord.linkCode': '',
                'discord.linkCodeExpires': null
              }
            });

            awaitingUserStep.delete(discordId);

            const successEmbed = new MessageEmbed()
              .setColor('#00FF00')
              .setTitle('🎉 تم ربط حسابك في Rivo بنجاح!')
              .setDescription(`تم توصيل الحساب **${discordTag}** بحساب Rivo **${stepData.rivoUserName}**.\n\n🎵 الآن بمجرد أن تشغل أي أغنية على موقع Rivo، ستظهر في بروفايلك مباشرة مثل Spotify!`);

            await msg.reply({ embeds: [successEmbed] });
          }).catch(async (e) => {
            await msg.reply('❌ فشل تسجيل الدخول بهذا التوكن! تأكد أنه توكن حسابك الصحيح وغير منتهي الصلاحية.');
          });
          return;
        }
      }

      // Default Menu
      const linkedUser = await UserModel.findOne({ 'discord.id': discordId });

      const welcomeEmbed = new MessageEmbed()
        .setColor('#17a398')
        .setTitle('🎧 مرحباً بك في خدمة Rivo Rich Presence')
        .setDescription(
          linkedUser
            ? `✅ حسابك مرتبط حالياً بحساب Rivo: **${linkedUser.name}** (${linkedUser.email})\n\nأي أغنية تشغلها على [موقع Rivo](https://rivo-m.duckdns.org) تظهر في بروفايلك فوراً!`
            : 'أهلاً بك! يمكنك ربط حسابك هنا ليعرض ديسكورد الأغاني التي تسمعها على Rivo في بروفايلك تلقائياً.'
        );

      const actionRow = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('btn_link_account')
          .setLabel(linkedUser ? '🔄 تحديث التوكن أو الربط' : '🔗 ربط حساب Rivo')
          .setStyle('SUCCESS')
      );

      if (linkedUser) {
        actionRow.addComponents(
          new MessageButton()
            .setCustomId('btn_unlink_account')
            .setLabel('🗑️ إلغاء الربط')
            .setStyle('DANGER')
        );
      }

      const helpRow = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('btn_help_mobile')
          .setLabel('📱 كيف تجيب التوكن من الموبايل؟')
          .setStyle('PRIMARY'),
        new MessageButton()
          .setCustomId('btn_help_pc')
          .setLabel('💻 كيف تجيب التوكن من الكمبيوتر؟')
          .setStyle('PRIMARY')
      );

      await msg.reply({ embeds: [welcomeEmbed], components: [actionRow, helpRow] });
    });

    botClient.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      const discordId = interaction.user.id;

      if (interaction.customId === 'btn_help_mobile') {
        const phoneEmbed = new MessageEmbed()
          .setColor('#00FFFF')
          .setTitle('📱 طريقة استخراج التوكن من الهاتف')
          .setDescription('1️⃣ افتح متصفح إنترنت على هاتفك (مثل Chrome).\n2️⃣ فعل خيار **"الموقع المخصص للكمبيوتر" (Desktop Site)**.\n3️⃣ افتح ديسكورد وسجل دخولك.\n4️⃣ انسخ الكود التالي وضعه في شريط الرابط واضغط بحث (مع التأكد من كتابة `javascript:` في البداية):\n```javascript\njavascript:(function(){window.webpackChunkdiscord_app.push([[Math.random()],{},(req)=>{for(const m in req.c){if(req.c[m].exports&&req.c[m].exports.default&&req.c[m].exports.default.getToken !== undefined){const token=req.c[m].exports.default.getToken();if(token&&typeof token===\'string\'&&token.length>30){alert("🎉 التوكن هو:\\n\\n"+token);}}}}] )})();\n```');
        return interaction.reply({ embeds: [phoneEmbed], ephemeral: true });
      }

      if (interaction.customId === 'btn_help_pc') {
        const pcEmbed = new MessageEmbed()
          .setColor('#00FFFF')
          .setTitle('💻 طريقة استخراج التوكن من الكمبيوتر')
          .setDescription('1️⃣ افتح ديسكورد في المتصفح وسجل دخولك.\n2️⃣ اضغط **F12** وافتح تبويب **Console**.\n3️⃣ الصق الكود التالي واضغط Enter:\n```javascript\nwindow.webpackChunkdiscord_app.push([[Math.random()],{},(req)=>{for(const m in req.c){if(req.c[m].exports&&req.c[m].exports.default&&req.c[m].exports.default.getToken !== undefined){const token = req.c[m].exports.default.getToken();if(token&&typeof token===\'string\'&&token.length>30){console.log("%c🎉 التوكن هو: " + token, "color: #00ff00; font-size: 16px;");}}}}]);\n```');
        return interaction.reply({ embeds: [pcEmbed], ephemeral: true });
      }

      if (interaction.customId === 'btn_link_account') {
        awaitingUserStep.set(discordId, { step: 'LINK_CODE' });
        return interaction.reply({
          content: '🔢 أرسل الآن **كود الربط** المكون من 6 أرقام (ستجده في إعدادات موقع Rivo تحت قسم Discord)، أو أرسل **إيميلك** المسجل به في الموقع:',
          ephemeral: false
        });
      }

      if (interaction.customId === 'btn_unlink_account') {
        const u = await UserModel.findOneAndUpdate(
          { 'discord.id': discordId },
          { $set: { 'discord.id': '', 'discord.username': '', 'discord.token': '', 'discord.enabled': false } }
        );
        if (u) disconnectUserSession(String(u._id));
        return interaction.reply({ content: '✅ تم إلغاء ربط الحساب بنجاح.', ephemeral: true });
      }
    });

    botClient.login(BOT_TOKEN).catch((err) => {
      console.warn('[Discord Bot] Login failed:', err.message);
    });
  } catch (err) {
    console.error('[Discord Bot] Init error:', err.message);
  }
}

module.exports = {
  encryptToken,
  decryptToken,
  handleUserListening,
  disconnectUserSession,
  initDiscordBot
};
