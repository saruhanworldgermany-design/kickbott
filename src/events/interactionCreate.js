const { 
  Events, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder 
} = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  /**
   * @param {import('discord.js').Client} client
   * @param {import('discord.js').Interaction} interaction
   */
  async execute(client, interaction) {
    try {
      // 1. SLASH COMMANDS
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(client, interaction);
        } catch (error) {
          console.error(error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Komut calistirilirken bir hata olustu!', ephemeral: true });
          } else {
            await interaction.reply({ content: 'Komut calistirilirken bir hata olustu!', ephemeral: true });
          }
        }
        return;
      }

      // 2. BUTTONS
      if (interaction.isButton()) {
        
        // Panel Butonu - Izleyici Gonder
        if (interaction.customId === 'send_viewer_btn') {
          
          // Cooldown Kontrolü (10 dakika)
          const cooldownAmount = 10 * 60 * 1000;
          const now = Date.now();
          if (client.cooldowns.has(interaction.user.id)) {
            const expirationTime = client.cooldowns.get(interaction.user.id) + cooldownAmount;
            if (now < expirationTime) {
              const timeLeft = Math.ceil((expirationTime - now) / 1000 / 60);
              return interaction.reply({
                content: `Bu islemi her 10 dakikada bir kullanabilirsiniz. Kalan sure: ${timeLeft} dakika.`,
                ephemeral: true
              });
            }
          }

          // Modal Olusturma
          const modal = new ModalBuilder()
            .setCustomId('send_viewer_modal')
            .setTitle('Izleyici Gonder');

          const channelInput = new TextInputBuilder()
            .setCustomId('channel_input')
            .setLabel('Kanal Ismi')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('crowegamingg')
            .setRequired(true);

          const amountInput = new TextInputBuilder()
            .setCustomId('amount_input')
            .setLabel('Miktar')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Miktar girin (Maksimum 1000)')
            .setRequired(true);

          const row1 = new ActionRowBuilder().addComponents(channelInput);
          const row2 = new ActionRowBuilder().addComponents(amountInput);

          modal.addComponents(row1, row2);

          await interaction.showModal(modal);
          return;
        }

        // Durdur Butonu (DM Analiz Paneli)
        if (interaction.customId.startsWith('stop_')) {
          const userId = interaction.customId.split('_')[1];

          if (interaction.user.id !== userId) {
            return interaction.reply({ content: 'Bu islemi durdurma yetkiniz yok.', ephemeral: true });
          }

          const task = client.activeTask;
          if (task && task.userId === userId && task.status === 'Calisiyor') {
            task.status = 'Durduruldu';

            if (task.timeoutId) {
              clearTimeout(task.timeoutId);
            }

            if (task.process) {
              try {
                task.process.kill();
              } catch (err) {
                console.error('Python sureci sonlandirilamadi:', err);
              }
            }

            const updatedContainer = client.createDMContainer(task);
            await interaction.update({
              components: [updatedContainer]
            });
            
            // Log gonder
            await client.logEvent('Durduruldu', task);
            
            console.log(`Gonderim kullanici tarafindan durduruldu: ${task.channelName}`);
          } else {
            await interaction.reply({ content: 'Durdurulacak aktif bir isleminiz bulunmuyor.', ephemeral: true });
          }
          return;
        }
      }

      // 3. MODAL SUBMISSIONS
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'send_viewer_modal') {
          const channelInput = interaction.fields.getTextInputValue('channel_input');
          const amountInput = interaction.fields.getTextInputValue('amount_input');

          // Kanal ismini normalize et (URL girildiyse temizle)
          let channelName = channelInput.trim().toLowerCase();
          if (channelName.includes('kick.com/')) {
            const parts = channelName.split('kick.com/');
            if (parts[1]) {
              channelName = parts[1].split('/')[0].split('?')[0];
            }
          }

          if (!channelName) {
            return interaction.reply({
              content: 'Gecersiz kanal ismi.',
              ephemeral: true
            });
          }

          // Miktar dogrulama
          const amount = parseInt(amountInput.trim(), 10);
          if (isNaN(amount) || amount <= 0 || amount > 1000) {
            return interaction.reply({
              content: 'Lutfen 1 ile 1000 arasinda gecerli bir miktar girin.',
              ephemeral: true
            });
          }

          // Sirada ayni kullanicinin baska aktif gorevi var mi kontrol et
          const hasActiveOrWaiting = client.queue.some(t => t.userId === interaction.user.id) || 
                                    (client.activeTask && client.activeTask.userId === interaction.user.id);
          
          if (hasActiveOrWaiting) {
            return interaction.reply({
              content: 'Halihazirda aktif veya sirada bekleyen bir isleminiz bulunuyor. Bitmesini bekleyin.',
              ephemeral: true
            });
          }

          // Cooldown'i kaydet
          client.cooldowns.set(interaction.user.id, Date.now());

          // Görevi sıraya ekleme
          const task = {
            userId: interaction.user.id,
            username: interaction.user.username,
            channelName: channelName,
            amount: amount,
            guildId: interaction.guildId, // Sunucu ID'si eklendi
            status: 'Bekliyor',
            process: null,
            dmMessage: null,
            startedAt: null,
            stats: {
              active: 0,
              total: 0,
              failures: 0,
              retries: 0
            }
          };

          client.queue.push(task);
          client.updatePresence();

          const queueIndex = client.queue.indexOf(task);

          if (queueIndex === 0 && !client.activeTask) {
            await interaction.reply({
              content: 'Izleyici gonderim islemi baslatildi! Analiz paneli DM kutunuza gonderildi.',
              ephemeral: true
            });
            // Islemi baslat
            client.startNextTask();
          } else {
            const position = client.activeTask ? queueIndex + 1 : queueIndex;
            await interaction.reply({
              content: `Gonderim siraya alindi. Siradaki yeriniz: **${position}**.\nIsleminiz basladiginda DM yoluyla analiz paneliniz gonderilecektir.`,
              ephemeral: true
            });
          }
        }
      }
    } catch (error) {
      console.error('Interaction esnasinda beklenmedik hata:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Beklenmedik bir hata olustu!', ephemeral: true });
        }
      } catch (e) {
        console.error('Kullaniciya hata bildirilmeye calisirken hata olustu:', e);
      }
    }
  }
};
