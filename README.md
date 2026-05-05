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


## GitHub Pages

This project can be deployed as a static site on GitHub Pages.

1. Build the project:

```bash
npm run build
```

2. In your repository settings, set **Pages** to deploy from the branch that contains this repository root (for example, `main` / `/root`).

3. GitHub Pages will serve `index.html` from the repo root, which loads `./dist/main.js` with a relative path compatible with project pages.
