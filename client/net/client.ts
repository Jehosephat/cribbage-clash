import { io, Socket } from 'socket.io-client';
import type {
  ComboEvent,
  GameState,
  GoResolution,
  PlayerId,
  PlayCardOutcome,
  ResolutionSummary
} from '@cribbage-clash/rules';

interface ServerToClientEvents {
  joined(payload: { roomId: string; seat: PlayerId }): void;
  state(payload: GameState): void;
  combo(events: ComboEvent[]): void;
  error(payload: { code: string; msg: string }): void;
}

interface ClientToServerEvents {
  join(payload: { roomId: string; name: string; seat?: PlayerId; mode?: 'online' | 'hotseat' | 'bot' }): void;
  start(payload: { roomId: string }): void;
  discard(payload: { roomId: string; cardIds: string[] }): void;
  cut(payload: { roomId: string }): void;
  play(payload: { roomId: string; cardId: string }): void;
  go(payload: { roomId: string }): void;
  resolve(payload: { roomId: string }): void;
}

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

export type JoinedHandler = (payload: { roomId: string; seat: PlayerId }) => void;
export type StateHandler = (state: GameState) => void;
export type ComboHandler = (events: ComboEvent[]) => void;
export type ErrorHandler = (payload: { code: string; msg: string }) => void;
export type DisconnectHandler = () => void;

function resolveSocketUrl(): string {
  const meta = import.meta as ImportMeta & { env?: Record<string, string> };
  if (meta?.env?.VITE_SOCKET_URL) {
    return meta.env.VITE_SOCKET_URL;
  }
  if (typeof window !== 'undefined') {
    const win = window as Window & { VITE_SOCKET_URL?: string };
    if (win.VITE_SOCKET_URL) {
      return win.VITE_SOCKET_URL;
    }
  }
  return 'http://localhost:3000';
}

const SOCKET_URL = resolveSocketUrl();

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    code += alphabet[index];
  }
  return code;
}

export class SocketClient {
  private socket?: SocketInstance;

  private joinedHandlers = new Set<JoinedHandler>();

  private stateHandlers = new Set<StateHandler>();

  private comboHandlers = new Set<ComboHandler>();

  private errorHandlers = new Set<ErrorHandler>();

  private disconnectHandlers = new Set<DisconnectHandler>();

  private connectedRoom?: string;

  connect(): void {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }
    const socket = io(SOCKET_URL, { transports: ['websocket'], autoConnect: true });
    this.socket = socket;
    socket.on('joined', (payload) => this.joinedHandlers.forEach((handler) => handler(payload)));
    socket.on('state', (payload) => this.stateHandlers.forEach((handler) => handler(payload)));
    socket.on('combo', (payload) => this.comboHandlers.forEach((handler) => handler(payload)));
    socket.on('error', (payload) => this.errorHandlers.forEach((handler) => handler(payload)));
    socket.on('disconnect', () => this.disconnectHandlers.forEach((handler) => handler()));
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }
    this.socket.disconnect();
    this.connectedRoom = undefined;
  }

  onJoined(handler: JoinedHandler): () => void {
    this.joinedHandlers.add(handler);
    return () => this.joinedHandlers.delete(handler);
  }

  onState(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  onCombo(handler: ComboHandler): () => void {
    this.comboHandlers.add(handler);
    return () => this.comboHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onDisconnect(handler: DisconnectHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  async createRoom(name: string, seat: PlayerId = 'p1'): Promise<{ roomId: string; seat: PlayerId }> {
    const roomId = generateRoomCode();
    return this.joinRoom(roomId, name, seat);
  }

  joinRoom(roomId: string, name: string, seat?: PlayerId): Promise<{ roomId: string; seat: PlayerId }> {
    return new Promise((resolve, reject) => {
      this.ensureSocket();
      if (!this.socket) {
        reject(new Error('Socket unavailable'));
        return;
      }
      const handleJoin = (payload: { roomId: string; seat: PlayerId }): void => {
        this.connectedRoom = payload.roomId;
        cleanup();
        resolve(payload);
      };
      const handleError = (payload: { code: string; msg: string }): void => {
        cleanup();
        reject(new Error(payload.msg));
      };
      const cleanup = (): void => {
        joinedOff();
        errorOff();
      };
      const joinedOff = this.onJoined(handleJoin);
      const errorOff = this.onError(handleError);
      this.socket.emit('join', { roomId, name, seat });
    });
  }

  startMatch(roomId: string): void {
    this.socket?.emit('start', { roomId });
  }

  discard(roomId: string, cardIds: string[]): void {
    this.socket?.emit('discard', { roomId, cardIds });
  }

  cut(roomId: string): void {
    this.socket?.emit('cut', { roomId });
  }

  play(roomId: string, cardId: string): void {
    this.socket?.emit('play', { roomId, cardId });
  }

  declareGo(roomId: string): void {
    this.socket?.emit('go', { roomId });
  }

  resolve(roomId: string): void {
    this.socket?.emit('resolve', { roomId });
  }

  get activeRoom(): string | undefined {
    return this.connectedRoom;
  }

  private ensureSocket(): void {
    if (!this.socket) {
      this.connect();
    }
  }
}

export const socketClient = new SocketClient();

export type ServerComboEvent = ComboEvent;
export type ServerState = GameState;
export type ServerPlayOutcome = PlayCardOutcome;
export type ServerGoResolution = GoResolution;
export type ServerResolutionSummary = ResolutionSummary;
