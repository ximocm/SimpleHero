# SimpleHero
Juego basado en dungeon crawl de mesa, pero en formato web simplificado

## Warning

Read the docs before touching code or assets:
- `docs/README.md`
- `docs/gdd.md`
- `docs/plans/`

## Installation

```bash
npm install
```

## Run

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
