import mongoose from 'mongoose'

const suspectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  description: { type: String, required: true },
}, { _id: true })

const clueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
}, { _id: true })

const caseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  setting: { type: String, required: true },
  story: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
  suspects: { type: [suspectSchema], required: true },
  clues: { type: [clueSchema], required: true },
  hintTexts: { type: [String], required: true, select: false },
  culpritId: { type: mongoose.Schema.Types.ObjectId, required: true, select: false },
  solution: { type: String, required: true, select: false },
  discoveredClueIds: [{ type: mongoose.Schema.Types.ObjectId }],
  hintsUsed: { type: Number, default: 0 },
  accusedSuspectId: { type: mongoose.Schema.Types.ObjectId, default: null },
  correct: { type: Boolean, default: null },
  score: { type: Number, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model('Case', caseSchema)
