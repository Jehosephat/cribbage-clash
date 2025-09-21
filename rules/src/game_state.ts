import {
  Card,
  ComboEvent,
  ComboLogEntry,
  DamageEvent,
  GamePhase,
  GameState,
  GoResolution,
  PeggingPileEntry,
  PeggingTracker,
  PlayerHands,
  PlayerId,
  PlayCardOutcome,
  ResolutionResult,
  ResolutionSummary
} from './types';
import { shuffleDeck } from './deck';
import { detectPeggingCombos } from './combos_pegging';
import { applyDamage } from './damage';
import { scoreHand } from './score_resolution';
import {
  CRIB_DISCARD_COUNT,
  DEFAULT_HP,
  GO_BONUS_DAMAGE,
  STANDARD_HAND_SIZE
} from './constants';

export interface CreateGameStateOptions {
  seed?: number;
  dealer?: PlayerId;
  hpTotal?: number;
  deck?: Card[];
}

export function createGameState(options: CreateGameStateOptions = {}): GameState {
  const seed = options.seed ?? Date.now();
  const dealer = options.dealer ?? 'p1';
  const hpTotal = options.hpTotal ?? DEFAULT_HP;
  const startingDeck = options.deck ? cloneCards(options.deck) : shuffleDeck({ seed });
  const { hands, remaining } = dealHands(startingDeck);

  const state: GameState = {
    seed,
    round: 1,
    dealer,
    count: 0,
    pile: [],
    turn: otherPlayer(dealer),
    hands,
    cribOwner: dealer,
    crib: [],
    starter: null,
    deck: remaining,
    hp: { p1: hpTotal, p2: hpTotal },
    shield: { p1: 0, p2: 0 },
    damageLog: [],
    comboLog: [],
    initiative: null,
    pegging: createPeggingTracker(),
    phase: 'discard'
  };

  return state;
}

export function discardToCrib(state: GameState, player: PlayerId, cardIds: string[]): void {
  ensurePhase(state, 'discard');
  if (cardIds.length === 0) {
    throw new Error('Must discard at least one card');
  }
  const hand = state.hands[player];
  if (hand.length - cardIds.length < STANDARD_HAND_SIZE - CRIB_DISCARD_COUNT) {
    throw new Error('Cannot discard more than allowed');
  }

  for (const cardId of cardIds) {
    const card = removeFromHand(hand, cardId);
    state.crib.push(card);
  }

  if (state.hands.p1.length === STANDARD_HAND_SIZE - CRIB_DISCARD_COUNT &&
      state.hands.p2.length === STANDARD_HAND_SIZE - CRIB_DISCARD_COUNT) {
    state.phase = 'cut';
  }
}

export function cutStarter(state: GameState): Card {
  ensurePhase(state, 'cut');
  if (state.deck.length === 0) {
    throw new Error('Deck is empty');
  }
  const starter = state.deck.shift()!;
  state.starter = starter;
  state.phase = 'pegging';
  state.count = 0;
  state.pile = [];
  state.pegging = createPeggingTracker();
  return starter;
}

export function playCard(state: GameState, player: PlayerId, cardId: string): PlayCardOutcome {
  ensurePhase(state, 'pegging');
  if (state.turn !== player) {
    throw new Error('Not this player\'s turn');
  }
  const hand = state.hands[player];
  const index = hand.findIndex((item) => item.id === cardId);
  if (index === -1) {
    throw new Error('Card not found in hand');
  }
  const card = hand[index];
  if (state.count + card.value > 31) {
    throw new Error('Play exceeds 31');
  }
  hand.splice(index, 1);

  state.count += card.value;
  const entry: PeggingPileEntry = { card, player };
  state.pile.push(entry);
  state.pegging.lastPlayedBy = player;
  state.pegging.passed.p1 = false;
  state.pegging.passed.p2 = false;

  const combos = detectPeggingCombos(state.pile, state.count);
  const damageEvent = applyComboDamage(state, otherPlayer(player), combos);
  logPeggingCombos(state, player, combos);
  const newCount = state.count;

  let reset = false;
  if (newCount === 31) {
    reset = true;
    resetPegging(state);
    setNextTurnAfterReset(state, otherPlayer(player));
  } else {
    state.turn = otherPlayer(player);
  }

  maybeAdvanceToResolution(state);

  return {
    player,
    card,
    count: newCount,
    combos,
    damageEvent,
    reset
  };
}

