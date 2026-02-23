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
- `src/views/`: HTML views/layout fragments.
- `docs/`: Design and production docs.
- `docs/plans/`: Implementation plans.
- `tests/`: Unit and integration tests.
- `scripts/`: Utility scripts.
