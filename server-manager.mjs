import http from 'http';
import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3099;
const LOG_FILE = path.join(__dirname, 'manager.log');

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line);
    console.log(msg);
}

log('--- Manager Starting ---');

// Server statuses & PIDs
const servers = {
    backend: { name: 'Backend', port: 3088, pid: null, cmd: 'node server.js', cwd: 'app' },
    admin: { name: 'Admin Panel', port: 5555, pid: null, cmd: 'npm run dev -- --mode admin --port 5555', cwd: 'app' },
    public: { name: 'Public Gallery', port: 5556, pid: null, cmd: 'npm run dev -- --mode production --port 5556', cwd: 'app' }
};

// Start a server
function startServer(type) {
    if (servers[type].pid) return;

    const { cmd, cwd } = servers[type];
    const [command, ...args] = cmd.split(' ');
    
    // Windows specifically needs shell: true for npm/node in some contexts
    const child = spawn(command, args, { 
        cwd: path.join(__dirname, cwd), 
        shell: true,
        stdio: 'inherit' 
    });

    servers[type].pid = child.pid;
    log(`🚀 Started ${servers[type].name} (PID: ${child.pid})`);

    child.on('exit', () => {
        log(`🛑 ${servers[type].name} stopped.`);
        servers[type].pid = null;
    });
}

// Stop a server (Reliable Windows Kill)
function stopServer(type) {
    if (!servers[type].pid) return;
    
    // Use taskkill to kill the whole process tree (important for Vite/npm)
    exec(`taskkill /F /T /PID ${servers[type].pid}`, (err) => {
        if (err) {
            log(`Failed to kill ${type}: ${err}`);
            // Fallback
            servers[type].pid = null; 
        }
    });
}

