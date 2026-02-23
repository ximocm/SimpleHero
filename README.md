# SimpleHero
Juego basado en dungeon crawl de mesa, pero en formato web simplificado

## Run (TypeScript + Python server)

1. Install deps:

```bash
npm install
```

2. Start dev server (it compiles TS before serving):

```bash
npm run serve
```

3. Open game:

`http://localhost:8081/src/views/index.html`

4. Health/status endpoint:

`http://localhost:8081/status`

- Returns `200` when TypeScript build is ready.
- Returns `400` when build is missing/failed.

Alternative one-shot command:

```bash
npm run dev
```

## Basic Project Layout

- `assets/images/`: Sprites and UI images.
- `assets/audio/music/`: Music tracks.
- `assets/audio/sfx/`: Sound effects.
- `src/`: Source code.
- `src/rooms/`: Room templates (matrix) and selection system.
- `src/views/`: HTML views/layout fragments.
- `docs/`: Design and production docs.
- `docs/plans/`: Implementation plans.
- `tests/`: Unit and integration tests.
- `scripts/`: Utility scripts.

## Custom Rooms (Matrix)

Define rooms in `src/rooms/roomTemplates.ts`.

Legend per character:
- `#` (or any unknown char): `VOID_BLACK` (wall/void)
- `.`: floor
- `N`, `E`, `S`, `W`: exit tiles by direction

Template selection is handled in `src/rooms/roomSelector.ts` using weighted deterministic choice by run seed + room coord.

Dungeon floors are generated up-front per run (no infinite expansion), with weighted floor count:
- 3 floors: 10%
- 4 floors: 20%
- 5 floors: 40%
- 6 floors: 20%
- 7 floors: 10%
