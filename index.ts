import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { app, BrowserWindow } from 'electron'
import express, { type Request, type Response } from 'express'
import { statelessHandler } from 'express-mcp-handler'
import * as puppeteer from 'puppeteer-core'
import pie from 'puppeteer-in-electron'
import { z } from 'zod'

const expressApp = express()
expressApp.use(express.json())
const port = 3000

// Session management
interface Session {
  window: BrowserWindow
  page: puppeteer.Page
}

const sessions = new Map<string, Session>()
let globalBrowser: puppeteer.Browser | null = null

// Helper functions
const generateId = (): string => randomUUID()

const resolveSession = (id: string): Session | null => {
  return sessions.get(id) || null
}

const ensurePieConnected = async (): Promise<void> => {
  if (!globalBrowser) {
    globalBrowser = await pie.connect(app, puppeteer)
  }
}

// Shared business logic functions
const browserOperations = {
  async open(initialUrl?: string): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      await ensurePieConnected()

      if (!globalBrowser) {
        return { success: false, message: 'Failed to initialize browser' }
      }

      const window = new BrowserWindow()
      const page = await pie.getPage(globalBrowser, window)
      const id = generateId()

      sessions.set(id, { window, page })

      if (initialUrl) {
        await window.loadURL(initialUrl)
      }

      return { success: true, message: 'Browser session opened successfully', id }
    } catch (error) {
      return { success: false, message: `Failed to open browser: ${error}` }
    }
  },

  async close(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = resolveSession(id)
      if (!session) {
        return { success: false, message: 'Session not found' }
      }

      // Use close() instead of destroy() for graceful shutdown
      if (!session.window.isDestroyed()) {
        session.window.close()
      }
      sessions.delete(id)

      return { success: true, message: 'Browser session closed successfully' }
    } catch (error) {
      return { success: false, message: `Failed to close browser: ${error}` }
    }
  },

  async navigate(
    id: string,
    url: string
  ): Promise<{ success: boolean; message: string; currentUrl?: string }> {
    try {
      const session = resolveSession(id)
      if (!session) {
        return { success: false, message: 'Session not found' }
      }

      await session.window.loadURL(url)
      const currentUrl = session.page.url()

      return { success: true, message: `Navigated to ${url}`, currentUrl }
    } catch (error) {
      return { success: false, message: `Failed to navigate: ${error}` }
    }
  },

  async fetch(
    id: string
  ): Promise<{ success: boolean; message: string; content?: string; title?: string }> {
    try {
      const session = resolveSession(id)
      if (!session) {
        return { success: false, message: 'Session not found' }
      }

      const content = await session.page.evaluate(() => document.body.innerText)
      const title = await session.page.evaluate(() => document.title)

      return { success: true, message: 'Content fetched successfully', content, title }
    } catch (error) {
      return { success: false, message: `Failed to fetch: ${error}` }
    }
  },
}

// HTTP route handlers that use shared logic
const routeHandlers = {
  createSession: async (req: Request, res: Response): Promise<void> => {
    const { initialUrl } = req.body
    const result = await browserOperations.open(initialUrl)
    if (result.success && result.id) {
      res.status(201).json({ id: result.id })
    } else {
      res.status(500).json(result)
    }
  },

  deleteSession: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const session = resolveSession(id)
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' })
      return
    }
    const result = await browserOperations.close(id)
    res.status(200).json(result)
  },

  navigateSession: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const { url } = req.body
    const session = resolveSession(id)
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' })
      return
    }
    if (!url) {
      res.status(400).json({ success: false, message: 'URL required in request body' })
      return
    }
    const result = await browserOperations.navigate(id, url)
    res.status(200).json(result)
  },

  fetchSession: async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json({ success: false, message: 'Not implemented' })
  },

  status: async (_req: Request, res: Response): Promise<void> => {
    const uptime = process.uptime()
    const memoryUsage = process.memoryUsage()
    const activeSessions = sessions.size

    const status = {
      uptime: Math.floor(uptime),
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      browser: {
        isOpen: activeSessions > 0,
      },
      sessions: {
        active: activeSessions,
      },
      timestamp: new Date().toISOString(),
    }

    res.json(status)
  },
}

// Express routes
expressApp.post('/sessions', routeHandlers.createSession)
expressApp.delete('/sessions/:id', routeHandlers.deleteSession)
expressApp.post('/sessions/:id/navigate', routeHandlers.navigateSession)
expressApp.get('/sessions/:id/fetch', routeHandlers.fetchSession)
expressApp.get('/status', routeHandlers.status)

// MCP Server setup
const createMcpServer = () => {
  const server = new McpServer({
    name: 'electro-puppeteer-mcp',
    version: '1.0.0',
  })

  // Register MCP tools that use the same logic as HTTP routes
  server.registerTool(
    'open_browser',
    {
      title: 'Open Browser',
      description: 'Open a new browser session for web scraping',
      inputSchema: {
        initialUrl: z.string().url().optional().describe('Optional URL to load initially'),
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
        id: z.string().optional(),
      },
    },
    async ({ initialUrl }) => {
      const result = await browserOperations.open(initialUrl)
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      }
    }
  )

  server.registerTool(
    'close_browser',
    {
      title: 'Close Browser',
      description: 'Close a browser session',
      inputSchema: {
        id: z.string().describe('The session ID to close'),
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
      },
    },
    async ({ id }) => {
      const result = await browserOperations.close(id)
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      }
    }
  )

  server.registerTool(
    'navigate_to_url',
    {
      title: 'Navigate to URL',
      description: 'Navigate a browser session to a specific URL',
      inputSchema: {
        id: z.string().describe('The session ID'),
        url: z.string().url().describe('The URL to navigate to'),
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
        currentUrl: z.string().optional(),
      },
    },
    async ({ id, url }) => {
      const result = await browserOperations.navigate(id, url)
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      }
    }
  )

  server.registerTool(
    'fetch_page_content',
    {
      title: 'Fetch Page Content',
      description: 'Extract text content and title from the current page',
      inputSchema: {},
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
        content: z.string().optional(),
        title: z.string().optional(),
      },
    },
    async () => {
      const result = { success: false, message: 'Not implemented' }
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      }
    }
  )

  return server
}

// MCP handler using express-mcp-handler
const mcpHandler = statelessHandler(createMcpServer)
expressApp.use('/mcp', mcpHandler)

const main = async (): Promise<void> => {
  // Initialize PIE before app is ready
  await pie.initialize(app)

  // Wait for Electron app to be ready
  await app.whenReady()

  // Prevent app from quitting when all windows are closed (server mode)
  app.on('window-all-closed', () => {
    // Do nothing - keep the app running
  })

  // Start Express server
  expressApp.listen(port, () => {
    console.log(`Express server running on port ${port}`)
    console.log(`HTTP API available at: http://localhost:${port}`)
    console.log(`MCP endpoint available at: http://localhost:${port}/mcp`)
  })
}

main()
