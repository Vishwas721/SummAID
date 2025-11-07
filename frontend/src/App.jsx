import { useState, useEffect } from 'react'
import axios from 'axios'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [apiStatus, setApiStatus] = useState('checking...')

  useEffect(() => {
    // Check API health when component mounts
    const checkApiHealth = async () => {
      try {
        // Use environment variable for API URL
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/`)
        console.log('API Response:', response.data)
        setApiStatus(`connected - ${response.data.message || ''}`)
      } catch (error) {
        console.error('API Error:', error)
        setApiStatus('error connecting')
      }
    }

    checkApiHealth()
  }, [])

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>SummAID</h1>
      <div className="card">
        <p>API Status: {apiStatus}</p>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <p className="read-the-docs">
        Backend connection status is shown above
      </p>
    </>
  )
}

export default App
