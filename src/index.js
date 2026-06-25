require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  ActivityType, 
  ContainerBuilder, 
  SectionBuilder, 
  TextDisplayBuilder, 
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  MessageFlags 
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('child_process');

// Guvenlik ve Cokus Engelleme (Botun dusmesini onler)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Gecici Hata - Unhandled Rejection]:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[Kritik Hata - Uncaught Exception]:', error);
});

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates
  ] 
});

// Console Log Interceptor (Tüm konsol loglarını Discord kanalına yansıtır)
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const consoleLogChannelId = '1519709775036940451';
let isLogging = false;

function sendToDiscordConsoleLog(type, args) {
  // Terminale orijinal yazdır
  if (type === 'log') originalLog(...args);
  else if (type === 'error') originalError(...args);
  else if (type === 'warn') originalWarn(...args);

  if (isLogging) return;
  isLogging = true;

  try {
    if (client.isReady()) {
      const channel = client.channels.cache.get(consoleLogChannelId);
      if (channel) {
        const message = args.map(arg => {
          if (arg instanceof Error) {
            return arg.stack || arg.message;
          }
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');

        // Discord 2000 karakter sınırına göre kırpıp gönder
        const chunk = message.substring(0, 1900);
        channel.send(`\`\`\`js\n[${type.toUpperCase()}] ${chunk}\n\`\`\``).catch(err => {
          originalError('[LOG_INTERCEPT_ERROR] Discord\'a log gonderilemedi:', err);
        });
      }
    }
  } catch (err) {
    originalError('[LOG_INTERCEPT_ERROR] Genel hata:', err);
  } finally {
    isLogging = false;
  }
}

console.log = (...args) => sendToDiscordConsoleLog('log', args);
console.error = (...args) => sendToDiscordConsoleLog('error', args);
console.warn = (...args) => sendToDiscordConsoleLog('warn', args);

client.commands = new Collection();
client.queue = [];
client.activeTask = null;
client.cooldowns = new Map();

// data/users.json yardimci fonksiyonlari
client.loadSentData = () => {
  const filePath = path.join(__dirname, '..', 'data', 'users.json');
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]));
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (error) {
    console.error('Sent data yuklenirken hata:', error);
    return [];
  }
};

client.saveSentData = (data) => {
  const filePath = path.join(__dirname, '..', 'data', 'users.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Sent data kaydedilirken hata:', error);
  }
};

// data/config.json yardimci fonksiyonlari
client.loadConfig = () => {
  const filePath = path.join(__dirname, '..', 'data', 'config.json');
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}));
      return {};
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) || {};
  } catch (error) {
    console.error('Config yuklenirken hata:', error);
    return {};
  }
};

client.saveConfig = (config) => {
  const filePath = path.join(__dirname, '..', 'data', 'config.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Config kaydedilirken hata:', error);
  }
};

// Log Kanalina Rapor Gonderimi
client.logEvent = async (type, task) => {
  try {
    const config = client.loadConfig();
    if (!config.logChannelId) return; // Ayarli log kanali yoksa bir sey yapma

    const channel = await client.channels.fetch(config.logChannelId).catch(() => null);
    if (!channel) return;

    let statusText = '';
    let color = 0x57F287; // Yesil

    if (type === 'Baslatildi') {
      statusText = '🟢 **GÖNDERİM BAŞLATILDI**';
      color = 0x2ecc71; // Yesil
    } else if (type === 'Durduruldu') {
      statusText = '🛑 **GÖNDERİM DURDURULDU**';
      color = 0xe74c3c; // Kirmizi
    } else if (type === 'Tamamlandi') {
      statusText = '✅ **GÖNDERİM TAMAMLANDI**';
      color = 0x3498db; // Mavi
    } else if (type === 'Hata') {
      statusText = '❌ **GÖNDERİMDE HATA OLUŞTU**';
      color = 0xe67e22; // Turuncu
    }

    const textDisplay = new TextDisplayBuilder()
      .setContent(`# ${statusText}\n\n` +
        `**Kullanici:** <@${task.userId}> (${task.username})\n` +
        `**Hedef Kanal:** ${task.channelName}\n` +
        `**Gonderilen Izleyici:** ${task.stats.active} / ${task.amount}`);

    const mediaGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL('https://cdn.discordapp.com/attachments/1519706791443959908/1519709283732951252/high-level-description-a-futuristic-gami_PKzXPUcmXxu6QgJlIVGpaQ_aEHWYnnLQTaWV8Of_UaFCw.jpg?ex=6a3e8b10&is=6a3d3990&hm=d6874241f4f2fcf0d32a4d84f553d9fd26974d1ae5c197b6432fa12928cc99d2&')
    );

    const container = new ContainerBuilder()
      .setAccentColor(color)
      .addMediaGalleryComponents(mediaGallery)
      .addTextDisplayComponents(textDisplay);

    await channel.send({
      components: [container],
      flags: [MessageFlags.IsComponentsV2]
    }).catch(err => console.error('Log kanalina mesaj gonderilirken hata:', err));
  } catch (error) {
    console.error('logEvent icinde beklenmedik hata:', error);
  }
};



