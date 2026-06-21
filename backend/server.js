import { randomUUID } from "node:crypto";
import http from "node:http";
import cors from "cors";
import express from "express";
import pino from "pino";
import pinoPretty from "pino-pretty";
import WebSocket, { WebSocketServer } from "ws";

// Инициализация логирования
const logger = pino(pinoPretty());
const app = express();
app.use(cors());

let userState = [];

const server = http.createServer(app);
const wsServer = new WebSocketServer({ server });

const broadcast = (data) => {
  const message = JSON.stringify(data);
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

wsServer.on("connection", (ws) => {
  ws.user = null;

  ws.on("message", (msg) => {
    let receivedMSG;
    try {
      receivedMSG = JSON.parse(msg);
    } catch (err) {
      return logger.error("Получен невалидный JSON");
    }

    logger.info(`Message received: ${receivedMSG.type}`);

    // --- СЦЕНАРИЙ А: ЛОГИН ---
    if (receivedMSG.type === "login") {
      const { name } = receivedMSG.user;
      const isExist = userState.some(
        (u) => u.name.toLowerCase() === name.toLowerCase(),
      );

      if (isExist) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "This name is already taken!",
          }),
        );
        return;
      }

      ws.user = { id: randomUUID(), name };
      userState.push(ws.user);
      logger.info(`User logged in: ${name}`);

      ws.send(JSON.stringify({ type: "login_success", user: ws.user }));
      broadcast({ type: "users", data: userState });
    }

    // --- СЦЕНАРИЙ Б: СООБЩЕНИЕ ---
    if (receivedMSG.type === "send") {
      broadcast({ type: "send", data: receivedMSG.data });
    }

    // --- СЦЕНАРИЙ В: ВЫХОД ---
    if (receivedMSG.type === "exit") {
      if (ws.user) {
        userState = userState.filter((u) => u.name !== ws.user.name);
        ws.user = null;
        broadcast({ type: "users", data: userState });
      }
    }
  });

  // --- СЦЕНАРИЙ Г: ЗАКРЫТИЕ СОКЕТА (ВАЖНО!) ---
  ws.on("close", () => {
    if (ws.user) {
      logger.info(`Connection closed for: ${ws.user.name}`);
      userState = userState.filter((u) => u.name !== ws.user.name);
      broadcast({ type: "users", data: userState });
    }
  });

  // Отправляем текущий список при подключении
  ws.send(JSON.stringify({ type: "users", data: userState }));
});

const port = process.env.PORT || 3000;

const bootstrap = async () => {
  try {
    server.listen(port, () =>
      logger.info(`Server started on http://localhost:${port}`),
    );
  } catch (error) {
    logger.error(`Error: ${error.message}`);
  }
};

bootstrap();
