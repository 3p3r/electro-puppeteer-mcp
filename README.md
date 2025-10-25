# electro-puppeteer-mcp

A powerful Electron application that provides both HTTP REST API and Model Context Protocol (MCP) interfaces for managing browser automation sessions using Puppeteer. Enables programmatic control of browser windows with full Chrome DevTools Protocol access.

## Overview

This project combines:
- **Electron** - Provides native browser window management
- **Puppeteer** - Enables Chrome DevTools Protocol automation
- **Express** - RESTful HTTP API server
- **MCP** - Model Context Protocol for AI agent integration

## Features

- 🌐 **Multi-Session Management** - Create and manage multiple isolated browser sessions with unique IDs
- 🔌 **Dual Interface** - Access via HTTP REST API or MCP protocol
- 🚀 **Real Browser Automation** - Full Puppeteer capabilities with actual Chrome rendering
- 📊 **System Monitoring** - Built-in status endpoint for health checks
- 🎯 **Session Isolation** - Each session maintains independent state and context

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## API Documentation

### HTTP REST API

All HTTP endpoints are available at `http://localhost:3000`

#### Create Session
Creates a new browser session with an optional initial URL.

**Endpoint:** `POST /sessions`

**Request Body:**
```json
{
  "initialUrl": "https://example.com"  // optional
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"initialUrl": "https://example.com"}'
```

---

#### Navigate Session
Navigates an existing session to a new URL.

**Endpoint:** `POST /sessions/:id/navigate`

**Request Body:**
```json
{
  "url": "https://example.com/?q=search"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Navigated to https://example.com/?q=search",
  "currentUrl": "https://example.com/?q=search"
}
```

**Error Response:** `404 Not Found`
```json
{
  "success": false,
  "message": "Session not found"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/sessions/{SESSION_ID}/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

#### Delete Session
Closes and removes a browser session.

**Endpoint:** `DELETE /sessions/:id`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Browser session closed successfully"
}
```

**Error Response:** `404 Not Found`
```json
{
  "success": false,
  "message": "Session not found"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/sessions/{SESSION_ID}
```

---

#### Fetch Page Content
**Status:** Not Implemented

**Endpoint:** `GET /sessions/:id/fetch`

**Response:** `501 Not Implemented`
```json
{
  "success": false,
  "message": "Not implemented"
}
```

---

#### Health Status
Returns server health metrics and session information.

**Endpoint:** `GET /status`

**Response:** `200 OK`
```json
{
  "uptime": 42,
  "memoryUsage": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321,
    "external": 1234567
  },
  "browser": {
    "isOpen": true
  },
  "sessions": {
    "active": 2
  },
  "timestamp": "2025-10-25T10:44:15.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/status
```

---

### MCP Protocol

The MCP endpoint is available at `http://localhost:3000/mcp` and follows the JSON-RPC 2.0 specification with Server-Sent Events (SSE) responses.

#### Available Tools

##### open_browser
Opens a new browser session with an optional initial URL.

**Input Schema:**
```typescript
{
  initialUrl?: string  // Optional URL to load initially
}
```

**Output:**
```json
{
  "success": true,
  "message": "Browser session opened successfully",
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "open_browser",
    "arguments": {
      "initialUrl": "https://example.com"
    }
  }
}
```

---

##### close_browser
Closes an existing browser session.

**Input Schema:**
```typescript
{
  id: string  // Session ID to close
}
```

**Output:**
```json
{
  "success": true,
  "message": "Browser session closed successfully"
}
```

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "close_browser",
    "arguments": {
      "id": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

---

##### navigate_to_url
Navigates a browser session to a specific URL.

**Input Schema:**
```typescript
{
  id: string,    // Session ID
  url: string    // URL to navigate to
}
```

**Output:**
```json
{
  "success": true,
  "message": "Navigated to https://example.com",
  "currentUrl": "https://example.com"
}
```

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "navigate_to_url",
    "arguments": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://example.com/?q=1"
    }
  }
}
```

---

##### fetch_page_content
**Status:** Not Implemented

Returns an error indicating the feature is not yet implemented.

**Output:**
```json
{
  "success": false,
  "message": "Not implemented"
}
```

---

## Project Structure

```
electro-puppeteer-mcp/
├── index.ts              # Main application file
│   ├── Session Management    # Map-based session storage with UUID keys
│   ├── HTTP Routes          # Express REST API endpoints
│   ├── MCP Server           # Model Context Protocol implementation
│   └── Electron Setup       # App initialization and lifecycle
├── tests/
│   ├── http.test.ts     # Integration tests for HTTP API
│   └── mcp.test.ts      # Integration tests for MCP protocol
├── agents/              # Agent planning and artifacts
│   └── routes.plan.md   # Refactoring plan documentation
├── dist/                # Compiled TypeScript output
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── biome.json          # Biome linter/formatter configuration
```

### Key Components

#### Session Management
- Sessions stored in `Map<string, { window: BrowserWindow, page: puppeteer.Page }>`
- UUID-based session identifiers using `crypto.randomUUID()`
- Lazy browser initialization on first session creation
- Graceful window cleanup with `window.close()`

#### Browser Operations
Core functionality shared between HTTP and MCP interfaces:
- `open(initialUrl?)` - Create new session
- `close(id)` - Remove session
- `navigate(id, url)` - Load URL in session
- `fetch(id)` - (Not implemented) Extract page content

#### Server Architecture
- **Puppeteer-in-Electron (PIE)** initialized before app ready
- **Express** server starts after Electron ready
- **Window-all-closed** handler prevents app quit (server mode)
- **Port 3000** for both HTTP and MCP endpoints

---

## Useful Commands

### Development

```bash
# Build TypeScript to JavaScript
npm run build

