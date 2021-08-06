const fs = require('fs');

module.exports = {
	name: 'scrape',
	execute(message, args) {
            const channel_as_json = scrape_channel(message.channel);
	    console.log(channel_as_json);
	},
};

async function scrape_channel(channel) {
    // Only allowed to grab 100 messages at a time
    let messages_json = await channel.messages.fetch({limit: 100});
    fs.writeFile('test.json', JSON.stringify(messages_json), 'utf8', () => {});
    console.log(messages_json);
    await channel.send({
	files: [{
	    attachment: './test.json',
	    name: 'last_100_messages.json'
	}]
    });
}
