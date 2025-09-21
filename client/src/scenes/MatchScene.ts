import {
  Card,
  ComboEvent,
  GameState,
  GoResolution,
  PlayerId,
  PlayCardOutcome,
  ResolutionSummary,
  createInitialState,
  declareGo,
  discardToCrib,
  cutStarter,
  playCard,
  resolveRound
} from '@cribbage-clash/rules';
import Phaser from 'phaser';
import { socketClient } from '../../net/client';

export interface MatchSceneData {
  mode: 'hotseat' | 'bot' | 'online';
  localSeat?: PlayerId;
  seat?: PlayerId;
  playerName?: string;
  roomId?: string;
}

type MatchMode = MatchSceneData['mode'];

type ToastKind = 'combo' | 'info' | 'error' | 'damage';

interface HudText {
  hp: Record<PlayerId, Phaser.GameObjects.Text>;
  shield: Record<PlayerId, Phaser.GameObjects.Text>;
  count: Phaser.GameObjects.Text;
  phase: Phaser.GameObjects.Text;
  turn: Phaser.GameObjects.Text;
}

interface PendingToast {
  text: Phaser.GameObjects.Text;
  timer: Phaser.Tweens.Tween;
}

const SUIT_SYMBOL: Record<Card['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

function deepClone<T>(value: T): T {
  const clone = (globalThis as typeof globalThis & { structuredClone?: <K>(input: K) => K }).structuredClone;
  if (clone) {
    return clone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export default class MatchScene extends Phaser.Scene {
  private mode: MatchMode = 'hotseat';

  private localSeat: PlayerId = 'p1';

  private networkSeat?: PlayerId;

  private roomId?: string;

  private controller?: LocalMatchController;

  private state?: GameState;

  private playerName?: string;

  private hud!: HudText;

  private boardLayer!: Phaser.GameObjects.Container;

  private pileLayer!: Phaser.GameObjects.Container;

  private handLayer!: Phaser.GameObjects.Container;

  private actionLayer!: Phaser.GameObjects.Container;

  private statusBanner!: Phaser.GameObjects.Text;

  private pendingToasts: PendingToast[] = [];

  private selectedCardIds = new Set<string>();

  private unsubscribes: Array<() => void> = [];

  private discardSeat: PlayerId = 'p1';

  private pendingSummary?: ResolutionSummary;

  init(data: MatchSceneData): void {
    this.mode = data.mode;
    this.localSeat = data.localSeat ?? data.seat ?? 'p1';
    this.networkSeat = data.seat;
    this.roomId = data.roomId;
    this.playerName = data.playerName;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1120');
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0b1120).setOrigin(0, 0);

    this.boardLayer = this.add.container(0, 0);
    this.pileLayer = this.add.container(0, 0);
    this.handLayer = this.add.container(0, 0);
    this.actionLayer = this.add.container(0, 0);

    this.createBackground();
    this.hud = this.createHud();
    this.statusBanner = this.add.text(this.scale.width / 2, 44, 'Preparing match…', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#cbd5f5'
    });
    this.statusBanner.setOrigin(0.5, 0.5);

    if (this.mode === 'online') {
      this.setupNetworkBindings();
      if (!this.roomId) {
        this.returnToMenuWithError('Missing room identifier for online match.');
        return;
      }
    } else {
      this.setupLocalMatch();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private setupLocalMatch(): void {
    this.controller = new LocalMatchController(this, this.mode);
    this.controller.onState((state) => this.handleStateUpdate(state));
    this.controller.onCombo((outcome) => this.handleCombo(outcome));
    this.controller.onGo((resolution) => this.handleGo(resolution));
    this.controller.onResolution((summary) => this.handleResolution(summary));
    this.controller.start();
  }

  private setupNetworkBindings(): void {
    this.unsubscribes.push(socketClient.onState((state) => this.handleStateUpdate(state)));
    this.unsubscribes.push(socketClient.onCombo((combos) => this.handleCombo({ combos })));
    this.unsubscribes.push(socketClient.onError((payload) => this.pushToast('error', payload.msg)));
    this.unsubscribes.push(socketClient.onDisconnect(() => this.pushToast('error', 'Lost connection')));
  }

  private handleStateUpdate(state: GameState): void {
    this.state = deepClone(state);
    this.statusBanner.setText(this.describePhase(state));
    this.updateHud(state);
    this.renderPile(state);
    this.renderHand(state);
    this.updatePhaseControls(state);

    if (state.phase === 'discard') {
      this.selectedCardIds.clear();
      this.updateDiscardSeat(state);
      this.pendingSummary = undefined;
    }

    if (state.phase === 'results') {
      this.presentResults(state);
    }
  }

  private handleCombo(outcome: { combos?: ComboEvent[]; damageEvent?: unknown; count?: number }): void {
    if (outcome.combos && outcome.combos.length > 0) {
      const summary = outcome.combos
        .map((combo) => (combo.length ? `${combo.kind} x${combo.length}` : combo.kind))
        .join(', ');
      this.pushToast('combo', `Combo: ${summary}`);
    }
  }

  private handleGo(resolution: GoResolution): void {
    if (resolution.awardedTo) {
      this.pushToast('info', `${resolution.awardedTo.toUpperCase()} scores Go!`);
    }
  }

  private handleResolution(summary: ResolutionSummary): void {
    this.pendingSummary = summary;
    const totalDamage = summary.damageEvents.reduce((acc, event) => acc + event.amount, 0);
    if (totalDamage > 0) {
      this.pushToast('damage', `Resolution damage dealt: ${totalDamage}`);
    }
  }

  private updateDiscardSeat(state: GameState): void {
    if (this.mode === 'hotseat') {
      if (state.hands.p1.length > 4 && state.hands.p2.length <= 4) {
        this.discardSeat = 'p1';
      } else if (state.hands.p2.length > 4 && state.hands.p1.length <= 4) {
        this.discardSeat = 'p2';
      }
    } else {
      this.discardSeat = this.localSeat;
    }
  }

  private presentResults(state: GameState): void {
    const winner: PlayerId = state.hp.p1 <= 0 ? 'p2' : 'p1';
    this.scene.start('ResultsScene', {
      winner,
      state,
      summary: this.pendingSummary,
      mode: this.mode,
      seat: this.networkSeat ?? this.localSeat,
      roomId: this.roomId,
      playerName: this.playerName
    });
  }

  private updateHud(state: GameState): void {
    this.hud.hp.p1.setText(`P1 HP: ${state.hp.p1}`);
    this.hud.hp.p2.setText(`P2 HP: ${state.hp.p2}`);
    this.hud.shield.p1.setText(`Shield: ${state.shield.p1}`);
    this.hud.shield.p2.setText(`Shield: ${state.shield.p2}`);
    this.hud.count.setText(`Count: ${state.count}`);
    this.hud.phase.setText(`Phase: ${state.phase}`);
    this.hud.turn.setText(`Turn: ${state.turn.toUpperCase()}`);
  }

  private renderPile(state: GameState): void {
    this.pileLayer.removeAll(true);
    const maxVisible = 6;
    const startX = this.scale.width / 2 - (maxVisible * 70) / 2;
    const y = this.scale.height / 2 - 30;
    const recent = state.pile.slice(-maxVisible);
    recent.forEach((entry, index) => {
      const container = this.add.container(startX + index * 70, y);
      const rect = this.add.rectangle(0, 0, 64, 96, 0x1f2937, 0.9);
      rect.setStrokeStyle(2, 0x38bdf8, 0.8);
      const text = this.add.text(0, -10, this.formatCard(entry.card), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#f8fafc'
      });
      text.setOrigin(0.5, 0.5);
      const owner = this.add.text(0, 24, entry.player.toUpperCase(), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: '#94a3b8'
      });
      owner.setOrigin(0.5, 0.5);
      container.add([rect, text, owner]);
      this.pileLayer.add(container);
    });
  }

  private renderHand(state: GameState): void {
    this.handLayer.removeAll(true);
    const seat = this.determineHandSeat(state);
    const hand = state.hands[seat];
    const totalWidth = hand.length > 0 ? hand.length * 80 : 0;
    const startX = hand.length > 0 ? this.scale.width / 2 - totalWidth / 2 + 40 : this.scale.width / 2;
    const y = this.scale.height - 120;

    hand.forEach((card, index) => {
      const container = this.add.container(startX + index * 80, y);
      const isSelected = this.selectedCardIds.has(card.id);
      const rect = this.add.rectangle(0, 0, 70, 110, isSelected ? 0xf97316 : 0x1f2937, isSelected ? 0.95 : 0.9);
      rect.setStrokeStyle(2, isSelected ? 0xfb923c : 0x38bdf8, 1);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', () => this.handleCardInteraction(card));

      const label = this.add.text(0, -16, this.formatCard(card), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        color: '#f8fafc'
      });
      label.setOrigin(0.5, 0.5);

      const value = this.add.text(0, 20, `${card.value}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#94a3b8'
      });
      value.setOrigin(0.5, 0.5);

      container.add([rect, label, value]);
      this.handLayer.add(container);
    });
  }

  private updatePhaseControls(state: GameState): void {
    this.actionLayer.removeAll(true);
    this.selectedCardIds.forEach((cardId) => {
      if (!this.cardIsPresent(state, cardId)) {
        this.selectedCardIds.delete(cardId);
      }
    });

    const controlsY = this.scale.height - 40;
    if (state.phase === 'discard') {
      const discardButton = this.createControlButton('Discard Selected', () => this.performDiscard());
      discardButton.setPosition(this.scale.width / 2, controlsY);
      this.setButtonEnabled(discardButton, this.selectedCardIds.size === 2 && this.canAct(this.discardSeat));
      this.actionLayer.add(discardButton);
    } else if (state.phase === 'cut') {
      const cutButton = this.createControlButton('Cut Starter', () => this.performCut());
      cutButton.setPosition(this.scale.width / 2, controlsY);
      this.setButtonEnabled(cutButton, this.canAct(this.localSeat));
      this.actionLayer.add(cutButton);
    } else if (state.phase === 'pegging') {
      const goButton = this.createControlButton('Call Go', () => this.performGo());
      goButton.setPosition(this.scale.width / 2, controlsY);
      this.setButtonEnabled(goButton, this.canRequestGo(state));
      this.actionLayer.add(goButton);
    } else if (state.phase === 'resolution') {
      const resolveButton = this.createControlButton('Resolve Round', () => this.performResolve());
      resolveButton.setPosition(this.scale.width / 2, controlsY);
      this.setButtonEnabled(resolveButton, this.mode !== 'online' || this.canAct(this.localSeat));
      this.actionLayer.add(resolveButton);
    }
  }

  private handleCardInteraction(card: Card): void {
    const state = this.state;
    if (!state) {
      return;
    }
    if (state.phase === 'discard') {
      this.toggleCardSelection(card);
      this.updatePhaseControls(state);
      return;
    }
    if (state.phase === 'pegging') {
      const actingSeat = this.mode === 'hotseat' ? state.turn : this.localSeat;
      if (!this.canAct(actingSeat)) {
        this.pushToast('info', 'Not your turn to play.');
        return;
      }
      if (!this.cardPlayable(state, actingSeat, card)) {
        this.pushToast('error', 'Play exceeds 31.');
        return;
      }
      this.submitPlay(actingSeat, card.id);
    }
  }

  private toggleCardSelection(card: Card): void {
    if (this.selectedCardIds.has(card.id)) {
      this.selectedCardIds.delete(card.id);
    } else {
      if (this.selectedCardIds.size >= 2) {
        const [first] = Array.from(this.selectedCardIds);
        this.selectedCardIds.delete(first);
      }
      this.selectedCardIds.add(card.id);
    }
    if (this.state) {
      this.renderHand(this.state);
    }
  }

  private cardIsPresent(state: GameState, cardId: string): boolean {
    return state.hands.p1.some((card) => card.id === cardId) || state.hands.p2.some((card) => card.id === cardId);
  }

  private submitPlay(seat: PlayerId, cardId: string): void {
    if (this.mode === 'online') {
      if (!this.roomId) {
        return;
      }
      socketClient.play(this.roomId, cardId);
    } else if (this.controller) {
      const outcome = this.controller.play(seat, cardId);
      this.handleCombo(outcome);
    }
  }

  private performDiscard(): void {
    const state = this.state;
    if (!state || this.selectedCardIds.size !== 2) {
      return;
    }
    const targetSeat = this.mode === 'hotseat' ? this.discardSeat : this.localSeat;
    const cardIds = Array.from(this.selectedCardIds);
    if (this.mode === 'online') {
      if (!this.roomId) {
        return;
      }
      socketClient.discard(this.roomId, cardIds);
    } else if (this.controller) {
      this.controller.discard(targetSeat, cardIds);
    }
    this.selectedCardIds.clear();
  }

  private performCut(): void {
    if (this.mode === 'online') {
      if (this.roomId) {
        socketClient.cut(this.roomId);
      }
    } else if (this.controller) {
      this.controller.cut();
    }
  }

  private performGo(): void {
    const state = this.state;
    if (!state) {
      return;
    }
    const seat = this.mode === 'hotseat' ? state.turn : this.localSeat;
    if (this.mode === 'online') {
      if (this.roomId) {
        socketClient.declareGo(this.roomId);
      }
    } else if (this.controller) {
      const resolution = this.controller.go(seat);
      this.handleGo(resolution);
    }
  }

  private performResolve(): void {
    if (this.mode === 'online') {
      if (this.roomId) {
        socketClient.resolve(this.roomId);
      }
    } else if (this.controller) {
      const summary = this.controller.resolve();
      this.handleResolution(summary);
    }
  }

  private determineHandSeat(state: GameState): PlayerId {
    if (state.phase === 'discard') {
      return this.mode === 'hotseat' ? this.discardSeat : this.localSeat;
    }
    if (this.mode === 'hotseat') {
      return state.turn;
    }
    return this.localSeat;
  }

  private canAct(seat: PlayerId): boolean {
    if (this.mode === 'online') {
      return this.localSeat === seat;
    }
    if (this.mode === 'bot') {
      return this.localSeat === seat;
    }
    return true;
  }

  private cardPlayable(state: GameState, seat: PlayerId, card: Card): boolean {
    const hand = state.hands[seat];
    if (!hand.some((item) => item.id === card.id)) {
      return false;
    }
    return state.count + card.value <= 31;
  }

  private canRequestGo(state: GameState): boolean {
    const seat = this.mode === 'hotseat' ? state.turn : this.localSeat;
    const hand = state.hands[seat];
    const canPlay = hand.some((card) => card.value + state.count <= 31);
    return !canPlay && this.canAct(seat);
  }

  private pushToast(kind: ToastKind, message: string): void {
    const colorMap: Record<ToastKind, string> = {
      combo: '#22d3ee',
      info: '#e0f2fe',
      error: '#f87171',
      damage: '#fbbf24'
    };
    const toast = this.add.text(this.scale.width / 2, 100 + this.pendingToasts.length * 30, message, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: colorMap[kind],
      backgroundColor: '#020617cc',
      padding: { x: 12, y: 8 }
    });
    toast.setOrigin(0.5, 0.5);
    const tween = this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 20,
      duration: 1400,
      delay: 900,
      onComplete: () => {
        toast.destroy();
        this.pendingToasts = this.pendingToasts.filter((entry) => entry.text !== toast);
      }
    });
    this.pendingToasts.push({ text: toast, timer: tween });
  }

  private createControlButton(label: string, handler: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const background = this.add.rectangle(0, 0, 220, 52, 0x2563eb, 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, 0x38bdf8, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#f8fafc'
    });
    text.setOrigin(0.5, 0.5);
    background.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (background.getData('disabled')) {
        return;
      }
      handler();
    });
    container.add([background, text]);
    container.setData('background', background);
    return container;
  }

  private setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
    const background = button.getData('background') as Phaser.GameObjects.Rectangle | undefined;
    if (!background) {
      return;
    }
    background.setData('disabled', !enabled);
    background.setFillStyle(enabled ? 0x2563eb : 0x1f2937, enabled ? 0.92 : 0.6);
    button.setAlpha(enabled ? 1 : 0.6);
  }

  private createBackground(): void {
    const board = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width - 120, this.scale.height - 160, 0x111c31, 0.95);
    board.setStrokeStyle(4, 0x1d4ed8, 0.8);
    this.boardLayer.add(board);

    const countTrack = this.add.rectangle(this.scale.width / 2, this.scale.height / 2 + 120, 420, 12, 0x1e293b, 0.9);
    countTrack.setStrokeStyle(2, 0x38bdf8, 0.7);
    this.boardLayer.add(countTrack);

    const fifteenTick = this.add.rectangle(this.scale.width / 2 - 80, this.scale.height / 2 + 120, 4, 28, 0xfacc15, 1);
    const thirtyOneTick = this.add.rectangle(this.scale.width / 2 + 140, this.scale.height / 2 + 120, 4, 28, 0xf87171, 1);
    this.boardLayer.add(fifteenTick);
    this.boardLayer.add(thirtyOneTick);
  }

  private createHud(): HudText {
    const hpTextP1 = this.add.text(60, 40, 'P1 HP: 0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#38bdf8'
    });
    const hpTextP2 = this.add.text(this.scale.width - 200, 40, 'P2 HP: 0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#f472b6'
    });
    const shieldP1 = this.add.text(60, 66, 'Shield: 0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: '#cbd5f5'
    });
    const shieldP2 = this.add.text(this.scale.width - 200, 66, 'Shield: 0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      color: '#cbd5f5'
    });
    const countText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 90, 'Count: 0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#f8fafc'
    });
    countText.setOrigin(0.5, 0.5);

    const phaseText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 180, 'Phase: —', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#cbd5f5'
    });
    phaseText.setOrigin(0.5, 0.5);

    const turnText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 150, 'Turn: —', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#38bdf8'
    });
    turnText.setOrigin(0.5, 0.5);

    return {
      hp: { p1: hpTextP1, p2: hpTextP2 },
      shield: { p1: shieldP1, p2: shieldP2 },
      count: countText,
      phase: phaseText,
      turn: turnText
    };
  }

  private describePhase(state: GameState): string {
    switch (state.phase) {
      case 'discard':
        return 'Discard to crib';
      case 'cut':
        return 'Cut the starter';
      case 'pegging':
        return `Pegging — Count ${state.count}`;
      case 'resolution':
        return 'Scoring hands';
      case 'deal':
        return 'Dealing next round';
      case 'results':
        return 'Match over';
      default:
        return `Phase: ${state.phase}`;
    }
  }

  private formatCard(card: Card): string {
    const rank = this.rankToString(card.rank);
    const suit = SUIT_SYMBOL[card.suit];
    return `${rank}${suit}`;
  }

  private rankToString(rank: number): string {
    if (rank === 1) return 'A';
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    return `${rank}`;
  }

  private cleanup(): void {
    this.unsubscribes.forEach((off) => off());
    this.unsubscribes = [];
    this.pendingToasts.forEach((entry) => {
      entry.timer.remove();
      entry.text.destroy();
    });
    this.pendingToasts = [];
  }

  private returnToMenuWithError(message: string): void {
    this.pushToast('error', message);
    this.scene.start('MenuScene', { returnToLobby: true });
  }
}

class LocalMatchController {
  private state: GameState;

  private onStateHandler: (state: GameState) => void = () => undefined;

  private onComboHandler: (outcome: PlayCardOutcome) => void = () => undefined;

  private onGoHandler: (resolution: GoResolution) => void = () => undefined;

  private onResolutionHandler: (summary: ResolutionSummary) => void = () => undefined;

  constructor(private readonly scene: Phaser.Scene, private readonly mode: MatchMode) {
    this.state = createInitialState();
  }

  start(): void {
    this.emitState();
    this.scheduleBotAction();
  }

  onState(handler: (state: GameState) => void): void {
    this.onStateHandler = handler;
  }

  onCombo(handler: (outcome: PlayCardOutcome) => void): void {
    this.onComboHandler = handler;
  }

  onGo(handler: (resolution: GoResolution) => void): void {
    this.onGoHandler = handler;
  }

  onResolution(handler: (summary: ResolutionSummary) => void): void {
    this.onResolutionHandler = handler;
  }

  play(player: PlayerId, cardId: string): PlayCardOutcome {
    const outcome = playCard(this.state, player, cardId);
    this.emitState();
    this.onComboHandler(outcome);
    if (outcome.reset) {
      this.scheduleBotAction();
    } else {
      this.scheduleBotAction();
    }
    return outcome;
  }

  discard(player: PlayerId, cardIds: string[]): void {
    discardToCrib(this.state, player, cardIds);
    this.emitState();
    this.scheduleBotAction();
  }

  cut(): void {
    cutStarter(this.state);
    this.emitState();
    this.scheduleBotAction();
  }

  go(player: PlayerId): GoResolution {
    const resolution = declareGo(this.state, player);
    this.emitState();
    this.onGoHandler(resolution);
    this.scheduleBotAction();
    return resolution;
  }

  resolve(): ResolutionSummary {
    const summary = resolveRound(this.state);
    this.emitState();
    this.onResolutionHandler(summary);
    this.scheduleBotAction();
    return summary;
  }

  private emitState(): void {
    this.onStateHandler(deepClone(this.state));
  }

  private scheduleBotAction(): void {
    if (this.mode !== 'bot') {
      return;
    }
    const botSeat: PlayerId = 'p2';
    this.scene.time.delayedCall(400, () => {
      this.performBotAction(botSeat);
    });
  }

  private performBotAction(botSeat: PlayerId): void {
    if (this.mode !== 'bot') {
      return;
    }
    const state = this.state;
    if (state.phase === 'discard' && state.hands[botSeat].length > 4) {
      const cardIds = state.hands[botSeat].slice(0, 2).map((card) => card.id);
      this.discard(botSeat, cardIds);
      return;
    }
    if (state.phase === 'cut') {
      this.cut();
      return;
    }
    if (state.phase === 'pegging' && state.turn === botSeat) {
      const playable = state.hands[botSeat].find((card) => card.value + state.count <= 31);
      if (playable) {
        this.play(botSeat, playable.id);
        return;
      }
      this.go(botSeat);
      return;
    }
    if (state.phase === 'resolution') {
      this.resolve();
    }
  }
}
