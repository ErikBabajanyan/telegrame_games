# Next Game Analysis — TON Casino

## Current State

| Game | Type | Complexity | Session | Edge |
|------|------|-----------|---------|------|
| Dice | Instant / Stateless | Low | Single request | 1.5% |
| HiLo | Multi-round / Stateful | Medium | Redis session | 2.5% |
| Mines | Multi-round / Provably fair | High | Redis session + seeds | 2.0% |

**Architecture already supports:** WebSocket pub/sub, Redis sessions, provably fair seeds, BullMQ queues, real-time luck factor, Prometheus metrics.

---

## Candidates Ranked

### 1. CRASH (Recommended First)

**Why first:** Highest engagement game in crypto casinos. Only game on the list that is **multiplayer/social** — players bet together on the same round. This drives retention harder than any solo game. You already have WebSocket infra for it.

**How it works:**
- A multiplier starts at 1.00x and climbs continuously (1.01, 1.05, 1.20, 2.00, 5.00, ...).
- Players cash out at any time — if they cash out before the crash, they win at that multiplier.
- If the multiplier crashes before they cash out, they lose their bet.
- The crash point is pre-determined (provably fair) but hidden.

**Architecture fit:**

| Aspect | Approach |
|--------|----------|
| Game loop | Server-driven tick (every 100ms) broadcast via WebSocket |
| State | Single shared round in Redis (`crash:current`) |
| Crash point | `crashPoint = (HOUSE_EDGE / random) * 100` from HMAC chain |
| Provably fair | SHA-256 hash chain — reveal previous seed after each round |
| Bets | Players join during "betting phase" (5-10s), then round starts |
| Cash out | WebSocket message → atomic Redis credit at current multiplier |
| History | Last 20 crash points shown as colored bubbles (social proof) |

**Effort:** ~3-5 days. Reuses: Lua balance scripts, WebSocket pub/sub, provably fair pattern, metrics, luck factor.

**New infra needed:**
- Game loop ticker (setInterval server-side, 100ms broadcasts)
- Shared round state (not per-user sessions)
- Betting phase → flying phase → crashed state machine
- Round history (lightweight — just crash points + player results)

**Revenue potential:** Highest. Players bet more aggressively due to social pressure and "I should have held longer" psychology.

---

### 2. COIN FLIP (Recommended Second)

**Why second:** Dead simple to build (~1 day). Fills the "ultra-casual" slot. Good palette cleanser between complex games. Great for new users who want to understand the platform with zero learning curve.

**How it works:**
- Pick heads or tails, bet, flip, 1.96x payout (2% edge).
- That's it.

**Architecture fit:**

| Aspect | Approach |
|--------|----------|
| Model | Identical to Dice — stateless, single request |
| Engine | `randomInt(0, 1_000_000) / 1_000_000 < 0.5 / luckFactor` |
| Provably fair | Same HMAC pattern as mines |
| Frontend | Coin flip animation (CSS 3D transform, ~100 LOC) |

**Effort:** ~1 day. Literally copy-paste Dice service, change the math.

---

### 3. ROULETTE (Third)

**Why third:** Classic, high recognition. Moderately complex due to multiple bet types (single number, red/black, odd/even, rows, dozens).

**How it works:**
- European roulette (0-36, single zero = 2.7% house edge).
- Players place bets on a board (numbers, colors, groups).
- Ball spins, lands on number, all matching bets pay out.

**Architecture fit:**

| Aspect | Approach |
|--------|----------|
| Model | Stateless per spin (like dice) OR multiplayer timed rounds (like crash) |
| Bet types | Array of `{ type, value, amount }` — validate against payout table |
| Edge | Built into payout ratios (36:1 on 37 numbers) |
| Frontend | Most complex — animated wheel + bet board |

**Effort:** ~5-7 days (mostly frontend animation).

**Two modes possible:**
- **Solo mode** (simpler): Player spins whenever they want, instant result. Ship fast.
- **Multiplayer mode** (better): Timed rounds like crash, all players bet on same spin. More engaging but more work.

---

### 4. SLOTS

**Why later:** Visually impressive but fundamentally a dice game with a skin. High frontend effort (reel animations, symbol design), low gameplay innovation. Better ROI to ship Crash first.

**Architecture:** Stateless. Weighted random from a paytable. Each spin = one API call. ~3-4 days (mostly animation).

---

### 5. BLACKJACK

**Why last:** Most complex game logic (splits, doubles, insurance, dealer AI). Multi-round stateful. Requires careful edge calculation. Lowest house edge (~0.5% with basic strategy), meaning less revenue per bet.

**Architecture:** Stateful like HiLo but with branching decisions. ~7-10 days. Save for later when you have a larger user base that expects table games.

