const WebSocket = require("ws");
const http = require("http");

const express = require("express");
const app = express();

const sockerServer = http.createServer(app);
const socketPort = process.env.PORT || 6969;

sockerServer.listen(socketPort, function () {
  console.log("Web server start. http://localhost:" + socketPort);
});

const wss = new WebSocket.Server({ server: sockerServer });

wss.on("connection", (ws) => {
  ws.username = "";
  ws.room = "";

  console.log("");
  console.log("-------------------------");
  console.log("--- Someone Connected ---");
  console.log("-------------------------");
  console.log("");

  ws.on("message", (payload) => {
    console.log("");
    console.log(`==> Payload: ${payload}`);
    console.log("");

    let message = "";

    try {
      message = JSON.parse(payload);
    } catch (e) {
      console.log(e);
    }

    if (message.join && message.join.room && message.join.username) {
      const room = message.join.room.toUpperCase();
      const username = message.join.username.toUpperCase();

      let userExist = false;
      let someoneLose = false;
      let roomPlay = false;

      wss.clients.forEach((client) => {
        if (client.room === room) {
          if (client.username) {
            roomPlay = true;
          }

          if (client.lose) {
            someoneLose = true;
          }

          if (!client.isReady) {
            roomPlay = false;
          }

          if (client.username === username) {
            userExist = true;
          }
        }
      });

      if (roomPlay || someoneLose) {
        const payload = {
          code: 10002,
          message: "Room already start playing",
        };

        ws.send(JSON.stringify(payload));

        console.log(`--> Error because room "${room}" already start playing`);
        return;
      }

      if (userExist) {
        const payload = {
          code: 10001,
          message: "Username already exist in this room",
        };

        ws.send(JSON.stringify(payload));

        console.log(
          `--> Error because username "${username}" already exist in "${room}" room`
        );
        return;
      }

      console.log("");
      console.log(`--> "${username}" has joined "${room}"`);

      ws.username = username;
      ws.room = room;
      ws.isReady = false;
      ws.lose = false;
      ws.increamentValue = randomIncreamentValue();
      ws.decreamentValue = 0;
      ws.color = Math.floor(Math.random() * 16777215).toString(16);

      let users = [];
      let bombCount = 0;

      wss.clients.forEach((client) => {
        if (client.room === room) {
          users.push({
            username: client.username,
            color: client.color,
            isReady: client.isReady,
            lose: client.lose,
          });

          bombCount += client.increamentValue;
        }
      });

      console.log(`--> Room "${room}" has ${users.length} Clients`);
      console.log("");

      const payload = {
        code: 20001,
        users: users,
        bombCount,
      };

      broadcast(room, payload);
    }

    if (typeof message.ready !== "undefined") {
      let users = [];

      wss.clients.forEach((client) => {
        if (client.room === ws.room) {
          let isReady = client.isReady;

          if (client.username === ws.username) {
            isReady = message.ready;
            ws.isReady = isReady;
          }

          users.push({
            username: client.username,
            color: client.color,
            isReady,
            lose: client.lose,
          });
        }
      });

      const payload = {
        code: 20002,
        users,
      };

      broadcast(ws.room, payload);
    }

    if (message.explode) {
      ws.decreamentValue += 1;

      let users = [];
      let explodeCount = 0;

      wss.clients.forEach((client) => {
        if (client.room === ws.room) {
          users.push({
            username: client.username,
            color: client.color,
            isReady: client.isReady,
            lose: client.lose,
          });

          explodeCount += client.decreamentValue;
        }
      });

      const payload = {
        code: 20003,
        users: users,
        explodeCount,
      };

      broadcast(ws.room, payload);
    }

    if (message.nextTurn && typeof message.nextTurn.index != "undefined") {
      const payload = {
        code: 20004,
        index: message.nextTurn.index,
      };

      broadcast(ws.room, payload);
    }

    if (message.lose) {
      let users = [];
      let bombCount = 0;

      wss.clients.forEach((client) => {
        if (client.room === ws.room) {
          client.increamentValue = randomIncreamentValue();
          client.decreamentValue = 0;
          client.isReady = false;

          let lose = client.lose;

          if (client.username === ws.username) {
            lose = message.lose;
            ws.lose = lose;
          }

          users.push({
            username: client.username,
            color: client.color,
            isReady: false,
            lose,
          });

          bombCount += client.increamentValue;
        }
      });

      const payload = {
        code: 20005,
        users,
        index: 0,
        bombCount,
        explodeCount: 0,
      };

      broadcast(ws.room, payload);
    }
  });

  ws.on("error", (e) => () => {
    console.log("");
    console.log("=====================");
    console.log("=== Someone Error ===");
    console.log("=====================");
    console.log("");
    console.log(`=== ${e}`);

    if (ws.room && ws.username) {
      let users = [];
      wss.clients.forEach((client) => {
        if (client.room === ws.room) {
          users.push({
            username: client.username,
            color: client.color,
            isReady: client.isReady,
            lose: client.lose,
          });
        }
      });

      const payload = {
        code: 20002,
        users,
      };

      broadcast(ws.room, payload);
    }
  });

  ws.on("close", (e) => {
    console.log("");
    console.log("============================");
    console.log("=== Someone Disconnected ===");
    console.log("============================");
    console.log("");
    console.log(`=== ${e}`);

    if (ws.room && ws.username) {
      let users = [];
      wss.clients.forEach((client) => {
        if (client.room === ws.room) {
          users.push({
            username: client.username,
            color: client.color,
            isReady: client.isReady,
            lose: client.lose,
          });
        }
      });

      const payload = {
        code: 20002,
        users,
      };

      broadcast(ws.room, payload);
    }
  });
});

function broadcast(room, payload) {
  const data = JSON.stringify(payload);
  let count = 0;

  console.log(`--> Broadcasting "${data}" to room "${room}"`);

  wss.clients.forEach((client) => {
    if (client.room === room) {
      client.send(data);
      count++;
    }
  });

  console.log(`--> Data received by ${count} Clients`);
  console.log("");
}

function randomIncreamentValue() {
  return Math.floor(Math.random() * (9 - 6 + 1)) + 6;
}
