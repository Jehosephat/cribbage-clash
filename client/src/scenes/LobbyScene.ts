import type { GameState, PlayerId } from '@cribbage-clash/rules';
import Phaser from 'phaser';
import { socketClient } from '../../net/client';

interface LobbySceneData {
  defaultName?: string;
  roomId?: string;
  seat?: PlayerId;
}

export default class LobbyScene extends Phaser.Scene {
  private formElement?: Phaser.GameObjects.DOMElement;

  private nameInput?: HTMLInputElement;

  private codeInput?: HTMLInputElement;

  private seatSelect?: HTMLSelectElement;

  private statusText!: Phaser.GameObjects.Text;

  private joinInfoText!: Phaser.GameObjects.Text;

  private readyButton?: Phaser.GameObjects.Container;

  private startButton?: Phaser.GameObjects.Container;

  private joinedRoom?: string;

  private joinedSeat?: PlayerId;

  private isReady = false;

  private latestState?: GameState;

  private unsubscribes: Array<() => void> = [];

  private initialSeed?: number;

  private hasEnteredMatch = false;

  constructor() {
    super('LobbyScene');
  }

  init(): void {
    socketClient.connect();
  }

  create(data?: LobbySceneData): void {
    this.cameras.main.setBackgroundColor('#020617');
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x020617).setOrigin(0, 0);