---

## Recommended Build Order

```
1. Crash       ~3-5 days   ← Highest impact, social/multiplayer, drives retention
2. Coin Flip   ~1 day      ← Quick win, fills roster, new user funnel
3. Roulette    ~5-7 days   ← Classic recognition, multiple bet types
4. Slots       ~3-4 days   ← Visual impact, simple underlying math
5. Blackjack   ~7-10 days  ← Complex, low edge, save for mature platform
```

**Ship Crash + Coin Flip first** = 2 new games in under a week, covering both the "social high-stakes" and "casual quick flip" player segments.

---

## Crash Game — Technical Spec

Since Crash is the recommended first build, here's the detailed spec:

### Game States

```
WAITING (5s countdown, accepting bets)
  → FLYING (multiplier climbing, players cash out)
  → CRASHED (round over, losers revealed)
  → WAITING (next round)
```

### Backend Files to Create

```
backend/src/modules/games/crash/
├── crash.engine.ts      # Crash point calculation, HMAC hash chain
├── crash.service.ts     # Game loop, bet handling, cashout logic
├── crash.routes.ts      # REST: /bet, /cashout, /history, /current
├── crash.model.ts       # CrashRound schema (crashPoint, players, bets)
└── crash.loop.ts        # setInterval game ticker (100ms broadcast)
```

### Redis Keys

```
crash:state          → "waiting" | "flying" | "crashed"
crash:round          → current round JSON (startTime, crashPoint, bets)
crash:multiplier     → current multiplier (updated every tick)
crash:history        → list of last 50 crash points
crash:bets:{roundId} → hash of {userId: betAmount}
```

### WebSocket Events

```
Server → Client:
  crash:tick          { multiplier, elapsed }
  crash:state         { state, countdown?, crashPoint? }
  crash:player_cashout { userId, multiplier, payout }
  crash:crashed       { crashPoint, results[] }

Client → Server:
  crash:bet           { amount }
  crash:cashout       {}
```

### Crash Point Algorithm (Provably Fair)

```typescript
// Hash chain: each round's seed = SHA256(previous round's seed)
// Crash point formula:
function getCrashPoint(seed: string): number {
  const hash = createHmac('sha256', seed).update('crash').digest('hex');
  const h = parseInt(hash.slice(0, 13), 16);
  const e = 2 ** 52; // Same precision as Math.random()

  // 3% instant crash chance (house edge)
  if (h % 33 === 0) return 1.00;

  return Math.floor((100 * e - h) / (e - h)) / 100;
}
// Produces: mostly 1.0x-3.0x, occasionally 10x+, rarely 100x+
```

### Multiplier Curve

```typescript
// Multiplier grows exponentially over time
function getMultiplier(elapsedMs: number): number {
  return Math.floor(100 * Math.pow(Math.E, 0.00006 * elapsedMs)) / 100;
  // 0s → 1.00x, 5s → 1.35x, 10s → 1.82x, 20s → 3.32x, 30s → 6.05x
}
```

### Frontend Components

```
frontend/src/
├── pages/CrashGame.tsx
├── components/games/
│   ├── CrashChart.tsx        # Animated multiplier line chart (canvas/SVG)
│   ├── CrashControls.tsx     # Bet input + cashout button
│   ├── CrashHistory.tsx      # Row of colored crash point bubbles
│   ├── CrashPlayers.tsx      # Live list of who's in, who cashed out
│   └── crash.css
└── stores/useCrashStore.ts   # WebSocket-driven state
```

### Key UX Details

- **Auto-cashout:** Player can set a target multiplier (e.g., 2.00x) — auto-cashes if reached
- **Chat/reactions:** Optional — emojis on big wins (social proof)
- **History bubbles:** Green if >= 2x, gray if < 2x, red if 1.00x instant crash
- **Sound:** Ascending pitch while flying, explosion on crash, cha-ching on cashout
- **Mobile:** Big cashout button, chart takes top 60% of screen

---

## Architecture Reuse Summary

| Existing Infrastructure | Used By Crash |
|------------------------|--------------|
| Redis Lua balance scripts | Bet deduction + cashout credit |
| WebSocket pub/sub | Real-time multiplier ticks + state changes |
| Provably fair (HMAC) | Hash chain for crash point generation |
| Real-time stats tracking | Per-user bet/win counters |
| Luck factor system | Adjust effective house edge per user |
| Prometheus metrics | game_bets_total{game="crash"}, bet latency |
| Mongo retry queue | Durable round + transaction persistence |
| Rate limiting | Bet rate limit during betting phase |
| BullMQ | Not needed (game loop is in-process) |

**~80% of infrastructure is already built.** The main new work is the game loop ticker and the frontend chart animation.
