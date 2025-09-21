import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createInitialState } from '@cribbage-clash/rules';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

io.on('connection', (socket) => {
  const state = createInitialState();
  socket.emit('state:init', state);

  socket.on('disconnect', () => {
    // eslint-disable-next-line no-console
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Cribbage Clash server listening on port ${port}`);
});
