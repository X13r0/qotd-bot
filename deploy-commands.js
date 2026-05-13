require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("setupqotd")
    .setDescription("Set up the daily QOTD channel and time.")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("The channel where QOTD will be sent.")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("time")
        .setDescription("Time in 24-hour format. Example: 09:00 or 21:30")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("qotdtest")
    .setDescription("Send a test QOTD now.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("addquestion")
    .setDescription("Add a new QOTD question.")
    .addStringOption(option =>
      option
        .setName("question")
        .setDescription("The question you want to add.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("listquestions")
    .setDescription("Show all saved QOTD questions.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deployCommands() {
  try {
    console.log("Refreshing slash commands...");

    if (!process.env.TOKEN) {
      throw new Error("Missing TOKEN in .env");
    }

    if (!process.env.CLIENT_ID) {
      throw new Error("Missing CLIENT_ID in .env");
    }

    if (!process.env.GUILD_ID) {
      throw new Error("Missing GUILD_ID in .env");
    }

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("Slash commands registered successfully.");
  } catch (error) {
    console.error("Error registering slash commands:");
    console.error(error);
  }
}

deployCommands();