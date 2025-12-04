import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const CSV_URL = '/Lottery_Powerball_Winning_Numbers__Beginning_2010.csv'
const MAIN_RANGE = { min: 1, max: 69 }
const POWERBALL_RANGE = { min: 1, max: 26 }
const INITIAL_MAIN_PICK = ['07', '11', '19', '27', '53']
const INITIAL_POWERBALL_PICK = '10'

const formatBall = (value) => value.toString().padStart(2, '0')

const clampInput = (rawValue, max) => {
  if (rawValue === '') return ''
  const numeric = Number(rawValue)
  if (!Number.isFinite(numeric)) return ''
  const clamped = Math.max(MAIN_RANGE.min, Math.min(max, Math.floor(numeric)))
  return clamped.toString()
}

const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/)
  const dataLines = lines.slice(1)

  return dataLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const values = line
        .replace(/^"|"$/g, '')
        .split('","')
        .map((value) => value.trim())

      const [rawDate, winningNumbers = '', multiplierValue] = values
      if (!rawDate || !winningNumbers) return null

      const date = new Date(rawDate)
      if (Number.isNaN(date.getTime())) return null

      const numbers = winningNumbers
        .split(' ')
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))

      if (!numbers.length) return null

      const powerball = numbers.length ? numbers[numbers.length - 1] : null
      const mainNumbers = powerball !== null ? numbers.slice(0, -1) : numbers
      const multiplier = multiplierValue ? Number(multiplierValue) : null

      return {
        dateMs: date.getTime(),
        dateLabel: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        mainNumbers,
        powerball,
        multiplier,
        mainSum: mainNumbers.reduce((sum, value) => sum + value, 0),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.dateMs - b.dateMs)
}

