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

The server starts only after it connects to MongoDB. Case generation returns a setup error until `GEMINI_API_KEY` is configured.

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

## Production preparation

The root Dockerfile builds the client and runs the Express server, which serves both the API and built frontend. `render.yaml` configures a Render Blueprint for the container and asks for `MONGODB_URI` and `GEMINI_API_KEY` as private dashboard values. The model defaults to `gemini-3.8-flash`; `GEMINI_MODEL` and `PORT` can be overridden. Do not bake secrets into the image or commit them.

The GitHub Actions workflow runs the frontend build, lint, and backend syntax checks without credentials. Publishing and deployment still require a chosen GitHub repository and a host with the runtime environment variables configured.
