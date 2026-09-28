import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

const app = express()
const { Pool } = pg
const port = 3001

const connectionString =
  (process.env.DATABASE_URL || 'postgresql+psycopg://shashwatmishra@localhost:5432/intrest_calculator')
    .replace('postgresql+psycopg://', 'postgresql://')
    .replace('postgres+psycopg://', 'postgresql://')

const pool = new Pool({
  connectionString,
  ssl: false,
})

async function initializeDatabase() {
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS interest_calculations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        interest_type VARCHAR(20) NOT NULL,
        annual_investment NUMERIC(18, 2) NOT NULL,
        investment_duration INTEGER NOT NULL,
        total_duration INTEGER NOT NULL,
        final_amount NUMERIC(18, 2) NOT NULL,
        rate NUMERIC(12, 6) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  } finally {
    client.release()
  }
}

app.use(cors())
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, message: 'Database connected' })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/savings', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, interest_type, annual_investment, investment_duration, total_duration, final_amount, rate, created_at
       FROM interest_calculations
       ORDER BY created_at DESC`
    )

    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

app.post('/api/savings', async (req, res) => {
  try {
    const {
      title,
      interestType,
      annualInvestment,
      investmentDuration,
      totalDuration,
      finalAmount,
      rate,
    } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required.' })
    }

    const cleanedTitle = title.trim()
    const payload = {
      title: cleanedTitle,
      interestType: interestType === 'simple' ? 'simple' : 'compound',
      annualInvestment: Number(annualInvestment),
      investmentDuration: Number(investmentDuration),
      totalDuration: Number(totalDuration),
      finalAmount: Number(finalAmount),
      rate: Number(rate),
    }

    if (
      !Number.isFinite(payload.annualInvestment) ||
      !Number.isFinite(payload.investmentDuration) ||
      !Number.isFinite(payload.totalDuration) ||
      !Number.isFinite(payload.finalAmount) ||
      !Number.isFinite(payload.rate)
    ) {
      return res.status(400).json({ message: 'Invalid calculation values.' })
    }

    const result = await pool.query(
      `INSERT INTO interest_calculations
        (title, interest_type, annual_investment, investment_duration, total_duration, final_amount, rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        payload.title,
        payload.interestType,
        payload.annualInvestment,
        payload.investmentDuration,
        payload.totalDuration,
        payload.finalAmount,
        payload.rate,
      ]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

async function startServer() {
  await initializeDatabase()
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
