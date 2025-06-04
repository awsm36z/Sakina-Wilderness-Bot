// index.js
const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField,
    ChannelType
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, () => {
    console.log(`✔️ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    // 1) /trip → send ephemeral dropdown
    if (interaction.isChatInputCommand() && interaction.commandName === 'trip') {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('tripTypeSelect')
            .setPlaceholder('Choose trip type…')
            .addOptions(
                new StringSelectMenuOptionBuilder({ label: 'Hike', value: 'hike' }),
                new StringSelectMenuOptionBuilder({ label: 'Backpack', value: 'backpack' })
            );

        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.reply({
            content: 'Select your trip type to continue:',
            components: [row],
            flags: 1 << 6
        });
    }

    // 2) User selects Hike or Backpack
    if (interaction.isStringSelectMenu() && interaction.customId === 'tripTypeSelect') {
        const tripType = interaction.values[0]; // 'hike' or 'backpack'


        // Build a different modal depending on tripType
        let modal;
        if (tripType === 'hike') {
            modal = new ModalBuilder()
                .setCustomId('hikeModal')
                .setTitle('Plan Your Hike');

            const hikeLocation = new TextInputBuilder()
                .setCustomId('hikeLocation')
                .setLabel('Location')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Where will you hike?')
                .setRequired(true);

            const hikeDate = new TextInputBuilder()
                .setCustomId('hikeDate')
                .setLabel('Date (MM/DD/YYYY)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 07/15/2025')
                .setRequired(true);

            const hikeDistance = new TextInputBuilder()
                .setCustomId('hikeDistance')
                .setLabel('Distance (optional, e.g. “8 miles”)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 8 miles')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(hikeLocation),
                new ActionRowBuilder().addComponents(hikeDate),
                new ActionRowBuilder().addComponents(hikeDistance)
            );
        } else {
            modal = new ModalBuilder()
                .setCustomId('backpackModal')
                .setTitle('Plan Your Backpack Trip');

            // Location (required)
            const backpackLocation = new TextInputBuilder()
                .setCustomId('backpackLocation')
                .setLabel('Location')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Where will you backpack?')
                .setRequired(true);

            // Duration (required)
            const backpackDuration = new TextInputBuilder()
                .setCustomId('backpackDuration')
                .setLabel('Duration (e.g. “3 days 2 nights”)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('How long is the trip?')
                .setRequired(true);

            // Dates (required)
            const backpackDates = new TextInputBuilder()
                .setCustomId('backpackDates')
                .setLabel('Dates (MM/DD – MM/DD)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 07/10 – 07/13')
                .setRequired(true);

            // # of Spots (optional)
            const backpackSpots = new TextInputBuilder()
                .setCustomId('backpackSpots')
                .setLabel('# of Spots (optional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 5 (or leave blank)')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(backpackLocation),
                new ActionRowBuilder().addComponents(backpackDuration),
                new ActionRowBuilder().addComponents(backpackDates),
                new ActionRowBuilder().addComponents(backpackSpots)
            );
        }

        // This is the one valid “reply” for this interaction:
        return interaction.showModal(modal);
    }

    // 3) Handle the Hike modal submission: create a poll in #hikes
    if (interaction.isModalSubmit() && interaction.customId === 'hikeModal') {
        // 1) Extract fields
        const location = interaction.fields.getTextInputValue('hikeLocation');
        const date = interaction.fields.getTextInputValue('hikeDate');
        const distance = interaction.fields.getTextInputValue('hikeDistance') || 'N/A';

        // 2) Look up the #hikes channel
        const guild = interaction.guild;
        const hikesChannel = guild.channels.cache.find(
            (ch) => ch.name === 'hikes' && ch.isTextBased()
        );
        if (!hikesChannel) {
            return interaction.reply({
                content: 'I could not find a channel named “hikes”. Please create one first.',
                ephemeral: true
            });
        }

        // 3) Defer the reply so we have time to post + react
        await interaction.deferReply({ ephemeral: true });

        // 4) Post the poll message
        const pollText = ` **Hiking at ${location} on ${date}**\nReact with ✅ if you can join, ❌ if you cannot.\n• Distance: ${distance}`;
        const sentMsg = await hikesChannel.send({ content: pollText });

        // 5) Add reactions
        try {
            await sentMsg.react('✅');
            await sentMsg.react('❌');
        } catch (err) {
            console.error('Failed to add reactions:', err);
        }

        // 6) Edit your deferred reply to confirm success
        return interaction.editReply({
            content: `Your hike poll has been posted in <#${hikesChannel.id}>.`
        });
    }



