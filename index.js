const Imap = require("imap");
const config = require("./config.js");
const connection = new Imap(config.imap);

async function unreadFor(connection, path) {
	return new Promise((resolve) => {
		connection.status(path, (err, box) => {
			if (err) throw err;
			if (!box) throw new Error("no box object in " + path);
			if (!box.messages) throw new Error("no box.messages object in " + path);
			resolve(box.messages);
		});
	});
}

connection.once("ready", async () => {
	console.log("connection ready");

	config.folders.forEach(async folder => {
		console.log("opening %s: ", folder);
		const messages = await unreadFor(connection, folder);
		console.log("  total: %d unread: %d", messages.total, messages.unseen);
	});

	connection.end();
});

connection.once("end", () => {
	console.log("connection ended");
});
connection.on("error", (err) => {
	console.log("connection error: ", err);
});

console.log("attempting connection");
connection.connect();
