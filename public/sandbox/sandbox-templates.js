// ---------------------------------------------------------------------------
// sandbox-templates.js — Framework scaffold templates for the sandbox container.
// Each key is a template name; values are maps of vfs-path → file content.
// ---------------------------------------------------------------------------

// Packages to install per template (one npm.install call per entry).
// null means no extra install is needed beyond what's already bundled.
export const TEMPLATE_INSTALL_SPECS = {
	express: null,
	"vite-react": ["react", "react-dom", "vite", "@vitejs/plugin-react"],
	"next-pages": ["next", "react", "react-dom"],
	"next-app": ["next", "react", "react-dom"],
};

export const FRAMEWORK_TEMPLATES = {
	express: {
		"/server.js": `const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.send(\`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Express App</title>
<style>body{font-family:sans-serif;max-width:600px;margin:80px auto;padding:0 20px}h1{color:#333}</style>
</head>
<body>
  <h1>Hello from Express!</h1>
  <p>Your server is running.</p>
  <ul>
    <li><a href="/api/hello">/api/hello</a></li>
    <li><a href="/api/time">/api/time</a></li>
    <li><a href="/api/random">/api/random</a></li>
  </ul>
</body>
</html>\`);
});

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello World!' });
});

app.get('/api/time', (_req, res) => {
  res.json({ time: new Date().toISOString() });
});

app.get('/api/random', (_req, res) => {
  res.json({ value: Math.random() });
});

app.post('/api/echo', (req, res) => {
  res.json({ echo: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
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
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
		"/src/App.jsx": `import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="counter">
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <h1>Vite + React</h1>
      <Counter />
      <p>Edit <code>src/App.jsx</code> and save to see HMR in action.</p>
    </div>
  );
}
`,
		"/src/App.css": `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: sans-serif; background: #f5f5f5; }
.app {
  max-width: 480px;
  margin: 60px auto;
  padding: 32px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,.08);
  text-align: center;
}
h1 { margin-bottom: 24px; color: #333; }
.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 16px 0 24px;
}
.counter button {
  width: 36px; height: 36px;
  font-size: 18px; border: none;
  border-radius: 50%; background: #646cff;
  color: white; cursor: pointer;
}
.counter span { font-size: 24px; font-weight: bold; min-width: 40px; }
p { color: #666; font-size: 14px; }
code { background: #eee; padding: 2px 6px; border-radius: 4px; }
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