// 4) Handle the Backpack modal submission
if (interaction.isModalSubmit() && interaction.customId === 'backpackModal') {
    // 4a) Extract field values
    const location = interaction.fields.getTextInputValue('backpackLocation');
    const duration = interaction.fields.getTextInputValue('backpackDuration');
    const dates = interaction.fields.getTextInputValue('backpackDates');
    const spots = interaction.fields.getTextInputValue('backpackSpots') || 'N/A';

    // 4b) Defer reply so we have time to create role + channel
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const organizer = interaction.member; // the GuildMember who submitted

    // 4c) Build sanitized base name from location + dates
    const sanitize = (str) => {
      return str
        .toLowerCase()
        .replace(/[\/––—\s]+/g, '-')        // slashes, dashes, whitespace → hyphens
        .replace(/[^a-z0-9-]/g, '')         // strip out anything not alphanumeric or hyphen
        .slice(0, 50);                      // trim to 50 chars
    };
    const safeLocation = sanitize(location);
    const safeDates    = sanitize(dates);
    const baseName = `${safeLocation}-${safeDates}`; // e.g. "mount-rainier-07-10-07-13"

    // 4d) Ensure there's a “Backpacking Trips” category (create if missing)
    let category = guild.channels.cache.find(
      (ch) => ch.name === 'Backpacking Trips' && ch.type === ChannelType.GuildCategory
    );
    if (!category) {
      try {
        category = await guild.channels.create({
          name: 'Backpacking Trips',
          type: ChannelType.GuildCategory,
          reason: 'Category for all backpacking trip channels'
        });
      } catch (err) {
        console.error('Failed to create "Backpacking Trips" category:', err);
        return interaction.editReply({
          content: 'Could not create or find the “Backpacking Trips” category. Please check my permissions.',
        });
      }
    }

    // 4e) Create a new Role named "trip-<baseName>"
    let tripRole;
    try {
      tripRole = await guild.roles.create({
        name: `trip-${baseName}`,
        permissions: [],   // no special perms
        reason: `Backpack trip created by ${organizer.user.tag}`
      });
    } catch (err) {
      console.error('Failed to create role:', err);
      return interaction.editReply({
        content: '❌ I could not create the trip role. Please check my permissions.',
      });
    }

    // 4f) Create a new text channel under “Backpacking Trips”
    let tripChannel;
    try {
      tripChannel = await guild.channels.create({
        name: `backpack-${baseName}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: tripRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ],
        topic: `Backpacking trip to ${location} (${dates})`,
        reason: `Private channel for backpack trip created by ${organizer.user.tag}`
      });
    } catch (err) {
      console.error('Failed to create channel:', err);
      // Clean up role if channel creation failed
      try { await tripRole.delete('Cleaning up role after channel creation failed'); } catch {}
      return interaction.editReply({
        content: '❌ I could not create the trip channel. Please check my permissions.',
      });
    }

    // 4g) Assign the new role to the organizer so they see the channel
    try {
      await organizer.roles.add(tripRole.id);
    } catch (err) {
      console.error('Failed to assign role to organizer:', err);
      // We can still proceed even if this fails
    }

    // 4h) Send a welcome message inside the new channel
    try {
      await tripChannel.send({
        content:
          `**Backpacking Trip: ${location}**\n` +
          `• Duration: ${duration}\n` +
          `• Dates: ${dates}\n` +
          `• # of Spots: ${spots}\n` +
          `• Organizer: <@${organizer.id}>\n\n` +
          `Welcome! Only members with the \`${tripRole.name}\` role can see and chat here.`
      });
    } catch (err) {
      console.error('Failed to send welcome message in trip channel:', err);
    }

    // 4i) ALSO send a public announcement in the channel where /trip was used:
    try {
      const invokingChannel = interaction.channel; // where /trip was originally typed
      const announceText = `🎒 **Backpacking trip in ${location} on ${dates}!**\nReact with 🎫 if interested!`;
      const announcement = await invokingChannel.send({ content: announceText });
      await announcement.react('🎫');
    } catch (err) {
      console.error('Failed to send or react to the public announcement:', err);
    }

    // 4j) Finally, edit the deferred reply to confirm success
    return interaction.editReply({
      content: `Your private backpack channel has been created: <#${tripChannel.id}>.\n` +
               `The role <@&${tripRole.id}> was assigned to you.`
    });
  }
});

client.login(process.env.BOT_TOKEN);
