import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../app.js'
import { DIFFICULTIES } from '../config.js'
import Case from '../models/Case.js'
import { normalizeMystery } from '../services/gemini.js'

class TestId {
  constructor(value) { this.value = String(value) }
  equals(other) { return this.value === String(other?.value ?? other) }
  toJSON() { return this.value }
  toString() { return this.value }
}

class Query {
  constructor(value) { this.value = value }
  select() { return this }
  sort() { return this }
  limit() { return this }
  then(resolve, reject) { return Promise.resolve(this.value).then(resolve, reject) }
}

const storedCases = new Map()
let caseNumber = 0
const FakeCase = {
  async create(data) {
    const gameId = `case-${++caseNumber}`
    const suspects = data.suspects.map((suspect, index) => ({ ...suspect, _id: new TestId(`${gameId}-suspect-${index}`) }))
    const clues = data.clues.map((clue, index) => ({ ...clue, _id: new TestId(`${gameId}-clue-${index}`) }))
    suspects.id = (id) => suspects.find((item) => item._id.equals(id))
    clues.id = (id) => clues.find((item) => item._id.equals(id))
    const game = {
      ...data, _id: new TestId(gameId), suspects, clues, culpritId: suspects[0]._id, discoveredClueIds: [], hintsUsed: 0,
      correct: null, score: null, completedAt: null,
      async save() { return this },
    }
    game.suspects = suspects
    storedCases.set(gameId, game)
    return game
  },
  findById(id) { return new Query(storedCases.get(String(id)) || null) },
  find() { return new Query([...storedCases.values()]) },
}

const generator = async (difficulty) => {
  const rules = DIFFICULTIES[difficulty]
  const suspects = Array.from({ length: rules.suspects }, (_, i) => ({ name: `Suspect ${i + 1}`, role: `Role ${i + 1}`, description: `Background ${i + 1}` }))
  return {
    title: `${difficulty} test case`, setting: 'A locked archive', story: 'A rare map has vanished.',
    suspects, clues: Array.from({ length: rules.clues }, (_, i) => ({ title: `Clue ${i + 1}`, description: `Evidence ${i + 1}` })),
    hintTexts: Array.from({ length: rules.hints }, (_, i) => `Hint ${i + 1}`),
    culpritId: 'generated-culprit', solution: 'The clock log proves the curator was present.',
  }
}

const app = createApp({ CaseModel: FakeCase, mysteryGenerator: generator, serveClient: false })
let server
let baseUrl
before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json() }
}

test('full gameplay workflow enforces difficulty, clue, hint, accusation, score, and reveal rules', async () => {
  assert.deepEqual(await request('/api/health'), { status: 200, data: { status: 'ok', database: 'connected' } })
  const badDifficulty = await request('/api/cases', { method: 'POST', body: { difficulty: 'Extreme' } })
  assert.equal(badDifficulty.status, 400)

  const created = await request('/api/cases', { method: 'POST', body: { difficulty: 'Easy' } })
  assert.equal(created.status, 201)
  const game = created.data.case
  assert.equal(game.suspects.length, 3)
  assert.equal(game.clueCount, 5)
  assert.equal(game.hintLimit, 2)
  assert.equal('culpritId' in game, false)
  assert.equal('solution' in game, false)

  const list = await request('/api/cases/')
  assert.equal(list.status, 200)
  assert.equal(list.data.cases.length, 1)
  assert.equal(JSON.stringify(list.data).includes('generated-culprit'), false)
  assert.equal(JSON.stringify(list.data).includes('clock log proves'), false)

  assert.equal((await request(`/api/cases/${game._id}/result`)).status, 409)
  const clue = await request(`/api/cases/${game._id}/clues/1/discover`, { method: 'POST', body: {} })
  assert.equal(clue.data.discoveredCount, 1)
  assert.equal(clue.data.score, 5)
  assert.equal((await request(`/api/cases/${game._id}/clues/1/discover`, { method: 'POST', body: {} })).data.discoveredCount, 1)

  assert.equal((await request(`/api/cases/${game._id}/hints`, { method: 'POST', body: {} })).data.hintsUsed, 1)
  assert.equal((await request(`/api/cases/${game._id}/hints`, { method: 'POST', body: {} })).data.hintsUsed, 2)
  assert.equal((await request(`/api/cases/${game._id}/hints`, { method: 'POST', body: {} })).status, 409)

  const accused = await request(`/api/cases/${game._id}/accuse`, { method: 'POST', body: { suspectId: game.suspects[0]._id } })
  assert.equal(accused.status, 200)
  assert.equal(accused.data.correct, true)
  assert.equal(accused.data.basePoints, DIFFICULTIES.Easy.points)
  assert.equal(accused.data.score, 85)
  const result = await request(`/api/cases/${game._id}/result`)
  assert.equal(result.data.culprit.name, game.suspects[0].name)
  assert.equal(result.data.solution, 'The clock log proves the curator was present.')
  assert.equal((await request(`/api/cases/${game._id}/accuse`, { method: 'POST', body: { suspectId: game.suspects[1]._id } })).status, 409)
  assert.equal((await request(`/api/cases/${game._id}/hints`, { method: 'POST', body: {} })).status, 409)
  assert.equal((await request(`/api/cases/${game._id}/clues/2/discover`, { method: 'POST', body: {} })).status, 409)
})

