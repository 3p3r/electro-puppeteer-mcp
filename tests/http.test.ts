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
    // Stop the server using the quit route
    try {
      await axios.post(`${BASE_URL}/quit`)
      // Give the server time to shut down gracefully
      await new Promise(resolve => setTimeout(resolve, 300))
    } catch (error) {
      // Ignore errors on shutdown (e.g., connection refused after quit)
    }
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

  describe('Screenshot Endpoint', () => {
    let sessionId: string

    it('should create a session for screenshot test', async () => {
      const response = await axios.post(`${BASE_URL}/sessions`, {
        initialUrl: 'https://example.com'
      })

      expect(response.status).toBe(201)
      expect(response.data).toHaveProperty('id')
      sessionId = response.data.id
    })

    it('should capture a screenshot as PNG', async () => {
      const response = await axios.get(`${BASE_URL}/sessions/${sessionId}/screenshot`, {
        responseType: 'arraybuffer'
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('image/png')
      expect(response.data).toBeInstanceOf(Buffer)
      expect(response.data.length).toBeGreaterThan(0)
    })

    it('should return 404 for non-existent session screenshot', async () => {
      try {
        await axios.get(`${BASE_URL}/sessions/non-existent-id/screenshot`, {
          responseType: 'json'
        })
      } catch (error: any) {
        expect(error.response.status).toBe(404)
        expect(error.response.data).toHaveProperty('success', false)
        expect(error.response.data).toHaveProperty('message', 'Session not found')
      }
    })

    it('should clean up screenshot test session', async () => {
      const response = await axios.delete(`${BASE_URL}/sessions/${sessionId}`)
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('success', true)
    })
  })

  describe('Fetch Endpoint', () => {
    let sessionId: string

    const decodeBase64ToString = (b64: string): string => {
      return Buffer.from(b64, 'base64').toString('utf8')
    }

    it('should create a session for fetch tests', async () => {
      const response = await axios.post(`${BASE_URL}/sessions`, {
        initialUrl: 'https://example.com'
      })

      expect(response.status).toBe(201)
      expect(response.data).toHaveProperty('id')
      sessionId = response.data.id
    })

    it('should perform a GET fetch from the renderer', async () => {
      const response = await axios.post(`${BASE_URL}/sessions/${sessionId}/fetch`, {
        url: 'https://example.com',
        method: 'GET'
      })

      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('ok', true)
      expect(response.data).toHaveProperty('status', 200)
      expect(typeof response.data.headers).toBe('object')

      const contentType = response.data.headers['content-type'] || response.data.headers['Content-Type']
      expect(typeof contentType).toBe('string')
      expect((contentType as string).toLowerCase()).toContain('text/html')

      const html = decodeBase64ToString(response.data.bodyBase64)
      expect(typeof html).toBe('string')
      expect(html.length).toBeGreaterThan(0)
      expect(html.toLowerCase()).toContain('example domain')
    })

    it('should perform a POST fetch with a base64-encoded JSON body', async () => {
      const payload = { foo: 'bar', nested: { a: 1 } }
      const payloadStr = JSON.stringify(payload)
      const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64')

      const response = await axios.post(`${BASE_URL}/sessions/${sessionId}/fetch`, {
        url: `${BASE_URL}/echo`,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payloadB64,
        bodyEncoding: 'base64'
      })

      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('ok', true)
      expect(response.data.status).toBeGreaterThanOrEqual(200)
      expect(response.data.status).toBeLessThan(400)

      const contentType = response.data.headers['content-type'] || response.data.headers['Content-Type']
      expect(typeof contentType).toBe('string')
      expect((contentType as string).toLowerCase()).toContain('application/json')

      const bodyStr = decodeBase64ToString(response.data.bodyBase64)
      const parsed = JSON.parse(bodyStr)
      expect(parsed).toHaveProperty('body')
      expect(parsed.body).toMatchObject(payload)
    })

    it('should return 400 when url is missing in request body', async () => {
      try {
        await axios.post(`${BASE_URL}/sessions/${sessionId}/fetch`, {})
        throw new Error('Expected 400 error not thrown')
      } catch (error: any) {
        expect(error.response.status).toBe(400)
        expect(error.response.data).toHaveProperty('success', false)
        expect(error.response.data).toHaveProperty('message', 'Request body must include url')
      }
    })

    it('should return 404 for non-existent session fetch', async () => {
      try {
        await axios.post(`${BASE_URL}/sessions/non-existent-id/fetch`, { url: 'https://example.com' })
        throw new Error('Expected 404 error not thrown')
      } catch (error: any) {
        expect(error.response.status).toBe(404)
        expect(error.response.data).toHaveProperty('success', false)
        expect(error.response.data).toHaveProperty('message', 'Session not found')
      }
    })

    it('should clean up fetch test session', async () => {
      const response = await axios.delete(`${BASE_URL}/sessions/${sessionId}`)
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('success', true)
    })
  })
})
