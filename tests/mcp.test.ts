import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import axios from 'axios'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const MCP_ENDPOINT = 'http://localhost:3000/mcp'

describe('MCP Routes', { sequential: true }, () => {
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
    expect(parsed.result.tools).toHaveLength(4)

    const toolNames = parsed.result.tools.map((tool: any) => tool.name)
    expect(toolNames).toContain('open_browser')
    expect(toolNames).toContain('close_browser')
    expect(toolNames).toContain('navigate_to_url')
    expect(toolNames).toContain('fetch_page_content')
  })

  it('should open browser', async () => {
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'open_browser',
        arguments: {}
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
  })

  it('should close browser', async () => {
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'close_browser',
        arguments: {}
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
  })

  it('should navigate to URL', async () => {
    // First open browser
    await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'open_browser',
        arguments: {}
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      responseType: 'stream'
    })

    // Then navigate
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'navigate_to_url',
        arguments: {
          url: 'https://example.com'
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
    // currentUrl is only present on success
    if (result.success) {
      expect(result).toHaveProperty('currentUrl')
    }
  })

  it('should fetch page content', async () => {
    // First open browser and navigate
    await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'open_browser',
        arguments: {}
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      responseType: 'stream'
    })

    await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'navigate_to_url',
        arguments: {
          url: 'https://example.com'
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      responseType: 'stream'
    })

    // Then fetch content
    const response = await axios.post(MCP_ENDPOINT, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'fetch_page_content',
        arguments: {}
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
    // content and title are only present on success
    if (result.success) {
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('title')
    }
  })
})
