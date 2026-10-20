const crypto = require('crypto');
const { Client: BotClient, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { Client: SelfClient, RichPresence } = require('discord.js-selfbot-v13');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('❌ [FATAL] ENCRYPTION_KEY is required in environment variables for Discord activity token security.');
}
const BOT_TOKEN = process.env.BOT_TOKEN;
const DISCORD_APP_ID = process.env.DISCORD_CLIENT_ID || '1440997674630250506';

// 🔒 Token Encryption & Decryption
function encryptToken(text) {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(text) {
  if (!text) return '';
  if (!text.includes(':')) return null;
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts.slice(1).join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

const activeUserBots = new Map();
const userIdleTimers = new Map();

async function disconnectUserSession(userId) {
  if (userIdleTimers.has(userId)) {
    clearTimeout(userIdleTimers.get(userId));
    userIdleTimers.delete(userId);
  }
  const session = activeUserBots.get(userId);
  if (session) {
    activeUserBots.delete(userId);
    session.isPlaying = false;
    session.currentTrack = null;
    session.status = 'disconnected';
    try {
      if (session.client) {
        try {
          if (session.client.settings && typeof session.client.settings.setCustomStatus === 'function') {
            await session.client.settings.setCustomStatus(null).catch(() => {});
          }
        } catch (e) {}
        if (session.client.user) {
          try {
            await session.client.user.setPresence({ activities: [], status: 'online' }).catch(() => {});
          } catch (e) {}
        }
        // Give Discord Gateway 200ms to register clear presence before tearing down client
        await new Promise(r => setTimeout(r, 200));
        session.client.destroy();
      }
    } catch (e) {}
  }
}

async function applyTrackPresence(client, track, currentTime = 0) {
  if (!client || !client.user || !track) return;
  try {
    const appId = DISCORD_APP_ID;
    const curSec = Math.max(0, Number(currentTime) || 0);
    const startTs = Date.now() - Math.round(curSec * 1000);
    const durationSec = track.duration && track.duration > 0 ? Math.round(track.duration) : 0;
    const rawCover = track.cover || track.coverUrl || '';
    let resolvedCover = 'https://rivo-m.duckdns.org/discord-badge.png';
    if (rawCover && typeof rawCover === 'string') {
      const trimmed = rawCover.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        resolvedCover = trimmed;
      } else if (trimmed.startsWith('//')) {
        resolvedCover = `https:${trimmed}`;
      } else if (trimmed.startsWith('/')) {
        resolvedCover = `https://rivo-m.duckdns.org${trimmed}`;
      } else if (!trimmed.startsWith('data:') && !trimmed.startsWith('file:')) {
        resolvedCover = `https://rivo-m.duckdns.org/${trimmed}`;
      }
    }

    const coverUrl = resolvedCover;
    const iconUrl = 'https://rivo-m.duckdns.org/discord-badge.png';

    let largeAsset = null;
    let smallAsset = null;

    try {
      const assets = await RichPresence.getExternal(client, appId, coverUrl, iconUrl);
      if (assets && assets[0]?.external_asset_path) largeAsset = assets[0].external_asset_path;
      if (assets && assets[1]?.external_asset_path) smallAsset = assets[1].external_asset_path;
    } catch (assetErr) {
      console.warn('[Discord Activity] getExternal warning:', assetErr.message);
    }

    const r = new RichPresence(client)
      .setApplicationId(appId)
      .setType('LISTENING')
      .setName('Rivo')
      .setDetails(track.title || 'Unknown Title')
      .setState(track.artist ? `by ${track.artist}` : 'Rivo Music')
      .setStartTimestamp(startTs);

    if (largeAsset) {
      r.setAssetsLargeImage(largeAsset).setAssetsLargeText(track.album || track.title || 'Rivo');
    } else if (coverUrl) {
      r.setAssetsLargeImage(coverUrl).setAssetsLargeText(track.album || track.title || 'Rivo');
    }
    if (smallAsset) {
      r.setAssetsSmallImage(smallAsset).setAssetsSmallText('Rivo Music');
    } else if (iconUrl) {
      r.setAssetsSmallImage(iconUrl).setAssetsSmallText('Rivo Music');
    }

    if (durationSec > 0) {
      r.setEndTimestamp(startTs + durationSec * 1000);
    }

    try {
      r.addButton('Listen on Rivo', 'https://rivo-m.duckdns.org');
    } catch (e) {}

    // Set Rich Presence Activity (Listening to Rivo card)
    try {
      await client.user.setActivity(r);
    } catch (presenceErr) {
      console.warn('[Discord Activity] setActivity error:', presenceErr.message);
    }
  } catch (err) {
    console.warn('[Discord Activity] applyTrackPresence error:', err.message);
  }
}

async function handleUserListening(user, track, isPlaying, currentTime = 0) {
  if (!user || !user._id) return;
  const uidStr = String(user._id);

  if (!user.discord || !user.discord.token || user.discord.enabled === false) {
    if (activeUserBots.has(uidStr)) {
      disconnectUserSession(uidStr);
    }
    return;
  }

  // If stopped or paused: IMMEDIATELY clear Discord Rich Presence and destroy session!
  if (!isPlaying || !track) {
    await disconnectUserSession(uidStr);
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

  const curSec = Math.max(0, Number(currentTime) || 0);
  const now = Date.now();
  let session = activeUserBots.get(uidStr);

  // If already ready, update presence with drift check
  if (session && session.status === 'ready' && session.client && session.client.user) {
    const prevTrackId = session.currentTrack ? String(session.currentTrack.id || session.currentTrack._id || '') : '';
    const newTrackId = track ? String(track.id || track._id || '') : '';
    const prevDuration = session.currentTrack?.duration || 0;
    const newDuration = track?.duration || 0;

    const expectedCurSec = session.lastStartTs ? Math.max(0, (now - session.lastStartTs) / 1000) : 0;
    const driftSec = Math.abs(curSec - expectedCurSec);

    const shouldUpdate =
      prevTrackId !== newTrackId ||
      !session.isPlaying ||
      !session.lastStartTs ||
      Math.abs(prevDuration - newDuration) >= 2 ||
      driftSec >= 3;

    session.currentTrack = track;
    session.currentTime = curSec;
    session.isPlaying = true;

    if (shouldUpdate) {
      session.lastStartTs = now - Math.round(curSec * 1000);
      applyTrackPresence(session.client, track, curSec);
    }
    return;
  }

  // If currently connecting, save track for ready event
  if (session && session.status === 'connecting') {
    session.currentTrack = track;
    session.currentTime = curSec;
    session.isPlaying = true;
    session.lastStartTs = now - Math.round(curSec * 1000);
    return;
  }

  // Otherwise, create new client instance
  try {
    const client = new SelfClient({ checkUpdate: false });
    session = {
      client,
      status: 'connecting',
      currentTrack: track,
      currentTime: curSec,
      isPlaying: true,
      lastStartTs: now - Math.round(curSec * 1000)
    };
    activeUserBots.set(uidStr, session);

    client.on('ready', () => {
      console.log(`[Discord Activity] User ${uidStr} logged in to Discord as: ${client.user.tag}`);
      session.status = 'ready';
      if (session.currentTrack && session.isPlaying) {
        const elapsedSinceConnect = session.lastStartTs ? Math.max(0, (Date.now() - session.lastStartTs) / 1000) : session.currentTime;
        applyTrackPresence(client, session.currentTrack, elapsedSinceConnect);
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
      if (msg.author.bot) return;
      if (msg.guildId || msg.guild) return; // DM only
      const discordId = msg.author.id;
      const content = msg.content.trim();

      // Check if user sent a token directly (long string with at least 2 dots)
      const isPossibleToken = content.length >= 50 && (content.match(/\./g) || []).length >= 2;
      const stepData = awaitingUserStep.get(discordId);

      // 1. Process Token (either in step TOKEN or pasted directly)
      if ((stepData && stepData.step === 'TOKEN') || isPossibleToken) {
        const tokenInput = content.replace(/^token:\s*/i, '').trim();
        let targetUserId = stepData?.rivoUserId;
        let targetUserName = stepData?.rivoUserName;

        if (!targetUserId) {
          const existingUser = await UserModel.findOne({ 'discord.id': discordId });
          if (existingUser) {
            targetUserId = existingUser._id;
            targetUserName = existingUser.name;
          }
        }

        if (!targetUserId) {
          await msg.reply('❌ يرجى إرسال **كود الربط** المكون من 6 أرقام من موقع Rivo أولاً أو كتابة إيميلك المسجل في Rivo.');
          return;
        }

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
          await UserModel.findByIdAndUpdate(targetUserId, {
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
            .setColor('#17a398')
            .setTitle('🎉 تم ربط حسابك في Rivo بنجاح!')
            .setDescription(`تم توصيل الحساب **${discordTag}** بحساب Rivo **${targetUserName}**.\n\n🎵 الآن بمجرد أن تشغل أي أغنية على [موقع Rivo](https://rivo-m.duckdns.org)، ستظهر في بروفايلك مباشرة مثل Spotify!`);

          await msg.reply({ embeds: [successEmbed] });
        }).catch(async (e) => {
          await msg.reply('❌ فشل تسجيل الدخول بهذا التوكن! تأكد أنه توكن حسابك الصحيح وغير منتهي الصلاحية.');
        });
        return;
      }

      // 2. Check if input is a 6-digit link code or email
      const isSixDigit = /^\d{6}$/.test(content);
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content);

      if ((stepData && stepData.step === 'LINK_CODE') || isSixDigit || isEmail) {
        const user = await UserModel.findOne({
          $or: [
            { 'discord.linkCode': content },
            { email: content.toLowerCase() },
            { name: { $regex: new RegExp(`^${content}$`, 'i') } }
          ]
        });

        if (!user) {
          await msg.reply('❌ لم يتم العثور على حساب Rivo بهذا الكود أو الإيميل.\n\nتأكد من الكود أو الإيميل المسجل في موقع Rivo.');
          return;
        }

        awaitingUserStep.set(discordId, {
          step: 'TOKEN',
          rivoUserId: user._id,
          rivoUserName: user.name
        });

        const codeFoundEmbed = new MessageEmbed()
          .setColor('#17a398')
          .setTitle(`✅ تم التعرف على حسابك: ${user.name}`)
          .setDescription('🔑 الآن أرسل **توكن حسابك الشخصي في ديسكورد** هنا في المحادثة لحفظه مشفراً وعرض الأغاني في بروفايلك.\n\n*(إذا كنت لا تعرف كيف تجلب التوكن، اضغط على أحد الأزرار بالأسفل)*');

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

        await msg.reply({ embeds: [codeFoundEmbed], components: [helpRow] });
        return;
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
