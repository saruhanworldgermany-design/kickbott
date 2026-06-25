const { 
  SlashCommandBuilder, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick-log-kur')
    .setDescription('Kick islemleri log kanalini ayarlar.')
    .addChannelOption(option => 
      option.setName('kanal')
        .setDescription('Loglarin gonderilecegi kanali secin.')
        .setRequired(true)
    ),

  /**
   * @param {import('discord.js').Client} client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(client, interaction) {
    // Sadece yetkili kullanici kullanabilir
    if (interaction.user.id !== '578816597054193664') {
      return interaction.reply({
        content: 'Bu komutu kullanmak icin yetkiniz yok.',
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel('kanal');

    // Kanala gonderim yapilabilecek bir kanal tipi mi kontrol et
    if (!channel.isTextBased()) {
      return interaction.reply({
        content: 'Lutfen yazi yazilabilen bir kanal secin.',
        ephemeral: true
      });
    }

    try {
      const config = client.loadConfig();
      config.logChannelId = channel.id;
      client.saveConfig(config);

      await interaction.reply({
        content: `Log kanali basariyla ${channel} olarak ayarlandi. Artik tüm islemler anlik olarak buraya raporlanacaktir.`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Log kanali ayarlanirken hata olustu:', error);
      await interaction.reply({
        content: `Log kanali ayarlanirken bir hata olustu: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
