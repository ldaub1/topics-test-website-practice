import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const CSV_URL = '/Open_Data_Website_Traffic.csv'

const parseNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/)
  const dataLines = lines.slice(1)

  const parsed = dataLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((value) => value.trim()))
    .map((cols) => {
      const [dateString, socrataUsers, , , geohubUsers, , , combinedUsers] = cols
      if (!dateString) return null

      const [month, day, year] = dateString.split('/').map((part) => Number(part))
      const date = new Date(year, month - 1, day)
      if (Number.isNaN(date.getTime())) return null

      const socrataValue = parseNumber(socrataUsers)
      const geohubValue = parseNumber(geohubUsers)
      let combinedValue = parseNumber(combinedUsers)

      if (combinedValue === null && (socrataValue !== null || geohubValue !== null)) {
        combinedValue = (socrataValue ?? 0) + (geohubValue ?? 0)
      }

      if (combinedValue === null) return null

      return {
        dateMs: date.getTime(),
        dateLabel: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        socrataUsers: socrataValue,
        geohubUsers: geohubValue,
        combinedUsers: combinedValue,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.dateMs - b.dateMs)

  return parsed
}

function App() {
  const [chartData, setChartData] = useState([])
  const [status, setStatus] = useState('loading')

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
          setChartData(parsedData)
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

  const peakDay = useMemo(() => {
    if (!chartData.length) return null
    return chartData.reduce((highest, entry) =>
      entry.combinedUsers > highest.combinedUsers ? entry : highest,
    chartData[0])
  }, [chartData])

  const timeRangeLabel = useMemo(() => {
    if (!chartData.length) return null
    const startYear = new Date(chartData[0].dateMs).getFullYear()
    const endYear = new Date(chartData[chartData.length - 1].dateMs).getFullYear()
    return `${startYear}–${endYear}`
  }, [chartData])

  return (
    <main className="app">
      <header className="app__header">
        <h1>Daily utilization metrics for data.lacity.org</h1>
        <p className="subhead">Combined Socrata + GeoHub users ({timeRangeLabel ?? '2014–2018'}).</p>
        {peakDay && (
          <p className="meta">
            Highest combined traffic: {peakDay.combinedUsers.toLocaleString()} users on {peakDay.dateLabel}.
          </p>
        )}
      </header>

      {status === 'loading' && <p className="status">Loading traffic data…</p>}
      {status === 'error' && (
        <p className="status status--error">
          Something went wrong while loading the CSV. Please try again.
        </p>
      )}
      {status === 'empty' && (
        <p className="status status--error">
          The data file was empty. Double-check the CSV contents and refresh.
        </p>
      )}

      {status === 'ready' && (
        <>
          <section className="chart-card" aria-label="Combined Socrata and GeoHub traffic line chart">
            <ResponsiveContainer width="100%" minHeight={420}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#e1e1e1" strokeDasharray="4 4" />
                <XAxis
                  dataKey="dateMs"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value) => new Date(value).getFullYear()}
                  tick={{ fill: '#555', fontSize: 12 }}
                  stroke="#c1c1c1"
                />
                <YAxis
                  tickFormatter={(value) => value.toLocaleString('en-US')}
                  tick={{ fill: '#555', fontSize: 12 }}
                  stroke="#c1c1c1"
                  width={70}
                />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel ?? ''}
                  formatter={(value, name) => [`${value.toLocaleString()} users`, name]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="combinedUsers"
                  name="Combined users"
                  stroke="#003459"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="socrataUsers"
                  name="Socrata users"
                  stroke="#4f772d"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="geohubUsers"
                  name="GeoHub users"
                  stroke="#f28482"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="2 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </main>
  )
}

export default App
