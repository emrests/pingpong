# Ping Pong — Design Spec

Date: 2026-09-18

## Goal

Browser-based 3D table tennis game inspired by "RALLY" (three.js, mouse moves paddle left/right, automatic swing, CPU only). The reference feels slow because the player controls only position; the swing, direction, power and spin are automatic.

This game gives the player full mouse-only control of direction, power and spin, and adds online 1v1 play through invite rooms.

## Scope

In scope:
- Online 1v1 via room code / invite link (P2P WebRTC through PeerJS)
- Practice mode against a simple CPU opponent
- Mouse-only control: direction, power, topspin, backspin, sidespin
- Spin physics: Magnus curve in flight, spin-dependent bounce
- Standard scoring: first to 11, win by 2, serve alternates every 2 points (every point at 10–10)

Out of scope (YAGNI): difficulty levels, sound, mobile/touch, TURN server, spectators, accounts, matchmaking.

## Tech Stack

- Vite (dev server + static build), vanilla JavaScript ES modules
- three.js for rendering
- PeerJS (public broker + public STUN) for P2P data channel
- Vitest for unit tests
- Output: static site, deployable to GitHub Pages / Netlify

## Coordinate System

Units: metres, seconds. Table 2.74 (length, z axis) × 1.525 (width, x axis), surface at y = 0.76. Net height 0.1525 at z = 0. Local player always occupies the +z end (near camera); opponent at −z. Ball radius 0.02, mass 2.7 g.

On the wire, all positions/velocities/spins are mirrored (x → −x, z → −z; spin vector mirrored accordingly) so each client sees itself at the near end.

## Modules (`src/`)

Each module has one purpose. `physics`, `hit`, `rules`, `ai` are pure (no three.js, no DOM) and unit-testable.

### `constants.js`
Table dimensions, ball properties, physics coefficients, speed clamps.

### `physics.js`
`stepBall(ball, dt)` → mutates/returns ball state `{pos, vel, spin}` and returns events (`bounce` with side, `net`, `out`, `floor`).
- Gravity, quadratic air drag
- Magnus force: `a = k_m * (spin × vel)`
- Table bounce: restitution on y; tangential velocity changed by surface friction coupled with spin (topspin adds forward speed after bounce, backspin removes it, sidespin deflects laterally); spin decays on bounce
- Net collision: ball crossing z = 0 plane below net top → velocity damped, event `net`
- Fixed timestep (1/240 s) with accumulator so both peers simulate identically

### `paddle.js`
Converts relative mouse movement (Pointer Lock `movementX/Y`) into paddle position on a bounded play volume at the player's end. Mouse X → x. Mouse Y → z (forward/back) with slight y rise when moving forward. Keeps a ~50 ms position history to produce a smoothed velocity. Auto-tilts paddle for forehand/backhand depending on x relative to ball. Tracks button state (left = topspin, right = backspin).

### `hit.js`
`computeHit(ball, paddle)` → new `{vel, spin}` when ball intersects paddle disc (radius ~0.085 + tolerance) while travelling toward the player and after a legal bounce.
- Direction: lateral paddle velocity + contact offset on paddle
- Power: forward paddle speed, mapped to ball speed, clamped [min, max] (approx 4–15 m/s)
- Spin: left button → topspin proportional to swing speed; right button → backspin; no button → light topspin; lateral swing speed → sidespin
- Assist: launch elevation is solved so that a ball of the chosen speed/spin clears the net and targets the opponent's half; extreme inputs can still miss (long or into net) so skill matters

### `rules.js`
State machine: `serving → rally → pointOver → (gameOver)`. Tracks score, server, legal bounce sequence. Inputs are physics events + hit events; outputs are point awards. Rules: serve is simplified — after the toss it is hit like a normal stroke and must land directly on the opponent's side (no bounce on server's own side); ball must bounce exactly once on receiver's side before being hit; double bounce, net-stop, out → point to other player.

### `ai.js`
Predicts ball landing/arrival point by stepping a copy of the ball with `physics.js`, moves its paddle toward it with capped speed and reaction delay, produces a synthetic swing (velocity + button) with random error and random spin choice.

### `net.js`
PeerJS wrapper.
- `host()` → creates peer with id `pingpong-<4-char code>`, returns code; invite link `?room=CODE`
- `join(code)` → connects to host
- Reliable ordered data channel, JSON messages
- Emits `open`, `message`, `close`, `error`

Message types:
- `paddle` `{pos, vel, buttons}` ~30 Hz
- `hit` `{pos, vel, spin, t}` — sent by hitter at moment of hit (also used for serve)
- `point` `{winner, reason}` — sent by the ball's current authority (receiving side)
- `score` `{me, you, server, state}` — sent by host, authoritative
- `ping/pong` for latency estimate

### Netcode model: ball authority handoff
The player who must hit the ball next owns the outcome. Hits are computed locally → zero perceived lag on own strokes. After a hit, hitter sends `hit`; the other peer replaces its ball state and fast-forwards by estimated one-way latency. Both run the same fixed-step deterministic physics. The receiving side declares misses / outs / net faults (`point`); host keeps the authoritative score and broadcasts `score`. Opponent paddle is rendered with interpolation from `paddle` messages.

Disconnect → pause game, show message, return to menu.

### `render.js`
three.js scene: table, net, two paddles, ball with shadow and short trail, simple lighting, flat clean style similar to reference. Camera behind and above local player's end.

### `ui.js`
DOM overlay: main menu (Practice / Create room / Join room), room code + copy link, connection status, scoreboard, serve indicator, spin indicator (which button held), point/game-over banners.

### `main.js`
Wires everything: game loop (fixed-step physics, render per frame), mode selection (practice → `ai.js` drives opponent; online → `net.js` drives opponent), Pointer Lock handling (click to lock, Esc → pause menu).

## Controls

- Click canvas → Pointer Lock
- Move mouse → move paddle (x, depth)
- Swing through ball → hit; speed = power, lateral motion = direction (+ sidespin when fast)
- Hold left button → topspin; hold right button → backspin (context menu suppressed)
- Serve: click to toss, then swing
- Esc → release pointer / pause (practice only pauses; online shows menu without pausing)

## Error Handling

- PeerJS broker unreachable / room not found / room full → message in UI, back to menu
- Peer disconnect mid-game → banner, back to menu
- Pointer Lock denied → fallback to absolute mouse position over canvas
- Ball state NaN/escape → reset point as let

## Testing

Vitest unit tests:
- `physics`: gravity fall, bounce restitution, topspin bounce gains forward speed vs backspin loses, Magnus curve direction for sidespin/topspin, net event, determinism (same input → same output)
- `hit`: button → spin sign, swing speed → ball speed monotonic + clamped, lateral velocity → direction sign, normal hit clears net and lands on opponent half
- `rules`: scoring, serve rotation, deuce, double bounce, out, game over
- `net` mirror transform: mirror(mirror(v)) = v
- `ai`: predicted arrival point within tolerance

Manual: practice mode feel; two browser tabs for online mode (create room, join via link, play points, disconnect handling).
