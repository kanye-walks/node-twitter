/**
http://ikertxu.tumblr.com/post/56686134143/nodejs-socketio-and-the-twitter-streaming-api
 * Declare all variables
 *
 * @var fs The file system handler
 * @var app The server app running
 * @var io The Socket.IO handler
 * @var config Configuration option for Twitter API
 * @var twitter The twitter library for the Streaming API
 * @var mime The mime type mapping library
 * @var path The path utility for handling file path
 * @var theport The port that the app will be listening
 * @var cache The cache object to cache server responses
 */
var fs = require("fs"),
	app = require("http").createServer(responseHandler), // handler defined below
	io = require("socket.io").listen(app, {
		log: false
	}),
	config = require("./config"),
	twitter = require("ntwitter"),
	mime = require('mime'),
	path = require('path'),
	theport = process.env.PORT || 2000,
	cache = {};

function handler(req, res) {
	fs.readFile(__dirname + "/index.html",
		function(err, data) {
			if (err) {
				res.writeHead(500);
				return res.end("Error loading index.html");
			}
			res.writeHead(200);
			res.end(data);
		});
}

function send404(response) {
	response.writeHead(404, {
		'Content-Type': 'text/plain'
	});
	response.write('Error 404: resource not found.');
	response.end();
}

function sendFile(response, filePath, fileContents) {
	response.writeHead(
		200, {
			"content-type": mime.lookup(path.basename(filePath))
		}
	);
	response.end(fileContents);
}

function responseHandler(request, response) {
	var filePath = false;

	if (request.url == '/') {
		filePath = 'public/index.html';
	} else {
		filePath = 'public' + request.url;
	}

	var absPath = './' + filePath;
	serveStatic(response, cache, absPath);
}

function serveStatic(response, cache, absPath) {

	if (cache[absPath]) {
		sendFile(response, absPath, cache[absPath]);
	} else {
		fs.exists(absPath, function(exists) {
			if (exists) {
				fs.readFile(absPath, function(err, data) {
					if (err) {
						send404(response);
					} else {
						cache[absPath] = data;
						sendFile(response, absPath, data);
					}
				});
			} else {
				send404(response);
			}
		});
	}
}

app.listen(theport, function() {
	console.log("Server listening on port " + theport);
});

/**
 * This are the application global variables for the server
 *
 * @var tw The Twitter Streaming API initialization
 * @var stream When a stream is created this will be the only instance of it
 * @var track The tracking words for the stream
 * @var users An array of connected users to the application
 */
var tw = new twitter(config.twitter),
	stream = null,
	track = "kanye",
	users = [];

/**
 * A listener for a client connection
 */
io.sockets.on("connection", function(socket) {
	// The user it's added to the array if it doesn't exist
	if (users.indexOf(socket.id) === -1) {
		users.push(socket.id);
	}

	// Log
	logConnectedUsers();

	// Listener when a user emits the "start stream" signal
	socket.on("start stream", function() {
		// The stream will be started only when the 1st user arrives
		if (stream !== null) return;
		tw.stream("statuses/filter", {
				track: track
			},
			function(s) {
				stream = s;
				stream.on("data", function(data) {
					// only broadcast when users are online
					if (users.length > 0) {
						if (data['user'] !== undefined) {
							// Construct a new tweet object
							var month = new Array();
									month[0] = "Jan";
									month[1] = "Feb";
									month[2] = "Mar";
									month[3] = "Apr";
									month[4] = "May";
									month[5] = "Jun";
									month[6] = "Jul";
									month[7] = "Aug";
									month[8] = "Sep";
									month[9] = "Oct";
									month[10] = "Nov";
									month[11] = "Dec";
							var tweet = {
								twid: data['id_str'],
								active: false,
								author: data['user']['name'],
								avatar: data['user']['profile_image_url'],
								body: data['text'],
								date: month[new Date().getMonth(data['created_at'])] + " " + new Date().getDate(data['created_at']) ,
								screenname: data['user']['screen_name']
							};
						}
						// Emit the signal to other users
						socket.broadcast.emit("new tweet", tweet);
						// Emit the signal to the 1st user
						socket.emit("new tweet", tweet);
					} else {
						// If there are no users connected we destroy the stream.
						// Why would we keep it running for nobody?
						stream.destroy();
						stream = null;
					}
				});
			});
	});

	// This handles when a user is disconnected
	socket.on("disconnect", function(o) {
		// find the user in the array
		var index = users.indexOf(socket.id);
		if (index != -1) {
			// Eliminates the user from the array
			users.splice(index, 1);
		}
		logConnectedUsers();
	});

	// Emits signal when the user is connected sending
	// the tracking words the app it's using
	socket.emit("connected", {
		tracking: track
	});
});

// A log function for debugging purposes
function logConnectedUsers() {
	console.log("============= CONNECTED USERS ==============");
	console.log("==  ::  " + users.length);
	console.log("============================================");
}