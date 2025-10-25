import { BrowserWindow, app } from "electron";
import * as puppeteer from "puppeteer-core";
import pie from "puppeteer-in-electron";
import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { statelessHandler } from "express-mcp-handler";
import { z } from "zod";

const expressApp = express();
const port = 3000;

// Global state for browser management
let globalBrowser: puppeteer.Browser | null = null;
let globalPage: puppeteer.Page | null = null;
let globalWindow: BrowserWindow | null = null;

// Shared business logic functions
const browserOperations = {
  async open(): Promise<{ success: boolean; message: string }> {
    try {
      if (globalBrowser && globalPage && globalWindow) {
        return { success: false, message: "Browser already open" };
      }

      await pie.initialize(app);
      globalBrowser = await pie.connect(app, puppeteer);
      globalWindow = new BrowserWindow();
      globalPage = await pie.getPage(globalBrowser, globalWindow);

      return { success: true, message: "Browser opened successfully" };
    } catch (error) {
      return { success: false, message: `Failed to open browser: ${error}` };
    }
  },

  async close(): Promise<{ success: boolean; message: string }> {
    try {
      if (!globalBrowser || !globalWindow) {
        return { success: false, message: "No browser to close" };
      }

      globalWindow.destroy();
      await globalBrowser.close();

      globalBrowser = null;
      globalPage = null;
      globalWindow = null;

      return { success: true, message: "Browser closed successfully" };
    } catch (error) {
      return { success: false, message: `Failed to close browser: ${error}` };
    }
  },

  async navigate(url: string): Promise<{ success: boolean; message: string; currentUrl?: string }> {
    try {
      if (!globalPage) {
        return { success: false, message: "No browser page available. Call open first." };
      }

      await globalWindow!.loadURL(url);
      const currentUrl = globalPage.url();

      return { success: true, message: `Navigated to ${url}`, currentUrl };
    } catch (error) {
      return { success: false, message: `Failed to navigate: ${error}` };
    }
  },

  async scrape(): Promise<{ success: boolean; message: string; content?: string; title?: string }> {
    try {
      if (!globalPage) {
        return { success: false, message: "No browser page available. Call open first." };
      }

      const content = await globalPage.evaluate(() => document.body.innerText);
      const title = await globalPage.evaluate(() => document.title);

      return { success: true, message: "Content scraped successfully", content, title };
    } catch (error) {
      return { success: false, message: `Failed to scrape: ${error}` };
    }
  }
};

// HTTP route handlers that use shared logic
const routeHandlers = {
  open: async (req: Request, res: Response): Promise<void> => {
    const result = await browserOperations.open();
    res.json(result);
  },
  close: async (req: Request, res: Response): Promise<void> => {
    const result = await browserOperations.close();
    res.json(result);
  },
  navigate: async (req: Request, res: Response): Promise<void> => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ success: false, message: "URL parameter required" });
      return;
    }
    const result = await browserOperations.navigate(url);
    res.json(result);
  },
  fetch: async (req: Request, res: Response): Promise<void> => {
    const result = await browserOperations.scrape();
    res.json(result);
  },

  status: async (req: Request, res: Response): Promise<void> => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const isBrowserOpen = globalBrowser !== null && globalPage !== null && globalWindow !== null;

    const status = {
      uptime: Math.floor(uptime),
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      browser: {
        isOpen: isBrowserOpen
      },
      timestamp: new Date().toISOString()
    };

    res.json(status);
  }
};

// Express routes
expressApp.get("/open", routeHandlers.open);
expressApp.get("/close", routeHandlers.close);
expressApp.get("/navigate", routeHandlers.navigate);
expressApp.get("/fetch", routeHandlers.fetch);
expressApp.get("/status", routeHandlers.status);

// MCP Server setup
const createMcpServer = () => {
  const server = new McpServer({
    name: 'electro-puppeteer-mcp',
    version: '1.0.0'
  });

  // Register MCP tools that use the same logic as HTTP routes
  server.registerTool(
    'open_browser',
    {
      title: 'Open Browser',
      description: 'Open a new browser window for web scraping',
      inputSchema: {},
      outputSchema: {
        success: z.boolean(),
        message: z.string()
      }
    },
    async () => {
      const result = await browserOperations.open();
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  server.registerTool(
    'close_browser',
    {
      title: 'Close Browser',
      description: 'Close the currently open browser window',
      inputSchema: {},
      outputSchema: {
        success: z.boolean(),
        message: z.string()
      }
    },
    async () => {
      const result = await browserOperations.close();
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  server.registerTool(
    'navigate_to_url',
    {
      title: 'Navigate to URL',
      description: 'Navigate the browser to a specific URL',
      inputSchema: {
        url: z.string().url().describe('The URL to navigate to')
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
        currentUrl: z.string().optional()
      }
    },
    async ({ url }) => {
      const result = await browserOperations.navigate(url);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

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
        title: z.string().optional()
      }
    },
    async () => {
      const result = await browserOperations.scrape();
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  return server;
};

// MCP handler using express-mcp-handler
const mcpHandler = statelessHandler(createMcpServer);
expressApp.use("/mcp", mcpHandler);

const main = async (): Promise<void> => {
  // Start Express server
  expressApp.listen(port, () => {
    console.log(`Express server running on port ${port}`);
    console.log(`HTTP API available at: http://localhost:${port}`);
    console.log(`MCP endpoint available at: http://localhost:${port}/mcp`);
  });
};

main();