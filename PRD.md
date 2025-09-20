# PRD — **Cribbage Clash (Phaser + TypeScript)**

A fast, web-first, head-to-head card battler that reimagines cribbage as HP combat. Built with **Phaser 3 + TypeScript + Vite**. Deterministic rules engine, crisp UX, small bundle.

---

## 1) Product Overview

**Vision**
Preserve cribbage’s tactical pegging and hand/crib scoring, but translate them into **damage, shields, and tempo**. Quick 5–8 minute matches; easy to learn, deep to master.

**Goals**

* Web-first MVP that plays smoothly on desktop + mobile browsers.
* Deterministic rules module shared by client (for UX) and server (for validation).
* Clear, readable UI that surfaces **Count→31**, pairs, runs, and “Go”.
* Paves the way for ranked, cosmetics, and roguelite modes.

**Platforms**
Chrome/Safari/Edge (desktop + mobile). Optional Electron/Tauri later.

**Audience**
Card game fans; cribbage enjoyers; quick-match battlers.

---

## 2) Core Game Design

### 2.1 Round Structure (unchanged flow, new effects)

1. **Deal**: 6 cards each.
2. **Discard to Crib**: Each discards 2 to dealer’s crib (face-down).
3. **Cut Starter**: Turn up 1 starter card.
4. **Pegging (Volleys)**: Alternate playing cards without exceeding a **Count Meter (0–31)**.
5. **Resolution**: Score **hands + starter**, then **crib**; convert outcomes to **damage/shields/tempo**.
6. **Swap Dealer**; next round.

### 2.2 Combat Mapping (MVP numbers)

**Player HP**: 61 (fast) or 91 (standard).
**Pegging effects**

* **Fifteen (count=15)** → **3 damage**
* **Thirty-One (count=31)** → **6 damage** + apply **Vulnerable(1)** next volley
* **Pairs**: Pair **2 dmg**; Trips **6 dmg**; Quads **12 dmg**
* **Runs (length N)**: **N dmg** (score only the **longest** run formed by the most recent plays)
* **Go / Last Card**: If opponent cannot play ≤31 and says “Go”, the last legal play scores **+1 dmg**, then reset count.

**Resolution effects** (per standard cribbage scoring)

* **15s**: +2 dmg each
* **Pairs**: +2 dmg each
* **Runs**: +run length dmg
* **Flush (4/5)**: **Shield +4/+5** (absorbs future damage this round and next)
* **Nobs (Jack of starter suit)**: Gain **Initiative** (lead next round)

> **Dials**: Fifteen 3→4 dmg; 31 6→7; Flush shield 3/5 instead of 4/5; enable/disable statuses.

### 2.3 Optional Status (toggleable in custom lobbies)

* **Vulnerable(1)**: +1 damage taken until end of next personal play.
* **Stagger(1)**: Max hand size play penalty; or “−1 damage on next effect”.
* **Poison**: 1 dmg end-of-volley (stacks to 3). (Off by default in MVP.)

### 2.4 Suits-as-Elements (post-MVP)

Flavor passives (e.g., Hearts heal 1 on 15s; Diamonds +1 Energy on run; etc.). Off in MVP.

---

## 3) Scope

### 3.1 MVP (ship this)

* **Hotseat** (local 2P) + **vs. Bot** (simple AI).
* **Core rules**: deal, crib, starter, full pegging (legal plays, go/standstill), resolution scoring.
* **Combat mapping** per §2.2.
* **HUD**: HP, Shield, Count Meter, recent-play timeline, combo badges.
* **Animations**: light tweens, shake on 31, shield pulse.
* **Deterministic rules module** shared client/server.
* **Basic online P2P via Socket rooms** (create/join code) with server validation.
* **Seeded RNG** (server authoritative in online).

### 3.2 Out of scope (MVP)

Ranked ladder, cosmetics, loadouts/relics, roguelite, replays.

---

## 4) UX / UI

**Scenes**

