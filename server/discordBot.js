const { Client: BotClient, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

const BOT_TOKEN = process.env.BOT_TOKEN;

let botClient = null;

function initDiscordBot(UserModel, { encryptToken, disconnectUserSession }) {
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

          const encrypted = typeof encryptToken === 'function' ? encryptToken(tokenInput) : '';
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
        if (u && typeof disconnectUserSession === 'function') {
          disconnectUserSession(String(u._id));
        }
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
  initDiscordBot
};
