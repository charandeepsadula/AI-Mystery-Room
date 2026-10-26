import { GoogleGenAI } from '@google/genai'
import mongoose from 'mongoose'
import { DIFFICULTIES } from '../config.js'

export function normalizeMystery(difficulty, generated) {
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
  const validList = (items, count, fields) => Array.isArray(items) && items.length === count && items.every((item) => fields.every((field) => nonempty(item?.[field])))
  const rule = DIFFICULTIES[difficulty]
  if (!rule) throw new Error('Difficulty must be Easy, Medium, or Hard.')
  if (!nonempty(generated?.title) || !nonempty(generated?.setting) || !nonempty(generated?.story) || !nonempty(generated?.solution) || !nonempty(generated?.culpritName) ||
    !validList(generated?.suspects, rule.suspects, ['name', 'role', 'description']) ||
    !validList(generated?.clues, rule.clues, ['title', 'description']) ||
    !Array.isArray(generated?.hints) || generated.hints.length !== rule.hints || !generated.hints.every(nonempty)) {
    throw new Error(`Gemini's response did not meet the ${difficulty} case requirements. Please try again.`)
  }
  if (new Set(generated.suspects.map((suspect) => suspect.name.trim().toLowerCase())).size !== rule.suspects) {
    throw new Error('Gemini generated duplicate suspects. Please try again.')
  }
  if (new Set(generated.clues.map((clue) => clue.title.trim().toLowerCase())).size !== rule.clues) {
    throw new Error('Gemini generated duplicate clues. Please try again.')
  }
  const culpritIndex = generated.suspects.findIndex((suspect) => suspect.name.trim() === generated.culpritName.trim())
  if (culpritIndex < 0) throw new Error('Gemini returned a culprit who is not a suspect. Please try again.')

  const suspects = generated.suspects.map(({ name, role, description }) => ({ _id: new mongoose.Types.ObjectId(), name: name.trim(), role: role.trim(), description: description.trim() }))
  return {
    title: generated.title.trim(), setting: generated.setting.trim(), story: generated.story.trim(),
    suspects,
    clues: generated.clues.map(({ title, description }) => ({ title: title.trim(), description: description.trim() })),
    hintTexts: generated.hints.map((hint) => hint.trim()),
    culpritId: suspects[culpritIndex]._id,
    solution: generated.solution.trim(),
  }
}

export async function generateMystery(difficulty) {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error('GEMINI_API_KEY is not configured on the server.')
    error.status = 503
    throw error
  }
  const requirements = DIFFICULTIES[difficulty]
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    contents: `Create a fair-play, original detective mystery for a short web game. Difficulty: ${difficulty}. Return ONLY JSON with keys title, setting, story, suspects, clues, culpritName, solution, hints. Exactly ${requirements.suspects} suspects, exactly ${requirements.clues} distinct discoverable clues, and exactly ${requirements.hints} progressive hints. Each suspect has name, role, description (their public background/alibi, no secret answer). Each clue has title and description. culpritName must exactly match one suspect name. solution is a concise explanation identifying the culprit and explaining how the clues prove it. Each hint gently points toward evidence without naming the culprit. The story is 2-3 sentences setting up the crime; it must not reveal the answer. Every mystery must be logically solvable from the clues, with one unambiguous culprit. Keep text concise and avoid graphic violence.` ,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' }, setting: { type: 'STRING' }, story: { type: 'STRING' },
          suspects: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, role: { type: 'STRING' }, description: { type: 'STRING' } }, required: ['name', 'role', 'description'] } },
          clues: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' } }, required: ['title', 'description'] } },
          culpritName: { type: 'STRING' }, solution: { type: 'STRING' }, hints: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'setting', 'story', 'suspects', 'clues', 'culpritName', 'solution', 'hints'],
      },
    },
  })
  let generated
  try { generated = JSON.parse(response.text || '') }
  catch { throw new Error('Gemini returned an invalid mystery format. Please try again.') }
  return normalizeMystery(difficulty, generated)
}
