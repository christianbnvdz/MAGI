const fs = require('fs');

module.exports = {
	name: 'archive',
	execute(message, args) {
            const channel_as_json = scrape_channel(message.channel);
	    console.log(channel_as_json);
	},
};

async function scrape_channel(channel) {
    // Only allowed to grab 100 messages at a time
    let messages = await channel.messages.fetch({limit: 100});
    let messages_retreived = messages.size;
    while (messages_retreived === 100) {
        const last_message_snowflake = messages.lastKey();
        const message_batch = await channel.messages.fetch({limit: 100, before: last_message_snowflake});
	messages = messages.concat(message_batch);
	messages_retreived = message_batch.size;
    }
    //fs.writeFile('test.json', JSON.stringify(messages), 'utf8', () => {});
    /*await channel.send({
	files: [{
	    attachment: './test.json',
	    name: 'last_100_messages.json'
	}]
    });*/
}