function App() {
  const [draws, setDraws] = useState([])
  const [status, setStatus] = useState('loading')
  const [mainPick, setMainPick] = useState(INITIAL_MAIN_PICK)
  const [powerballPick, setPowerballPick] = useState(INITIAL_POWERBALL_PICK)
  const [isTicketChecked, setIsTicketChecked] = useState(false)

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      try {
        const response = await fetch(CSV_URL)
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const csvText = await response.text()
        const parsedData = parseCsv(csvText)

        if (isMounted) {
          setDraws(parsedData)
          setStatus(parsedData.length ? 'ready' : 'empty')
        }
      } catch (error) {
        console.error('Failed to load CSV data', error)
        if (isMounted) setStatus('error')
      }
    }

    fetchData()
    return () => {
      isMounted = false
    }
  }, [])

  const timeRangeLabel = useMemo(() => {
    if (!draws.length) return null
    const startYear = new Date(draws[0].dateMs).getFullYear()
    const endYear = new Date(draws[draws.length - 1].dateMs).getFullYear()
    return `${startYear}–${endYear}`
  }, [draws])

  const {
    totalDraws,
    averageMainSum,
    topMainNumbers,
    topPowerballNumbers,
    mostCommonMain,
    mostCommonPowerball,
    mostCommonMultiplier,
  } = useMemo(() => {
    if (!draws.length) {
      return {
        totalDraws: 0,
        averageMainSum: null,
        topMainNumbers: [],
        topPowerballNumbers: [],
        mostCommonMain: null,
        mostCommonPowerball: null,
        mostCommonMultiplier: null,
      }
    }

    const mainFrequency = new Map()
    const powerballFrequency = new Map()
    const multiplierFrequency = new Map()
    let mainSumTotal = 0

    draws.forEach((draw) => {
      draw.mainNumbers.forEach((number) => {
        mainFrequency.set(number, (mainFrequency.get(number) ?? 0) + 1)
      })

      if (draw.powerball !== null) {
        powerballFrequency.set(draw.powerball, (powerballFrequency.get(draw.powerball) ?? 0) + 1)
      }

      if (draw.multiplier !== null) {
        multiplierFrequency.set(draw.multiplier, (multiplierFrequency.get(draw.multiplier) ?? 0) + 1)
      }

      mainSumTotal += draw.mainSum
    })

    const sortByHits = (map) =>
      Array.from(map.entries())
        .map(([label, hits]) => ({ label: label.toString().padStart(2, '0'), hits }))
        .sort((a, b) => b.hits - a.hits)

    const rankedMain = sortByHits(mainFrequency)
    const rankedPowerball = sortByHits(powerballFrequency)
    const rankedMultiplier = Array.from(multiplierFrequency.entries()).sort((a, b) => b[1] - a[1])

    return {
      totalDraws: draws.length,
      averageMainSum: Math.round(mainSumTotal / draws.length),
      topMainNumbers: rankedMain.slice(0, 15),
      topPowerballNumbers: rankedPowerball.slice(0, 10),
      mostCommonMain: rankedMain[0] ?? null,
      mostCommonPowerball: rankedPowerball[0] ?? null,
      mostCommonMultiplier: rankedMultiplier.length
        ? { value: rankedMultiplier[0][0], hits: rankedMultiplier[0][1] }
        : null,
    }
  }, [draws])

  const pickAnalysis = useMemo(() => {
    const numericMain = []
    mainPick.forEach((value) => {
      const numeric = Number(value)
      if (
        Number.isFinite(numeric) &&
        numeric >= MAIN_RANGE.min &&
        numeric <= MAIN_RANGE.max
      ) {
        numericMain.push(numeric)
      }
    })

    const powerballNumeric = Number(powerballPick)
    const hasFullSet = numericMain.length === 5
    const hasDuplicates = new Set(numericMain).size !== numericMain.length
    const validPowerball =
      Number.isFinite(powerballNumeric) &&
      powerballNumeric >= POWERBALL_RANGE.min &&
      powerballNumeric <= POWERBALL_RANGE.max

    const ready = hasFullSet && !hasDuplicates && validPowerball && draws.length > 0

    if (!ready) {
      return {
        ready: false,
        hasDuplicates,
        missingMain: !hasFullSet,
        invalidPowerball: !validPowerball,
        jackpotHits: [],
        bestDraws: [],
        numericMain,
        powerballNumeric: validPowerball ? powerballNumeric : null,
      }
    }

    const mainSet = new Set(numericMain)
    const annotatedDraws = draws.map((draw) => {
      const mainMatches = draw.mainNumbers.reduce(
        (count, number) => count + (mainSet.has(number) ? 1 : 0),
        0,
      )
      const powerballMatch = draw.powerball === powerballNumeric
      return { ...draw, mainMatches, powerballMatch }
    })

    const jackpotHits = annotatedDraws.filter((draw) => draw.mainMatches === 5 && draw.powerballMatch)

    const bestDraws = annotatedDraws
      .slice()
      .sort((a, b) => {
        if (b.mainMatches !== a.mainMatches) return b.mainMatches - a.mainMatches
        if (a.powerballMatch !== b.powerballMatch) {
          return (b.powerballMatch ? 1 : 0) - (a.powerballMatch ? 1 : 0)
        }
        return b.dateMs - a.dateMs
      })
      .slice(0, 3)

    return {
      ready: true,
      hasDuplicates: false,
      missingMain: false,
      invalidPowerball: false,
      jackpotHits,
      bestDraws,
      numericMain,
      powerballNumeric,
    }
  }, [draws, mainPick, powerballPick])

  const handleMainInputChange = (index, event) => {
    const nextValue = clampInput(event.target.value, MAIN_RANGE.max)
    setIsTicketChecked(false)
    setMainPick((previous) => previous.map((value, i) => (i === index ? nextValue : value)))
  }

  const handlePowerballChange = (event) => {
    const nextValue = clampInput(event.target.value, POWERBALL_RANGE.max)
    setIsTicketChecked(false)
    setPowerballPick(nextValue)
  }

  const handleCheckTicket = () => {
    if (pickAnalysis.ready) {
      setIsTicketChecked(true)
    }
  }

  const showResults = pickAnalysis.ready && isTicketChecked
  const selectedMainSet = showResults ? new Set(pickAnalysis.numericMain) : null

  return (
    <main className="app">
      <header className="app__header">
        <h1>Powerball winning number patterns</h1>
        <p className="subhead">
          Draw history ({timeRangeLabel ?? '2010–present'}) covering {totalDraws.toLocaleString('en-US')} results.
        </p>
        {draws.length > 0 && (
          <p className="meta">Data source: data.ny.gov - updated after each drawing.</p>
        )}
      </header>

      {status === 'loading' && <p className="status">Loading Powerball draws…</p>}
      {status === 'error' && (
        <p className="status status--error">Something went wrong while loading the CSV. Please try again.</p>
      )}
      {status === 'empty' && (
        <p className="status status--error">The data file was empty. Double-check the CSV contents and refresh.</p>
      )}

      {status === 'ready' && (
        <>
          <section className="insights" aria-label="Summary metrics">
            <div className="insight">
              <p className="insight-label">Most common main ball</p>
              <p className="insight-value">{mostCommonMain?.label ?? '—'}</p>
              <p className="insight-meta">
                {mostCommonMain ? `${mostCommonMain.hits.toLocaleString('en-US')} appearances` : 'No data'}
              </p>
            </div>
            <div className="insight">
              <p className="insight-label">Most common Powerball</p>
              <p className="insight-value">{mostCommonPowerball?.label ?? '—'}</p>
              <p className="insight-meta">
                {mostCommonPowerball
                  ? `${mostCommonPowerball.hits.toLocaleString('en-US')} drawings`
                  : 'No data'}
              </p>
            </div>
            <div className="insight">
              <p className="insight-label">Typical sum of first five balls</p>
              <p className="insight-value">
                {averageMainSum ? averageMainSum.toLocaleString('en-US') : '—'}
              </p>
              <p className="insight-meta">based on all recorded draws</p>
            </div>
            <div className="insight">
              <p className="insight-label">Popular multiplier</p>
              <p className="insight-value">
                {mostCommonMultiplier ? `x${mostCommonMultiplier.value}` : '—'}
              </p>
              <p className="insight-meta">
                {mostCommonMultiplier
                  ? `${mostCommonMultiplier.hits.toLocaleString('en-US')} uses`
                  : 'No data'}
              </p>
            </div>
          </section>

          <section className="charts">
            <article className="chart-card" aria-label="Main ball frequency chart">
              <h2 className="chart-title">Main ball frequency (top 15)</h2>
              <ResponsiveContainer width="100%" minHeight={360}>
                <BarChart data={topMainNumbers} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1e1e1" />
                  <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 11 }} stroke="#c1c1c1" />
                  <YAxis allowDecimals={false} tick={{ fill: '#555', fontSize: 11 }} stroke="#c1c1c1" />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number' ? `${value.toLocaleString('en-US')} hits` : value
                    }
                  />
                  <Bar dataKey="hits" fill="#003459" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>

            <article className="chart-card" aria-label="Powerball frequency chart">
              <h2 className="chart-title">Powerball frequency (top 10)</h2>
              <ResponsiveContainer width="100%" minHeight={360}>
                <BarChart data={topPowerballNumbers} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1e1e1" />
                  <XAxis dataKey="label" tick={{ fill: '#555', fontSize: 11 }} stroke="#c1c1c1" />
                  <YAxis allowDecimals={false} tick={{ fill: '#555', fontSize: 11 }} stroke="#c1c1c1" />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number' ? `${value.toLocaleString('en-US')} hits` : value
                    }
                  />
                  <Bar dataKey="hits" fill="#f28482" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </article>
          </section>

          <section className="picker" aria-label="Number picker">
            <div className="picker__form">
              <div>
                <p className="picker__title">Pick five main numbers</p>
                <div className="number-grid">
                  {mainPick.map((value, index) => (
                    <label key={`main-${index}`} className="number-field">
                      <span># {index + 1}</span>
                      <input
                        type="number"
                        min={MAIN_RANGE.min}
                        max={MAIN_RANGE.max}
                        value={value}
                        onChange={(event) => handleMainInputChange(index, event)}
                        className="number-input"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="powerball-field">
                <p className="picker__title">Powerball</p>
                <input
                  type="number"
                  min={POWERBALL_RANGE.min}
                  max={POWERBALL_RANGE.max}
                  value={powerballPick}
                  onChange={handlePowerballChange}
                  className="number-input number-input--powerball"
                />
              </div>
            </div>

            <div className="picker__actions">
              <button
                type="button"
                className="checker-button"
                disabled={!pickAnalysis.ready}
                onClick={handleCheckTicket}
              >
                {pickAnalysis.ready ? (isTicketChecked ? 'Reveal again' : 'Reveal results') : 'Complete your ticket'}
              </button>
              <p className="picker__hint">Choose five unique numbers (1–69) and one Powerball (1–26).</p>
            </div>

            <div className="picker__results">
              {!pickAnalysis.ready && (
                <p className="picker__status">
                  {pickAnalysis.hasDuplicates && 'Use five unique main numbers to check a ticket.'}
                  {!pickAnalysis.hasDuplicates && pickAnalysis.missingMain &&
                    'Enter all five main numbers to see if you ever hit a jackpot.'}
                  {!pickAnalysis.hasDuplicates && !pickAnalysis.missingMain && pickAnalysis.invalidPowerball &&
                    'Add a valid Powerball number (1-26).'}
                </p>
              )}

              {pickAnalysis.ready && !isTicketChecked && (
                <p className="picker__status picker__status--pulse">
                  Ticket locked in! Tap “Reveal results” to see how it performed.
                </p>
              )}

              {showResults && (
                <>
                  {pickAnalysis.jackpotHits.length > 0 ? (
                    <p className="picker__status picker__status--success">
                      Jackpot! These numbers hit {pickAnalysis.jackpotHits.length} time(s); most recently on{' '}
                      {pickAnalysis.jackpotHits[pickAnalysis.jackpotHits.length - 1].dateLabel}.
                    </p>
                  ) : (
                    <p className="picker__status">
                      No perfect matches yet, but these draws came closest:
                    </p>
                  )}

                  <ul className="match-list" aria-live="polite">
                    {(pickAnalysis.jackpotHits.length ? pickAnalysis.jackpotHits : pickAnalysis.bestDraws).map(
                      (draw) => (
                        <li key={`${draw.dateMs}-${draw.powerball}`} className="match-card">
                          <p className="match-card__headline">{draw.dateLabel}</p>
                          <p className="match-card__summary">
                            {draw.mainMatches} main number{draw.mainMatches === 1 ? '' : 's'}
                            {draw.powerballMatch ? ' + Powerball' : ''}
                          </p>
                          <div className="match-card__numbers">
                            {draw.mainNumbers.map((number) => (
                              <span
                                key={`main-${draw.dateMs}-${number}`}
                                className={`ball-pill${selectedMainSet?.has(number) ? ' ball-pill--match' : ''}`}
                              >
                                {formatBall(number)}
                              </span>
                            ))}
                            <span
                              className={`ball-pill ball-pill--power${draw.powerballMatch ? ' ball-pill--match' : ''}`}
                            >
                              {formatBall(draw.powerball)}
                            </span>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default App
