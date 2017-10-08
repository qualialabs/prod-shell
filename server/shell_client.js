// Fork of https://github.com/meteor/meteor/devel/tools/shell-client.js

// This allows us to access the Meteor shell without having Meteor
// installed (as is the case in a deployed Meteor application).
// All NPM dependencies have been removed.

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var net = require("net");
var EOL = require("os").EOL;

// These two values (EXITING_MESSAGE and getInfoFile) must match the
// values used by the shell-server package.
var EXITING_MESSAGE = "Shell exiting...";
function getInfoFile(shellDir) {
  return path.join(shellDir, "info.json");
}

function Client(shellDir) {
  var self = this;
  assert.ok(self instanceof Client);

  self.shellDir = shellDir;
  self.exitOnClose = false;
  self.firstTimeConnecting = true;
  self.connected = false;
  self.reconnectCount = 0;
}

var Cp = Client.prototype;

Cp.reconnect = function reconnect(delay) {
  var self = this;

  // Display the "Server unavailable" warning only on the third attempt
  // to reconnect, so it doesn't get shown for successful reconnects.
  if (++self.reconnectCount === 3) {
    console.error("\x1b[33mServer unavailable (waiting to reconnect)\x1b[0m");
  }

  if (!self.reconnectTimer) {
    self.reconnectTimer = setTimeout(function() {
      delete self.reconnectTimer;
      self.connect();
    }, delay || 100);
  }
};

Cp.connect = function connect() {
  var self = this;
  var infoFile = getInfoFile(self.shellDir);

  fs.readFile(infoFile, "utf8", function(err, json) {
    if (err) {
      return self.reconnect();
    }

    try {
      var info = JSON.parse(json);
    } catch (err) {
      return self.reconnect();
    }

    if (info.status !== "enabled") {
      if (self.firstTimeConnecting) {
        return self.reconnect();
      }

      if (info.reason) {
        console.error(info.reason);
      }

      console.error(EXITING_MESSAGE);
      process.exit(0);
    }

    self.setUpSocket(
      net.connect(info.port, "127.0.0.1"),
      info.key
    );
  });
};

Cp.setUpSocketForSingleUse = function (sock, key) {
  sock.on("connect", function () {
    const inputBuffers = [];
    process.stdin.on("data", buffer => inputBuffers.push(buffer));
    process.stdin.on("end", () => {
      sock.write(JSON.stringify({
        evaluateAndExit: {
          // Make sure the entire command is written as a string within a
          // JSON object, so that the server can easily tell when it has
          // received the whole command.
          command: Buffer.concat(inputBuffers).toString("utf8")
        },
        terminal: false,
        key: key
      }) + "\n");
    });
  });

  const outputBuffers = [];
  sock.on("data", buffer => outputBuffers.push(buffer));
  sock.on("close", function () {
    var output = JSON.parse(Buffer.concat(outputBuffers));
    if (output.error) {
      console.error(output.error);
      process.exit(output.code);
    } else {
      process.stdout.write(JSON.stringify(output.result) + "\n");
      process.exit(0);
    }
  });
};

Cp.setUpSocket = function setUpSocket(sock, key) {
  const self = this;

  if (! process.stdin.isTTY) {
    return self.setUpSocketForSingleUse(sock, key);
  }

  // Put STDIN into "flowing mode":
  // http://nodejs.org/api/stream.html#stream_compatibility_with_older_node_versions
  process.stdin.resume();

  function onConnect() {
    self.firstTimeConnecting = false;
    self.reconnectCount = 0;
    self.connected = true;

    // Sending a JSON-stringified options object (even just an empty
    // object) over the socket is required to start the REPL session.
    sock.write(JSON.stringify({
      columns: process.stdout.columns,
      terminal: ! process.env.EMACS,
      key: key
    }) + "\n");

    process.stdin.pipe(sock);
    if (process.stdin.setRawMode) { // https://github.com/joyent/node/issues/8204
      process.stdin.setRawMode(true);
    }
  }

  function onClose() {
    tearDown();

    // If we received the special EXITING_MESSAGE just before the socket
    // closed, then exit the shell instead of reconnecting.
    if (self.exitOnClose) {
      process.exit(0);
    } else {
      self.reconnect();
    }
  }

  function onError(err) {
    tearDown();
    self.reconnect();
  }

  function tearDown() {
    self.connected = false;
    if (process.stdin.setRawMode) { // https://github.com/joyent/node/issues/8204
      process.stdin.setRawMode(false);
    }
    process.stdin.unpipe(sock);
    sock.unpipe(process.stdout);
    sock.removeListener("connect", onConnect);
    sock.removeListener("close", onClose);
    sock.removeListener("error", onError);
    sock.end();
  }

  sock.pipe(process.stdout);

  var tail = "";
  sock.on("data", function(data) {
    tail = (tail + data).slice(-20);
    self.exitOnClose = tail.indexOf(EXITING_MESSAGE) >= 0;
  });

  sock.on("connect", onConnect);
  sock.on("close", onClose);
  sock.on("error", onError);
};

new Client(process.env.METEOR_SHELL_DIR).connect()
