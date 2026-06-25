const { Events } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
  name: Events.ClientReady,
  once: true,
  /**
   * @param {import('discord.js').Client} client
   */
  async execute(client) {
    console.log(`Bot basariyla giris yapti: ${client.user.tag}`);
    await client.deployCommands();
    client.updatePresence();

    // Ses kanalına otomatik katılım ve AFK kalma
    try {
      const guildId = '1434311334840893553';
      const channelId = '1519710410310422549';
      
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        joinVoiceChannel({
          channelId: channelId,
          guildId: guildId,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: true,
        });
        console.log(`Bot ses kanalına başarıyla katıldı ve AFK bırakıldı: ${channelId}`);
      } else {
        console.error(`Sunucu bulunamadı (Guild ID: ${guildId}), ses kanalına katılınamadı.`);
      }
    } catch (error) {
      console.error('Ses kanalına katılırken beklenmedik hata oluştu:', error);
    }
  },
};