* **Boot** → preloads fonts.
* **Title** → Play (Hotseat / vs Bot / Online), Settings.
* **Lobby** (Online only) → Create Room, Join by code.
* **Match** → Core gameplay.
* **Results** → Win/Lose, damage recap.

**Match HUD**

* Top: **HP bars** with **Shield overlay**.
* Center: **Count Meter (0–31)** with tick marks at **15** and **31**; glow on thresholds.
* Center-bottom: **Recent Plays** (last 5–7 cards) to surface runs/pairs.
* Bottom: **Your Hand** (click/tap to play); **Crib icon** shows dealer.
* Toaster badges: **“FIFTEEN!”**, **“THIRTY-ONE!”**, **“PAIR / RUN xN”**, **“GO!”**.
* Accessibility: large fonts, color-safe suit indicators (♥♦=red with icons; ♣♠=dark with icons), high contrast mode toggle.

---

## 5) Technical Architecture

**Client**: Phaser 3, TypeScript, Vite.
**Server (online)**: Node, Socket.IO (or `ws`), Express for health.
**Shared Rules**: Pure TS package (no Phaser), imported on both sides.

**Determinism**

* Server seeds RNG and deals; client receives initial state + seed.
* All **plays** are intents; server validates legality and emits authoritative state.

**Performance budgets**

* Initial JS < **2.5 MB** gzip.
* First interactive < **1.5s** desktop, < **3s** mid-range mobile.

---

## 6) Systems & Data

### 6.1 Data Models (JSON Schemas)

```json
{
  "$id": "Card",
  "type": "object",
  "properties": {
    "id": {"type":"string"},
    "rank": {"type":"integer","minimum":1,"maximum":13},
    "suit": {"enum":["hearts","diamonds","clubs","spades"]},
    "value": {"type":"integer","minimum":1,"maximum":10}
  },
  "required": ["id","rank","suit","value"]
}
```

```json
{
  "$id": "GameState",
  "type": "object",
  "properties": {
    "seed": {"type":"number"},
    "round": {"type":"integer"},
    "dealer": {"enum":["p1","p2"]},
    "count": {"type":"integer"},
    "pile": {"type":"array","items":{"$ref":"Card"}},
    "turn": {"enum":["p1","p2"]},
    "hands": {
      "type":"object",
      "properties": {"p1":{"type":"array","items":{"$ref":"Card"}}, "p2":{"type":"array","items":{"$ref":"Card"}}},
      "required": ["p1","p2"]
    },
    "cribOwner": {"enum":["p1","p2"]},
    "crib": {"type":"array","items":{"$ref":"Card"}},
    "starter": {"anyOf":[{"$ref":"Card"},{"type":"null"}]},
    "hp": {"type":"object","properties":{"p1":{"type":"integer"},"p2":{"type":"integer"}}, "required":["p1","p2"]},
    "shield": {"type":"object","properties":{"p1":{"type":"integer"},"p2":{"type":"integer"}}, "required":["p1","p2"]},
    "phase": {"enum":["deal","discard","cut","pegging","resolution","results"]}
  },
  "required": ["seed","round","dealer","count","pile","turn","hands","cribOwner","crib","hp","shield","phase"]
}
```

```json
{
  "$id": "PlayIntent",
  "type": "object",
  "properties": {
    "roomId": {"type":"string"},
    "player": {"enum":["p1","p2"]},
    "cardId": {"type":"string"}
  },
  "required": ["roomId","player","cardId"]
}
```

```json
{
  "$id": "ComboEvent",
  "type": "object",
  "properties": {
    "kind": {"enum":["fifteen","thirtyone","pair","pair3","pair4","run"]},
    "length": {"type":"integer"},
    "damage": {"type":"integer"}
  },
  "required": ["kind","damage"]
}
```

### 6.2 Socket Protocol (authoritative server)

