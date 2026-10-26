import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import Case from './models/Case.js'
import { DIFFICULTIES, publicCase } from './config.js'
import { generateMystery } from './services/gemini.js'

export function createApp({ CaseModel = Case, mysteryGenerator = generateMystery, databaseStatus = () => 'connected', serveClient = true } = {}) {
  const app = express()
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
  app.use(cors({ origin: clientOrigin }))
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: databaseStatus() }))

  app.post('/api/cases', async (req, res, next) => {
    try {
      const { difficulty } = req.body || {}
      if (!DIFFICULTIES[difficulty]) return res.status(400).json({ error: 'Difficulty must be Easy, Medium, or Hard.' })
      const mystery = await mysteryGenerator(difficulty)
      const game = await CaseModel.create({ ...mystery, difficulty })
      res.status(201).json({ case: publicCase(game) })
    } catch (error) { next(error) }
  })

  app.get('/api/cases', async (_req, res, next) => {
    try {
      const games = await CaseModel.find().sort({ createdAt: -1 }).limit(25)
      res.json({ cases: games.map(publicCase) })
    } catch (error) { next(error) }
  })

  app.post('/api/cases/:caseId/clues/:clueId/discover', async (req, res, next) => {
    try {
      const game = await CaseModel.findById(req.params.caseId)
      if (!game) return res.status(404).json({ error: 'Case not found.' })
      if (game.correct !== null) return res.status(409).json({ error: 'This case is already closed.' })
      const index = Number(req.params.clueId) - 1
      const clue = Number.isInteger(index) ? game.clues[index] : game.clues.id(req.params.clueId)
      if (!clue) return res.status(404).json({ error: 'No more clues are available.' })
      if (!game.discoveredClueIds.some((id) => id.equals(clue._id))) {
        game.discoveredClueIds.push(clue._id)
        await game.save()
      }
      res.json({ clue, discoveredClues: game.clues.filter((item) => game.discoveredClueIds.some((id) => id.equals(item._id))), discoveredCount: game.discoveredClueIds.length, score: Math.max(0, (game.correct ? DIFFICULTIES[game.difficulty].points : 0) + game.discoveredClueIds.length * 5 - game.hintsUsed * 10) })
    } catch (error) { next(error) }
  })

  app.post('/api/cases/:caseId/hints', async (req, res, next) => {
    try {
      const game = await CaseModel.findById(req.params.caseId).select('+hintTexts')
      if (!game) return res.status(404).json({ error: 'Case not found.' })
      if (game.correct !== null) return res.status(409).json({ error: 'This case is already closed.' })
      const limit = DIFFICULTIES[game.difficulty].hints
      if (game.hintsUsed >= limit) return res.status(409).json({ error: 'You have used all available hints.' })
      const hint = game.hintTexts[game.hintsUsed]
      game.hintsUsed += 1
      await game.save()
      res.json({ hint, hintsUsed: game.hintsUsed, hintLimit: limit, score: Math.max(0, (game.correct ? DIFFICULTIES[game.difficulty].points : 0) + game.discoveredClueIds.length * 5 - game.hintsUsed * 10) })
    } catch (error) { next(error) }
  })

  app.post('/api/cases/:caseId/accuse', async (req, res, next) => {
    try {
      const { suspectId } = req.body || {}
      const game = await CaseModel.findById(req.params.caseId).select('+culpritId +solution')
      if (!game) return res.status(404).json({ error: 'Case not found.' })
      if (game.correct !== null) return res.status(409).json({ error: 'An accusation has already been submitted.' })
      const suspect = game.suspects.id(suspectId)
      if (!suspect) return res.status(400).json({ error: 'Choose a valid suspect from this case.' })
      game.accusedSuspectId = suspect._id
      game.correct = suspect._id.equals(game.culpritId)
      game.score = Math.max(0, (game.correct ? DIFFICULTIES[game.difficulty].points : 0) + game.discoveredClueIds.length * 5 - game.hintsUsed * 10)
      game.completedAt = new Date()
      await game.save()
      res.json({ correct: game.correct, score: game.score, basePoints: game.correct ? DIFFICULTIES[game.difficulty].points : 0, cluePoints: game.discoveredClueIds.length * 5, hintPenalty: game.hintsUsed * 10, message: game.correct ? 'You followed the clues and found the truth.' : 'The evidence told another story.' })
    } catch (error) { next(error) }
  })

  app.get('/api/cases/:caseId/result', async (req, res, next) => {
    try {
      const game = await CaseModel.findById(req.params.caseId).select('+culpritId +solution')
      if (!game) return res.status(404).json({ error: 'Case not found.' })
      if (game.correct === null) return res.status(409).json({ error: 'Submit an accusation before viewing the result.' })
      const culprit = game.suspects.id(game.culpritId)
      res.json({ correct: game.correct, score: game.score, basePoints: game.correct ? DIFFICULTIES[game.difficulty].points : 0, cluePoints: game.discoveredClueIds.length * 5, hintPenalty: game.hintsUsed * 10, culprit: { _id: culprit._id, name: culprit.name, role: culprit.role }, solution: game.solution, accusedSuspectId: game.accusedSuspectId })
    } catch (error) { next(error) }
  })

  app.all('/api/*path', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }))
  if (serveClient) {
    const root = path.dirname(fileURLToPath(import.meta.url))
    const clientDist = path.resolve(root, '../client/dist')
    app.use(express.static(clientDist))
    app.get('*path', (_req, res) => res.sendFile(path.join(clientDist, 'index.html'), (error) => { if (error) res.status(404).json({ error: 'Client build not found. Run npm run build.' }) }))
  }

  app.use((error, _req, res, _next) => {
    const status = error.name === 'CastError' ? 400 : error.status === 503 ? 503 : [400, 404, 409].includes(error.status) ? error.status : 500
    if (status === 500) console.error('API request failed.')
    const message = status === 400 && error.name === 'CastError' ? 'Invalid case or suspect ID.' : status < 500 ? error.message : 'Unable to complete this request. Please try again.'
    res.status(status).json({ error: message })
  })
  return app
}
