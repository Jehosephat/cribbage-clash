import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import type {
  ComboEvent,
  GameState,
  GoResolution,
  PlayerId,
  PlayCardOutcome,
  ResolutionSummary
} from '@cribbage-clash/rules';
import * as Rules from '@cribbage-clash/rules';
import {
  JoinRequest,
  joinRequestSchema,
  StartRequest,
  startRequestSchema,
  DiscardRequest,
  discardRequestSchema,
  CutRequest,
  cutRequestSchema,
  PlayRequest,
  playRequestSchema,
  GoRequest,
  goRequestSchema,
  ResolveRequest,
  resolveRequestSchema
} from './net/schema.js';

type SeatType = 'online' | 'hotseat' | 'bot';

interface RoomSeat {
  id: string;
  name: string;
  type: SeatType;
  joinedAt: number;
}

interface RoomRegistry {
  id: string;
  seed: number;
  state: GameState;
  players: Record<PlayerId, RoomSeat | undefined>;
  createdAt: number;
}

const rooms = new Map<string, RoomRegistry>();

const {
  createInitialState,
  declareGo,
  discardToCrib,
  cutStarter,
  playCard,
  resolveRound
} = Rules;

const metrics = {
  roomsCreated: 0,
  matchesStarted: 0,
  eventsProcessed: 0,
  errors: 0,
  combos: 0
};

interface ServerToClientEvents {
  joined(payload: { roomId: string; seat: PlayerId }): void;
  state(state: GameState): void;
  combo(combos: ComboEvent[]): void;
  error(payload: { code: string; msg: string }): void;
}

interface ClientToServerEvents {
  join(payload: JoinRequest): void;
  start(payload: StartRequest): void;
  discard(payload: DiscardRequest): void;
  cut(payload: CutRequest): void;
  play(payload: PlayRequest): void;
  go(payload: GoRequest): void;
  resolve(payload: ResolveRequest): void;
}

type InterServerEvents = Record<string, never>;

interface SocketData {
  roomId?: string;
  seat?: PlayerId;
}

const app = express();
const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: '*'
  }
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/metrics', (_req, res) => {
  const activeSeats = Array.from(rooms.values()).reduce(
    (count, room) => count + Number(Boolean(room.players.p1)) + Number(Boolean(room.players.p2)),
    0
  );

  res.json({
    uptime: process.uptime(),
    rooms: rooms.size,
    activeSeats,
    roomsCreated: metrics.roomsCreated,
    matchesStarted: metrics.matchesStarted,
    eventsProcessed: metrics.eventsProcessed,
    errors: metrics.errors,
    combos: metrics.combos,
    memory: process.memoryUsage()
  });
});