export function declareGo(state: GameState, player: PlayerId): GoResolution {
  ensurePhase(state, 'pegging');
  if (state.turn !== player) {
    throw new Error('Not this player\'s turn');
  }
  if (hasLegalPlay(state.hands[player], state.count)) {
    throw new Error('Player has a legal play');
  }

  state.pegging.passed[player] = true;
  const opponent = otherPlayer(player);
  state.turn = opponent;

  if (state.pegging.passed[opponent]) {
    const awardedTo = state.pegging.lastPlayedBy ?? opponent;
    const damageEvent = awardGoBonus(state, awardedTo);
    resetPegging(state);
    setNextTurnAfterReset(state, otherPlayer(awardedTo));
    maybeAdvanceToResolution(state);
    return { awardedTo, damageEvent, reset: true };
  }

  return { reset: false };
}

export function resolveRound(state: GameState): ResolutionSummary {
  ensurePhase(state, 'resolution');
  if (!state.starter) {
    throw new Error('Starter has not been cut');
  }

  const handResults: Record<PlayerId, ResolutionResult> = {
    p1: emptyResolutionResult(),
    p2: emptyResolutionResult()
  };
  const damageEvents: DamageEvent[] = [];
  const order: PlayerId[] = state.dealer === 'p1' ? ['p2', 'p1'] : ['p1', 'p2'];

  for (const seat of order) {
    const result = scoreHand({ hand: state.hands[seat], starter: state.starter });
    handResults[seat] = result;
    if (result.damage > 0) {
      const damageEvent = applyDamage(state.hp, state.shield, otherPlayer(seat), result.damage, {
        source: 'resolution',
        description: `Resolution damage for ${seat}`
      });
      damageEvents.push(damageEvent);
      state.damageLog.push(damageEvent);
    }
    if (result.shield > 0) {
      state.shield[seat] += result.shield;
    }
    if (result.initiative) {
      state.initiative = seat;
    }
  }

  let cribResult: ResolutionResult | null = null;
  if (state.crib.length > 0) {
    const result = scoreHand({ hand: state.crib, starter: state.starter, isCrib: true });
    cribResult = result;
    if (result.damage > 0) {
      const damageEvent = applyDamage(state.hp, state.shield, otherPlayer(state.cribOwner), result.damage, {
        source: 'resolution',
        description: 'Crib damage'
      });
      damageEvents.push(damageEvent);
      state.damageLog.push(damageEvent);
    }
    if (result.shield > 0) {
      state.shield[state.cribOwner] += result.shield;
    }
    if (result.initiative) {
      state.initiative = state.cribOwner;
    }
  }

  if (state.hp.p1 === 0 || state.hp.p2 === 0) {
    state.phase = 'results';
    return { handResults, cribResult, damageEvents };
  }

  startNextRound(state);
  return { handResults, cribResult, damageEvents };
}