* `join({roomId, name})` → `joined({roomId, seat})`
* `start({roomId})` → `state(GameState)` (server deals/sets dealer)
* `discard({roomId, cardIds:[2]})` → `state(...)`
* `cut({roomId})` → `state(...)`
* `play({roomId, cardId})` → `combo(ComboEvent[])`, `state(...)`
* `go({roomId})` → `state(...)`
* `resolve({roomId})` → `state(...)`
* `error({code,msg})`

### 6.3 Rules Engine (pure TS)

**CountMeter**

* `count` (0–31), `canPlay(value)`, `add(value)`, `reset()`.

**ComboDetector (pegging)**

* Input: ordered pile since last reset.
* **Pairs**: only contiguous same ranks (backwards).
* **Runs**: scan last K=7..3; must be unique ranks; score **longest only**.
* **Fifteen/Thirty-one**: check new count exactly.
* **Go**: when both players can’t play, last legal player +1 dmg; reset.

**ResolutionScorer**

* Enumerate all 15s (subset sums) → +2 dmg each.
* Pairs/Trips/Quads → +2/+6/+12.
* Runs: all distinct combinations (standard cribbage run scoring).
* Flush: 4 in hand = +4 shield; 5 incl. starter = +5 shield.
* Nobs: jack matching starter suit → Initiative next round.

**Damage Application**

* Apply to **Shield** first, remainder to **HP**.
* Log `DamageEvent` for replay.

**RNG**

* Fisher–Yates shuffle with seed (e.g., mulberry32); server is source of truth.

### 6.4 Turn Manager

* Enforces phase transitions: `deal→discard→cut→pegging→resolution→deal`.
* Legal move checks (cannot exceed 31; must play if able; otherwise declare Go).

### 6.5 AI (MVP)

* **Greedy pegging**: prefer legal plays yielding highest immediate damage (31>15>pair>run>other), break ties minimizing opponent run/pair likelihood (simple heuristic using seen cards).
* **Discard to crib**: If own crib, keep synergy (pairs, runs); else toss low synergy.

---

## 7) UI/Scene Implementation Plan (Phaser)

**Scenes**

* `BootScene` → loads webfont (optional).
* `MenuScene` → buttons to game modes.
* `LobbyScene` → room create/join.
* `MatchScene`

  * Layers: Background, Board, HUD, Hand.
  * Components:

    * `HandView` (card sprites with hit areas)
    * `CountMeterView` (bar + ticks at 15/31)
    * `PileView` (recent cards; max 7)
    * `HPBar(p1|p2)` with shield overlay
    * `Toast/Badge` system
* `ResultsScene`

**Input**

* Click/tap card → emits `play` intent if legal; otherwise shake + tooltip.

**Animations**

* Card fly-in/out (200–250ms), meter pulse on 15/31, HP damage shake, shield absorb fade.

---

## 8) Test Plan

**Unit Tests (rules module)**

* Count: cannot exceed 31; reset on 31; go logic.
* Pairs: contiguous only; pair/trips/quads scoring vectors.
* Runs: longest-only in pegging; standard multi-run scoring in resolution.
* 15s: subset enumeration correctness on known hands.
* Flush & Nobs.
* Damage application with shield overflow.

**Golden Vectors**

* Pegging pile: `5,10` → fifteen (3 dmg).
* Pegging pile: `K,5,6` (values 10,5,6) → 31 (6 dmg).
* Pegging pile: `4,5,6` in any order → run3 (3 dmg).
* Resolution hand: `5♥,5♣,5♦,J♠,starter=5♠` → pairs/trips/quads scoring = 12 dmg.
* Flush: `A♣,5♣,9♣,K♣,starter=Q♦` → +4 shield.

**Integration**

* Full round hotseat; crib ownership alternation; initiative via Nobs.

**Manual QA Checklist**

* Mobile touch targets ≥ 44px.
* Orientation change preserves layout.
* Network loss → reconnection and state resync.

---

## 9) Analytics (optional in MVP on dev builds)