io.on('connection', (socket) => {
  logAnalyticsEvent('socket_connected', { socketId: socket.id });

  socket.on('join', (payload) => {
    const result = joinRequestSchema.safeParse(payload);
    if (!result.success) {
      emitValidationError(socket, result.error.message);
      return;
    }
    const data = result.data;
    const room = getOrCreateRoom(data.roomId);
    const seat = assignSeat(room, data.seat);
    if (!seat) {
      emitError(socket, 'room_full', 'Room is full');
      return;
    }

    const seatType: SeatType = data.mode ?? 'online';
    room.players[seat] = {
      id: socket.id,
      name: data.name,
      type: seatType,
      joinedAt: Date.now()
    };

    socket.data.roomId = room.id;
    socket.data.seat = seat;
    socket.join(room.id);

    socket.emit('joined', { roomId: room.id, seat });
    socket.emit('state', room.state);

    logAnalyticsEvent('player_join', {
      roomId: room.id,
      seat,
      seatType,
      name: data.name
    });
  });

  socket.on('start', (payload) => {
    if (!ensureMembership(socket, payload)) {
      return;
    }
    const result = startRequestSchema.safeParse(payload);
    if (!result.success) {
      emitValidationError(socket, result.error.message);
      return;
    }
    const room = rooms.get(result.data.roomId);
    if (!room) {
      emitError(socket, 'not_found', 'Room not found');
      return;
    }
    if (!room.players.p1 || !room.players.p2) {
      emitError(socket, 'not_ready', 'Both seats must be filled to start');
      return;
    }

    room.seed = Date.now();
    room.state = createInitialState(room.seed);
    metrics.matchesStarted += 1;
    metrics.eventsProcessed += 1;

    logAnalyticsEvent('match_start', {
      roomId: room.id,
      seed: room.seed,
      players: describeRoomPlayers(room)
    });

    broadcastState(room);
  });

  socket.on('discard', (payload) => {
    const seat = ensureMembership(socket, payload);
    if (!seat) {
      return;
    }
    const result = discardRequestSchema.safeParse(payload);
    if (!result.success) {
      emitValidationError(socket, result.error.message);
      return;
    }
    const room = rooms.get(result.data.roomId);
    if (!room) {
      emitError(socket, 'not_found', 'Room not found');
      return;
    }

    processIntent(socket, room, seat, 'discard', () => {
      discardToCrib(room.state, seat, result.data.cardIds);
      logAnalyticsEvent('discard', { roomId: room.id, seat, cards: result.data.cardIds });
    });
  });

  socket.on('cut', (payload) => {
    const seat = ensureMembership(socket, payload);
    if (!seat) {
      return;
    }
    const result = cutRequestSchema.safeParse(payload);
    if (!result.success) {
      emitValidationError(socket, result.error.message);
      return;
    }
    const room = rooms.get(result.data.roomId);
    if (!room) {
      emitError(socket, 'not_found', 'Room not found');
      return;
    }

    processIntent(socket, room, seat, 'cut', () => {
      const starter = cutStarter(room.state);
      logAnalyticsEvent('starter_cut', { roomId: room.id, seat, starter });
    });
  });

  socket.on('play', (payload) => {
    const seat = ensureMembership(socket, payload);
    if (!seat) {
      return;
    }
    const result = playRequestSchema.safeParse(payload);
    if (!result.success) {
      emitValidationError(socket, result.error.message);
      return;
    }
    const room = rooms.get(result.data.roomId);
    if (!room) {
      emitError(socket, 'not_found', 'Room not found');
      return;
    }

    processIntent(socket, room, seat, 'play', () => {
      const outcome: PlayCardOutcome = playCard(room.state, seat, result.data.cardId);
      if (outcome.combos.length > 0) {
        metrics.combos += outcome.combos.length;
        io.to(room.id).emit('combo', outcome.combos);
        logAnalyticsEvent('pegging_combo', {
          roomId: room.id,
          seat,
          combos: outcome.combos,
          count: outcome.count
        });
      }
      if (outcome.damageEvent) {
        logAnalyticsEvent('damage_event', {
          roomId: room.id,
          seat,
          damage: outcome.damageEvent
        });
      }
      if (outcome.reset) {
        logAnalyticsEvent('pegging_reset', { roomId: room.id, seat });
      }
    });
  });

  socket.on('go', (payload) => {
    const seat = ensureMembership(socket, payload);
    if (!seat) {
      return;
    }
    const result = goRequestSchema.safeParse(payload);
    if (!result.success) {
      emitValidationError(socket, result.error.message);
      return;
    }
    const room = rooms.get(result.data.roomId);
    if (!room) {
      emitError(socket, 'not_found', 'Room not found');
      return;
    }

    processIntent(socket, room, seat, 'go', () => {
      const resolution: GoResolution = declareGo(room.state, seat);
      if (resolution.awardedTo) {
        logAnalyticsEvent('go_awarded', {
          roomId: room.id,
          seat: resolution.awardedTo,
          damage: resolution.damageEvent
        });
      }
      if (resolution.reset) {
        logAnalyticsEvent('pegging_reset', { roomId: room.id, seat });
      }
    });
  });

  socket.on('resolve', (payload) => {
    const seat = ensureMembership(socket, payload);
    if (!seat) {
      return;
    }
    const result = resolveRequestSchema.safeParse(payload);
    if (!result.success) {
      emitValidationError(socket, result.error.message);
      return;
    }
    const room = rooms.get(result.data.roomId);
    if (!room) {
      emitError(socket, 'not_found', 'Room not found');
      return;
    }

    processIntent(socket, room, seat, 'resolve', () => {
      const summary: ResolutionSummary = resolveRound(room.state);
      logAnalyticsEvent('resolution_score', { roomId: room.id, seat, summary });
      if (room.state.phase === 'results') {
        const winner = room.state.hp.p1 > 0 ? 'p1' : 'p2';
        logAnalyticsEvent('match_end', {
          roomId: room.id,
          winner,
          rounds: room.state.round
        });
      }
    });
  });

  socket.on('disconnect', () => {
    const { roomId, seat } = socket.data;
    if (!roomId || !seat) {
      logAnalyticsEvent('socket_disconnected', { socketId: socket.id });
      return;
    }
    const room = rooms.get(roomId);
    if (!room) {
      logAnalyticsEvent('socket_disconnected', { socketId: socket.id });
      return;
    }
    const occupant = room.players[seat];
    if (occupant && occupant.id === socket.id) {
      room.players[seat] = undefined;
      logAnalyticsEvent('player_leave', { roomId, seat });
    }
    if (!room.players.p1 && !room.players.p2) {
      rooms.delete(roomId);
      logAnalyticsEvent('room_closed', { roomId });
    }
  });
});

