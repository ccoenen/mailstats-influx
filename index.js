const Imap = require("imap");
const Influx = require("influx");
const configname = process.argv[2] || "config.js";
const config = require(configname);

const connection = new Imap(Object.assign({}, config.imap, {}));

const influx = new Influx.InfluxDB(Object.assign(
	{
		options: {
			headers: {
				"Authorization": "Basic " + Buffer.from(config.influxdb.basic_auth_username + ":" + config.influxdb.basic_auth_password).toString("base64")
			}
		}
	},
	config.influxdb,
	{
		schema: [{
			measurement: "mailbox_contents",
			tags: ["account", "path"],
			fields: {
				unread: Influx.FieldType.INTEGER,
				total: Influx.FieldType.INTEGER
			}
		}]
	}));

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
	const promises = config.folders.map(async folder => {
		console.log("opening %s", folder);
		const messages = await unreadFor(connection, folder);
		const result = {
			measurement: "mailbox_contents",
			tags: { account: config.configname, path: folder },
			fields: { unread: messages.unseen, total: messages.total },
		};
		// console.log(result);
		return result;
	});
	return Promise.all(promises).then((results) => {
		return influx.writePoints(results);
	}).then(() => {
		connection.end();
	});
});

connection.once("end", () => {
	console.log("connection ended");
});
connection.on("error", (err) => {
	console.log("connection error: ", err);
});

influx.getDatabaseNames()
	.then(names => {
		if (!names.includes(config.influxdb.database)) {
			return influx.createDatabase(config.influxdb.database);
		}
	})
	.then(() => {
		console.log("attempting connection");
		connection.connect();
	})
	.catch(err => {
		console.error(err);
	});

