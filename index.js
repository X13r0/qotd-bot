require("dotenv").config();

const fs = require("fs");
const cron = require("node-cron");

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  Events
} = require("discord.js");

console.log("Starting QOTD bot...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
function readJSON(fileName) {
  try {
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  } catch (error) {
    console.error(`Could not read ${fileName}:`, error);
    return null;
  }
}

function writeJSON(fileName, data) {
  try {
    fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Could not write ${fileName}:`, error);
  }
}

function memberHasAllowedRole(interaction) {
  const config = readJSON("./config.json");

  if (!config || !Array.isArray(config.allowedRoleIds)) {
    return false;
  }

  return interaction.member.roles.cache.some(role =>
    config.allowedRoleIds.includes(role.id)
  );
}

function getRandomQuestion() {
  const questions = readJSON("./questions.json");

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return "No QOTD questions have been added yet.";
  }

  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

async function sendQOTD(channelId) {
  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      console.log("QOTD channel not found.");
      return;
    }

    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement
    ) {
      console.log("Selected channel is not a text or announcement channel.");
      return;
    }

    const question = getRandomQuestion();

    const message = await channel.send({
      content:
        `╭─ ✨ **QUESTION OF THE DAY**\n` +
        `│\n` +
        `│ **${question}**\n` +
        `│\n` +
        `╰─ 💬 Answer in the thread below!`
    });

    await message.startThread({
      name: "QOTD Answers",
      autoArchiveDuration: 1440,
      reason: "QOTD answer thread"
    });

    console.log("QOTD sent and thread created.");
  } catch (error) {
    console.error("Error sending QOTD:");
    console.error(error);
  }
}

let scheduledTask = null;

function scheduleQOTD() {
  const config = readJSON("./config.json");

  if (!config) {
    console.log("Missing or broken config.json.");
    return;
  }

  if (!config.channelId || !config.time) {
    console.log("QOTD is not set up yet. Use /setupqotd first.");
    return;
  }

  if (scheduledTask) {
    scheduledTask.stop();
  }

  const [hour, minute] = config.time.split(":");

  const cronTime = `${minute} ${hour} * * *`;

  scheduledTask = cron.schedule(
    cronTime,
    async () => {
      await sendQOTD(config.channelId);
    },
    {
      timezone: config.timezone || "Asia/Manila"
    }
  );

  console.log(
    `QOTD scheduled daily at ${config.time} ${config.timezone || "Asia/Manila"}.`
  );
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  scheduleQOTD();
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const protectedCommands = [
    "setupqotd",
    "qotdtest",
    "addquestion",
    "listquestions"
  ];

  if (
    protectedCommands.includes(interaction.commandName) &&
    !memberHasAllowedRole(interaction)
  ) {
    await interaction.reply({
      content: "You do not have permission to use this command.",
      ephemeral: true
    });
    return;
  }

  try {
    if (interaction.commandName === "setupqotd") {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel("channel");
      const time = interaction.options.getString("time");

      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

      if (!timeRegex.test(time)) {
        await interaction.editReply({
          content:
            "Invalid time format. Use 24-hour format like `09:00` or `21:30`."
        });
        return;
      }

      const config = readJSON("./config.json") || {};

      config.channelId = channel.id;
      config.time = time;
      config.timezone = "Asia/Manila";

      writeJSON("./config.json", config);

      scheduleQOTD();

      await interaction.editReply({
        content: `QOTD has been set up in ${channel} every day at **${time} PH time**.`
      });
    }

    if (interaction.commandName === "qotdtest") {
      await interaction.deferReply({ ephemeral: true });

      const config = readJSON("./config.json");

      if (!config || !config.channelId) {
        await interaction.editReply({
          content: "QOTD is not set up yet. Use `/setupqotd` first."
        });
        return;
      }

      await sendQOTD(config.channelId);

      await interaction.editReply({
        content: "Test QOTD sent."
      });
    }

    if (interaction.commandName === "addquestion") {
      await interaction.deferReply({ ephemeral: true });

      const newQuestion = interaction.options.getString("question");

      const questions = readJSON("./questions.json") || [];

      questions.push(newQuestion);

      writeJSON("./questions.json", questions);

      await interaction.editReply({
        content: `Question added:\n\n**${newQuestion}**`
      });
    }

    if (interaction.commandName === "listquestions") {
      await interaction.deferReply({ ephemeral: true });

      const questions = readJSON("./questions.json") || [];

      if (questions.length === 0) {
        await interaction.editReply({
          content: "No questions saved yet."
        });
        return;
      }

      const questionList = questions
        .map((question, index) => `${index + 1}. ${question}`)
        .join("\n");

      const finalMessage = `**Saved QOTD Questions:**\n\n${questionList}`;

      if (finalMessage.length > 1900) {
        await interaction.editReply({
          content: "There are too many questions to show in one message."
        });
        return;
      }

      await interaction.editReply({
        content: finalMessage
      });
    }
  } catch (error) {
    console.error("Interaction error:");
    console.error(error);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "Something went wrong while running this command."
      });
    } else {
      await interaction.reply({
        content: "Something went wrong while running this command.",
        ephemeral: true
      });
    }
  }
});

if (!process.env.TOKEN) {
  console.error("Missing TOKEN in .env");
  process.exit(1);
}

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Works with:
  // karina
  // KARINA
  // karina!!!
  // hey karina
  // karina?
  const karinaRegex = /k+a+r+i+n+a+/i;

  const karinaReplies = [
    "You called? I’m here~ ✨",
    "Hi hi~ did someone say my name? 💙",
    "Karina is here~ what’s up? 🌙",
    "Hiii~ I heard my name 🫶",
    "Yes yes, I’m listening ✨",
    "You summoned me~ 💙",
    "Hello~ what do you need? 🌙",
    "I’m here now~ don’t be shy ✨",
    "Did you miss me? 🫶",
    "Karina mode activated~ 💙"
  ];

  if (karinaRegex.test(content)) {
    const randomReply =
      karinaReplies[Math.floor(Math.random() * karinaReplies.length)];

    await message.reply({
      content: randomReply
    });
  }
});

client.login(process.env.TOKEN);