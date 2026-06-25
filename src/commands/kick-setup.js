const { 
  SlashCommandBuilder, 
  ContainerBuilder, 
  TextDisplayBuilder, 
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  MessageFlags 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick-setup')
    .setDescription('Kick izleyici gonderme panelini kurar.')
    .addChannelOption(option => 
      option.setName('kanal')
        .setDescription('Panelin gonderilecegi kanali secin.')
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

    // Components V2 hazirlama - Görseli Banner (Media Gallery) olarak ekliyoruz
    const mediaGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL('https://cdn.discordapp.com/attachments/1519706791443959908/1519709283732951252/high-level-description-a-futuristic-gami_PKzXPUcmXxu6QgJlIVGpaQ_aEHWYnnLQTaWV8Of_UaFCw.jpg?ex=6a3e8b10&is=6a3d3990&hm=d6874241f4f2fcf0d32a4d84f553d9fd26974d1ae5c197b6432fa12928cc99d2&')
    );

    // Tıklanabilir başlık içeren yazı alanı
    const textDisplay = new TextDisplayBuilder()
      .setContent('# [KICK IZLEYICI GONDERIMI](https://kick.com)\n\nKanaliniza canli izleyici gondermek icin asagidaki **Izleyici Gonder** butonuna tiklayin.\n\n*Not: Bu sistem sira mantigiyla calisir ve her kullanici 10 dakikada bir islem baslatabilir.*');

    // Emoji eklenmiş buton
    const button = new ButtonBuilder()
      .setCustomId('send_viewer_btn')
      .setLabel('Izleyici Gonder')
      .setEmoji('1519707734998515712')
      .setStyle(ButtonStyle.Success);

    const actionRow = new ActionRowBuilder().addComponents(button);

    const container = new ContainerBuilder()
      .setAccentColor(0x00FF00) // Yemyeseil (Green)
      .addMediaGalleryComponents(mediaGallery)
      .addTextDisplayComponents(textDisplay)
      .addActionRowComponents(actionRow);

    try {
      await channel.send({
        components: [container],
        flags: [MessageFlags.IsComponentsV2]
      });

      await interaction.reply({
        content: `Panel basariyla ${channel} kanalinda kuruldu.`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Panel gonderilirken hata olustu:', error);
      await interaction.reply({
        content: `Panel gonderilirken bir hata olustu: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
