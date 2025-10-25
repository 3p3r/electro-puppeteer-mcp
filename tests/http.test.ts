import { describe, it, expect } from 'vitest'
import axios from 'axios'

const BASE_URL = 'http://localhost:3000'

describe('HTTP Routes', () => {
  describe('Status Route', () => {
  it('should return health check metrics', async () => {
    const response = await axios.get(`${BASE_URL}/status`)

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty('uptime')
    expect(response.data).toHaveProperty('memoryUsage')
    expect(response.data).toHaveProperty('browser')
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

    // Check timestamp format
    expect(typeof response.data.timestamp).toBe('string')
    expect(new Date(response.data.timestamp).toISOString()).toBe(response.data.timestamp)
  })
  })
})