    const title = this.add.text(this.scale.width / 2, 80, 'Online Lobby', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#f8fafc'
    });
    title.setOrigin(0.5, 0.5);

    this.statusText = this.add.text(this.scale.width / 2, this.scale.height - 50, 'Choose a name and join/create a room.', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#cbd5f5',
      align: 'center'
    });
    this.statusText.setOrigin(0.5, 0.5);

    this.joinInfoText = this.add.text(this.scale.width / 2, 150, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#38bdf8'
    });
    this.joinInfoText.setOrigin(0.5, 0.5);

    this.buildForm(data);
    this.buildReadyControls();

    this.unsubscribes.push(socketClient.onJoined((payload) => this.handleJoined(payload.roomId, payload.seat)));
    this.unsubscribes.push(socketClient.onState((state) => this.updateState(state)));
    this.unsubscribes.push(socketClient.onError((payload) => this.setStatus(`⚠️ ${payload.msg}`)));
    this.unsubscribes.push(socketClient.onDisconnect(() => this.setStatus('Disconnected from server.')));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private cleanup(): void {
    this.unsubscribes.forEach((fn) => fn());
    this.unsubscribes = [];
    this.formElement?.destroy();
    this.readyButton?.destroy();
    this.startButton?.destroy();
  }

  private buildForm(data?: LobbySceneData): void {
    const html = `
      <div class="lobby-form" style="display:flex;flex-direction:column;gap:18px;width:320px;padding:24px;border-radius:16px;background:#0f172a;border:2px solid #1d4ed8;box-shadow:0 18px 38px rgba(15,23,42,0.45);color:#f8fafc;font-family:Inter,sans-serif;">
        <label style="display:flex;flex-direction:column;font-size:16px;gap:8px;">
          <span>Display name</span>
          <input type="text" name="name" maxlength="12" placeholder="CardShark" style="padding:10px;border-radius:8px;border:1px solid #334155;background:#111827;color:#f8fafc;font-size:16px;" />
        </label>
        <label style="display:flex;flex-direction:column;font-size:16px;gap:8px;">
          <span>Room code</span>
          <input type="text" name="code" maxlength="8" placeholder="ABCDE" style="padding:10px;border-radius:8px;border:1px solid #334155;background:#111827;color:#f8fafc;font-size:16px;text-transform:uppercase;letter-spacing:2px;" />
        </label>
        <label style="display:flex;flex-direction:column;font-size:16px;gap:8px;">
          <span>Seat</span>
          <select name="seat" style="padding:10px;border-radius:8px;border:1px solid #334155;background:#111827;color:#f8fafc;font-size:16px;">
            <option value="p1">Player 1</option>
            <option value="p2">Player 2</option>
          </select>
        </label>
        <div style="display:flex;gap:12px;justify-content:space-between;">
          <button type="button" data-action="create" style="flex:1;padding:12px;border-radius:8px;border:none;background:#2563eb;color:#f8fafc;font-size:16px;font-weight:600;cursor:pointer;">Create</button>
          <button type="button" data-action="join" style="flex:1;padding:12px;border-radius:8px;border:none;background:#0ea5e9;color:#0f172a;font-size:16px;font-weight:600;cursor:pointer;">Join</button>
        </div>
        <button type="button" data-action="back" style="padding:10px;border-radius:6px;border:none;background:#334155;color:#e2e8f0;font-size:16px;cursor:pointer;">Back to menu</button>
      </div>
    `;

    this.formElement = this.add.dom(this.scale.width / 2, this.scale.height / 2).createFromHTML(html);
    const node = this.formElement.node as HTMLElement;
    this.nameInput = node.querySelector('input[name="name"]') as HTMLInputElement | null || undefined;
    this.codeInput = node.querySelector('input[name="code"]') as HTMLInputElement | null || undefined;
    this.seatSelect = node.querySelector('select[name="seat"]') as HTMLSelectElement | null || undefined;

    if (this.nameInput && data?.defaultName) {
      this.nameInput.value = data.defaultName;
    }
    if (this.codeInput && data?.roomId) {
      this.codeInput.value = data.roomId;
    }
    if (this.seatSelect && data?.seat) {
      this.seatSelect.value = data.seat;
    }

    this.formElement.addListener('click');
    this.formElement.on('click', (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const action = target.getAttribute('data-action');
      if (action === 'create') {
        this.handleCreate();
      } else if (action === 'join') {
        this.handleJoin();
      } else if (action === 'back') {
        this.returnToMenu();
      }
    });
  }

  private buildReadyControls(): void {
    this.readyButton = this.createActionButton(this.scale.width / 2 - 120, this.scale.height / 2 + 180, 'Ready', () => {
      this.toggleReady();
    });
    this.readyButton.setVisible(false);

    this.startButton = this.createActionButton(this.scale.width / 2 + 120, this.scale.height / 2 + 180, 'Start match', () => {
      if (this.joinedRoom) {
        socketClient.startMatch(this.joinedRoom);
        this.setStatus('Requested match start…');
      }
    });
    this.startButton.setVisible(false);
  }

  private createActionButton(x: number, y: number, label: string, handler: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const background = this.add.rectangle(0, 0, 150, 48, 0x2563eb, 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, 0x38bdf8, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#f8fafc'
    });
    text.setOrigin(0.5, 0.5);
    background.setInteractive({ useHandCursor: true })
      .on('pointerdown', handler)
      .on('pointerover', () => background.setFillStyle(0x1d4ed8, 1))
      .on('pointerout', () => background.setFillStyle(0x2563eb, 0.92));
    container.add([background, text]);
    return container;
  }

  private handleCreate(): void {
    const name = this.nameInput?.value.trim() || 'Player';
    socketClient
      .createRoom(name)
      .then(({ roomId, seat }) => {
        this.handleJoined(roomId, seat);
        if (this.codeInput) {
          this.codeInput.value = roomId;
        }
        this.setStatus('Room created. Share the code with your opponent.');
      })
      .catch((error: Error) => this.setStatus(`⚠️ ${error.message}`));
  }

  private handleJoin(): void {
    const name = this.nameInput?.value.trim() || 'Player';
    const roomId = (this.codeInput?.value.trim() || '').toUpperCase();
    if (!roomId) {
      this.setStatus('Enter a room code to join.');
      return;
    }
    const seat = (this.seatSelect?.value as PlayerId | undefined) || undefined;
    socketClient
      .joinRoom(roomId, name, seat)
      .then(({ roomId: joinedRoom, seat: joinedSeat }) => {
        this.handleJoined(joinedRoom, joinedSeat);
        this.setStatus('Joined room. Waiting for all players to ready up.');
      })
      .catch((error: Error) => this.setStatus(`⚠️ ${error.message}`));
  }

  private handleJoined(roomId: string, seat: PlayerId): void {
    this.joinedRoom = roomId;
    this.joinedSeat = seat;
    this.isReady = false;
    this.initialSeed = undefined;
    this.hasEnteredMatch = false;
    this.updateReadyLabels();
    this.readyButton?.setVisible(true);
    this.startButton?.setVisible(seat === 'p1');
    this.joinInfoText.setText(`Room ${roomId} — You are ${seat.toUpperCase()}`);
  }

  private updateState(state: GameState): void {
    this.latestState = state;
    if (!this.initialSeed) {
      this.initialSeed = state.seed;
    }
    const matchInProgress = state.phase !== 'discard';
    const seedChanged = this.initialSeed !== state.seed;
    if (!this.hasEnteredMatch && (matchInProgress || seedChanged)) {
      this.hasEnteredMatch = true;
      this.setStatus('Match starting…');
      this.scene.start('MatchScene', {
        mode: 'online',
        roomId: this.joinedRoom,
        seat: this.joinedSeat,
        playerName: this.nameInput?.value || 'Player'
      });
    }
  }

  private toggleReady(): void {
    this.isReady = !this.isReady;
    this.updateReadyLabels();
    this.setStatus(this.isReady ? 'Ready — waiting for opponent.' : 'Not ready.');
  }

  private updateReadyLabels(): void {
    const button = this.readyButton;
    if (!button) {
      return;
    }
    const text = button.list.find((item) => item instanceof Phaser.GameObjects.Text) as
      | Phaser.GameObjects.Text
      | undefined;
    if (text) {
      text.setText(this.isReady ? 'Ready ✔' : 'Ready');
    }
  }

  private setStatus(message: string): void {
    this.statusText.setText(message);
  }

  private returnToMenu(): void {
    this.scene.start('MenuScene', { returnToLobby: true });
  }
}