export function startNextRound(state: GameState): void {
  state.round += 1;
  state.dealer = otherPlayer(state.dealer);
  state.cribOwner = state.dealer;
  state.phase = 'deal';

  const seed = state.seed + state.round - 1;
  const deck = shuffleDeck({ seed });
  const { hands, remaining } = dealHands(deck);

  state.hands = hands;
  state.deck = remaining;
  state.crib = [];
  state.starter = null;
  state.count = 0;
  state.pile = [];
  state.pegging = createPeggingTracker();
  state.phase = 'discard';

  const lead = state.initiative ?? otherPlayer(state.dealer);
  state.turn = lead;
  state.initiative = null;
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

function dealHands(deck: Card[]): { hands: PlayerHands; remaining: Card[] } {
  const p1 = deck.slice(0, STANDARD_HAND_SIZE);
  const p2 = deck.slice(STANDARD_HAND_SIZE, STANDARD_HAND_SIZE * 2);
  const remaining = deck.slice(STANDARD_HAND_SIZE * 2);
  return {
    hands: { p1, p2 },
    remaining
  };
}

function createPeggingTracker(): PeggingTracker {
  return {
    passed: { p1: false, p2: false },
    lastPlayedBy: null
  };
}

function ensurePhase(state: GameState, phase: GamePhase): void {
  if (state.phase !== phase) {
    throw new Error(`Expected phase ${phase} but was ${state.phase}`);
  }
}

function removeFromHand(hand: Card[], cardId: string): Card {
  const index = hand.findIndex((card) => card.id === cardId);
  if (index === -1) {
    throw new Error('Card not found in hand');
  }
  return hand.splice(index, 1)[0];
}

function hasLegalPlay(hand: Card[], count: number): boolean {
  return hand.some((card) => card.value + count <= 31);
}

function applyComboDamage(state: GameState, target: PlayerId, combos: ComboEvent[]): DamageEvent | undefined {
  const total = combos.reduce((sum, combo) => sum + combo.damage, 0);
  if (total <= 0) {
    return undefined;
  }
  const description = describeCombos(combos);
  const damageEvent = applyDamage(state.hp, state.shield, target, total, {
    source: 'pegging',
    description
  });
  state.damageLog.push(damageEvent);
  return damageEvent;
}

function describeCombos(combos: ComboEvent[]): string {
  return combos
    .map((combo) =>
      combo.length ? `${combo.kind}(${combo.length})` : combo.kind
    )
    .join(', ');
}

function logPeggingCombos(state: GameState, player: PlayerId, combos: ComboEvent[]): void {
  if (combos.length === 0) {
    return;
  }
  const entry: ComboLogEntry = {
    player,
    combos: combos.map((combo) => ({ ...combo })),
    count: state.count,
    pile: state.pile.map((item) => ({ card: { ...item.card }, player: item.player })),
    round: state.round,
    phase: state.phase,
    timestamp: Date.now()
  };
  state.comboLog.push(entry);
}

function resetPegging(state: GameState): void {
  state.count = 0;
  state.pile = [];
  state.pegging = createPeggingTracker();
}

function setNextTurnAfterReset(state: GameState, preferred: PlayerId): void {
  const opponent = otherPlayer(preferred);
  if (state.hands[preferred].length > 0) {
    state.turn = preferred;
  } else if (state.hands[opponent].length > 0) {
    state.turn = opponent;
  } else {
    state.turn = preferred;
  }
}

function maybeAdvanceToResolution(state: GameState): void {
  if (state.hands.p1.length === 0 && state.hands.p2.length === 0 && state.count === 0) {
    state.phase = 'resolution';
    state.turn = state.dealer;
  }
}

function awardGoBonus(state: GameState, awardedTo: PlayerId): DamageEvent | undefined {
  if (GO_BONUS_DAMAGE <= 0) {
    return undefined;
  }
  const target = otherPlayer(awardedTo);
  const damageEvent = applyDamage(state.hp, state.shield, target, GO_BONUS_DAMAGE, {
    source: 'pegging',
    description: 'Go bonus'
  });
  state.damageLog.push(damageEvent);
  return damageEvent;
}

function emptyResolutionResult(): ResolutionResult {
  return { damage: 0, shield: 0, initiative: false, details: [] };
}

function cloneCards(cards: Card[]): Card[] {
  return cards.map((card) => ({ ...card }));
}