* `match_start`, `match_end` (duration, mode).
* `pegging_combo` (kind, length, damage).
* `resolution_score` (totals).
* `illegal_play_attempt`.

---

## 10) Risks & Mitigations

* **Rules complexity** → Strict unit tests + golden vectors; single source of truth rules module.
* **Desync online** → Server authoritative; client only renders after server ack.
* **Mobile perf** → Vector/bitmap text; avoid heavy shaders; cap particles; sprite pooling.

---

## 11) Roadmap

**MVP (2–3 weeks)**

* Rules engine + unit tests.
* Hotseat + vs Bot.
* Online rooms (basic).
* Core HUD & effects.

**Post-MVP (3–6 weeks)**

* Ranked queues, ELO.
* Cosmetics & emotes.
* Suit elements & statuses.
* Tutorials & challenges.

**Future**

* Roguelite mode, relics.
* Replays; spectate.

---

## 12) Acceptance Criteria (MVP)

* ✅ Complete round loop with dealer swap and initiative from Nobs.
* ✅ Pegging enforces ≤31, Go/standstill, and auto reset on 31 or standstill.
* ✅ Damage mapping works with shield overflow and HP depletion → results.
* ✅ Crib scoring correctly uses starter; dealer’s crib resolves after both hands.
* ✅ Hotseat and vs Bot fully playable; Online rooms allow 1v1 with server validation.
* ✅ 95%+ unit test coverage of rules functions; golden vectors pass.
* ✅ Initial bundle ≤ 2.5 MB gzip; mobile Safari playable at 60fps on mid devices.

---

## 13) Implementation Notes / Pseudocode

**Pegging play (server)**

```ts
function playCard(state: GameState, player: Seat, cardId: string) {
  assert(state.phase === 'pegging' && state.turn === player)
  const card = removeFromHand(state.hands[player], cardId)
  assert(state.count + card.value <= 31)

  state.pile.push(card)
  state.count += card.value

  const combos = detectPeggingCombos(state.pile, state.count) // fifteen/31/pairs/runs
  const dmg = combos.reduce((a,c)=>a + c.damage, 0)
  applyDamage(state, opponent(player), dmg)

  if (state.count === 31) resetPegging(state)
  else if (!hasLegalPlay(opponent(player), state)) {
    // opponent says 'Go'
    applyDamage(state, player, 1) // last card bonus
    resetPegging(state)
  } else {
    state.turn = opponent(player)
  }
}
```

**Resolution (server)**

```ts
function resolution(state: GameState) {
  const hands = ['p1','p2'] as const
  for (const seat of hands) {
    const dmg = scoreHand(state.hands[seat], state.starter) // cribbage points → damage
    applyDamage(state, opponent(seat), dmg)
    const shield = flushShield(state.hands[seat], state.starter)
    state.shield[seat] += shield
    if (hasNobs(state.hands[seat], state.starter)) state.initiative = seat
  }
  // Crib last
  const cribDmg = scoreHand(state.crib, state.starter)
  applyDamage(state, opponent(state.cribOwner), cribDmg)
  const cribShield = flushShield(state.crib, state.starter)
  state.shield[state.cribOwner] += cribShield
}
```

---

## 14) File/Module Plan

```
/rules (pure TS)
  count.ts
  combos_pegging.ts
  score_resolution.ts
  deck.ts (seeded shuffle)
  types.ts
  tests/*.spec.ts

/client (Phaser)
  scenes/Boot.ts
  scenes/Menu.ts
  scenes/Lobby.ts
  scenes/Match.ts
  ui/HPBar.ts, CountMeterView.ts, HandView.ts, Toast.ts
  net/client.ts (socket wrapper)
  main.ts

/server (Node)
  index.ts (rooms, state, validation)
  net/schema.ts (zod/io-ts validation optional)
```

---

If you want, I can turn this PRD into a tracked GitHub project board (cards per module), or generate the **rules module + unit tests** first so you’ve got a rock-solid core to build the Phaser UI on.
