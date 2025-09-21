export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type PlayerId = 'p1' | 'p2';
export type GamePhase =
  | 'deal'
  | 'discard'
  | 'cut'
  | 'pegging'
  | 'resolution'
  | 'results';

export interface Card {
  id: string;
  rank: number;
  suit: Suit;
  value: number;
}

export interface PlayerHands {
  p1: Card[];
  p2: Card[];
}

export interface HitPointTrack {
  p1: number;
  p2: number;
}

export interface GameState {
  seed: number;
  round: number;
  dealer: PlayerId;
  count: number;
  pile: Card[];
  turn: PlayerId;
  hands: PlayerHands;
  cribOwner: PlayerId;
  crib: Card[];
  starter: Card | null;
  hp: HitPointTrack;
  shield: HitPointTrack;
  phase: GamePhase;
}

export interface PlayIntent {
  roomId: string;
  player: PlayerId;
  cardId: string;
}

export type ComboKind =
  | 'fifteen'
  | 'thirtyone'
  | 'pair'
  | 'pair3'
  | 'pair4'
  | 'run';

export interface ComboEvent {
  kind: ComboKind;
  damage: number;
  length?: number;
}

export type DamageSource = 'pegging' | 'resolution' | 'ability' | 'status';

export interface DamageEvent {
  target: PlayerId;
  amount: number;
  absorbed: number;
  hpDamage: number;
  shieldBefore: number;
  hpBefore: number;
  shieldAfter: number;
  hpAfter: number;
  source: DamageSource;
  combo?: ComboEvent;
  description?: string;
  timestamp: number;
}

export interface ResolutionDetail {
  kind: 'fifteen' | 'pair' | 'pair3' | 'pair4' | 'run' | 'flush' | 'nobs';
  points: number;
  cards: Card[];
  length?: number;
}

export interface ResolutionResult {
  damage: number;
  shield: number;
  initiative: boolean;
  details: ResolutionDetail[];
}

export interface PeggingPileEntry {
  card: Card;
  player: PlayerId;
}

export interface GoResolution {
  awardedTo?: PlayerId;
}