const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kefel Lashon - Control Center</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0f172a;
            --card: rgba(30, 41, 59, 0.7);
            --primary: #6366f1;
            --success: #22c55e;
            --danger: #ef4444;
            --text: #f8fafc;
        }

        body {
            margin: 0;
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-image: 
                radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
                radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
                radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%);
        }

        .container {
            width: 100%;
            max-width: 600px;
            padding: 2rem;
            background: var(--card);
            backdrop-filter: blur(12px);
            border-radius: 24px;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }

        h1 {
            text-align: center;
            margin-bottom: 2rem;
            font-weight: 800;
            background: linear-gradient(to right, #818cf8, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 2.5rem;
        }

        .server-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .server-card {
            background: rgba(15, 23, 42, 0.5);
            padding: 1.25rem;
            border-radius: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
        }

        .server-card:hover {
            transform: translateX(-5px);
            background: rgba(15, 23, 42, 0.8);
        }

        .info {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--danger);
            box-shadow: 0 0 10px var(--danger);
        }

        .status-dot.active {
            background: var(--success);
            box-shadow: 0 0 15px var(--success);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }

        .name { font-weight: 600; font-size: 1.1rem; }
        .port { font-size: 0.8rem; color: #94a3b8; }

        .actions {
            display: flex;
            gap: 0.5rem;
        }

        button {
            padding: 0.6rem 1.2rem;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
            font-family: inherit;
        }

        .btn-start { background: var(--primary); color: white; }
        .btn-start:hover { background: #4f46e5; box-shadow: 0 0 15px rgba(99, 102, 241, 0.4); }

        .btn-stop { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger); }
        .btn-stop:hover { background: var(--danger); color: white; }

        .global-actions {
            margin-top: 2rem;
            display: flex;
            gap: 1rem;
        }

        .btn-all { flex: 1; padding: 1rem; font-size: 1.1rem; border-radius: 14px; }
        .btn-all-start { background: linear-gradient(135deg, #6366f1, #a855f7); color: white; }
        .btn-all-stop { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444; }

        .footer {
            margin-top: 2rem;
            text-align: center;
            font-size: 0.8rem;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>מרכז שליטה - כפל לשון</h1>
        
        <div class="server-list" id="serverList">
            <!-- Dynamic Content -->
        </div>

        <div class="global-actions">
            <button class="btn-all btn-all-start" onclick="action('start-all')">הפעל הכל</button>
            <button class="btn-all btn-all-stop" onclick="action('stop-all')">כבה הכל</button>
        </div>
        
        <div style="margin-top: 1rem;">
            <button class="btn-all" style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3);" onclick="exitManager()">סגור מרכז שליטה</button>
        </div>

        <div class="footer">
            Manager running on port ${PORT} | Antigravity AI
        </div>
    </div>

    <script>
        async function updateStatus() {
            const resp = await fetch('/status');
            const data = await resp.json();
            
            const html = Object.entries(data).map(([id, s]) => \`
                <div class="server-card">
                    <div class="info">
                        <div class="status-dot \${s.pid ? 'active' : ''}"></div>
                        <div>
                            <div class="name" 
                                 style="\${s.pid ? 'cursor: pointer; color: #818cf8; text-decoration: underline;' : ''}"
                                 onclick="\${s.pid ? \`openLink('http://localhost:\${s.port}')\` : ''}">
                                \${s.name}
                            </div>
                            <div class="port">פורט: \${s.port}</div>
                        </div>
                    </div>
                    <div class="actions">
                        \${s.pid 
                            ? \`<button class="btn-stop" onclick="action('stop', '\${id}')">כבה</button>\`
                            : \`<button class="btn-start" onclick="action('start', '\${id}')">הפעל</button>\`
                        }
                    </div>
                </div>
            \`).join('');
            
            document.getElementById('serverList').innerHTML = html;
        }

        async function action(type, id) {
            const url = id ? \`/\${type}/\${id}\` : \`/\${type}\`;
            await fetch(url, { method: 'POST' });
            updateStatus();
        }

        setInterval(updateStatus, 1500);
        updateStatus();
    </script>
</body>
</html>
`;

// Search for browser to open in --app mode
function openAppMode(url) {
    log(`Attempting to open App Mode for: ${url}`);
    
    // Windows: Try 'start msedge' which is the most reliable
    const cmd = `start msedge --app=${url}`;
    
    log(`Executing sync command: ${cmd}`);
    try {
        exec(cmd);
        log('Browser launch command sent.');
    } catch (err) {
        log(`Browser launch error: ${err.message}`);
    }
}

const server = http.createServer((req, res) => {
    const { url, method } = req;

    if (method === 'GET' && url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    } else if (method === 'GET' && url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(servers));
    } else if (method === 'POST' && url.startsWith('/start/')) {
        const type = url.split('/')[2];
        if (servers[type]) startServer(type);
        res.end('ok');
    } else if (method === 'POST' && url === '/start-all') {
        Object.keys(servers).forEach(startServer);
        res.end('ok');
    } else if (method === 'POST' && url.startsWith('/stop/')) {
        const type = url.split('/')[2];
        if (servers[type]) stopServer(type);
        res.end('ok');
    } else if (method === 'POST' && url === '/stop-all') {
        Object.keys(servers).forEach(stopServer);
        res.end('ok');
    } else if (method === 'POST' && url === '/exit-manager') {
        res.end('ok');
        process.exit(0);
    } else if (method === 'GET' && url === '/open-gui') {
        openAppMode(`http://localhost:${PORT}`);
        res.end('ok');
    } else if (method === 'POST' && url === '/open-link') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            const { url } = JSON.parse(body);
            log(`Opening external link: ${url}`);
            exec(`start ${url}`);
            res.end('ok');
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        log('Manager already running. Triggering GUI...');
        http.get(`http://localhost:${PORT}/open-gui`, () => {
            process.exit(0);
        });
    }
});

server.listen(PORT, () => {
    log(`✨ Manager Dashboard active at http://localhost:${PORT}`);
    openAppMode(`http://localhost:${PORT}`);
});