const port = Number(process.env.PORT ?? 3000);

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Cribbage Clash server listening on port ${port}`);
});

function emitError(socket: Socket, code: string, msg: string): void {
  socket.emit('error', { code, msg });
  metrics.errors += 1;
}

function emitValidationError(socket: Socket, msg: string): void {
  emitError(socket, 'bad_request', msg);
}

function getOrCreateRoom(roomId: string): RoomRegistry {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }
  const seed = Date.now();
  const state = createInitialState(seed);
  const room: RoomRegistry = {
    id: roomId,
    seed,
    state,
    players: { p1: undefined, p2: undefined },
    createdAt: Date.now()
  };
  rooms.set(roomId, room);
  metrics.roomsCreated += 1;
  logAnalyticsEvent('room_created', { roomId, seed });
  return room;
}

function assignSeat(room: RoomRegistry, requested?: PlayerId): PlayerId | null {
  if (requested) {
    if (!room.players[requested]) {
      return requested;
    }
    return null;
  }
  if (!room.players.p1) {
    return 'p1';
  }
  if (!room.players.p2) {
    return 'p2';
  }
  return null;
}

function ensureMembership(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  payload: { roomId?: string }
): PlayerId | null {
  const roomId = payload.roomId;
  if (!roomId) {
    emitValidationError(socket, 'roomId is required');
    return null;
  }
  if (socket.data.roomId !== roomId || !socket.data.seat) {
    emitError(socket, 'forbidden', 'You are not a member of this room');
    return null;
  }
  return socket.data.seat;
}

function processIntent(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  room: RoomRegistry,
  seat: PlayerId,
  intent: string,
  action: () => void
): void {
  try {
    action();
    metrics.eventsProcessed += 1;
    broadcastState(room);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    emitError(socket, 'illegal_action', message);
    logAnalyticsEvent('illegal_play_attempt', {
      roomId: room.id,
      seat,
      intent,
      message
    });
  }
}

function broadcastState(room: RoomRegistry): void {
  io.to(room.id).emit('state', room.state);
}

function describeRoomPlayers(room: RoomRegistry): Record<PlayerId, SeatType | null> {
  return {
    p1: room.players.p1?.type ?? null,
    p2: room.players.p2?.type ?? null
  };
}

function logAnalyticsEvent(event: string, payload?: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[analytics] ${event}`, payload ? JSON.stringify(payload) : '');
}

