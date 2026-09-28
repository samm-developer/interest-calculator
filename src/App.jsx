import { useEffect, useMemo, useState } from 'react'
import './App.css'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)

function futureValue({ annualInvestment, investmentDuration, totalDuration, rate, interestType }) {
  const safeRate = Math.max(rate, 0)

  if (interestType === 'simple') {
    const totalYears = Math.max(totalDuration, investmentDuration)
    const deposits = Math.max(investmentDuration, 0)
    const sumOfYears = deposits * totalYears - (deposits * (deposits + 1)) / 2
    return annualInvestment * deposits + annualInvestment * safeRate * sumOfYears
  }

  const contributionYears = Math.max(investmentDuration, 0)
  const compoundingYears = Math.max(totalDuration - investmentDuration, 0)
  const annuityFactor =
    safeRate === 0
      ? contributionYears
      : (Math.pow(1 + safeRate, contributionYears) - 1) / safeRate

  return annualInvestment * annuityFactor * Math.pow(1 + safeRate, compoundingYears)
}

function findRate(form) {
  const annualInvestment = Number(form.annualInvestment)
  const investmentDuration = Number(form.investmentDuration)
  const totalDuration = Number(form.totalDuration)
  const finalAmount = Number(form.finalAmount)

  if (
    !Number.isFinite(annualInvestment) ||
    !Number.isFinite(investmentDuration) ||
    !Number.isFinite(totalDuration) ||
    !Number.isFinite(finalAmount) ||
    annualInvestment <= 0 ||
    investmentDuration <= 0 ||
    totalDuration < investmentDuration ||
    finalAmount <= 0
  ) {
    return null
  }

  let low = 0.000001
  let high = 1

  while (futureValue({ ...form, rate: high }) < finalAmount) {
    high *= 2
    if (high > 100000) {
      return null
    }
  }

  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2
    const currentValue = futureValue({ ...form, rate: middle })

    if (currentValue < finalAmount) {
      low = middle
    } else {
      high = middle
    }
  }

  const rate = (low + high) / 2
  return Number.isFinite(rate) ? rate : null
}

function App() {
  const [form, setForm] = useState({
    interestType: 'compound',
    annualInvestment: 100000,
    investmentDuration: 8,
    totalDuration: 16,
    finalAmount: 2000000,
  })
  const [title, setTitle] = useState('My investment plan')
  const [savedRecords, setSavedRecords] = useState([])
  const [saveStatus, setSaveStatus] = useState('')

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const response = await fetch('/api/savings')
        if (response.ok) {
          const data = await response.json()
          setSavedRecords(data)
        }
      } catch (error) {
        setSaveStatus('Database unavailable. Save feature will retry once the backend is running.')
      }
    }

    fetchSaved()
  }, [])

  const rate = useMemo(() => findRate(form), [form])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setSaveStatus('Please enter a title before saving.')
      return
    }

    if (rate === null) {
      setSaveStatus('Please enter valid values before saving.')
      return
    }

    try {
      const response = await fetch('/api/savings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          interestType: form.interestType,
          annualInvestment: Number(form.annualInvestment),
          investmentDuration: Number(form.investmentDuration),
          totalDuration: Number(form.totalDuration),
          finalAmount: Number(form.finalAmount),
          rate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Unable to save calculation.')
      }

      setSavedRecords((previous) => [data, ...previous])
      setSaveStatus(`Saved: ${data.title}`)
    } catch (error) {
      setSaveStatus(error.message || 'Unable to save right now.')
    }
  }

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/savings/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Unable to delete saved calculation.')
      }

      setSavedRecords((previous) => previous.filter((record) => record.id !== id))
      setSaveStatus('Saved calculation deleted.')
    } catch (error) {
      setSaveStatus(error.message || 'Unable to delete the saved calculation.')
    }
  }

  const formulaText =
    form.interestType === 'compound'
      ? 'FV = P × (((1 + r)^n - 1) / r) × (1 + r)^(T - n)'
      : 'FV = P × n + P × r × (n × T - n(n + 1) / 2)'

  return (
    <main className="app-shell">
      <aside className="saved-panel">
        <h2>Saved calculations</h2>

        {savedRecords.length > 0 ? (
          <div className="saved-list">
            {savedRecords.map((record) => (
              <div key={record.id} className="saved-item">
                <div className="saved-item-head">
                  <strong>{record.title}</strong>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => handleDelete(record.id)}
                    aria-label={`Delete ${record.title}`}
                  >
                    Delete
                  </button>
                </div>
                <span>
                  {record.interest_type} • {(Number(record.rate) * 100).toFixed(2)}% •{' '}
                  {formatCurrency(Number(record.final_amount))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="saved-empty">No saved calculations yet.</div>
        )}
      </aside>

      <section className="calculator-card">
        <div className="header-block">
          <p className="eyebrow">Investment calculator</p>
          <h1>Rate of interest finder</h1>
        </div>

        <div className="content-grid">
          <div className="form-panel">
            <div className="field">
              <label htmlFor="interestType">Interest type</label>
              <select id="interestType" name="interestType" value={form.interestType} onChange={handleChange}>
                <option value="compound">Compound</option>
                <option value="simple">Simple</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="annualInvestment">Per year investment</label>
              <input
                id="annualInvestment"
                name="annualInvestment"
                type="number"
                min="0"
                step="1000"
                value={form.annualInvestment}
                onChange={handleChange}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="investmentDuration">Investment duration</label>
                <input
                  id="investmentDuration"
                  name="investmentDuration"
                  type="number"
                  min="1"
                  step="1"
                  value={form.investmentDuration}
                  onChange={handleChange}
                />
              </div>

              <div className="field">
                <label htmlFor="totalDuration">Total duration</label>
                <input
                  id="totalDuration"
                  name="totalDuration"
                  type="number"
                  min="1"
                  step="1"
                  value={form.totalDuration}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="finalAmount">Final amount</label>
              <input
                id="finalAmount"
                name="finalAmount"
                type="number"
                min="0"
                step="1000"
                value={form.finalAmount}
                onChange={handleChange}
              />
            </div>

            <div className="save-box">
              <label htmlFor="title">Save title</label>
              <div className="save-row">
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: 1 Lakh for 8 years"
                />
                <button type="button" onClick={handleSave}>
                  Save
                </button>
              </div>
              {saveStatus ? <p className="save-status">{saveStatus}</p> : null}
            </div>
          </div>

          <div className="result-panel">
            <div className="metric-box">
              <span className="metric-label">Estimated rate</span>
              <strong className="metric-value">
                {rate === null ? 'Not possible' : `${(rate * 100).toFixed(2)}%`}
              </strong>
            </div>

            <div className="formula-box">
              <span className="label">Formula used</span>
              <p>{formulaText}</p>
            </div>

            <div className="summary-box">
              <span className="label">Sample scenario</span>
              <p>
                Invest {formatCurrency(form.annualInvestment)} every year for {form.investmentDuration}{' '}
                years, hold for {form.totalDuration} total years, and receive {formatCurrency(form.finalAmount)}.
              </p>
            </div>

            <div className="note-box">
              <span className="label">How it works</span>
              <p>
                This calculator solves the interest rate mathematically using a bisection method, so the final
                amount matches your input as closely as possible.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