// V2 DM Analiz Paneli Tasarimi
client.createDMContainer = (task) => {
  let statusText = '';
  if (task.status === 'Calisiyor') {
    statusText = '🟢 **Gonderim Aktif (Calisiyor)**';
  } else if (task.status === 'Bekliyor') {
    statusText = '⏳ **Sirada Bekliyor**';
  } else if (task.status === 'Tamamlandi') {
    statusText = '✅ **Gonderim Tamamlandi**';
  } else if (task.status === 'Durduruldu') {
    statusText = '🛑 **Gonderim Durduruldu**';
  } else if (task.status === 'Hata') {
    statusText = '❌ **Gonderimde Hata Olustu**';
  } else {
    statusText = '⚠️ **Bilinmeyen Durum**';
  }

  const textDisplay = new TextDisplayBuilder()
    .setContent(`# KICK GONDERIM YONETIMI\n\n` +
      `${statusText}\n\n` +
      `**Hedef Kanal:** ${task.channelName}\n` +
      `**Gonderilen Izleyici:** ${task.stats.active} / ${task.amount}`);

  // Renk belirleme
  let color = 0x57F287; // Yesil
  if (task.status === 'Tamamlandi') color = 0x2ecc71; // Koyu Yesil
  if (task.status === 'Durduruldu' || task.status === 'Hata') color = 0xe74c3c; // Kirmizi

  const mediaGallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL('https://cdn.discordapp.com/attachments/1519706791443959908/1519709283732951252/high-level-description-a-futuristic-gami_PKzXPUcmXxu6QgJlIVGpaQ_aEHWYnnLQTaWV8Of_UaFCw.jpg?ex=6a3e8b10&is=6a3d3990&hm=d6874241f4f2fcf0d32a4d84f553d9fd26974d1ae5c197b6432fa12928cc99d2&')
  );

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addMediaGalleryComponents(mediaGallery)
    .addTextDisplayComponents(textDisplay);

  // Sadece calisirken Durdur butonu gosterilsin
  if (task.status === 'Calisiyor') {
    const stopButton = new ButtonBuilder()
      .setCustomId(`stop_${task.userId}`)
      .setLabel('Durdur')
      .setEmoji('1519711018702340310')
      .setStyle(ButtonStyle.Danger);
    const actionRow = new ActionRowBuilder().addComponents(stopButton);
    container.addActionRowComponents(actionRow);
  }

  return container;
};

