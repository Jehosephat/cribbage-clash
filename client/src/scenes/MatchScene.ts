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
import CountMeterView from '../../ui/CountMeterView';
import HandView from '../../ui/HandView';
import HPBar from '../../ui/HPBar';
import PileView from '../../ui/PileView';
import ShieldOverlay from '../../ui/ShieldOverlay';
import Toast, { ToastKind } from '../../ui/Toast';
import {
  getAccessibilitySettings,
  onAccessibilitySettingsChange
} from '../settings/accessibility';
import type { AccessibilitySettings } from '../settings/types';

export interface MatchSceneData {
  mode: 'hotseat' | 'bot' | 'online';
  localSeat?: PlayerId;
  seat?: PlayerId;
  playerName?: string;
  roomId?: string;
}

type MatchMode = MatchSceneData['mode'];

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

  private boardLayer!: Phaser.GameObjects.Container;

  private pileLayer!: Phaser.GameObjects.Container;

  private handLayer!: Phaser.GameObjects.Container;

  private actionLayer!: Phaser.GameObjects.Container;

  private statusBanner!: Phaser.GameObjects.Text;

  private turnIndicator!: Phaser.GameObjects.Text;

  private sceneBackground?: Phaser.GameObjects.Rectangle;

  private boardBackground?: Phaser.GameObjects.Rectangle;

  private hpBars!: Record<PlayerId, HPBar>;

  private shieldOverlays!: Record<PlayerId, ShieldOverlay>;

  private countMeter!: CountMeterView;

  private pileView!: PileView;

  private handView!: HandView;

  private toastContainer!: Phaser.GameObjects.Container;

  private activeToasts: Toast[] = [];

  private selectedCardIds = new Set<string>();

  private unsubscribes: Array<() => void> = [];

  private discardSeat: PlayerId = 'p1';

  private pendingSummary?: ResolutionSummary;

  private accessibility: AccessibilitySettings = getAccessibilitySettings();

  private accessibilityUnsubscribe?: () => void;

  private lastShields: Record<PlayerId, number> = { p1: 0, p2: 0 };

  private maxHp = 61;

  constructor() {
    super('MatchScene');
  }

  init(data: MatchSceneData): void {
    this.mode = data.mode;
    this.localSeat = data.localSeat ?? data.seat ?? 'p1';
    this.networkSeat = data.seat;
    this.roomId = data.roomId;
    this.playerName = data.playerName;
  }

  create(): void {
    this.accessibility = getAccessibilitySettings();
    const backgroundColor = this.accessibility.highContrast ? 0x000000 : 0x0b1120;
    this.cameras.main.setBackgroundColor(backgroundColor);
    this.sceneBackground = this.add.rectangle(0, 0, this.scale.width, this.scale.height, backgroundColor).setOrigin(0, 0);

    this.boardLayer = this.add.container(0, 0);
    this.pileLayer = this.add.container(0, 0);
    this.handLayer = this.add.container(0, 0);
    this.actionLayer = this.add.container(0, 0);
    this.toastContainer = this.add.container(0, 0);
    this.toastContainer.setDepth(1000);

    this.createBackground();
    this.buildHud();
    this.statusBanner.setText('Preparing match…');

    if (this.mode === 'online') {
      this.setupNetworkBindings();
      if (!this.roomId) {
        this.returnToMenuWithError('Missing room identifier for online match.');
        return;
      }
    } else {
      this.setupLocalMatch();
    }

    this.accessibilityUnsubscribe = onAccessibilitySettingsChange((settings) => {
      this.accessibility = settings;
      this.applyAccessibilitySettings();
      if (this.state) {
        this.renderPile(this.state);
        this.renderHand(this.state);
        this.updateHud(this.state);
        this.updatePhaseControls(this.state);
      }
    });

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
      outcome.combos.forEach((combo) => {
        const message = this.describeComboToast(combo);
        if (message) {
          this.pushToast('combo', message);
        }
      });
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
    this.maxHp = Math.max(this.maxHp, state.hp.p1, state.hp.p2);
    this.hpBars.p1.setHp(state.hp.p1, this.maxHp);
    this.hpBars.p2.setHp(state.hp.p2, this.maxHp);
    this.shieldOverlays.p1.setShield(state.shield.p1, this.lastShields.p1);
    this.shieldOverlays.p2.setShield(state.shield.p2, this.lastShields.p2);
    this.lastShields = { p1: state.shield.p1, p2: state.shield.p2 };
    this.countMeter.setCount(state.count);
    this.turnIndicator.setText(`Turn: ${state.turn.toUpperCase()}`);
  }

  private renderPile(state: GameState): void {
    this.pileView.setEntries(state.pile);
  }

  private renderHand(state: GameState): void {
    const seat = this.determineHandSeat(state);
    const hand = state.hands[seat];
    const phase: 'discard' | 'pegging' | 'other' =
      state.phase === 'discard' ? 'discard' : state.phase === 'pegging' ? 'pegging' : 'other';

    let canAct = this.canAct(seat);
    if (phase === 'discard') {
      if (this.mode === 'hotseat') {
        canAct = canAct && seat === this.discardSeat;
      }
      canAct = canAct && state.hands[seat].length > 4;
    } else if (phase === 'pegging') {
      canAct = canAct && state.turn === seat;
    } else {
      canAct = canAct && seat === (this.mode === 'hotseat' ? seat : this.localSeat);
    }

    this.handView.setHand({
      cards: hand,
      selectedIds: this.selectedCardIds,
      playable: (card) => this.cardPlayable(state, seat, card),
      canAct,
      phase,
      settings: this.accessibility
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
    const toast = new Toast(this, this.scale.width / 2, 0, {
      kind,
      message,
      settings: this.accessibility,
      duration: kind === 'combo' ? 2600 : 2000
    });
    toast.setData('kind', kind);
    this.add.existing(toast);
    this.toastContainer.add(toast);
    this.activeToasts.push(toast);
    this.layoutToasts();
    toast.play(() => {
      this.activeToasts = this.activeToasts.filter((entry) => entry !== toast);
      this.layoutToasts();
    });
  }

  private layoutToasts(): void {
    this.activeToasts.forEach((toast, index) => {
      toast.setPosition(this.scale.width / 2, 120 + index * 64);
    });
  }

  private describeComboToast(combo: ComboEvent): string {
    const bonus = combo.damage > 0 ? ` +${combo.damage} dmg` : '';
    switch (combo.kind) {
      case 'fifteen':
        return `FIFTEEN!${bonus}`;
      case 'thirtyone':
        return `THIRTY-ONE!${bonus}`;
      case 'pair':
        return `PAIR!${bonus}`;
      case 'pair3':
        return `TRIPLE!${bonus}`;
      case 'pair4':
        return `QUAD!${bonus}`;
      case 'run':
        return `RUN x${combo.length ?? 0}!${bonus}`;
      default:
        return (combo.kind as string).toUpperCase();
    }
  }

  private createControlButton(label: string, handler: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0);
    const fillColor = this.accessibility.highContrast ? 0xffffff : 0x2563eb;
    const strokeColor = this.accessibility.highContrast ? 0xffffff : 0x38bdf8;
    const background = this.add.rectangle(0, 0, 220, 52, fillColor, this.accessibility.highContrast ? 1 : 0.92);
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(2, strokeColor, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.getFontSize(20),
      fontStyle: 'bold',
      color: this.accessibility.highContrast ? '#000000' : '#f8fafc'
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
    const baseFill = this.accessibility.highContrast ? 0xffffff : 0x2563eb;
    const disabledFill = this.accessibility.highContrast ? 0x4b5563 : 0x1f2937;
    background.setFillStyle(enabled ? baseFill : disabledFill, enabled ? (this.accessibility.highContrast ? 1 : 0.92) : 0.6);
    button.setAlpha(enabled ? 1 : 0.6);
  }

  private applyAccessibilitySettings(): void {
    const backgroundColor = this.accessibility.highContrast ? 0x000000 : 0x0b1120;
    this.cameras.main.setBackgroundColor(backgroundColor);
    this.sceneBackground?.setFillStyle(backgroundColor, 1);
    const boardFill = this.accessibility.highContrast ? 0x020617 : 0x111c31;
    const boardStroke = this.accessibility.highContrast ? 0xffffff : 0x1d4ed8;
    this.boardBackground?.setFillStyle(boardFill, this.accessibility.highContrast ? 0.98 : 0.95);
    this.boardBackground?.setStrokeStyle(4, boardStroke, this.accessibility.highContrast ? 1 : 0.85);

    this.statusBanner.setFontSize(this.getFontSize(24));
    this.statusBanner.setColor(this.accessibility.highContrast ? '#ffffff' : '#cbd5f5');
    this.turnIndicator.setFontSize(this.getFontSize(20));
    this.turnIndicator.setColor(this.accessibility.highContrast ? '#e0f2fe' : '#94a3b8');

    this.hpBars.p1.applySettings(this.accessibility);
    this.hpBars.p2.applySettings(this.accessibility);
    this.shieldOverlays.p1.applySettings(this.accessibility);
    this.shieldOverlays.p2.applySettings(this.accessibility);
    this.countMeter.applySettings(this.accessibility);
    this.pileView.setSettings(this.accessibility);
    if (this.state) {
      this.pileView.setEntries(this.state.pile);
    }
    this.activeToasts.forEach((toast) => {
      const toastKind = (toast.getData('kind') as ToastKind) ?? 'info';
      toast.applySettings(this.accessibility, toastKind);
    });
  }

  private getFontSize(base: number): number {
    return Math.round(base * (this.accessibility.largeText ? 1.25 : 1));
  }

  private createBackground(): void {
    const boardFill = this.accessibility.highContrast ? 0x020617 : 0x111c31;
    const boardStroke = this.accessibility.highContrast ? 0xffffff : 0x1d4ed8;
    const board = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width - 120,
      this.scale.height - 160,
      boardFill,
      this.accessibility.highContrast ? 0.98 : 0.95
    );
    board.setStrokeStyle(4, boardStroke, this.accessibility.highContrast ? 1 : 0.85);
    this.boardLayer.add(board);
    this.boardBackground = board;
  }

  private buildHud(): void {
    this.statusBanner = this.add.text(this.scale.width / 2, 48, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.getFontSize(24),
      fontStyle: 'bold',
      color: '#cbd5f5'
    });
    this.statusBanner.setOrigin(0.5, 0.5);

    this.turnIndicator = this.add.text(this.scale.width / 2, 82, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: this.getFontSize(20),
      color: '#94a3b8'
    });
    this.turnIndicator.setOrigin(0.5, 0.5);
    this.turnIndicator.setText('Turn: —');

    const hpBarP1 = new HPBar(this, 140, 110, {
      width: 260,
      height: 28,
      label: 'Player 1',
      maxHp: this.maxHp,
      align: 'left',
      settings: this.accessibility
    });
    const hpBarP2 = new HPBar(this, this.scale.width - 140, 110, {
      width: 260,
      height: 28,
      label: 'Player 2',
      maxHp: this.maxHp,
      align: 'right',
      settings: this.accessibility
    });
    this.add.existing(hpBarP1);
    this.add.existing(hpBarP2);
    this.boardLayer.add([hpBarP1, hpBarP2]);
    this.hpBars = { p1: hpBarP1, p2: hpBarP2 };

    const shieldP1 = new ShieldOverlay(this, 140, 150, { width: 220, settings: this.accessibility });
    const shieldP2 = new ShieldOverlay(this, this.scale.width - 140, 150, {
      width: 220,
      settings: this.accessibility
    });
    this.add.existing(shieldP1);
    this.add.existing(shieldP2);
    this.boardLayer.add([shieldP1, shieldP2]);
    this.shieldOverlays = { p1: shieldP1, p2: shieldP2 };

    const countMeter = new CountMeterView(this, this.scale.width / 2, this.scale.height / 2 + 120, {
      width: 480,
      height: 18,
      settings: this.accessibility
    });
    this.add.existing(countMeter);
    this.boardLayer.add(countMeter);
    this.countMeter = countMeter;

    const pileView = new PileView(this, this.scale.width / 2, this.scale.height / 2 - 20, {
      settings: this.accessibility
    });
    this.add.existing(pileView);
    this.pileLayer.add(pileView);
    this.pileView = pileView;

    const handView = new HandView(this, this.scale.width / 2, this.scale.height - 140, {
      settings: this.accessibility,
      onCardSelected: (card) => this.handleCardInteraction(card)
    });
    this.add.existing(handView);
    this.handLayer.add(handView);
    this.handView = handView;

    this.applyAccessibilitySettings();
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

  private cleanup(): void {
    this.unsubscribes.forEach((off) => off());
    this.unsubscribes = [];
    this.accessibilityUnsubscribe?.();
    this.accessibilityUnsubscribe = undefined;
    this.activeToasts.forEach((toast) => toast.destroy());
    this.activeToasts = [];
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
