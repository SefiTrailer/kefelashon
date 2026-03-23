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

// Stop a server
function stopServer(type) {
    if (!servers[type].pid) return;
    exec(`taskkill /F /T /PID ${servers[type].pid}`, (err) => {
        if (err) {
            log(`Failed to kill ${type}: ${err}`);
            servers[type].pid = null; 
        }
    });
}

// Shut down everything
function stopAllServers() {
    log('Shutting down all servers...');
    Object.keys(servers).forEach(stopServer);
}

// Browser App Mode launch
function openAppMode(url) {
    log(`Attempting to open App Mode for: ${url}`);
    const cmd = `start msedge --app=${url}`;
    try {
        exec(cmd);
        log('Browser launch command sent.');
    } catch (err) {
        log(`Browser launch error: ${err.message}`);
    }
}

const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>כפל לשון - מרכז שליטה</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0f172a;
            --sidebar: #1e293b;
            --primary: #6366f1;
            --success: #22c55e;
            --danger: #ef4444;
            --text: #f8fafc;
            --card: rgba(255,255,255,0.05);
        }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        /* Sidebar Styling */
        .sidebar {
            width: 320px;
            background: var(--sidebar);
            border-left: 1px solid rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            padding: 1.5rem;
            flex-shrink: 0;
            z-index: 10;
            box-shadow: 10px 0 30px rgba(0,0,0,0.3);
        }

        .main-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            background: #000;
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 2rem;
            background: linear-gradient(to right, #818cf8, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .server-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            flex-grow: 1;
        }

        .server-card {
            background: var(--card);
            padding: 1rem;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.05);
        }

        .info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--danger);
        }

        .status-dot.active {
            background: var(--success);
            box-shadow: 0 0 10px var(--success);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }

        .name { font-weight: 600; font-size: 1rem; }
        
        .actions {
            display: flex;
            gap: 0.5rem;
        }

        button {
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
            font-family: inherit;
            font-size: 0.85rem;
        }

        .btn-start { background: var(--primary); color: white; width: 100%; }
        .btn-stop { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger); width: 100%; }
        .btn-view { background: #334155; color: white; flex: 1; }
        .btn-view:hover { background: #475569; }

        .global-actions {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .btn-exit { background: #ef4444; color: white; }

        /* Viewer Styling */
        .viewer-header {
            background: #1e293b;
            padding: 0.5rem 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .current-tag {
            background: rgba(99, 102, 241, 0.2);
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            color: #818cf8;
            font-weight: 700;
        }

        iframe {
            flex-grow: 1;
            border: none;
            background: #fff;
        }

        .welcome-screen {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: var(--bg);
            text-align: center;
        }

        .welcome-screen p { color: #64748b; margin-top: 1rem; }

        /* Modal Styling */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-blur: 8px;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .modal {
            background: #1e293b;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 24px;
            padding: 2.5rem;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        
        .modal h2 { margin-top: 0; font-size: 1.25rem; }
        .modal p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5; }
        
        .modal-actions { display: flex; gap: 1rem; }
        .modal-btn {
            flex: 1;
            padding: 0.75rem;
            border-radius: 12px;
            font-weight: 700;
            transition: all 0.2s;
        }
        
        .btn-cancel { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); }
        .btn-cancel:hover { background: rgba(255,255,255,0.1); }
        .btn-confirm { background: #ef4444; color: white; border: none; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
        .btn-confirm:hover { background: #dc2626; transform: translateY(-1px); }
    </style>
</head>
<body>
    <div id="exitModal" class="modal-overlay">
        <div class="modal">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🛑</div>
            <h2>כיבוי מערכת</h2>
            <p>האם אתה בטוח שברצונך לכבות את כל השרתים ולסגור את האפליקציה?</p>
            <div class="modal-actions">
                <button class="modal-btn btn-confirm" onclick="confirmExit()">כן, כבה הכל</button>
                <button class="modal-btn btn-cancel" onclick="hideExitModal()">ביטול</button>
            </div>
        </div>
    </div>

    <div class="sidebar">
        <h1>מרכז שליטה - כפל לשון</h1>
        
        <div class="server-list" id="serverList">
            <!-- Dynamic Content -->
        </div>

        <div class="global-actions">
            <button onclick="action('start-all')">הפעל הכל</button>
            <button class="btn-exit" onclick="exitManager()">כבה הכל וסגור</button>
        </div>
    </div>

    <div class="main-content">
        <div class="viewer-header">
            <div id="viewTag" class="current-tag">מצב: מערכת</div>
            <div id="viewUrl" style="font-size: 0.8rem; color: #64748b;">http://localhost:3099</div>
        </div>
        
        <div id="viewer" style="display: flex; flex-direction: column; flex-grow: 1;">
            <div class="welcome-screen">
                <div style="font-size: 4rem;">🏠</div>
                <h2>ברוך הבא</h2>
                <p>הפעל שרת ולחץ על "הצג" כדי לראות את האתר כאן.</p>
            </div>
        </div>
    </div>

    <script>
        let currentView = 'status';
        let firstLoad = true;

        async function updateStatus() {
            const resp = await fetch('/status');
            const data = await resp.json();
            
            const htmlArr = Object.entries(data).map(([id, s]) => {
                return \`
                <div class="server-card">
                    <div class="info">
                        <div class="status-dot \${s.pid ? 'active' : ''}"></div>
                        <div class="name">\${s.name}</div>
                    </div>
                    <div class="actions">
                        \${s.pid 
                            ? \`
                               <button class="btn-stop" onclick="action('stop', '\${id}')">כבה</button>
                               \${id !== 'backend' ? \`<button class="btn-view" onclick="viewPath('\${id}', \${s.port})">הצג</button>\` : ''}
                              \`
                            : \`<button class="btn-start" onclick="action('start', '\${id}')">הפעל</button>\`
                        }
                    </div>
                </div>
                \`;
            });
            
            
            document.getElementById('serverList').innerHTML = htmlArr.join('');

            // Auto-view on first load if admin is already running
            if (firstLoad && data.admin && data.admin.pid) {
                firstLoad = false;
                viewPath('admin', 5555);
            } else if (firstLoad) {
                firstLoad = false;
            }
        }

        function viewPath(id, port) {
            const url = 'http://localhost:' + port;
            document.getElementById('viewTag').innerText = 'מצב: ' + (id === 'admin' ? 'ניהול' : 'גלריה');
            document.getElementById('viewUrl').innerText = url;
            document.getElementById('viewer').innerHTML = '<iframe src="' + url + '"></iframe>';
        }

        async function action(type, id) {
            const url = id ? '/' + type + '/' + id : '/' + type;
            await fetch(url, { method: 'POST' });
            updateStatus();
            
            // Auto-switch to Admin Panel view if it was started
            if (type === 'start-all' || (type === 'start' && id === 'admin')) {
                setTimeout(() => viewPath('admin', 5555), 1000);
            }
        }

        function exitManager() {
            document.getElementById('exitModal').style.display = 'flex';
        }

        function hideExitModal() {
            document.getElementById('exitModal').style.display = 'none';
        }

        async function confirmExit() {
            const btn = document.querySelector('.btn-confirm');
            btn.disabled = true;
            btn.innerText = 'מכבה...';
            
            try {
                await fetch('/exit-manager', { method: 'POST' });
                // Small delay to let the browser process the response before closing
                setTimeout(() => {
                    window.close();
                }, 500);
            } catch (e) {
                console.error('Exit failed', e);
                hideExitModal();
            }
        }

        setInterval(updateStatus, 2000);
        updateStatus();
    </script>
</body>
</html>
`;

// Start manager server
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
        stopAllServers();
        res.end('ok');
    } else if (method === 'POST' && url === '/exit-manager') {
        log('Exiting manager (Full Shutdown)...');
        stopAllServers();
        res.end('ok');
        // Give children more time to die before manager shuts down
        setTimeout(() => {
            log('Manager process exiting now. Goodbye!');
            process.exit(0);
        }, 2000); 
    } else if (method === 'GET' && url === '/favicon.ico') {
        const icoPath = path.join(__dirname, 'app/public/logo.ico');
        if (fs.existsSync(icoPath)) {
            res.writeHead(200, { 'Content-Type': 'image/x-icon' });
            fs.createReadStream(icoPath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
    } else if (method === 'GET' && url === '/open-gui') {
        openAppMode(`http://localhost:${PORT}`);
        res.end('ok');
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        log('Manager already running. Triggering GUI...');
        http.get(`http://localhost:${PORT}/open-gui`, () => process.exit(0));
    }
});

server.listen(PORT, () => {
    log(`✨ Manager Dashboard active at http://localhost:${PORT}`);
    openAppMode(`http://localhost:${PORT}`);
});