// Sıradaki Görevi Başlatan Fonksiyon
client.startNextTask = async () => {
  if (client.activeTask) return;
  if (client.queue.length === 0) {
    client.updatePresence();
    return;
  }

  const task = client.queue.find(t => t.status === 'Bekliyor');
  if (!task) return;

  client.activeTask = task;
  task.status = 'Calisiyor';
  task.startedAt = Date.now();
  client.updatePresence();

  // Log gonder
  client.logEvent('Baslatildi', task);

  // Ilk gonderimde rol verme islemi
  if (task.guildId) {
    try {
      const guild = client.guilds.cache.get(task.guildId);
      if (guild) {
        const member = await guild.members.fetch(task.userId).catch(() => null);
        if (member) {
          const roleId = '1519704048981381312';
          const sentData = client.loadSentData();
          if (!sentData.includes(task.userId)) {
            // Rolun memberda bulunup bulunmadigini kontrol et
            if (!member.roles.cache.has(roleId)) {
              await member.roles.add(roleId).catch(err => console.error('Kullaniciya rol eklenirken hata olustu:', err));
              console.log(`Ilk gonderim rolu (${roleId}) verildi: ${task.username}`);
            }
            sentData.push(task.userId);
            client.saveSentData(sentData);
          }
        }
      }
    } catch (err) {
      console.error('Rol kontrolu ve verme esnasinda genel hata:', err);
    }
  }

  // Kullaniciyi fetch edip DM gonderelim
  const user = await client.users.fetch(task.userId).catch(() => null);
  if (!user) {
    console.error(`Kullanici fetch edilemedi: ${task.userId}`);
    task.status = 'Hata';
    client.activeTask = null;
    client.startNextTask();
    return;
  }

  const container = client.createDMContainer(task);
  try {
    const dmMessage = await user.send({
      components: [container],
      flags: [MessageFlags.IsComponentsV2]
    });
    task.dmMessage = dmMessage;
  } catch (error) {
    console.error(`Kullaniciya DM gonderilemedi: ${task.userId}`, error);
    // DM gonderilemezse bile islemi durdurmayip arka planda calistiralim
  }

  const scriptPath = path.join(__dirname, '..', 'kick', 'kickbotsender.py');
  let pythonPath = process.platform === 'win32' ? 'python' : 'python3';

  if (process.platform !== 'win32') {
    const possiblePaths = [
      path.join(__dirname, '..', '.venv', 'bin', 'python3'),
      path.join(__dirname, '..', '.venv', 'bin', 'python'),
      '/app/.venv/bin/python3',
      '/app/.venv/bin/python',
      '/opt/venv/bin/python3',
      '/opt/venv/bin/python'
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        pythonPath = p;
        break;
      }
    }
  }

  console.log(`Python scripti calistiriliyor: ${scriptPath} - Python yolu: ${pythonPath} - Kanal: ${task.channelName} - Miktar: ${task.amount}`);

  const child = spawn(pythonPath, [
    scriptPath,
    '--channel', task.channelName,
    '--viewers', task.amount.toString(),
    '--auto-start',
    '--status-interval', '5'
  ], {
    cwd: path.join(__dirname, '..', 'kick'),
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  task.process = child;

  // 15 Dakika (900000 ms) Zaman Asimi Kontrolu
  const maxDuration = 15 * 60 * 1000;
  task.timeoutId = setTimeout(async () => {
    if (task.status === 'Calisiyor') {
      console.log(`[Zaman Asimi] ${task.channelName} kanali icin 15 dakikalik limit doldu, islem otomatik sonlandiriliyor.`);
      task.status = 'Tamamlandi';
      
      if (task.process) {
        try {
          task.process.kill();
        } catch (err) {
          console.error('Zaman asiminda Python sureci sonlandirilamadi:', err);
        }
      }

      if (task.dmMessage) {
        const finalContainer = client.createDMContainer(task);
        await task.dmMessage.edit({
          components: [finalContainer]
        }).catch(dmErr => console.error('DM zaman asimi guncellemesinde hata:', dmErr));

        await task.dmMessage.reply({
          content: '⚠️ Gönderim işleminiz 15 dakikalık maksimum süreyi doldurduğu için otomatik olarak tamamlandı.'
        }).catch(() => null);
      }

      await client.logEvent('Tamamlandi', task);
    }
  }, maxDuration);

  // Hata durumunda botun cokmesini engelle
  child.on('error', async (err) => {
    console.error('Python islemi baslatilamadi/hata aldi:', err);
    
    if (task.timeoutId) clearTimeout(task.timeoutId);
    
    if (task.status === 'Calisiyor') {
      task.status = 'Hata';
      if (task.dmMessage) {
        const finalContainer = client.createDMContainer(task);
        await task.dmMessage.edit({
          components: [finalContainer]
        }).catch(dmErr => console.error('DM hata guncellemesinde hata:', dmErr));
      }
      
      // Log gonder
      await client.logEvent('Hata', task);
      
      client.activeTask = null;
      const index = client.queue.indexOf(task);
      if (index > -1) {
        client.queue.splice(index, 1);
      }
      client.startNextTask();
    }
  });

  let buffer = '';
  child.stdout.on('data', async (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Son yarim kalan satiri bufferda tut

    for (const line of lines) {
      console.log(`[Python Out]: ${line.trim()}`);
      // Durum | aktif=X toplam=Y hata=Z retry=W
      const match = line.match(/Durum\s*\|\s*aktif=(\d+)\s*toplam=(\d+)\s*hata=(\d+)\s*retry=(\d+)/i);
      if (match && task.dmMessage) {
        task.stats.active = parseInt(match[1], 10);
        task.stats.total = parseInt(match[2], 10);
        task.stats.failures = parseInt(match[3], 10);
        task.stats.retries = parseInt(match[4], 10);

        const updatedContainer = client.createDMContainer(task);
        await task.dmMessage.edit({
          components: [updatedContainer]
        }).catch(err => console.error('DM paneli guncellenirken hata:', err));
      }
    }
  });

  child.stderr.on('data', (data) => {
    console.error(`[Python Err]: ${data.toString()}`);
  });

  child.on('close', async (code) => {
    console.log(`Python islemi kapandi (Kod: ${code})`);
    
    if (task.timeoutId) clearTimeout(task.timeoutId);
    
    if (task.status === 'Calisiyor') {
      task.status = code === 0 ? 'Tamamlandi' : 'Hata';
      
      if (task.dmMessage) {
        const finalContainer = client.createDMContainer(task);
        await task.dmMessage.edit({
          components: [finalContainer]
        }).catch(err => console.error('DM final guncellemesinde hata:', err));
      }
      
      // Log gonder
      await client.logEvent(task.status, task);
    }

    client.activeTask = null;
    
    // Tamamlanan/durdurulan görevi sıradan çıkaralım
    const index = client.queue.indexOf(task);
    if (index > -1) {
      client.queue.splice(index, 1);
    }

    client.startNextTask();
  });
};

// Durum / Presence Guncelleme
client.updatePresence = () => {
  try {
    const activeTask = client.activeTask;
    const waitingCount = client.queue.filter(t => t.status === 'Bekliyor').length;

    if (activeTask) {
      const totalQueue = waitingCount + 1;
      client.user.setPresence({
        activities: [{ name: `Aktif Sira: ${totalQueue}`, type: ActivityType.Watching }],
        status: 'dnd',
        afk: true
      });
      console.log(`[Durum Guncelleme] Aktif Sira: ${totalQueue}`);
    } else {
      client.user.setPresence({ 
        activities: [], 
        status: 'dnd',
        afk: true
      });
      console.log(`[Durum Guncelleme] Temizlendi (Sira yok).`);
    }
  } catch (error) {
    console.error('Bot durumu guncellenirken hata olustu:', error);
  }
};

// Slash Komutlarini API'ye otomatik kaydetme fonksiyonu
client.deployCommands = async () => {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`${commands.length} slash komutu otomatik olarak kaydediliyor...`);
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log('Sunucuya ozel komutlar basariyla otomatik guncellendi.');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('Kuresel komutlar basariyla otomatik guncellendi.');
    }
  } catch (error) {
    console.error('Otomatik komut guncellemesinde hata olustu:', error);
  }
};

const { REST, Routes } = require('discord.js');

// Command Yükleyici
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

// Event Yükleyici
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(client, ...args));
  } else {
    client.on(event.name, (...args) => event.execute(client, ...args));
  }
}

client.login(process.env.DISCORD_TOKEN);
