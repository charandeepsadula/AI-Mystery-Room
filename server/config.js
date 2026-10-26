export const DIFFICULTIES = {
  Easy: { suspects: 3, clues: 5, hints: 2, points: 100 },
  Medium: { suspects: 4, clues: 7, hints: 3, points: 150 },
  Hard: { suspects: 5, clues: 9, hints: 3, points: 200 },
}

export const publicCase = (game) => ({
  _id: game._id,
  title: game.title,
  setting: game.setting,
  story: game.story,
  difficulty: game.difficulty,
  suspects: game.suspects,
  clueCount: game.clues.length,
  hintLimit: DIFFICULTIES[game.difficulty].hints,
  discoveredClueIds: game.discoveredClueIds,
  discoveredClues: game.clues.filter((clue) => game.discoveredClueIds.some((id) => id.equals(clue._id))),
  hintsUsed: game.hintsUsed,
  completed: game.correct !== null,
})
