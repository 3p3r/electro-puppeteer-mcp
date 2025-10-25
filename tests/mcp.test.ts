import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import axios from 'axios'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const MCP_ENDPOINT = 'http://localhost:3000/mcp'

describe('MCP Routes', { sequential: true }, () => {
  let sessionId: string

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
  
  it('should list available tools', async () => {
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      responseType: 'stream'
    })

    // Read the SSE response
    const stream = response.data
    let data = ''

    for await (const chunk of stream) {
      data += chunk.toString()
    }

    // Extract the JSON from the SSE data
    const lines = data.split('\n')
    const dataLine = lines.find((line: string) => line.startsWith('data: '))
    expect(dataLine).toBeDefined()

    const jsonData = dataLine!.replace('data: ', '')
    const parsed = JSON.parse(jsonData)

    expect(parsed).toHaveProperty('result')
    expect(parsed.result).toHaveProperty('tools')
    expect(Array.isArray(parsed.result.tools)).toBe(true)

    const toolNames = parsed.result.tools.map((tool: any) => tool.name)
    expect(toolNames).toContain('open_browser')
    expect(toolNames).toContain('close_browser')
    expect(toolNames).toContain('navigate_to_url')
  })

  it('should open browser with initialUrl', async () => {
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'open_browser',
        arguments: {
          initialUrl: 'https://example.com'
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      responseType: 'stream'
    })

    const stream = response.data
    let data = ''

    for await (const chunk of stream) {
      data += chunk.toString()
    }

    const lines = data.split('\n')
    const dataLine = lines.find((line: string) => line.startsWith('data: '))
    expect(dataLine).toBeDefined()

    const jsonData = dataLine!.replace('data: ', '')
    const parsed = JSON.parse(jsonData)

    expect(parsed).toHaveProperty('result')
    expect(parsed.result).toHaveProperty('content')
    expect(Array.isArray(parsed.result.content)).toBe(true)
    expect(parsed.result.content[0]).toHaveProperty('type', 'text')

    const result = JSON.parse(parsed.result.content[0].text)
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('message')
    expect(result).toHaveProperty('id')
    
    sessionId = result.id
  })

  it('should navigate to URL with session ID', async () => {
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'navigate_to_url',
        arguments: {
          id: sessionId,
          url: 'https://example.com/?q=1'
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      responseType: 'stream'
    })

    const stream = response.data
    let data = ''

    for await (const chunk of stream) {
      data += chunk.toString()
    }

    const lines = data.split('\n')
    const dataLine = lines.find((line: string) => line.startsWith('data: '))
    expect(dataLine).toBeDefined()

    const jsonData = dataLine!.replace('data: ', '')
    const parsed = JSON.parse(jsonData)

    expect(parsed).toHaveProperty('result')
    expect(parsed.result).toHaveProperty('content')
    expect(Array.isArray(parsed.result.content)).toBe(true)
    expect(parsed.result.content[0]).toHaveProperty('type', 'text')

    const result = JSON.parse(parsed.result.content[0].text)
    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('currentUrl')
  })

  it('should close browser with session ID', async () => {
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'close_browser',
        arguments: {
          id: sessionId
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      responseType: 'stream'
    })

    const stream = response.data
    let data = ''

    for await (const chunk of stream) {
      data += chunk.toString()
    }

    const lines = data.split('\n')
    const dataLine = lines.find((line: string) => line.startsWith('data: '))
    expect(dataLine).toBeDefined()

    const jsonData = dataLine!.replace('data: ', '')
    const parsed = JSON.parse(jsonData)

    expect(parsed).toHaveProperty('result')
    expect(parsed.result).toHaveProperty('content')
    expect(Array.isArray(parsed.result.content)).toBe(true)
    expect(parsed.result.content[0]).toHaveProperty('type', 'text')

    const result = JSON.parse(parsed.result.content[0].text)
    expect(result).toHaveProperty('success', true)
  })
})
