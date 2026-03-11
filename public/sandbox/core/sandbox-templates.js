// ---------------------------------------------------------------------------
// sandbox-templates.js — Framework scaffold templates for the sandbox container.
// Each key is a template name; values are maps of vfs-path → file content.
// ---------------------------------------------------------------------------

// Packages to install per template (one npm.install call per entry).
// null means no extra install is needed beyond what's already bundled.
export const TEMPLATE_INSTALL_SPECS = {
	http: null,
	express: null,
	"vite-react": ["react", "react-dom", "vite", "@vitejs/plugin-react"],
	"next-pages": ["next", "react", "react-dom"],
	"next-app": ["next", "react", "react-dom"],
};

export const FRAMEWORK_TEMPLATES = {
	http: {
		"/server.js": `const http = require('http');

const server = http.createServer((req, res) => {
  console.log(\`\${req.method} \${req.url}\`);

  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(\`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: system-ui, sans-serif;
              padding: 2rem;
              background: #0c0c0c;
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #c0c0c0;
            }
            .card {
              border: 1px solid #2a2a2a;
              padding: 2rem;
              max-width: 480px;
            }
            h1 { color: #00ff88; margin-top: 0; }
            a { color: #00ff88; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Agent Runtime Active</h1>
            <p>This HTTP server is running inside an isolated browser runtime.</p>
            <p>Try <a href="/api/time">/api/time</a> or <a href="/api/random">/api/random</a></p>
          </div>
        </body>
      </html>
    \`);
  } else if (req.url === '/api/time') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ time: new Date().toISOString() }));
  } else if (req.url === '/api/random') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ random: Math.random() }));
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
`,
	},

	express: {
		"/server.js": `const express = require('express');
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Home route
app.get('/', (req, res) => {
  console.log('GET /');
  res.send(\`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: system-ui, sans-serif;
            padding: 2rem;
            background: #0c0c0c;
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #c0c0c0;
          }
          .card {
            border: 1px solid #2a2a2a;
            padding: 2rem;
            max-width: 480px;
          }
          h1 { color: #00ff88; margin-top: 0; }
          a { color: #00ff88; font-weight: bold; }
          code { background: #1a1a1a; padding: 2px 6px; border: 1px solid #2a2a2a; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Express Agent Runtime</h1>
          <p>This Express server is running inside an isolated browser runtime.</p>
          <p>Routes:</p>
          <p><a href="/api/users">/api/users</a> — list all users</p>
          <p><a href="/api/time">/api/time</a> — current time</p>
        </div>
      </body>
    </html>
  \`);
});

// API routes
app.get('/api/users', (req, res) => {
  console.log('GET /api/users');
  res.json([
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' }
  ]);
});

app.get('/api/time', (req, res) => {
  console.log('GET /api/time');
  res.json({
    timestamp: Date.now(),
    iso: new Date().toISOString(),
    readable: new Date().toLocaleString()
  });
});

app.get('/api/random', (req, res) => {
  console.log('GET /api/random');
  res.json({
    number: Math.random(),
    dice: Math.floor(Math.random() * 6) + 1
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Start server
app.listen(3000, () => {
  console.log('Express server running on port 3000');
});
`,
	},

	"vite-react": {
		"/package.json": JSON.stringify(
			{
				name: "vite-react-app",
				private: true,
				version: "0.0.0",
				type: "module",
				scripts: {
					dev: "vite",
					build: "vite build",
					preview: "vite preview",
				},
				dependencies: {
					react: "^18.2.0",
					"react-dom": "^18.2.0",
				},
				devDependencies: {
					"@vitejs/plugin-react": "^4.0.0",
					vite: "^5.0.0",
				},
			},
			null,
			2,
		),
		"/index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
		"/vite.config.js": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
		"/src/main.jsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
		"/src/App.jsx": `import React, { useState } from 'react';
import Counter from './Counter.jsx';

function App() {
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className={\`app \${theme}\`}>
      <header>
        <h1>⚡ React + Vite in Browser</h1>
        <p>Running with shimmed Node.js APIs</p>
      </header>

      <main>
        <Counter />

        <div className="theme-toggle">
          <button onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>

        <div className="info-card">
          <h3>How it works</h3>
          <ul>
            <li>VirtualFS stores all files in memory</li>
            <li>Node.js APIs are shimmed for the browser</li>
            <li>Edit files on the left to see HMR updates</li>
          </ul>
        </div>
      </main>

      <footer>
        Made with 💜 WebContainers
      </footer>
    </div>
  );
}

export default App;
`,
		"/src/Counter.jsx": `import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter-card">
      <h2>Interactive Counter</h2>
      <div className="counter-display">{count}</div>
      <div className="counter-buttons">
        <button onClick={() => setCount(c => c - 1)}>➖</button>
        <button onClick={() => setCount(0)}>Reset</button>
        <button onClick={() => setCount(c => c + 1)}>➕</button>
      </div>
    </div>
  );
}

export default Counter;
`,
		"/src/style.css": `* {
  box-sizing: border-box;
}

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
}

body {
  margin: 0;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.app.light {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.app.dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #eee;
}

header {
  text-align: center;
  padding: 2rem;
}

header h1 {
  font-size: 2.5rem;
  margin: 0 0 0.5rem 0;
}

header p {
  opacity: 0.8;
  margin: 0;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem;
}

.counter-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  min-width: 280px;
}

.counter-card h2 {
  margin: 0 0 1rem 0;
}

.counter-display {
  font-size: 4rem;
  font-weight: bold;
  margin: 1rem 0;
}

.counter-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

button:active {
  transform: translateY(0);
}

.theme-toggle button {
  background: rgba(0, 0, 0, 0.2);
}

.info-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
}

.info-card h3 {
  margin: 0 0 1rem 0;
}

.info-card ul {
  margin: 0;
  padding-left: 1.5rem;
}

.info-card li {
  margin: 0.5rem 0;
  opacity: 0.9;
}

footer {
  text-align: center;
  padding: 1.5rem;
  opacity: 0.7;
}
`,
	},

	"next-pages": {
		"/package.json": JSON.stringify(
			{
				name: "next-pages-app",
				version: "0.1.0",
				private: true,
				scripts: {
					dev: "next dev",
					build: "next build",
					start: "next start",
				},
				dependencies: {
					next: "^14.0.0",
					react: "^18.2.0",
					"react-dom": "^18.2.0",
				},
			},
			null,
			2,
		),
		"/next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
`,
		"/styles/globals.css": `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; background: #f5f5f5; color: #333; }
`,
		"/pages/_app.jsx": `import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
`,
		"/pages/index.jsx": `export default function Home() {
  return (
    <main style={{ maxWidth: 600, margin: '80px auto', padding: '0 20px' }}>
      <h1>Next.js Pages Router</h1>
      <p style={{ marginTop: 16 }}>
        Edit <code>pages/index.jsx</code> to get started.
      </p>
      <ul style={{ marginTop: 24, paddingLeft: 20 }}>
        <li><a href="/api/hello">GET /api/hello</a></li>
      </ul>
    </main>
  );
}
`,
		"/pages/api/hello.js": `export default function handler(req, res) {
  res.status(200).json({ message: 'Hello from Next.js API!', time: new Date().toISOString() });
}
`,
	},

	"next-app": {
		"/package.json": JSON.stringify(
			{
				name: "next-app-router",
				version: "0.1.0",
				private: true,
				scripts: {
					dev: "next dev",
					build: "next build",
					start: "next start",
				},
				dependencies: {
					next: "^14.0.0",
					react: "^18.2.0",
					"react-dom": "^18.2.0",
				},
			},
			null,
			2,
		),
		"/next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
`,
		"/app/globals.css": `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; background: #f5f5f5; color: #333; }
`,
		"/app/layout.jsx": `import './globals.css';

export const metadata = { title: 'Next.js App Router' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
		"/app/page.jsx": `export default function Page() {
  return (
    <main style={{ maxWidth: 600, margin: '80px auto', padding: '0 20px' }}>
      <h1>Next.js App Router</h1>
      <p style={{ marginTop: 16 }}>
        Edit <code>app/page.jsx</code> to get started.
      </p>
    </main>
  );
}
`,
		"/app/api/hello/route.js": `import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ message: 'Hello from App Router API!', time: new Date().toISOString() });
}
`,
	},
};
