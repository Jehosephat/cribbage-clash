import type { GameState, PlayerId, ResolutionSummary } from '@cribbage-clash/rules';
import Phaser from 'phaser';
import type { MatchSceneData } from './MatchScene';
import { socketClient } from '../../net/client';

interface ResultsSceneData {
  winner: PlayerId;
  state: GameState;
  summary?: ResolutionSummary;
  mode: MatchSceneData['mode'];
  seat: PlayerId;
  roomId?: string;
  playerName?: string;
}

export default class ResultsScene extends Phaser.Scene {
  private payload!: ResultsSceneData;

  constructor() {
    super('ResultsScene');
  }

  init(data: ResultsSceneData): void {
    this.payload = data;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0f172a');
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a).setOrigin(0, 0);

    const youWon = this.payload.winner === this.payload.seat;
    const heading = youWon ? 'Victory!' : 'Defeat';
    const description = youWon
      ? 'You reduced your opponent to zero HP.'
      : 'Your HP hit zero — better luck next time.';

    const title = this.add.text(this.scale.width / 2, 100, heading, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: youWon ? '#4ade80' : '#f87171'
    });
    title.setOrigin(0.5, 0.5);

    const subtitle = this.add.text(this.scale.width / 2, 160, description, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#cbd5f5'
    });
    subtitle.setOrigin(0.5, 0.5);

    this.renderDamageRecap();
    this.renderButtons();
  }

  private renderDamageRecap(): void {
    const { state, summary } = this.payload;
    const container = this.add.container(this.scale.width / 2, 260);
    const panel = this.add.rectangle(0, 0, 520, 260, 0x111c31, 0.92);
    panel.setStrokeStyle(2, 0x38bdf8, 0.8);
    panel.setOrigin(0.5, 0.5);

    const heading = this.add.text(0, -110, 'Damage Recap', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      color: '#f8fafc'
    });
    heading.setOrigin(0.5, 0.5);

    const lines: string[] = [];
    const damageEvents = summary?.damageEvents ?? state.damageLog.slice(-6);
    damageEvents.forEach((event) => {
      lines.push(
        `${event.target.toUpperCase()} took ${event.amount} dmg (hp ${event.hpAfter}/${event.hpBefore})` +
          (event.description ? ` — ${event.description}` : '')
      );
    });
    if (lines.length === 0) {
      lines.push('No damage dealt in the final round.');
    }

    const text = this.add.text(0, -60, lines.join('\n'), {
      fontFamily: 'Inter, sans-serif',
      fontSize: '18px',
      color: '#e2e8f0',
      align: 'center'
    });
    text.setOrigin(0.5, 0);

    container.add([panel, heading, text]);
  }

  private renderButtons(): void {
    const buttons: Phaser.GameObjects.Container[] = [];
    buttons.push(this.createButton('Play again', () => this.rematch()));
    buttons.push(this.createButton('Back to menu', () => this.scene.start('MenuScene')));
    if (this.payload.mode === 'online') {
      buttons.push(this.createButton('Back to lobby', () => this.scene.start('LobbyScene')));
    }

    const totalWidth = buttons.length * 200 + (buttons.length - 1) * 30;
    const startX = this.scale.width / 2 - totalWidth / 2 + 100;
    buttons.forEach((button, index) => {
      button.setPosition(startX + index * 230, this.scale.height - 120);
    });
  }

  private createButton(label: string, handler: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const background = this.add.rectangle(0, 0, 200, 56, 0x2563eb, 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, 0x38bdf8, 0.8);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#f8fafc'
    });
    text.setOrigin(0.5, 0.5);
    background.setInteractive({ useHandCursor: true })
      .on('pointerdown', handler)
      .on('pointerover', () => background.setFillStyle(0x1d4ed8, 0.95))
      .on('pointerout', () => background.setFillStyle(0x2563eb, 0.92));
    container.add([background, text]);
    return container;
  }

  private rematch(): void {
    const { mode, roomId, seat, playerName } = this.payload;
    if (mode === 'online' && roomId) {
      socketClient.startMatch(roomId);
      this.scene.start('MatchScene', { mode, roomId, seat, localSeat: seat, playerName });
    } else {
      this.scene.start('MatchScene', { mode, localSeat: seat, playerName });
    }
  }
}
