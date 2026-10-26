# AI Mystery Room

A React/Vite and Express MVP for generating and solving AI-written detective mysteries.

No official AI Mystery Room documentation or `SPEC.md` was present in the workspace when implementation began. This MVP follows the requirements in the project request.

## Requirements

- Node.js 20.19 or newer
- MongoDB Atlas connection string
- Gemini API key

## Local setup

1. Copy `.env.example` to `.env` in the repository root.
2. Set `MONGODB_URI` and `GEMINI_API_KEY` in `.env`. Keep `.env` private; it is ignored by Git.
3. Run `npm install` from the repository root.
4. Run `npm run dev` to start the Vite client and API. The client is at `http://localhost:5173`; Vite forwards `/api` requests to Express on port 3000.
5. Run `npm run build` for the production client bundle, then `npm start` to serve the built app and API together.

Run the API gameplay tests with `npm test` and the frontend lint with `npm run lint --workspace client`.

The server starts only after it connects to MongoDB. Case generation returns a setup error until `GEMINI_API_KEY` is configured. The API production command is `npm run start --workspace server`; it requires `MONGODB_URI` and optionally reads `PORT`, `GEMINI_MODEL`, `CLIENT_ORIGIN`, and `SERVE_CLIENT`.

## Gameplay rules

| Difficulty | Suspects | Clues | Hints | Correct accusation |
| --- | ---: | ---: | ---: | ---: |
| Easy | 3 | 5 | 2 | 100 |
| Medium | 4 | 7 | 3 | 150 |
| Hard | 5 | 9 | 3 | 200 |

Each discovered clue adds 5 points; each hint subtracts 10. Scores cannot go below zero. The server stores the culprit and solution in fields excluded from regular case queries, and reveals them only after an accusation is submitted.

## API

- `POST /api/cases` — generate and save a case (`{ "difficulty": "Easy|Medium|Hard" }`)
- `GET /api/cases/` — list the latest cases
- `POST /api/cases/:caseId/clues/:clueId/discover` — discover a clue; `clueId` accepts its 1-based sequence number or subdocument ID
- `POST /api/cases/:caseId/hints` — request a limited hint
- `POST /api/cases/:caseId/accuse` — submit `{ "suspectId": "..." }`
- `GET /api/cases/:caseId/result` — reveal outcome and solution after accusation
- `GET /api/health` — service and database status

## Separate-host deployment preparation

The frontend is prepared for Vercel and the API for Render. In Vercel, import the repository, set **Root Directory** to `client`, use `npm run build`, and publish `dist`. Add `VITE_API_BASE_URL` as a Vercel environment variable with the Render API base URL (for example, `https://your-api-service.onrender.com`, without `/api`). This value is a public endpoint URL, not a secret. The client reads it at build time.

`render.yaml` defines a Node web service using `npm ci --omit=dev` and `npm run start --workspace server`. Create it from the repository Blueprint. In the Render service environment settings, configure `MONGODB_URI`, `GEMINI_API_KEY`, and `CLIENT_ORIGIN`; the first two are secret values and must be entered only in the host dashboard. Set `CLIENT_ORIGIN` to the Vercel production origin. It accepts comma-separated origins if you need to allow more than one. The Blueprint sets `SERVE_CLIENT=false` and defaults `GEMINI_MODEL` to `gemini-3.8-flash`; Render supplies `PORT`.

For local setup, put `MONGODB_URI` and `GEMINI_API_KEY` in the ignored root `.env`; optional values are `PORT`, `GEMINI_MODEL`, and `CLIENT_ORIGIN`. Local Vite development uses its `/api` proxy, so `VITE_API_BASE_URL` is unnecessary. `client/.env.example` documents the frontend variable without containing credentials. Never put server secrets in a `VITE_` variable, frontend source, or committed file.

The root Dockerfile remains available for a combined frontend/API container deployment. The Render Blueprint now prepares separate hosting. No live Atlas or Gemini check is implied by a successful local build.

The GitHub Actions workflow runs the frontend build, lint, and backend syntax checks without credentials. Publishing and deployment still require a chosen GitHub repository and a host with the runtime environment variables configured.
