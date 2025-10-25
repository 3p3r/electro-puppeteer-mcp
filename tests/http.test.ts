import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import axios from 'axios'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const BASE_URL = 'http://localhost:3000'

describe('HTTP Routes', { sequential: true }, () => {
  beforeAll(async () => {
    // Start the server
    execAsync('npm start')
    // Wait a bit for the server to fully start
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 30000) // 30 second timeout for server startup

  afterAll(async () => {
    // Stop the server
    await execAsync('npm stop').catch(() => { /* ignore errors on shutdown */ })
  }, 10000) // 10 second timeout for server shutdown
  
  describe('Status Route', () => {
    it('should return health check metrics with sessions info', async () => {
      const response = await axios.get(`${BASE_URL}/status`)

      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('uptime')
      expect(response.data).toHaveProperty('memoryUsage')
      expect(response.data).toHaveProperty('browser')
      expect(response.data).toHaveProperty('sessions')
      expect(response.data).toHaveProperty('timestamp')

      // Check that uptime is a number
      expect(typeof response.data.uptime).toBe('number')
      expect(response.data.uptime).toBeGreaterThanOrEqual(0)

      // Check memory usage structure
      expect(response.data.memoryUsage).toHaveProperty('rss')
      expect(response.data.memoryUsage).toHaveProperty('heapTotal')
      expect(response.data.memoryUsage).toHaveProperty('heapUsed')
      expect(response.data.memoryUsage).toHaveProperty('external')

      // Check browser status
      expect(response.data.browser).toHaveProperty('isOpen')
      expect(typeof response.data.browser.isOpen).toBe('boolean')

      // Check sessions info
      expect(response.data.sessions).toHaveProperty('active')
      expect(typeof response.data.sessions.active).toBe('number')

      // Check timestamp format
      expect(typeof response.data.timestamp).toBe('string')
      expect(new Date(response.data.timestamp).toISOString()).toBe(response.data.timestamp)
    })
  })
  
  describe('Session Management', () => {
    let sessionId: string

    it('should create a new session with initialUrl', async () => {
      const response = await axios.post(`${BASE_URL}/sessions`, {
        initialUrl: 'https://example.com'
      })

      expect(response.status).toBe(201)
      expect(response.data).toHaveProperty('id')
      expect(typeof response.data.id).toBe('string')
      
      sessionId = response.data.id
    })

    it('should navigate a session to a URL', async () => {
      const response = await axios.post(`${BASE_URL}/sessions/${sessionId}/navigate`, {
        url: 'https://example.com/?q=1'
      })

      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('success', true)
      expect(response.data).toHaveProperty('currentUrl')
      expect(response.data.currentUrl).toContain('example.com')
    })

    it('should delete a session', async () => {
      const response = await axios.delete(`${BASE_URL}/sessions/${sessionId}`)

      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('success', true)
    })
  })
})
