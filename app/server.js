import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the git repository (one level up from /app)
const REPO_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

const IMAGES_DIR = path.resolve(__dirname, '../app/תמונות מקור');
const DATA_FILE = path.resolve(__dirname, '../data.json');

app.use('/images', express.static(IMAGES_DIR));

app.get('/api/images', (req, res) => {
    try {
        if (!fs.existsSync(IMAGES_DIR)) {
            return res.status(404).json({ error: 'Images directory not found' });
        }
        const files = fs.readdirSync(IMAGES_DIR).filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        files.sort((a, b) => {
            const aTagged = data[a]?.title && data[a]?.explanation ? 1 : 0;
            const bTagged = data[b]?.title && data[b]?.explanation ? 1 : 0;
            if (aTagged !== bTagged) {
                return aTagged - bTagged;
            }
            return a.localeCompare(b);
        });

        const fileStats = {};
        files.forEach(file => {
            try {
                const stat = fs.statSync(path.join(IMAGES_DIR, file));
                fileStats[file] = stat.size;
            } catch (err) {
                fileStats[file] = 0;
            }
        });

        res.json({ files, data, fileStats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/metadata', (req, res) => {
    try {
        const { filename, title, explanation, topic } = req.body;
        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        let newFilename = filename;
        const oldFilePath = path.join(IMAGES_DIR, filename);

        // If there's a title, we try to rename the file
        if (title && title.trim() !== '') {
            const ext = path.extname(filename);
            // Sanitize title for Windows filename
            let sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '').trim();
            if (sanitizedTitle) {
                let targetFilename = sanitizedTitle + ext;
                let targetPath = path.join(IMAGES_DIR, targetFilename);

                // If it's a different name, and the target doesn't exist (unless we just overwrite)
                if (filename !== targetFilename) {
                    let counter = 1;
                    while (fs.existsSync(targetPath)) {
                        targetFilename = `${sanitizedTitle}_${counter}${ext}`;
                        targetPath = path.join(IMAGES_DIR, targetFilename);
                        counter++;
                    }
                    if (fs.existsSync(oldFilePath)) {
                        fs.renameSync(oldFilePath, targetPath);
                        newFilename = targetFilename;
                    }
                }
            }
        }

        // Remove old entry if renamed
        if (newFilename !== filename && data[filename]) {
            delete data[filename];
        }

        data[newFilename] = { title, explanation, topic };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        res.json({ success: true, newFilename });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/images/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(IMAGES_DIR, filename);

        // Delete the physical file if it exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from metadata
        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            if (data[filename]) {
                delete data[filename];
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Publish to GitHub ────────────────────────────────────────────────────────

/**
 * Only these paths are ever staged. Code files are never touched.
 * Paths are relative to REPO_ROOT.
 */
const ALLOWED_GIT_PATHS = [
    'data.json',
    'app/public/images',
];

function runGit(command, cwd = REPO_ROOT) {
    return execSync(command, { cwd, encoding: 'utf-8' }).trim();
}

// GET /api/publish/status — returns last commit hash + message + timestamp
app.get('/api/publish/status', (req, res) => {
    try {
        const log = runGit('git log -1 --format=%H|||%s|||%ci');
        const [hash, subject, date] = log.split('|||');
        res.json({ hash: hash?.slice(0, 7), message: subject, date, ok: true });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

// POST /api/publish — run prepare-public.js, then stage only content files, commit, push
app.post('/api/publish', async (req, res) => {
    const log = [];
    try {
        // 1. Regenerate public-data.json from data.json (fast — no image recompression)
        log.push('⚙️  מעדכן public-data.json...');
        const prepareOut = execSync('node update-public-data.mjs', {
            cwd: path.resolve(__dirname),
            encoding: 'utf-8',
            timeout: 30000
        }).trim();
        log.push(`update: ${prepareOut}`);

        // 2. Stage ONLY allowed content paths — never code files
        const stagePaths = [
            'data.json',
            'app/public/images',
            'app/public/public-data.json',
        ];
        for (const p of stagePaths) {
            try {
                runGit(`git add -- "${p}"`);
                log.push(`git add "${p}" ✓`);
            } catch (e) {
                log.push(`git add "${p}" — skipped (${e.message.split('\n')[0]})`);
            }
        }

        // 3. Check if there's actually anything to commit
        const status = runGit('git status --porcelain');
        if (!status) {
            return res.json({ ok: true, skipped: true, message: 'אין שינויים לפרסם', log });
        }

        // 4. Commit with a descriptive Hebrew timestamp message
        const now = new Date();
        const dateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const commitMsg = `עדכון תוכן — ${dateStr} ${timeStr}`;

        const commitOut = runGit(`git commit -m "${commitMsg}"`);
        log.push(`commit: ${commitOut.split('\n')[0]}`);

        // 5. Push to origin (auto-detect branch)
        const branch = runGit('git rev-parse --abbrev-ref HEAD');
        const pushOut = runGit(`git push origin ${branch}`);
        log.push(`push → ${branch}: ${pushOut || 'הצלחה'}`);

        // 6. Return the new commit hash
        const hash = runGit('git rev-parse --short HEAD');
        res.json({ ok: true, hash, message: commitMsg, branch, log });

    } catch (e) {
        log.push(`❌ שגיאה: ${e.message}`);
        res.status(500).json({ ok: false, error: e.message, log });
    }
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(3088, () => {
    console.log('Server running on http://localhost:3088');
});