test('all difficulty counts and wrong-accusation minimum score are enforced', async () => {
  for (const [difficulty, rules] of Object.entries(DIFFICULTIES)) {
    const created = await request('/api/cases', { method: 'POST', body: { difficulty } })
    assert.equal(created.data.case.suspects.length, rules.suspects)
    assert.equal(created.data.case.clueCount, rules.clues)
    assert.equal(created.data.case.hintLimit, rules.hints)
    if (difficulty === 'Medium') {
      const game = created.data.case
      await request(`/api/cases/${game._id}/clues/1/discover`, { method: 'POST', body: {} })
      for (let i = 0; i < rules.hints; i += 1) await request(`/api/cases/${game._id}/hints`, { method: 'POST', body: {} })
      const wrong = await request(`/api/cases/${game._id}/accuse`, { method: 'POST', body: { suspectId: game.suspects[1]._id } })
      assert.equal(wrong.data.correct, false)
      assert.equal(wrong.data.score, 0)
    }
    const right = await request('/api/cases', { method: 'POST', body: { difficulty } })
    const correct = await request(`/api/cases/${right.data.case._id}/accuse`, { method: 'POST', body: { suspectId: right.data.case.suspects[0]._id } })
    assert.equal(correct.data.basePoints, rules.points)
    assert.equal(correct.data.score, rules.points)
  }
})

test('solution, culprit, and generated hint fields are excluded by default in MongoDB queries', () => {
  assert.equal(Case.schema.path('culpritId').options.select, false)
  assert.equal(Case.schema.path('solution').options.select, false)
  assert.equal(Case.schema.path('hintTexts').options.select, false)
})

test('Gemini response validation enforces counts, distinct suspects and clues, and culprit membership', () => {
  const rules = DIFFICULTIES.Hard
  const generated = {
    title: 'The Archive Key', setting: 'North Gallery', story: 'A key is missing from a locked room.',
    suspects: Array.from({ length: rules.suspects }, (_, i) => ({ name: `Person ${i + 1}`, role: 'Guest', description: 'A short alibi.' })),
    clues: Array.from({ length: rules.clues }, (_, i) => ({ title: `Trace ${i + 1}`, description: 'A distinct clue.' })),
    culpritName: 'Person 1', solution: 'A clear explanation.', hints: Array.from({ length: rules.hints }, (_, i) => `Hint ${i + 1}`),
  }
  const normalized = normalizeMystery('Hard', generated)
  assert.equal(normalized.clues.length, rules.clues)
  assert.equal(normalized.hintTexts.length, rules.hints)
  assert.equal(normalized.culpritId.equals(normalized.suspects[0]._id), true)
  assert.throws(() => normalizeMystery('Hard', { ...generated, clues: generated.clues.slice(1) }), /requirements/)
  assert.throws(() => normalizeMystery('Hard', { ...generated, culpritName: 'Not a suspect' }), /not a suspect/)
  assert.throws(() => normalizeMystery('Hard', { ...generated, clues: generated.clues.map((clue) => ({ ...clue, title: 'Duplicate' })) }), /duplicate clues/)
})
