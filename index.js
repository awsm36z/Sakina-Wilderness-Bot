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
    TextInputStyle
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
        const location = interaction.fields.getTextInputValue('backpackLocation');
        const duration = interaction.fields.getTextInputValue('backpackDuration');
        const dates = interaction.fields.getTextInputValue('backpackDates');
        const spots = interaction.fields.getTextInputValue('backpackSpots') || 'N/A';

        return interaction.reply({
            content:
                `**New Backpack Trip Request**\n` +
                `• **Location:** ${location}\n` +
                `• **Duration:** ${duration}\n` +
                `• **Dates:** ${dates}\n` +
                `• **# of Spots:** ${spots}`,
            ephemeral: false
        });
    }
});

client.login(process.env.BOT_TOKEN);