# Start the Electron application
npm start

# Stop the application
npm stop

# Run in development (build + start)
npm run build && npm start
```

### Testing

```bash
# Run all integration tests
npm test

# Tests use real Electron/Puppeteer - no mocking
# Both test suites run sequentially with actual server instances
```

### Code Quality

```bash
# Check linting and formatting
npm run lint

# Auto-format code
npm run format

# Biome handles both linting and formatting
```

### Process Management

```bash
# Kill any stuck Electron processes
pkill -f 'electron dist/index.js'

# Check if server is running
curl http://localhost:3000/status
```

---

## Session Lifecycle Example

### HTTP API Flow

```bash
# 1. Start server
npm start

# 2. Create a new session
SESSION_ID=$(curl -s -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"initialUrl": "https://example.com"}' \
  | jq -r '.id')

echo "Created session: $SESSION_ID"

# 3. Navigate to a different page
curl -X POST http://localhost:3000/sessions/$SESSION_ID/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/?q=search"}'

# 4. Check server status
curl http://localhost:3000/status | jq

# 5. Close the session
curl -X DELETE http://localhost:3000/sessions/$SESSION_ID

# 6. Verify session is closed
curl http://localhost:3000/status | jq '.sessions.active'
```

### MCP Protocol Flow

```bash
# 1. List available tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'

# 2. Open browser with MCP
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "open_browser",
      "arguments": {"initialUrl": "https://example.com"}
    }
  }'
```

---

## Technical Notes

### Electron + Puppeteer Integration

- **PIE (Puppeteer-in-Electron)** must call `pie.initialize(app)` before `app.whenReady()`
- Browser windows are real Electron `BrowserWindow` instances
- Puppeteer pages connected via Chrome DevTools Protocol
- Full access to page evaluation, network interception, and automation

### WSL2 Considerations

DBUS errors in WSL2 are expected and don't affect functionality:
```
ERROR:dbus/bus.cc:408] Failed to connect to the bus
```
These errors are cosmetic - Electron runs fine without DBUS in WSL2.

### Test Architecture

- **Real Integration Tests** - No mocking, actual Electron processes
- **Sequential Execution** - Tests run one at a time to avoid port conflicts
- **Server Lifecycle** - Each test suite starts/stops the server
- **Timing-Safe** - 2-second startup delay ensures server is ready

---

## Configuration

### Port Configuration
Default port is `3000`. To change, modify `index.ts`:
```typescript
const port = 3000
```

### Browser Options
Customize Electron `BrowserWindow` options in `browserOperations.open()`:
```typescript
const window = new BrowserWindow({
  width: 1280,
  height: 720,
  // Add more options here
})
```

---

## Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill any existing processes
npm stop
```

### Tests failing
```bash
# Ensure no server is running
npm stop

# Clean build and retry
rm -rf dist/
npm run build
npm test
```

### Memory Issues
Monitor session count and close unused sessions:
```bash
curl http://localhost:3000/status | jq '.sessions.active'
```

---

## Contributing

1. Follow TypeScript strict mode guidelines
2. Use Biome for code formatting (`npm run format`)
3. Ensure all tests pass (`npm test`)
4. No mocking in tests - use real integration tests
5. Update README for new features or API changes

---

## License

See LICENSE file for details.

---

## Related Technologies

- [Electron](https://www.electronjs.org/) - Cross-platform desktop applications
- [Puppeteer](https://pptr.dev/) - Headless Chrome automation
- [Puppeteer-in-Electron](https://github.com/TryGhost/puppeteer-in-electron) - PIE integration
- [Express](https://expressjs.com/) - Web framework for Node.js
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Biome](https://biomejs.dev/) - Fast linter and formatter
- [Vitest](https://vitest.dev/) - Fast unit test framework
