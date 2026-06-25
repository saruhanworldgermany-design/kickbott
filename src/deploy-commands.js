require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[UYARI] ${filePath} dosyasinda "data" veya "execute" eksik.`);
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`${commands.length} slash komutu yukleniyor...`);

    if (process.env.GUILD_ID) {
      console.log(`Sunucuya ozel komut kaydediliyor (Guild ID: ${process.env.GUILD_ID})...`);
      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`${data.length} slash komutu basariyla sunucuya kaydedildi.`);
    } else {
      console.log('Kuresel (global) komut kaydediliyor...');
      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log(`${data.length} slash komutu basariyla kuresel olarak kaydedildi.`);
    }
  } catch (error) {
    console.error(error);
  }
})();
