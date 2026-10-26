import path from 'node:path'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '../.env') })

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env and configure it.')
  process.exit(1)
}

try {
  await mongoose.connect(process.env.MONGODB_URI)
  const { createApp } = await import('./app.js')
  const port = Number(process.env.PORT || 3000)
  const app = createApp({ databaseStatus: () => 'connected' })
  app.listen(port, () => console.log(`Mystery Room API listening on port ${port}`))
} catch {
  console.error('MongoDB connection failed. Check MONGODB_URI and Atlas network access.')
  process.exit(1)
}
