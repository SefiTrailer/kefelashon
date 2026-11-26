import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import multer from 'multer'; // Import multer
import sharp from 'sharp';
import { generateAHash, getHammingDistance } from './utils/image-hash.js';
import dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';
import { GoogleGenAI } from "@google/genai";
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const geminiModel = "gemini-flash-latest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the git repository (one level up from /app)
const REPO_ROOT = path.resolve(__dirname, '..');

const ALLOWED_CORS_ORIGINS = new Set([
    'http://localhost:5555',
    'http://127.0.0.1:5555',
    'http://localhost:5556',
    'http://127.0.0.1:5556',
    'http://localhost:3099',
    'http://127.0.0.1:3099',
    'http://localhost:3088',
    'http://127.0.0.1:3088',
]);

const app = express();
app.use(cors({
    origin(origin, callback) {
        if (!origin || ALLOWED_CORS_ORIGINS.has(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));

// Block cross-site browser requests (including simple POSTs) to API endpoints
app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    if ((origin && !ALLOWED_CORS_ORIGINS.has(origin)) || fetchSite === 'cross-site') {
        console.warn(`[SECURITY] Blocked untrusted cross-site request (${req.method} ${req.originalUrl}) from origin=${origin || 'none'}`);
        return res.status(403).json({ error: 'Forbidden origin' });
    }
    next();
});

// Diagnostic logger
app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

const IMAGES_DIR = path.resolve(__dirname, '../app/public/images');
const THUMBNAILS_DIR = path.resolve(__dirname, '../app/public/thumbnails');
const NEW_IMAGES_DIR = path.resolve(__dirname, '../תמונות חדשות');
const DATA_FILE = path.resolve(__dirname, '../data.json');
const HASHES_FILE = path.resolve(__dirname, '../hashes.json');
const SOURCE_BACKUP_DIR = path.resolve(__dirname, '../app/תמונות מקור'); // Keep for legacy if needed

function sanitizeSingleFilename(filename) {
    if (typeof filename !== 'string') return null;
    const trimmed = filename.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..') return null;
    if (filename.includes('\0') || filename.includes('/') || filename.includes('\\')) return null;
    const base = path.basename(filename);
    if (base !== filename || base === '.' || base === '..') return null;
    return base;
}

function safeResolveUnder(baseDir, filename) {
    const cleanName = sanitizeSingleFilename(filename);
    if (!cleanName) return null;
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(resolvedBase, cleanName);
    if (!resolvedTarget.startsWith(resolvedBase + path.sep)) return null;
    return resolvedTarget;
}

console.log('IMAGES_DIR:', IMAGES_DIR);
console.log('THUMBNAILS_DIR:', THUMBNAILS_DIR);
console.log('NEW_IMAGES_DIR:', NEW_IMAGES_DIR);
console.log('DATA_FILE:', DATA_FILE);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Automatically create destination directory if it doesn't exist
        if (!fs.existsSync(IMAGES_DIR)) {
            fs.mkdirSync(IMAGES_DIR, { recursive: true });
        }
        cb(null, IMAGES_DIR);
    },
    filename: function (req, file, cb) {
        const cleanBase = path.basename(String(file.originalname || 'upload.png'))
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .trim();
        const safeName = (!cleanBase || cleanBase === '.' || cleanBase === '..') ? `upload_${Date.now()}.png` : cleanBase;
        cb(null, safeName);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

app.use('/images', express.static(IMAGES_DIR));
app.use('/images', express.static(NEW_IMAGES_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

app.get('/favicon.ico', (req, res) => {
    const icoPath = path.resolve(__dirname, 'public/logo.ico');
    if (fs.existsSync(icoPath)) {
        res.sendFile(icoPath);
    } else {
        res.status(404).end();
    }
});

app.get('/api/logo', (req, res) => {
    const logoPath = path.resolve(__dirname, 'public/logo.webp');
    if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
    } else {
        res.status(404).end();
    }
});

app.get('/api/images', (req, res) => {
    try {
        if (!fs.existsSync(IMAGES_DIR)) {
            return res.status(404).json({ error: 'Images directory not found' });
        }
        const sourceFiles = fs.readdirSync(IMAGES_DIR).filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file));
        let newFiles = [];
        if (fs.existsSync(NEW_IMAGES_DIR)) {
            newFiles = fs.readdirSync(NEW_IMAGES_DIR).filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file));
        }

        // Merge files and track their source for the frontend
        const files = [...sourceFiles, ...newFiles];
        const fileSources = {};
        sourceFiles.forEach(f => fileSources[f] = 'source');
        newFiles.forEach(f => fileSources[f] = 'new');

        console.log(`[API] /api/images - Public: ${sourceFiles.length}, New: ${newFiles.length}, Total: ${files.length}`);

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        files.sort((a, b) => {
            const aDate = data[a]?.dateMillis || 0;
            const bDate = data[b]?.dateMillis || 0;
            if (aDate !== bDate) return bDate - aDate;
            return a.localeCompare(b);
        });

        const fileStats = {};
        const fileCreationTimes = {};
        files.forEach(file => {
            try {
                const dir = fileSources[file] === 'new' ? NEW_IMAGES_DIR : IMAGES_DIR;
                const stat = fs.statSync(path.join(dir, file));
                fileStats[file] = stat.size;
                fileCreationTimes[file] = stat.birthtimeMs || stat.mtimeMs;
            } catch (err) {
                fileStats[file] = 0;
                fileCreationTimes[file] = 0;
            }
        });

        res.json({ files, data, fileStats, fileCreationTimes, fileSources });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tags', (req, res) => {
    try {
        const MASTER_TAGS_FILE = path.resolve(REPO_ROOT, 'tags_master.json');
        if (fs.existsSync(MASTER_TAGS_FILE)) {
            const master = JSON.parse(fs.readFileSync(MASTER_TAGS_FILE, 'utf-8'));
            res.json(master);
        } else {
            res.json({ categories: [], mappings: {} });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/metadata', (req, res) => {
    try {
        const { filename, title, explanation, topic, isApproved, isAIGenerated, renameFile } = req.body;
        const safeFilename = sanitizeSingleFilename(filename);
        if (!safeFilename) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        let newFilename = safeFilename;

        // Detect current source safely
        const newDirCandidate = safeResolveUnder(NEW_IMAGES_DIR, safeFilename);
        const sourceDirCandidate = safeResolveUnder(IMAGES_DIR, safeFilename);
        const currentInNew = Boolean(newDirCandidate && fs.existsSync(newDirCandidate));
        const currentInSource = Boolean(sourceDirCandidate && fs.existsSync(sourceDirCandidate));

        let oldFilePath = currentInNew ? newDirCandidate : sourceDirCandidate;

        // If it's a new image, we MUST move it to source (and public) even if title doesn't change
        const isFromNewFolder = currentInNew;

        // Rename file on disk ONLY if explicitly requested OR importing from new images folder
        const shouldRenameFile = Boolean(renameFile) || isFromNewFolder;

        // If rename is allowed and there's a title, we try to rename the file
        if (shouldRenameFile && title && title.trim() !== '') {
            const ext = path.extname(safeFilename).toLowerCase();
            // Sanitize title for Windows filename
            let sanitizedTitle = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
            if (sanitizedTitle && sanitizedTitle !== '.' && sanitizedTitle !== '..') {
                let targetFilename = sanitizedTitle + ext;
                let targetPath = safeResolveUnder(IMAGES_DIR, targetFilename);

                // If it's a different name, or it's from New folder (must move)
                if (targetPath && (safeFilename !== targetFilename || isFromNewFolder)) {
                    let counter = 1;
                    // Keep looking for a non-conflicting name
                    while (targetPath && fs.existsSync(targetPath)) {
                        // If it's the SAME file we are already editing (case-insensitive check on Windows)
                        // we only allow it if it's not from 'new'
                        if (!isFromNewFolder && targetFilename.toLowerCase() === safeFilename.toLowerCase()) {
                            break;
                        }
                        targetFilename = `${sanitizedTitle} ${counter}${ext}`;
                        targetPath = safeResolveUnder(IMAGES_DIR, targetFilename);
                        counter++;
                    }

                    if (oldFilePath && targetPath && fs.existsSync(oldFilePath)) {
                        fs.renameSync(oldFilePath, targetPath);
                        newFilename = targetFilename;
                    }
                }
            }
        } else if (isFromNewFolder && oldFilePath) {
            // No title, but it's in the new folder - just move it to source as is
            const ext = path.extname(safeFilename).toLowerCase();
            const base = path.basename(safeFilename, ext);
            let targetFilename = safeFilename;
            let targetPath = safeResolveUnder(IMAGES_DIR, targetFilename);

            let counter = 1;
            while (targetPath && fs.existsSync(targetPath)) {
                targetFilename = `${base} ${counter}${ext}`;
                targetPath = safeResolveUnder(IMAGES_DIR, targetFilename);
                counter++;
            }
            if (targetPath) {
                fs.renameSync(oldFilePath, targetPath);
                newFilename = targetFilename;
            }
        }

        // No need to sync to public images anymore since IMAGES_DIR IS PUBLIC_DIR

        // Maintain existing flags if not explicitly provided
        const oldEntry = data[filename] || {};
        const finalApproved = isApproved !== undefined ? Boolean(isApproved) : Boolean(oldEntry.isApproved);
        const finalAI = isAIGenerated !== undefined ? Boolean(isAIGenerated) : Boolean(oldEntry.isAIGenerated);
        const finalAIImproved = oldEntry.isAIImproved; // Preserve this flag
        const finalAIAdded = oldEntry.isAIAdded;       // Preserve this flag
        const finalNeedsAI = req.body.needsAIImprovement !== undefined ? Boolean(req.body.needsAIImprovement) : Boolean(oldEntry.needsAIImprovement);
        const finalAISuggestion = req.body.aiSuggestion !== undefined ? req.body.aiSuggestion : oldEntry.aiSuggestion;
        const finalCreatedAt = oldEntry.createdAt || Date.now(); // Preserve creation time or set it if missing

        // Remove old entry if renamed
        if (newFilename !== filename && data[filename]) {
            delete data[filename];
        }

        // Read master tags for normalization
        const MASTER_TAGS_FILE = path.resolve(REPO_ROOT, 'tags_master.json');
        let normalizedTopic = topic;
        if (fs.existsSync(MASTER_TAGS_FILE) && topic) {
            try {
                const master = JSON.parse(fs.readFileSync(MASTER_TAGS_FILE, 'utf-8'));
                const rawTags = topic.split(',').map(t => t.trim()).filter(Boolean);
                const normalizedSet = new Set();

                rawTags.forEach(tag => {
                    // Always keep the original tag
                    normalizedSet.add(tag);

                    // Also add the mapped general category if it exists
                    if (master.mappings && master.mappings[tag]) {
                        normalizedSet.add(master.mappings[tag]);
                    }
                });
                normalizedTopic = Array.from(normalizedSet).join(', ');
            } catch (err) {
                console.error('Error normalizing tags:', err);
            }
        }

        data[newFilename] = {
            title,
            explanation,
            topic: normalizedTopic,
            isApproved: finalApproved,
            isAIGenerated: finalAI,
            isAIImproved: finalAIImproved,
            isAIAdded: finalAIAdded,
            needsAIImprovement: finalNeedsAI,
            aiSuggestion: finalAISuggestion,
            createdAt: finalCreatedAt
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        res.json({ success: true, newFilename });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/images/:filename', (req, res) => {
    try {
        const safeFilename = sanitizeSingleFilename(req.params.filename);
        if (!safeFilename) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const sourceFilePath = safeResolveUnder(IMAGES_DIR, safeFilename);
        const newImagesPath = safeResolveUnder(NEW_IMAGES_DIR, safeFilename);

        // Delete the physical file from folders if they exist
        if (sourceFilePath && fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);
        if (newImagesPath && fs.existsSync(newImagesPath)) fs.unlinkSync(newImagesPath);

        // Remove from metadata
        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            if (data[safeFilename]) {
                delete data[safeFilename];
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            }
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Upload endpoint
app.post('/api/upload', upload.array('images'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        const uploadedFilenames = [];

        for (const file of req.files) {
            const originalPath = file.path;
            const webpFilename = file.filename.replace(/\.[^.]+$/, '') + '.webp';
            const publicWebpPath = safeResolveUnder(IMAGES_DIR, webpFilename);
            if (!publicWebpPath) {
                continue;
            }

            try {
                // Convert to WebP immediately
                await sharp(originalPath)
                    .webp({ quality: 85 })
                    .toFile(publicWebpPath);

                // Initialize metadata if it doesn't exist (using .webp extension as key)
                if (!data[webpFilename]) {
                    data[webpFilename] = {
                        title: "",
                        explanation: "",
                        topic: "",
                        isAIGenerated: false,
                        createdAt: Date.now()
                    };
                }
                uploadedFilenames.push(webpFilename);

                // Delete the original uploaded file (PNG/JPG) from IMAGES_DIR
                // Multer already saved it to IMAGES_DIR based on the storage config
                if (fs.existsSync(originalPath)) {
                    fs.unlinkSync(originalPath);
                }
            } catch (err) {
                console.error(`Error converting uploaded file ${file.filename}:`, err);
                // Fallback: if conversion fails, keep the original but it might lead to issues
                uploadedFilenames.push(file.filename);
            }
        }

        // Save updated metadata
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        res.json({ success: true, uploaded: uploadedFilenames });
    } catch (e) {
        console.error('Upload Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Duplicate detection logic
app.get('/api/duplicates', async (req, res) => {
    try {
        // Read metadata for all files
        const folders = [
            { path: IMAGES_DIR, type: 'source' },
            { path: NEW_IMAGES_DIR, type: 'new' }
        ];

        let cache = {};
        if (fs.existsSync(HASHES_FILE)) {
            try {
                cache = JSON.parse(fs.readFileSync(HASHES_FILE, 'utf-8'));
            } catch (e) {
                console.error('Error reading hashes cache:', e);
            }
        }

        let metadata = {};
        if (fs.existsSync(DATA_FILE)) {
            metadata = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        const allFiles = [];
        for (const folder of folders) {
            if (fs.existsSync(folder.path)) {
                const files = fs.readdirSync(folder.path).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
                for (const file of files) {
                    const fullPath = path.join(folder.path, file);
                    const stats = fs.statSync(fullPath);
                    const mtime = stats.mtimeMs;

                    let hash = null;
                    if (cache[fullPath] && cache[fullPath].mtime === mtime) {
                        hash = cache[fullPath].hash;
                    } else {
                        hash = await generateAHash(fullPath);
                        if (hash) {
                            cache[fullPath] = { hash, mtime };
                        }
                    }

                    if (hash) {
                        const fileMeta = metadata[file] || {};
                        allFiles.push({
                            filename: file,
                            basename: path.basename(file, path.extname(file)),
                            path: fullPath,
                            size: stats.size,
                            type: folder.type,
                            hash,
                            metadata: fileMeta
                        });
                    }
                }
            }
        }

        // Save cache
        fs.writeFileSync(HASHES_FILE, JSON.stringify(cache, null, 2));

        // Group by similarity (Hash OR Same Title OR Same Filename)
        const groups = [];
        const processed = new Set();

        for (let i = 0; i < allFiles.length; i++) {
            if (processed.has(i)) continue;
            const group = [allFiles[i]];
            processed.add(i);

            const titleI = allFiles[i].metadata?.title?.trim();
            const baseI = allFiles[i].basename;

            for (let j = i + 1; j < allFiles.length; j++) {
                if (processed.has(j)) continue;

                const hashMatch = getHammingDistance(allFiles[i].hash, allFiles[j].hash) <= 4;
                const titleJ = allFiles[j].metadata?.title?.trim();
                const titleMatch = titleI && titleJ && titleI === titleJ;
                const filenameMatch = baseI === allFiles[j].basename;
                
                // NEW: Skip if explicitly marked as not duplicates
                const isIgnored = allFiles[i].metadata?.not_duplicate_with?.includes(allFiles[j].filename) || 
                                 allFiles[j].metadata?.not_duplicate_with?.includes(allFiles[i].filename);

                if ((hashMatch || titleMatch || filenameMatch) && !isIgnored) {
                    group.push(allFiles[j]);
                    processed.add(j);
                }
            }

            if (group.length > 1) {
                // Annotate type for the UI
                const firstTitle = group[0].metadata?.title;
                const isTitleMatch = group.every(item => item.metadata?.title && item.metadata?.title === firstTitle);
                const isFilenameMatch = group.every(item => item.basename === group[0].basename);

                group.isTitleMatch = isTitleMatch;
                group.isFilenameMatch = isFilenameMatch;
                groups.push(group);
            }
        }

        res.json({ groups });
    } catch (e) {
        console.error('Duplicates Scan Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/duplicates/resolve', async (req, res) => {
    try {
        const { resolutions } = req.body;
        if (!Array.isArray(resolutions)) {
            return res.status(400).json({ error: 'resolutions must be an array' });
        }

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        for (const resItem of resolutions) {
            const { filename, action, metadata } = resItem;
            const safeName = sanitizeSingleFilename(filename);
            if (!safeName) {
                return res.status(400).json({ error: 'Invalid filename in resolutions' });
            }
            const filePath = safeResolveUnder(IMAGES_DIR, safeName);
            const newPath = safeResolveUnder(NEW_IMAGES_DIR, safeName);

            if (action === 'delete') {
                if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
                if (newPath && fs.existsSync(newPath)) fs.unlinkSync(newPath);
                delete data[safeName];
            } else if (action === 'keep') {
                // Move from 'new' to 'images' if it's there
                if (newPath && filePath && fs.existsSync(newPath) && !fs.existsSync(filePath)) {
                    fs.renameSync(newPath, filePath);
                }

                // Update metadata if provided
                if (metadata) {
                    data[safeName] = {
                        ...(data[safeName] || {}),
                        title: metadata.title || data[safeName]?.title || '',
                        explanation: metadata.explanation || data[safeName]?.explanation || '',
                        topic: metadata.topic || data[safeName]?.topic || '',
                        isApproved: true
                    };
                }
            }
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error('Deduplication Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/duplicates/ignore', async (req, res) => {
    try {
        const { filenames } = req.body;
        if (!Array.isArray(filenames) || filenames.length < 2) {
            return res.status(400).json({ error: 'Need at least two filenames to ignore.' });
        }
        const safeFilenames = filenames.map(sanitizeSingleFilename);
        if (safeFilenames.some(f => !f)) {
            return res.status(400).json({ error: 'Invalid filename in ignore list.' });
        }

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        // Cross-mark all as "not duplicates" of each other
        for (const f of safeFilenames) {
            if (!data[f]) data[f] = {};
            if (!data[f].not_duplicate_with) data[f].not_duplicate_with = [];
            
            for (const other of safeFilenames) {
                if (f === other) continue;
                if (!data[f].not_duplicate_with.includes(other)) {
                    data[f].not_duplicate_with.push(other);
                }
            }
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error('Ignore Duplicates Error:', e);
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
    return execSync(command, { cwd, encoding: 'utf-8', windowsHide: true }).trim();
}

async function runCmdAsync(command, options = {}) {
    const { stdout } = await execAsync(command, {
        encoding: 'utf-8',
        windowsHide: true,
        maxBuffer: 20 * 1024 * 1024,
        ...options
    });
    return (stdout || '').trim();
}

async function runGitAsync(command, cwd = REPO_ROOT) {
    return runCmdAsync(command, { cwd, timeout: 120000 });
}

// GET /api/publish/status — returns last commit hash + message + timestamp
app.get('/api/publish/status', async (req, res) => {
    try {
        const log = await runGitAsync('git log -1 "--format=%H|||%s|||%ci"');
        const [hash, subject, date] = log.split('|||');
        res.json({ hash: hash?.slice(0, 7), message: subject, date, ok: true });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

// POST /api/publish — non-blocking async publish so /api/tags & /api/social/post stay responsive during build/deploy
app.post('/api/publish', async (req, res) => {
    const log = [];
    try {
        // 1. Convert new images to WebP automatically before updating data
        log.push('🖼️  ממיר תמונות ל-WebP...');
        try {
            await runCmdAsync('node convert-to-webp.mjs', {
                cwd: REPO_ROOT,
                timeout: 120000
            });
        } catch (e) {
            log.push(`⚠️  שגיאה בהמרת WebP: ${e.message}`);
        }

        // 2. Regenerate public-data.json from data.json (fast — no image recompression)
        log.push('⚙️  מעדכן public-data.json...');
        const prepareOut = await runCmdAsync('node update-public-data.mjs', {
            cwd: path.resolve(__dirname),
            timeout: 30000
        });
        log.push(`update: ${prepareOut}`);

        // 3. Stage ONLY allowed content paths — never code files
        const stagePaths = [
            'data.json',
            'app/public/images',
            'app/public/public-data.json',
        ];
        for (const p of stagePaths) {
            try {
                await runGitAsync(`git add -- "${p}"`);
                log.push(`git add "${p}" ✓`);
            } catch (e) {
                log.push(`git add "${p}" — skipped (${e.message.split('\n')[0]})`);
            }
        }

        // 4. Check if there's actually anything staged to commit
        const stagedDiff = await runGitAsync('git diff --cached --name-only');
        if (!stagedDiff) {
            return res.json({ ok: true, skipped: true, message: 'אין שינויים לפרסם', log });
        }

        // 5. Commit with a descriptive Hebrew timestamp message
        const now = new Date();
        const dateStr = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const commitMsg = `עדכון תוכן — ${dateStr} ${timeStr}`;

        const commitOut = await runGitAsync(`git commit -m "${commitMsg}"`);
        log.push(`commit: ${commitOut.split('\n')[0]}`);

        // 6. Push to origin (auto-detect branch)
        const branch = await runGitAsync('git rev-parse --abbrev-ref HEAD');
        const pushOut = await runGitAsync(`git push origin ${branch}`);
        log.push(`push → ${branch}: ${pushOut || 'הצלחה'}`);

        // 7. Build and deploy to gh-pages branch locally so kefelashon.co.il updates immediately
        try {
            log.push('🚀 מעדכן אתר חי (gh-pages)...');
            await runCmdAsync('node scripts/prepare-public.js && npx vite build', {
                cwd: path.resolve(__dirname),
                timeout: 120000,
                env: { ...process.env, VITE_PUBLIC_VIEWER: 'true' }
            });
            await runCmdAsync('node scripts/manual-deploy.js', {
                cwd: path.resolve(__dirname),
                timeout: 90000
            });
            log.push('gh-pages: עודכן בהצלחה ✓');
        } catch (deployErr) {
            console.error('[Publish] Local gh-pages deploy failed:', deployErr.message);
            log.push(`⚠️ העלאה ל-gh-pages: ${deployErr.message.split('\n')[0]}`);
        }

        // 8. Return the new commit hash
        const hash = await runGitAsync('git rev-parse --short HEAD');
        res.json({ ok: true, hash, message: commitMsg, branch, log });
    } catch (e) {
        log.push(`❌ שגיאה: ${e.message}`);
        res.status(500).json({ ok: false, error: e.message, log });
    }
});

// ── WhatsApp Evolution API Client Setup ────────────────────────────────────
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
function getEvolutionApiKey() {
    return (process.env.EVOLUTION_API_KEY || '').trim();
}
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'personal-bot';

async function getEvolutionWhatsappStatus() {
    const apiKey = getEvolutionApiKey();
    if (!apiKey) {
        return { status: 'DISCONNECTED', qr: null, error: 'EVOLUTION_API_KEY אינו מוגדר ב-.env' };
    }
    try {
        const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`, {
            headers: { apikey: apiKey }
        });
        if (!res.ok) return { status: 'DISCONNECTED', qr: null };
        const data = await res.json();
        const state = data?.instance?.state || 'close';
        return {
            status: state === 'open' ? 'CONNECTED' : (state === 'connecting' ? 'LOADING' : 'DISCONNECTED'),
            qr: null,
            instance: EVOLUTION_INSTANCE_NAME,
            testGroupJid: process.env.WA_TEST_GROUP_JID || '',
            publicGroupJid: process.env.WA_PUBLIC_GROUP_JID || ''
        };
    } catch (e) {
        return { status: 'DISCONNECTED', qr: null, error: e.message };
    }
}

function extractResultJson(output) {
    if (!output) return null;
    const matches = [...String(output).matchAll(/RESULT_JSON:(\{[^\r\n]*\})/g)];
    if (!matches.length) return null;
    const last = matches[matches.length - 1][1];
    try {
        return JSON.parse(last);
    } catch (_) {
        return null;
    }
}

async function sendEvolutionWhatsAppImage(targetId, filePath, caption = '') {
    const apiKey = getEvolutionApiKey();
    if (!apiKey) {
        throw new Error('EVOLUTION_API_KEY אינו מוגדר ב-.env');
    }
    const jpegBuffer = await sharp(filePath)
        .resize({ width: 1440, height: 1440, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 84, progressive: true, mozjpeg: true })
        .toBuffer();
    const base64Media = jpegBuffer.toString('base64');
    const baseName = path.basename(filePath, path.extname(filePath));

    let endpoint = `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE_NAME}`;
    const body = {
        number: targetId,
        mediatype: 'image',
        mimetype: 'image/jpeg',
        caption: caption || '',
        media: base64Media,
        fileName: `${baseName}.jpg`,
        delay: 1200
    };

    if (String(targetId).endsWith('@g.us')) {
        endpoint = `${EVOLUTION_API_URL}/wa-ext/group/sendMedia/${EVOLUTION_INSTANCE_NAME}`;
    } else if (String(targetId).endsWith('@newsletter')) {
        endpoint = `${EVOLUTION_API_URL}/wa-ext/newsletter/sendMedia/${EVOLUTION_INSTANCE_NAME}`;
        body.jid = targetId;
    }

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: apiKey
        },
        body: JSON.stringify(body)
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok || resData?.ok === false) {
        throw new Error(resData?.error || resData?.message || `Evolution API HTTP ${res.status}`);
    }
    if ((String(targetId).endsWith('@g.us') || String(targetId).endsWith('@newsletter')) && resData?.validated !== true) {
        throw new Error(resData?.error || 'השליחה לוואטסאפ לא אומתה ע"י השרת');
    }
    return resData;
}

// ── Social Media Posting (Meta Graph API & WhatsApp) ───────────────────────

// Helper to record social media posts in metadata
function recordSocialPost(filename, platform) {
    try {
        if (!fs.existsSync(DATA_FILE)) return;
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (data[filename]) {
            if (!data[filename].social_posts) {
                data[filename].social_posts = [];
            }
            data[filename].social_posts.push({
                platform,
                date: new Date().toISOString()
            });
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            console.log(`[Social] Recorded ${platform} post for ${filename}`);
        }
    } catch (e) {
        console.error('[Social] Error recording post:', e);
    }
}

// Helper to locate image safely in either IMAGES_DIR or NEW_IMAGES_DIR
function resolveImageFilePath(filename) {
    if (!filename) return null;
    const p1 = safeResolveUnder(IMAGES_DIR, filename);
    if (p1 && fs.existsSync(p1)) return p1;
    const p2 = safeResolveUnder(NEW_IMAGES_DIR, filename);
    if (p2 && fs.existsSync(p2)) return p2;
    return null;
}

// Helper to resolve Page Access Token from a User Access Token (fixes #200 publish_actions deprecated error)
async function resolvePageAccessToken(fbPageId, accessToken) {
    try {
        const pageRes = await fetch(`https://graph.facebook.com/v21.0/${fbPageId}?fields=access_token,name&access_token=${accessToken}`);
        const pageData = await pageRes.json();
        if (pageRes.ok && pageData.access_token) {
            return { token: pageData.access_token, pageName: pageData.name, isPageToken: true };
        }
        // Fallback: check /me/accounts
        const acctsRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`);
        const acctsData = await acctsRes.json();
        if (acctsRes.ok && Array.isArray(acctsData.data)) {
            const match = acctsData.data.find(a => a.id === String(fbPageId));
            if (match?.access_token) {
                return { token: match.access_token, pageName: match.name, isPageToken: true };
            }
        }
        return { token: accessToken, isPageToken: false, error: pageData.error?.message };
    } catch (e) {
        return { token: accessToken, isPageToken: false, error: e.message };
    }
}

// Upload photo to Facebook Page directly from local disk (converted to JPEG via sharp) so it works even before GitHub sync or with .webp files
async function postPhotoToFacebookPage(fbPageId, pageToken, filename, imageUrl, caption) {
    let result = { ok: false, data: {} };
    const localPath = resolveImageFilePath(filename);
    if (localPath) {
        try {
            const jpegBuffer = await sharp(localPath)
                .resize({ width: 1440, height: 1440, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 84, progressive: true, mozjpeg: true })
                .toBuffer();
            const form = new FormData();
            form.append('source', new Blob([jpegBuffer], { type: 'image/jpeg' }), 'post.jpg');
            if (caption) form.append('caption', caption);
            form.append('access_token', pageToken);

            const fbRes = await fetch(`https://graph.facebook.com/v21.0/${fbPageId}/photos`, {
                method: 'POST',
                body: form
            });
            const fbData = await fbRes.json();
            result = { ok: fbRes.ok, data: fbData };
        } catch (uploadErr) {
            console.warn('[Social] Direct FB binary upload failed, falling back to URL:', uploadErr.message);
        }
    }

    if (!result.ok) {
        const fbRes = await fetch(`https://graph.facebook.com/v21.0/${fbPageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: imageUrl,
                caption: caption,
                access_token: pageToken
            })
        });
        const fbData = await fbRes.json();
        result = { ok: fbRes.ok, data: fbData };
    }

    // Verify published Page post via Graph API readback and fetch official permalink_url
    if (result.ok && (result.data?.post_id || result.data?.id)) {
        const targetObjId = result.data.post_id || result.data.id;
        let verified = false;
        for (let attempt = 0; attempt < 2 && !verified; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, 1800));
            try {
                const permRes = await fetch(`https://graph.facebook.com/v21.0/${targetObjId}?fields=id,permalink_url&access_token=${pageToken}`);
                const permData = await permRes.json();
                if (permRes.ok && (permData.id || permData.permalink_url)) {
                    verified = true;
                    if (permData.permalink_url) {
                        result.data.permalink_url = permData.permalink_url;
                    }
                }
            } catch (e) {}
        }
        result.verified = verified;
        if (!verified) {
            return {
                ok: false,
                verified: false,
                data: {
                    error: { message: 'הפרסום לדף הפייסבוק לא אומת בקריאה חוזרת משרתי Meta' },
                    raw: result.data
                }
            };
        }
    } else if (result.ok) {
        return {
            ok: false,
            verified: false,
            data: { error: { message: 'תשובת Meta חסרה מזהה פוסט (id/post_id)' }, raw: result.data }
        };
    }

    return result;
}

async function resolveInstagramImageUrl(filename) {
    const siteUrl = `https://kefelashon.co.il/images/${encodeURIComponent(filename)}`;
    const rawUrl = `https://raw.githubusercontent.com/SefiTrailer/kefelashon/main/app/public/images/${encodeURIComponent(filename)}`;

    try {
        const res = await fetch(siteUrl, { method: 'HEAD' });
        if (res.ok && (res.headers.get('content-type') || '').toLowerCase().startsWith('image/')) {
            return siteUrl;
        }
    } catch (_) {}

    try {
        const res = await fetch(rawUrl, { method: 'HEAD' });
        if (res.ok) return rawUrl;
    } catch (_) {}

    return siteUrl;
}

async function publishToInstagramValidated({ igUserId, accessToken, imageUrl, caption, shareToFacebook, filename }) {
    // 0. Pre-flight check that imageUrl or raw GitHub fallback is reachable publicly before creating IG container
    let validUrl = imageUrl || await resolveInstagramImageUrl(filename);
    let headRes = await fetch(validUrl, { method: 'HEAD' }).catch(() => null);
    if (!headRes || headRes.status === 405) {
        headRes = await fetch(validUrl, { method: 'GET' }).catch(() => null);
    }
    const contentType = headRes?.headers?.get?.('content-type') || '';
    if (!headRes || !headRes.ok || (contentType && !contentType.toLowerCase().startsWith('image/'))) {
        const rawUrl = `https://raw.githubusercontent.com/SefiTrailer/kefelashon/main/app/public/images/${encodeURIComponent(filename)}`;
        let rawRes = await fetch(rawUrl, { method: 'HEAD' }).catch(() => null);
        if (rawRes && rawRes.ok) {
            validUrl = rawUrl;
            headRes = rawRes;
        } else {
            throw new Error(
                `התמונה "${filename}" אינה זמינה עדיין בכתובת ציבורית ברשת (${validUrl}). יש לבצע סנכרון/פרסום לאתר (GitHub) לפני הפרסום לאינסטגרם.`
            );
        }
    }

    // 1. Create Media Container
    const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image_url: validUrl,
            caption: caption,
            share_to_facebook: shareToFacebook === true,
            access_token: accessToken
        })
    });
    const containerData = await containerRes.json();
    if (!containerRes.ok || !containerData.id) {
        console.error('[Social] Instagram Error Details:', JSON.stringify(containerData, null, 2));
        const msg = containerData.error?.message || 'Failed to create Instagram container';
        throw new Error(formatSocialError('instagram', msg));
    }

    const creationId = containerData.id;
    console.log(`[Social] Created Instagram container: ${creationId}. Waiting for it to be ready...`);

    // 2. Poll for readiness (Up to 30 seconds)
    let isReady = false;
    for (let attempts = 1; attempts <= 10 && !isReady; attempts++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const statusRes = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${accessToken}`);
        const statusData = await statusRes.json();
        if (statusData.status_code === 'FINISHED') {
            isReady = true;
        } else if (statusData.status_code === 'ERROR') {
            throw new Error(`Instagram: עיבוד התמונה נכשל (${statusData.error_message || 'Unknown error'}). ודא שהתמונה זמינה ותקינה ב-kefelashon.co.il.`);
        } else {
            console.log(`[Social] Container ${creationId} status: ${statusData.status_code}. Attempt ${attempts}...`);
        }
    }

    if (!isReady) {
        throw new Error('Instagram: תם הזמן להמתנה לעיבוד התמונה בשרתי אינסטגרם. נסה שוב בעוד דקה.');
    }

    // 3. Publish Media
    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creation_id: creationId,
            access_token: accessToken
        })
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
        console.error('[Social] Instagram Publish Error:', JSON.stringify(publishData, null, 2));
        const msg = publishData.error?.message || 'Failed to publish to Instagram';
        throw new Error(formatSocialError('instagram', msg));
    }

    // 4. Post-publish readback validation
    let verifiedData = null;
    for (let attempt = 0; attempt < 2 && !verifiedData; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500));
        try {
            const verifyRes = await fetch(`https://graph.facebook.com/v21.0/${publishData.id}?fields=id,permalink,media_type,timestamp&access_token=${accessToken}`);
            const vJson = await verifyRes.json();
            if (verifyRes.ok && vJson?.id) {
                verifiedData = vJson;
            }
        } catch (_) {}
    }

    if (!verifiedData) {
        throw new Error(`Instagram: הפרסום החזיר ID (${publishData.id}) אך לא אומת בקריאה חוזרת מה-Graph API`);
    }

    return {
        ok: true,
        validated: true,
        id: verifiedData.id,
        postUrl: verifiedData.permalink || null,
        data: verifiedData
    };
}

function buildFacebookPagePostUrls(fbPageId, fbData) {
    const urls = [];
    if (fbData?.permalink_url) {
        urls.push(fbData.permalink_url);
    }
    if (fbData?.post_id && fbData.post_id.includes('_')) {
        const [, storyId] = fbData.post_id.split('_');
        urls.push(`https://www.facebook.com/${fbPageId}/posts/${storyId}`);
    }
    if (fbData?.id) {
        urls.push(`https://www.facebook.com/photo/?fbid=${fbData.id}`);
    }
    if (urls.length === 0) {
        urls.push(`https://www.facebook.com/${fbPageId}`);
    }
    return { primaryUrl: urls[0], fallbackUrls: urls.slice(1) };
}

async function runFacebookPersonalAutomation({ postUrl, fallbackUrls = [], filename, caption }) {
    const imagePath = resolveImageFilePath(filename);
    const taskId = Date.now();
    const taskPath = path.join(__dirname, 'scripts', `fb_task_${taskId}.json`);
    fs.writeFileSync(taskPath, JSON.stringify({ postUrl, fallbackUrls, imagePath, caption }));
    const scriptPath = path.join(__dirname, 'scripts', 'fb-personal-automation.js');
    return await new Promise((resolve) => {
        const child = spawn(process.execPath, [scriptPath, `--task=${taskPath}`], { windowsHide: true });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', (code) => {
            const parsed = extractResultJson(stdout);
            if (code === 0 && parsed?.ok === true && parsed?.validated === true) {
                const storyStatus = parsed.storyOk === true
                    ? 'ואומת שיתוף לסטורי'
                    : (parsed.storyOk === false ? `אך שיתוף לסטורי נכשל (${parsed.storyError || 'לא אומת'})` : 'ללא סטורי');
                resolve({
                    ok: true,
                    validated: true,
                    feedOk: Boolean(parsed.feedOk),
                    storyOk: parsed.storyOk,
                    storyError: parsed.storyError || null,
                    message: `בוצע ואומת ריפוסט אוטומטי לפיד האישי (${storyStatus})`
                });
            } else {
                const out = (stderr || stdout).trim();
                const needsLogin = out.includes('NOT_LOGGED_IN');
                const detail = parsed?.error || out.split('\n').slice(-2).join(' | ');
                resolve({
                    ok: false,
                    validated: false,
                    needsLogin,
                    error: needsLogin
                        ? 'יש להתחבר פעם אחת לפרופיל הפייסבוק האישי (לחץ על "🔑 התחבר לפרופיל אישי") כדי לאפשר ריפוסט אוטומטי'
                        : `ריפוסט אוטומטי לפרופיל אישי נכשל: ${detail || `קוד ${code}`}`
                });
            }
        });
    });
}

async function runInstagramAutomation({ filename, caption }) {
    const imagePath = resolveImageFilePath(filename);
    if (!imagePath) {
        return {
            ok: false,
            validated: false,
            needsLogin: false,
            error: `התמונה "${filename}" לא נמצאה בתיקיית התמונות`
        };
    }

    const taskId = Date.now();
    const taskPath = path.join(__dirname, 'scripts', `ig_task_${taskId}.json`);
    fs.writeFileSync(taskPath, JSON.stringify({ imagePath, caption }));
    const scriptPath = path.join(__dirname, 'scripts', 'ig-post-automation.js');

    return await new Promise((resolve) => {
        const child = spawn(process.execPath, [scriptPath, `--task=${taskPath}`], { windowsHide: true });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', (code) => {
            const parsed = extractResultJson(stdout);
            if (code === 0 && parsed?.ok === true && parsed?.validated === true) {
                resolve({
                    ok: true,
                    validated: true,
                    id: parsed.id || `ig_web_${Date.now()}`,
                    postUrl: parsed.postUrl || null
                });
            } else {
                const rawCombined = (parsed?.error || stderr || stdout || '').trim();
                const needsLogin = rawCombined.includes('NOT_LOGGED_IN');
                const detail = parsed?.error || rawCombined.split('\n').slice(-2).join(' | ');
                resolve({
                    ok: false,
                    validated: false,
                    needsLogin,
                    error: needsLogin
                        ? 'יש להתחבר פעם אחת לאינסטגרם בדפדפן (לחץ על "🔑 התחבר לאינסטגרם") כדי לאפשר העלאה מהמחשב'
                        : `פרסום באינסטגרם נכשל: ${detail || `קוד ${code}`}`
                });
            }
        });
    });
}

// Helper to translate common Meta / Social errors into clear Hebrew diagnostics
function formatSocialError(platform, rawError) {
    if (!rawError) return 'שגיאה לא ידועה';
    if (rawError.includes('Session has expired') || rawError.includes('Error validating access token')) {
        return `פג תוקף הטוקן של Meta (יש להדביק טוקן חדש בתיבת העדכון למעלה) [${rawError}]`;
    }
    if (rawError.includes('publish_actions')) {
        if (platform === 'facebook-personal') {
            return 'נדרשת התחברות חד-פעמית לאוטומציית פייסבוק אישי.';
        }
        return `נדרש Page Access Token במקום User Token או הרשאת pages_manage_posts [${rawError}]`;
    }
    return rawError;
}

// --- Background Bulk Task Management ---
let bulkTask = {
  isActive: false,
  queue: [],
  currentIndex: 0,
  platforms: [],
  status: 'Idle',
  nextPostTime: 0,
  lastFile: null,
  lastPlatform: null,
  platformStatuses: {}, // { instagram: { status, message }, facebook: ..., x: ..., whatsapp: ... }
  results: [],
  timer: null
};

async function postSingleImageForBulk(filename, platforms, shareToFacebook = false, shareToPersonalProfile = false) {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const fbPageId = process.env.FB_PAGE_ID;
    const igUserId = process.env.IG_USER_ID;
    const imageUrl = `https://kefelashon.co.il/images/${encodeURIComponent(filename)}`;

    // Build caption from data.json
    let meta = {};
    try {
        if (fs.existsSync(DATA_FILE)) {
            const allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            meta = allData[filename] || {};
        }
    } catch (e) {}
    const imgTitle = meta.title || filename.replace(/\.[^/.]+$/, "");
    const footer = `\n\n***\nלינק לאתר: KefeLashon.co.il\n\nלינק להצטרפות לערוץ: https://whatsapp.com/channel/0029VajNwaPL2AU0jdlgxa20\nלינק להצטרפות לקבוצה: https://chat.whatsapp.com/LN6nwJ8cYiLHaj5uhTum9P`;
    const xFooter = `\n\n***\nלינק לאתר: KefeLashon.co.il`;

    // Initialize platform statuses for current file
    bulkTask.lastFile = filename;
    bulkTask.platformStatuses = {};
    for (const p of platforms) {
        bulkTask.platformStatuses[p] = { status: 'pending', message: 'ממתין בתור...' };
    }
    if (shareToPersonalProfile && platforms.includes('facebook')) {
        bulkTask.platformStatuses['facebook-personal'] = { status: 'pending', message: 'ממתין לריפוסט לפרופיל אישי...' };
    }

    const results = [];
    for (const platform of platforms) {
        bulkTask.lastPlatform = platform;
        bulkTask.platformStatuses[platform] = { status: 'loading', message: 'מפרסם כעת...' };
        const finalCaption = platform === 'x' ? `${imgTitle}\n#כפלשון${xFooter}` : `${imgTitle}\n#כפלשון${footer}`;

        try {
            if (platform === 'instagram') {
                if (!igUserId || !accessToken) {
                    const err = !accessToken ? 'חסר META_ACCESS_TOKEN' : 'חסר IG_USER_ID';
                    bulkTask.platformStatuses[platform] = { status: 'error', message: err };
                    results.push({ platform: 'instagram', ok: false, validated: false, error: err });
                    continue;
                }
                const resolvedImageUrl = await resolveInstagramImageUrl(filename);
                const igRes = await publishToInstagramValidated({
                    igUserId,
                    accessToken,
                    imageUrl: resolvedImageUrl,
                    caption: finalCaption,
                    shareToFacebook: false,
                    filename
                });
                if (igRes.ok && igRes.validated) {
                    recordSocialPost(filename, 'instagram');
                    bulkTask.platformStatuses[platform] = { status: 'success', message: 'פורסם ואומת באינסטגרם בהצלחה!' };
                    results.push({ platform: 'instagram', ok: true, validated: true, id: igRes.id, postUrl: igRes.postUrl });
                } else {
                    bulkTask.platformStatuses[platform] = {
                        status: 'error',
                        message: igRes.error || 'פרסום באינסטגרם נכשל'
                    };
                    results.push({ platform: 'instagram', ok: false, validated: false, error: igRes.error || 'פרסום באינסטגרם נכשל' });
                }
            } else if (platform === 'facebook') {
                if (!fbPageId || !accessToken) {
                    const err = !accessToken ? 'חסר META_ACCESS_TOKEN' : 'חסר FB_PAGE_ID';
                    bulkTask.platformStatuses[platform] = { status: 'error', message: err };
                    results.push({ platform: 'facebook', ok: false, validated: false, error: err });
                    continue;
                }
                const resolved = await resolvePageAccessToken(fbPageId, accessToken);
                console.log(`[Social] Posting to Facebook Page: ${fbPageId} (isPageToken: ${resolved.isPageToken})`);
                const { ok: fbOk, verified: fbVerified, data: fbData } = await postPhotoToFacebookPage(fbPageId, resolved.token, filename, imageUrl, finalCaption);
                let pagePostUrl = null;
                let fallbackUrls = [];
                if (fbOk && fbVerified) {
                    recordSocialPost(filename, 'facebook');
                    const built = buildFacebookPagePostUrls(fbPageId, fbData);
                    pagePostUrl = built.primaryUrl;
                    fallbackUrls = built.fallbackUrls;
                    bulkTask.platformStatuses[platform] = { status: 'success', message: 'פורסם ואומת בדף כפלשון בהצלחה!' };
                    results.push({ platform: 'facebook', ok: true, validated: true, id: fbData.id, postUrl: pagePostUrl });
                } else {
                    console.error('[Social] Facebook Error Details:', JSON.stringify(fbData, null, 2));
                    const errorMsg = formatSocialError('facebook', fbData.error?.message || 'FB failed');
                    bulkTask.platformStatuses[platform] = { status: 'error', message: errorMsg };
                    results.push({ platform: 'facebook', ok: false, validated: false, error: errorMsg });
                }

                if (shareToPersonalProfile && fbOk && fbVerified && pagePostUrl) {
                    bulkTask.platformStatuses['facebook-personal'] = { status: 'loading', message: 'ממתין 3 שניות ומבצע ריפוסט מאומת לפרופיל האישי...' };
                    await new Promise(r => setTimeout(r, 3000));
                    const personalRes = await runFacebookPersonalAutomation({ postUrl: pagePostUrl, fallbackUrls, filename, caption: finalCaption });
                    if (personalRes.ok && personalRes.validated) {
                        recordSocialPost(filename, 'facebook-personal');
                        bulkTask.platformStatuses['facebook-personal'] = { status: 'success', message: personalRes.message };
                        results.push({
                            platform: 'facebook-personal',
                            ok: true,
                            validated: true,
                            feedOk: personalRes.feedOk,
                            storyOk: personalRes.storyOk,
                            storyError: personalRes.storyError
                        });
                    } else {
                        bulkTask.platformStatuses['facebook-personal'] = {
                            status: 'error',
                            message: personalRes.error,
                            needsFbLogin: personalRes.needsLogin,
                            shareUrl: pagePostUrl
                        };
                        results.push({ platform: 'facebook-personal', ok: false, validated: false, error: personalRes.error, shareUrl: pagePostUrl });
                    }
                } else if (shareToPersonalProfile && !fbOk) {
                    bulkTask.platformStatuses['facebook-personal'] = {
                        status: 'error',
                        message: 'בוטל ריפוסט לפרופיל אישי עקב כישלון הפרסום בעמוד כפלשון'
                    };
                }
            } else if (platform === 'x') {
                const imagePath = resolveImageFilePath(filename);
                if (!imagePath) {
                    const err = `קובץ תמונה לא נמצא: ${filename}`;
                    bulkTask.platformStatuses[platform] = { status: 'error', message: err };
                    results.push({ platform: 'x', ok: false, validated: false, error: err });
                    continue;
                }
                const taskId = Date.now();
                const taskPath = path.join(__dirname, 'scripts', `task_${taskId}.json`);
                fs.writeFileSync(taskPath, JSON.stringify({ imagePath, caption: finalCaption }));
                const scriptPath = path.join(__dirname, 'scripts', 'x-post-automation.js');
                await new Promise((resolve) => {
                    const child = spawn(process.execPath, [scriptPath, `--task=${taskPath}`], { windowsHide: true });
                    let stdout = '';
                    let stderr = '';
                    child.stdout.on('data', d => stdout += d.toString());
                    child.stderr.on('data', d => stderr += d.toString());
                    child.on('close', (code) => {
                        const parsed = extractResultJson(stdout);
                        if (code === 0 && parsed?.ok === true && parsed?.validated === true && parsed?.tweetId) {
                            recordSocialPost(filename, 'x');
                            bulkTask.platformStatuses[platform] = { status: 'success', message: 'פורסם ואומת ב-X בהצלחה!' };
                            results.push({ platform: 'x', ok: true, validated: true, tweetId: parsed.tweetId, postUrl: parsed.tweetUrl || null });
                        } else {
                            const err = parsed?.error || (stderr || stdout || `Exit code ${code}`).trim().slice(-250);
                            bulkTask.platformStatuses[platform] = { status: 'error', message: err };
                            results.push({ platform: 'x', ok: false, validated: false, error: err });
                        }
                        resolve();
                    });
                });
            } else if (platform === 'whatsapp') {
                const waState = await getEvolutionWhatsappStatus();
                if (waState.status !== 'CONNECTED') {
                    const err = 'WhatsApp אינו מחובר ב-Evolution API';
                    bulkTask.platformStatuses[platform] = { status: 'error', message: err };
                    results.push({ platform: 'whatsapp', ok: false, validated: false, error: err });
                    continue;
                }
                try {
                    const filePath = resolveImageFilePath(filename);
                    if (!filePath) throw new Error(`קובץ תמונה לא נמצא: ${filename}`);
                    const targetId = bulkTask.waTargetId || process.env.WA_TARGET_ID;
                    if (targetId) {
                        const waRes = await sendEvolutionWhatsAppImage(targetId, filePath, finalCaption);
                        const waValidated = Boolean(waRes?.validated ?? (!String(targetId).endsWith('@g.us') && !String(targetId).endsWith('@newsletter')));
                        recordSocialPost(filename, String(targetId).endsWith('@newsletter') ? 'whatsapp_channel' : 'whatsapp');
                        bulkTask.platformStatuses[platform] = { status: 'success', message: 'נשלח ואומת ב-WhatsApp!' };
                        results.push({ platform: 'whatsapp', ok: true, validated: waValidated, postUrl: waRes?.postUrl || null });
                    } else {
                        const err = 'לא הוגדר מזהה יעד (WA_TARGET_ID)';
                        bulkTask.platformStatuses[platform] = { status: 'error', message: err };
                        results.push({ platform: 'whatsapp', ok: false, validated: false, error: err });
                    }
                } catch (e) {
                    bulkTask.platformStatuses[platform] = { status: 'error', message: e.message };
                    results.push({ platform: 'whatsapp', ok: false, validated: false, error: e.message });
                }
            }
        } catch (e) {
            const err = formatSocialError(platform, e.message);
            bulkTask.platformStatuses[platform] = { status: 'error', message: err };
            results.push({ platform, ok: false, validated: false, error: err });
        }
    }
    bulkTask.lastPlatform = null;
    bulkTask.results.push({ filename, results, timestamp: Date.now() });
    return results;
}

async function runBulkTick() {
    if (!bulkTask.isActive || bulkTask.currentIndex >= bulkTask.queue.length) {
        bulkTask.isActive = false;
        bulkTask.status = 'done';
        return;
    }

    const currentFilename = bulkTask.queue[bulkTask.currentIndex];
    bulkTask.status = 'processing';
    bulkTask.nextPostTime = 0;
    
    // Actually post
    await postSingleImageForBulk(currentFilename, bulkTask.platforms, bulkTask.shareToFacebook, bulkTask.shareToPersonalProfile);
    
    bulkTask.currentIndex++;
    
    if (!bulkTask.isActive) return;

    if (bulkTask.currentIndex < bulkTask.queue.length) {
        const delay = 300 + Math.floor(Math.random() * 300); // 5-10 mins
        bulkTask.nextPostTime = Date.now() + (delay * 1000);
        bulkTask.status = 'waiting';
        bulkTask.timer = setTimeout(runBulkTick, delay * 1000);
    } else {
        // Keep status='done' and isActive=true until user closes or auto-clears so they can see results
        bulkTask.status = 'done';
        bulkTask.nextPostTime = 0;
    }
}

app.post('/api/social/bulk', (req, res) => {
    const { filenames, platforms, shareToFacebook, shareToPersonalProfile, waTargetId } = req.body;
    if (bulkTask.isActive && bulkTask.status !== 'done') return res.status(400).json({ error: 'Bulk task already running' });
    if (!filenames?.length || !platforms?.length) return res.status(400).json({ error: 'Missing filenames or platforms' });
    if (!Array.isArray(filenames) || filenames.some(f => !sanitizeSingleFilename(f))) {
        return res.status(400).json({ error: 'Invalid filename in bulk queue' });
    }

    if (bulkTask.timer) clearTimeout(bulkTask.timer);

    bulkTask = {
        isActive: true,
        queue: filenames,
        currentIndex: 0,
        platforms: platforms,
        status: 'processing',
        nextPostTime: 0,
        lastFile: filenames[0],
        lastPlatform: null,
        platformStatuses: {},
        shareToFacebook: shareToFacebook === true,
        shareToPersonalProfile: shareToPersonalProfile === true,
        waTargetId: waTargetId || null,
        results: [],
        timer: null
    };

    runBulkTick();
    res.json({ ok: true });
});

app.get('/api/social/bulk/status', (req, res) => {
    res.json({
        isActive: bulkTask.isActive,
        current: bulkTask.currentIndex,
        total: bulkTask.queue.length,
        status: bulkTask.status,
        lastFile: bulkTask.lastFile,
        lastPlatform: bulkTask.lastPlatform,
        platformStatuses: bulkTask.platformStatuses,
        results: bulkTask.results,
        countdown: bulkTask.nextPostTime > Date.now() ? Math.ceil((bulkTask.nextPostTime - Date.now()) / 1000) : 0
    });
});

app.post('/api/social/bulk/skip', (req, res) => {
    if (!bulkTask.isActive || bulkTask.status !== 'waiting') {
        return res.status(400).json({ error: 'No bulk task currently waiting' });
    }
    if (bulkTask.timer) clearTimeout(bulkTask.timer);
    bulkTask.timer = null;
    bulkTask.nextPostTime = 0;
    runBulkTick();
    res.json({ ok: true });
});

app.post('/api/social/bulk/cancel', (req, res) => {
    if (bulkTask.timer) clearTimeout(bulkTask.timer);
    bulkTask.isActive = false;
    bulkTask.status = 'Cancelled';
    res.json({ ok: true });
});

app.post('/api/social/manual', (req, res) => {
    try {
        const { filename, platform } = req.body;
        const safeFilename = sanitizeSingleFilename(filename);
        console.log(`[Social] Manual request received: ${platform} for ${safeFilename || filename}`);
        if (!safeFilename || !platform) {
            return res.status(400).json({ error: 'Missing or invalid filename or platform' });
        }
        recordSocialPost(safeFilename, platform);
        res.json({ ok: true });
    } catch (e) {
        console.error('[Social] Manual request error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Update META_ACCESS_TOKEN directly from the Admin UI, auto-exchange to 60-day + permanent Page Token if possible, and persist to .env
app.post('/api/social/meta/token', async (req, res) => {
    try {
        const { token, appSecret } = req.body || {};
        if (!token || !token.trim()) {
            return res.status(400).json({ ok: false, error: 'לא הוזן טוקן' });
        }
        let cleanToken = token.trim();
        const cleanSecret = (appSecret || process.env.META_APP_SECRET || '').trim();
        const appId = process.env.META_APP_ID || '2088373928676287';
        const fbPageId = process.env.FB_PAGE_ID;
        const igUserId = process.env.IG_USER_ID;

        // 1. Verify the input token works
        const checkRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${cleanToken}`);
        const data = await checkRes.json();
        if (!checkRes.ok || !data.id) {
            return res.status(400).json({ ok: false, connected: false, error: data.error?.message || 'הטוקן שהוזן אינו תקין' });
        }

        let tokenTypeMsg = 'טוקן נשמר';

        // 2. If App Secret is available, automatically exchange 1-hour token -> 60-day Long-Lived User Token
        if (cleanSecret) {
            try {
                const exUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${encodeURIComponent(cleanSecret)}&fb_exchange_token=${encodeURIComponent(cleanToken)}`;
                const exRes = await fetch(exUrl);
                const exData = await exRes.json();
                if (exRes.ok && exData.access_token) {
                    cleanToken = exData.access_token;
                    tokenTypeMsg = 'הומר אוטומטית לטוקן ארוך-טווח (60 יום)';
                }
            } catch (exErr) {
                console.warn('[Meta Token] Exchange error:', exErr.message);
            }
        }

        // 3. Try to extract a NEVER-EXPIRING (Permanent) Page Access Token from the token!
        // When a Page Token is fetched using a 60-day User Token, Meta issues a Page Token with expires_at = 0 (never expires!)
        if (fbPageId) {
            const resolved = await resolvePageAccessToken(fbPageId, cleanToken);
            if (resolved.isPageToken && resolved.token) {
                let igOk = true;
                if (igUserId) {
                    const igTest = await fetch(`https://graph.facebook.com/v21.0/${igUserId}?fields=id,username&access_token=${resolved.token}`).catch(() => ({ ok: false }));
                    igOk = igTest.ok;
                }
                let isPermanent = false;
                try {
                    const dbgRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${resolved.token}&access_token=${cleanToken}`);
                    const dbgData = await dbgRes.json();
                    if (dbgData?.data?.expires_at === 0) {
                        isPermanent = true;
                    }
                } catch (e) {}

                if (isPermanent && igOk) {
                    cleanToken = resolved.token;
                    tokenTypeMsg = '♾️ שודרג אוטומטית לטוקן קבוע לתמיד (ללא פג תוקף)!';
                }
            }
        }

        process.env.META_ACCESS_TOKEN = cleanToken;
        if (cleanSecret) process.env.META_APP_SECRET = cleanSecret;

        const envPath = path.resolve(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            if (/^META_ACCESS_TOKEN=.*/m.test(envContent)) {
                envContent = envContent.replace(/^META_ACCESS_TOKEN=.*/m, `META_ACCESS_TOKEN=${cleanToken}`);
            } else {
                envContent += `\nMETA_ACCESS_TOKEN=${cleanToken}\n`;
            }
            if (cleanSecret) {
                if (/^META_APP_SECRET=.*/m.test(envContent)) {
                    envContent = envContent.replace(/^META_APP_SECRET=.*/m, `META_APP_SECRET=${cleanSecret}`);
                } else {
                    envContent += `\nMETA_APP_SECRET=${cleanSecret}\n`;
                }
            }
            fs.writeFileSync(envPath, envContent, 'utf8');
        }

        return res.json({ ok: true, connected: true, userName: data.name, tokenTypeMsg });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// Dry-run diagnostic check across all platforms (DOES NOT PUBLISH ANY POSTS)
app.post('/api/social/diagnostics', async (req, res) => {
    try {
        const { filename, shareToPersonalProfile, waTargetId } = req.body || {};
        const accessToken = process.env.META_ACCESS_TOKEN;
        const fbPageId = process.env.FB_PAGE_ID;
        const igUserId = process.env.IG_USER_ID;
        const diagnostics = {};

        const localPath = filename ? resolveImageFilePath(filename) : null;
        const publicUrl = filename ? `https://kefelashon.co.il/images/${encodeURIComponent(filename)}` : null;

        // 1. Check Instagram (Meta Graph API)
        if (!igUserId) {
            diagnostics.instagram = { status: 'error', message: 'חסר IG_USER_ID בקובץ .env' };
        } else if (!accessToken) {
            diagnostics.instagram = { status: 'error', message: 'חסר META_ACCESS_TOKEN בקובץ .env' };
        } else {
            try {
                const igUserRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}?fields=id,username&access_token=${accessToken}`);
                const igUserData = await igUserRes.json();
                if (igUserRes.ok && igUserData.id) {
                    diagnostics.instagram = {
                        status: 'success',
                        message: `מוכן לפרסום! מחובר לחשבון אינסטגרם @${igUserData.username || igUserId} דרך Meta Graph API.`
                    };
                } else {
                    const err = formatSocialError('instagram', igUserData.error?.message || 'Invalid IG user/token');
                    diagnostics.instagram = { status: 'error', message: err };
                }
            } catch (igCheckErr) {
                diagnostics.instagram = { status: 'error', message: `שגיאה בבדיקת חיבור לאינסטגרם: ${igCheckErr.message}` };
            }
        }

        // 2. Check Meta Token & Facebook Page
        if (!accessToken) {
            diagnostics.facebook = { status: 'error', message: 'חסר META_ACCESS_TOKEN בקובץ .env' };
        } else {
            const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
            const meData = await meRes.json();
            if (!meRes.ok || !meData.id) {
                const err = formatSocialError('meta', meData.error?.message || 'Invalid token');
                diagnostics.facebook = { status: 'error', message: err };
            } else {
                // Check Facebook Page readiness + Page Token resolution
                if (!fbPageId) {
                    diagnostics.facebook = { status: 'error', message: 'חסר FB_PAGE_ID בקובץ .env' };
                } else {
                    const resolved = await resolvePageAccessToken(fbPageId, accessToken);
                    if (resolved.isPageToken) {
                        diagnostics.facebook = { status: 'success', message: `מוכן לפרסום! Page Token נשלף בהצלחה עבור דף "${resolved.pageName || fbPageId}" (תמונה תועלה ישירות כ-JPEG).` };
                    } else {
                        diagnostics.facebook = { status: 'error', message: `הטוקן תקף (${meData.name}), אך לא ניתן לשלוף Page Token עבור דף ${fbPageId}: ${resolved.error || 'ודא שהטוקן כולל הרשאות pages_manage_posts ו-pages_show_list'}` };
                    }
                }
            }
        }

        if (shareToPersonalProfile) {
            const fbSessionPath = path.join(__dirname, '../.fb-session');
            const fbSessionExists = fs.existsSync(fbSessionPath) && fs.existsSync(path.join(fbSessionPath, 'Default'));
            if (fbSessionExists) {
                diagnostics['facebook-personal'] = {
                    status: 'success',
                    message: 'מוכן לריפוסט אוטומטי לפרופיל האישי (.fb-session קיים)!'
                };
            } else {
                diagnostics['facebook-personal'] = {
                    status: 'error',
                    needsFbLogin: true,
                    message: 'לריפוסט אוטומטי לפרופיל האישי לחץ על "🔑 התחבר לפרופיל אישי" (חד-פעמי).'
                };
            }
        }

        // 2. Check X.com readiness
        const sessionPath = path.join(__dirname, '../.x-session');
        const xFolderExists = fs.existsSync(sessionPath) && fs.existsSync(path.join(sessionPath, 'Default'));
        if (!xFolderExists) {
            diagnostics.x = { status: 'error', message: 'לא נמצא חיבור שמור ל-X.com (.x-session חסר)' };
        } else if (filename && !localPath) {
            diagnostics.x = { status: 'error', message: `הקובץ המקומי "${filename}" לא נמצא בדיסק` };
        } else {
            diagnostics.x = { status: 'success', message: `מוכן לפרסום! סשן X.com קיים והקובץ המקומי תקין.` };
        }

        // 3. Check WhatsApp readiness via Evolution API
        const targetId = waTargetId || process.env.WA_TARGET_ID;
        const waState = await getEvolutionWhatsappStatus();
        if (waState.status !== 'CONNECTED') {
            diagnostics.whatsapp = { status: 'error', message: `WhatsApp אינו מחובר כרגע ב-Evolution API (סטטוס: ${waState.status})` };
        } else if (!targetId) {
            diagnostics.whatsapp = { status: 'error', message: 'WhatsApp מחובר, אך לא הוגדר מזהה יעד (WA_TARGET_ID או שדה יעד)' };
        } else if (String(targetId).endsWith('@g.us')) {
            try {
                const apiKey = getEvolutionApiKey();
                const chkRes = await fetch(`${EVOLUTION_API_URL}/wa-ext/group/check/${EVOLUTION_INSTANCE_NAME}?jid=${encodeURIComponent(targetId)}`, {
                    headers: { apikey: apiKey }
                });
                const chkData = await chkRes.json().catch(() => ({}));
                if (chkRes.ok && chkData.canSend) {
                    diagnostics.whatsapp = { status: 'success', message: `מוכן לפרסום בקבוצה "${chkData.subject || targetId}" (role=${chkData.role || 'member'})!` };
                } else {
                    const reason = !chkData.inGroup
                        ? 'הבוט אינו חבר בקבוצה'
                        : (chkData.announce && !chkData.isAdmin
                            ? `הקבוצה מוגדרת למנהלים בלבד והבוט אינו מנהל (יש למנות את הבוט למנהל בקבוצה)`
                            : (chkData.error || `HTTP ${chkRes.status}`));
                    diagnostics.whatsapp = { status: 'error', message: reason };
                }
            } catch (waErr) {
                diagnostics.whatsapp = { status: 'error', message: `שגיאה בבדיקת הרשאת קבוצה: ${waErr.message}` };
            }
        } else if (String(targetId).endsWith('@newsletter')) {
            try {
                const apiKey = getEvolutionApiKey();
                const infoRes = await fetch(`${EVOLUTION_API_URL}/wa-ext/newsletter/info/${EVOLUTION_INSTANCE_NAME}?jid=${encodeURIComponent(targetId)}`, {
                    headers: { apikey: apiKey }
                });
                const infoData = await infoRes.json().catch(() => ({}));
                if (infoRes.ok && infoData?.channel?.canSend) {
                    diagnostics.whatsapp = { status: 'success', message: `מוכן לפרסום בערוץ "${infoData.channel.name || targetId}" (${infoData.channel.role})!` };
                } else {
                    diagnostics.whatsapp = { status: 'error', message: `לבוט אין הרשאת פרסום בערוץ (${infoData?.channel?.role || infoData?.error || infoRes.status})` };
                }
            } catch (waErr) {
                diagnostics.whatsapp = { status: 'error', message: `שגיאה בבדיקת ערוץ וואטסאפ: ${waErr.message}` };
            }
        } else {
            diagnostics.whatsapp = { status: 'success', message: `מוכן לפרסום! WhatsApp מחובר דרך הבוט ויעד מוגדר (${targetId}).` };
        }

        res.json({ ok: true, diagnostics });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.get('/api/social/meta/status', async (req, res) => {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const fbPageId = process.env.FB_PAGE_ID;
    const igUserId = process.env.IG_USER_ID;
    if (!accessToken) return res.json({ connected: false, error: 'META_ACCESS_TOKEN חסר בקובץ .env' });

    try {
        const checkRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
        const data = await checkRes.json();
        if (checkRes.ok && data.id) {
            // Also check Page token resolution
            let pageOk = false;
            let pageName = null;
            if (fbPageId) {
                const resolved = await resolvePageAccessToken(fbPageId, accessToken);
                pageOk = resolved.isPageToken || !resolved.error;
                pageName = resolved.pageName || null;
            }
            return res.json({ 
                connected: true, 
                userName: data.name,
                pageConnected: pageOk,
                pageName,
                igConfigured: !!igUserId
            });
        } else {
            const rawErr = data.error?.message || 'Invalid token';
            const isExpired = data.error?.code === 190;
            return res.json({ 
                connected: false, 
                tokenExpired: isExpired,
                error: formatSocialError('meta', rawErr),
                rawError: rawErr
            });
        }
    } catch (e) {
        res.json({ connected: false, error: e.message });
    }
});

app.get('/api/social/whatsapp/status', async (req, res) => {
    const state = await getEvolutionWhatsappStatus();
    res.json(state);
});

app.post('/api/social/whatsapp/logout', async (req, res) => {
    res.json({ ok: true, message: 'חיבור WhatsApp מנוהל דרך בוט הוואטסאפ האישי (Evolution API)' });
});

app.post('/api/social/post', async (req, res) => {
    try {
        const { filename, caption, platform, shareToFacebook, shareToPersonalProfile } = req.body;
        const safeFilename = sanitizeSingleFilename(filename);
        if (!safeFilename) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const accessToken = process.env.META_ACCESS_TOKEN;
        const fbPageId = process.env.FB_PAGE_ID;
        const igUserId = process.env.IG_USER_ID;

        if (platform === 'facebook' && !accessToken) {
            return res.status(400).json({ error: 'META_ACCESS_TOKEN is not configured in .env' });
        }

        const imageUrl = `https://kefelashon.co.il/images/${encodeURIComponent(filename)}`;
        console.log(`[Social] Posting to ${platform}: ${filename}`);

        if (platform === 'instagram') {
            if (!igUserId) return res.status(400).json({ ok: false, validated: false, platform: 'instagram', error: 'IG_USER_ID is not configured in .env' });
            if (!accessToken) return res.status(400).json({ ok: false, validated: false, platform: 'instagram', error: 'META_ACCESS_TOKEN is not configured in .env' });

            const resolvedImageUrl = await resolveInstagramImageUrl(safeFilename);
            console.log(`[Social] Posting to Instagram via Meta Graph API for: ${safeFilename} (${resolvedImageUrl})`);

            try {
                const igRes = await publishToInstagramValidated({
                    igUserId,
                    accessToken,
                    imageUrl: resolvedImageUrl,
                    caption: caption || '',
                    shareToFacebook: shareToFacebook === true,
                    filename: safeFilename
                });

                if (igRes.ok && igRes.validated) {
                    recordSocialPost(safeFilename, 'instagram');
                    return res.json({
                        ok: true,
                        success: true,
                        validated: true,
                        platform: 'instagram',
                        method: 'meta_api',
                        id: igRes.id,
                        postUrl: igRes.postUrl,
                        message: 'פורסם ואומת באינסטגרם (Meta API) בהצלחה!'
                    });
                }
                return res.status(500).json({
                    ok: false,
                    success: false,
                    validated: false,
                    platform: 'instagram',
                    error: igRes.error || 'פרסום באינסטגרם נכשל'
                });
            } catch (igErr) {
                console.error('[Social] Instagram Meta API error:', igErr.message);
                return res.status(500).json({
                    ok: false,
                    success: false,
                    validated: false,
                    platform: 'instagram',
                    error: igErr.message || 'פרסום באינסטגרם נכשל'
                });
            }
        }

        if (platform === 'x') {
            console.log(`[Social] Using X Automation for: ${filename}`);

            const imagePath = resolveImageFilePath(filename);
            if (!imagePath) {
                throw new Error(`התמונה "${filename}" לא נמצאה בתיקיית התמונות`);
            }

            const taskId = Date.now();
            const taskPath = path.join(__dirname, 'scripts', `task_${taskId}.json`);
            fs.writeFileSync(taskPath, JSON.stringify({ imagePath, caption }));

            const scriptPath = path.join(__dirname, 'scripts', 'x-post-automation.js');

            return await new Promise((resolve) => {
                const child = spawn(process.execPath, [
                    scriptPath,
                    `--task=${taskPath}`
                ], { windowsHide: true });

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => stdout += data.toString());
                child.stderr.on('data', (data) => stderr += data.toString());

                child.on('close', (code) => {
                    console.log(`[X-Automation] Exit code: ${code}`);
                    const parsed = extractResultJson(stdout);
                    if (code === 0 && parsed?.ok === true && parsed?.validated === true && parsed?.tweetId) {
                        recordSocialPost(filename, 'x');
                        resolve(res.json({
                            ok: true,
                            success: true,
                            validated: true,
                            platform: 'x',
                            tweetId: parsed.tweetId,
                            postUrl: parsed.tweetUrl || null,
                            message: 'פורסם ואומת ב-X.com בהצלחה!',
                            output: stdout
                        }));
                    } else {
                        const rawErr = parsed?.error || (stderr || stdout).trim().split('\n').slice(-3).join(' | ');
                        const errMsg = code === 0 && (!parsed?.validated || !parsed?.tweetId)
                            ? `פרסום ב-X הסתיים ללא אימות ציוץ מהשרת (CreateTweet rest_id חסר): ${rawErr}`
                            : `פרסום ב-X נכשל: ${rawErr || `קוד יציאה ${code}`}`;
                        console.error(`[X-Automation] Failed validation: ${errMsg}`);
                        resolve(res.status(500).json({
                            ok: false,
                            success: false,
                            validated: false,
                            platform: 'x',
                            error: errMsg
                        }));
                    }
                });
            });
        }

        if (platform === 'facebook') {
            if (!fbPageId) return res.status(400).json({ error: 'FB_PAGE_ID is not configured' });

            const results = [];

            const resolved = await resolvePageAccessToken(fbPageId, accessToken);
            console.log(`[Social] Posting to Facebook Page: ${fbPageId} (isPageToken: ${resolved.isPageToken})`);

            const { ok: fbOk, verified: fbVerified, data: fbData } = await postPhotoToFacebookPage(fbPageId, resolved.token, filename, imageUrl, caption);
            let pagePostUrl = null;
            let fallbackUrls = [];
            if (fbOk && fbVerified) {
                recordSocialPost(filename, 'facebook');
                const built = buildFacebookPagePostUrls(fbPageId, fbData);
                pagePostUrl = built.primaryUrl;
                fallbackUrls = built.fallbackUrls;
                results.push({ platform: 'facebook-page', ok: true, validated: true, id: fbData.id, postUrl: pagePostUrl, message: 'פורסם ואומת בדף כפלשון בהצלחה!' });
            } else {
                console.error('[Social] Facebook Page Error:', JSON.stringify(fbData, null, 2));
                const errText = formatSocialError('facebook-page', fbData.error?.message || 'Page post failed');
                results.push({ platform: 'facebook-page', ok: false, validated: false, error: errText });
            }

            if (shareToPersonalProfile && fbOk && fbVerified && pagePostUrl) {
                console.log(`[Social] Waiting 3s for Facebook indexing, then running automated repost to Personal Profile...`);
                await new Promise(r => setTimeout(r, 3000));
                const personalRes = await runFacebookPersonalAutomation({ postUrl: pagePostUrl, fallbackUrls, filename, caption });
                if (personalRes.ok && personalRes.validated) {
                    recordSocialPost(filename, 'facebook-personal');
                    results.push({
                        platform: 'facebook-personal',
                        ok: true,
                        validated: true,
                        feedOk: personalRes.feedOk,
                        storyOk: personalRes.storyOk,
                        storyError: personalRes.storyError,
                        message: personalRes.message
                    });
                } else {
                    results.push({
                        platform: 'facebook-personal',
                        ok: false,
                        validated: false,
                        needsFbLogin: personalRes.needsLogin,
                        error: personalRes.error,
                        shareUrl: pagePostUrl
                    });
                }
            } else if (shareToPersonalProfile && !fbOk) {
                results.push({
                    platform: 'facebook-personal',
                    ok: false,
                    validated: false,
                    error: 'בוטל ריפוסט לפרופיל אישי עקב כישלון הפרסום בעמוד כפלשון'
                });
            }

            const pageResult = results.find(r => r.platform === 'facebook-page');
            const personalResult = results.find(r => r.platform === 'facebook-personal');
            const allOk = results.every(r => r.ok && r.validated);
            if (allOk) {
                return res.json({
                    ok: true,
                    success: true,
                    validated: true,
                    pageOk: true,
                    personalOk: personalResult ? personalResult.ok : null,
                    storyOk: personalResult ? personalResult.storyOk : null,
                    storyError: personalResult ? personalResult.storyError : null,
                    message: 'פורסם ואומת בפייסבוק בהצלחה!',
                    results,
                    postUrl: pagePostUrl
                });
            }

            const errors = results.filter(r => !r.ok).map(r => `${r.platform === 'facebook-page' ? 'דף כפלשון' : 'פרופיל אישי'}: ${r.error}`).join(' | ');
            return res.status(pageResult?.ok ? 200 : 400).json({
                ok: !!pageResult?.ok,
                success: false,
                validated: false,
                pageOk: Boolean(pageResult?.ok),
                personalOk: personalResult ? Boolean(personalResult.ok) : null,
                storyOk: personalResult ? personalResult.storyOk : null,
                partialError: pageResult?.ok ? errors : undefined,
                error: !pageResult?.ok ? errors : undefined,
                results,
                postUrl: pagePostUrl
            });
        }

        if (platform === 'whatsapp') {
            const waState = await getEvolutionWhatsappStatus();
            if (waState.status !== 'CONNECTED') {
                return res.status(400).json({ ok: false, validated: false, platform: 'whatsapp', error: 'WhatsApp אינו מחובר ב-Evolution API (יש לוודא שהבוט מחובר)' });
            }
            try {
                const filePath = resolveImageFilePath(filename);
                if (!filePath) {
                    return res.status(404).json({ ok: false, validated: false, platform: 'whatsapp', error: `התמונה "${filename}" לא נמצאה בדיסק` });
                }
                const targetId = req.body.targetId || process.env.WA_TARGET_ID;

                if (!targetId) {
                    return res.status(400).json({ ok: false, validated: false, platform: 'whatsapp', error: 'WA_TARGET_ID אינו מוגדר' });
                }

                const waRes = await sendEvolutionWhatsAppImage(targetId, filePath, caption || '');
                const waValidated = Boolean(waRes?.validated ?? (!String(targetId).endsWith('@g.us') && !String(targetId).endsWith('@newsletter')));
                recordSocialPost(filename, String(targetId).endsWith('@newsletter') ? 'whatsapp_channel' : 'whatsapp');
                return res.json({
                    ok: true,
                    success: true,
                    validated: waValidated,
                    postUrl: waRes?.postUrl || null,
                    message: 'נשלח ואומת ב-WhatsApp דרך הבוט בהצלחה!'
                });
            } catch (e) {
                return res.status(500).json({ ok: false, success: false, validated: false, platform: 'whatsapp', error: e.message });
            }
        }

        res.status(400).json({ ok: false, validated: false, error: 'Invalid platform specified' });

    } catch (e) {
        console.error('[Social Error]', e.message.substring(0, 500));
        const errorMsg = e.message.length > 1000 ? e.message.substring(0, 1000) + '...' : e.message;
        res.status(500).json({ ok: false, validated: false, error: errorMsg });
    }
});

app.get('/api/social/facebook-personal/status', (req, res) => {
    try {
        const fbSessionPath = path.join(__dirname, '../.fb-session');
        const connected = fs.existsSync(fbSessionPath) && fs.existsSync(path.join(fbSessionPath, 'Default'));
        res.json({ connected });
    } catch (e) {
        res.json({ connected: false, error: e.message });
    }
});

let lastIgCheck = {
    connected: false,
    timestamp: 0,
    username: ''
};

app.get('/api/social/instagram/status', async (req, res) => {
    try {
        const accessToken = process.env.META_ACCESS_TOKEN;
        const igUserId = process.env.IG_USER_ID;
        if (!accessToken || !igUserId) {
            return res.json({ connected: false, status: 'missing_config' });
        }

        const now = Date.now();
        if (lastIgCheck.timestamp && (now - lastIgCheck.timestamp < 300000)) {
            return res.json({ connected: lastIgCheck.connected, username: lastIgCheck.username, status: 'cached' });
        }

        const igRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}?fields=id,username&access_token=${accessToken}`);
        const data = await igRes.json();
        const connected = Boolean(igRes.ok && data?.id);
        lastIgCheck.connected = connected;
        lastIgCheck.username = data?.username || '';
        lastIgCheck.timestamp = now;

        return res.json({
            connected,
            username: lastIgCheck.username,
            status: connected ? 'connected' : 'error'
        });
    } catch (err) {
        console.error('[IG-Status Error]', err);
        res.json({ connected: false, error: err.message });
    }
});

app.post('/api/social/instagram/login', (req, res) => {
    res.json({ success: true, message: 'החיבור לאינסטגרם מנוהל ישירות דרך טוקן ה-API של Meta.' });
});

app.post('/api/social/facebook-personal/login', (req, res) => {
    try {
        const scriptPath = path.join(__dirname, 'scripts', 'fb-personal-automation.js');
        console.log('[Social] Launching Personal Facebook Login...');
        const child = spawn(process.execPath, [scriptPath, '--login'], {
            stdio: 'ignore',
            detached: true,
            windowsHide: true
        });
        child.unref();
        res.json({ success: true, message: 'חלון התחברות לפייסבוק נפתח...' });
    } catch (e) {
        console.error('[FB-Personal-Login Error]', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/social/x/login', (req, res) => {
    try {
        const scriptPath = path.join(__dirname, 'scripts', 'x-post-automation.js');
        const sessionPath = path.join(__dirname, '../.x-session');

        const force = req.query.force === 'true';
        if (force && fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('Cleared .x-session due to force=true');
        }

        console.log('[Social] Launching X Login...');
        lastXCheck.timestamp = 0;
        lastXCheck.connected = false;

        const child = spawn(process.execPath, [scriptPath, '--login'], {
            stdio: 'ignore',
            detached: true,
            windowsHide: true
        });
        child.unref();

        res.json({ success: true, message: 'Login window opening...' });
    } catch (e) {
        console.error('[X-Login Error]', e);
        res.status(500).json({ error: e.message });
    }
});

let lastXCheck = {
    connected: false,
    timestamp: 0,
    inProgress: false
};

app.get('/api/social/x/status', (req, res) => {
    try {
        const sessionPath = path.join(__dirname, '../.x-session');
        const folderExists = fs.existsSync(sessionPath) && fs.existsSync(path.join(sessionPath, 'Default'));

        if (!folderExists) {
            return res.json({ connected: false, status: 'no_session' });
        }

        const now = Date.now();
        const cacheTime = lastXCheck.connected ? 300000 : 30000; // 5 mins if connected, 30s if not

        // If check is recent or in progress, return cached
        if ((now - lastXCheck.timestamp < cacheTime) || lastXCheck.inProgress) {
            return res.json({ connected: lastXCheck.connected, status: 'cached' });
        }

        // Trigger real check in background
        lastXCheck.inProgress = true;
        const scriptPath = path.join(__dirname, 'scripts', 'x-post-automation.js');

        const child = spawn(process.execPath, [scriptPath, '--check'], { windowsHide: true });
        let output = '';
        child.stdout.on('data', (data) => output += data.toString());

        child.on('close', (code) => {
            lastXCheck.inProgress = false;
            lastXCheck.timestamp = Date.now();

            if (code === 0) {
                const match = output.match(/JSON:({.*})/);
                if (match) {
                    try {
                        const result = JSON.parse(match[1]);
                        lastXCheck.connected = result.connected;
                    } catch (e) { }
                }
            } else {
                lastXCheck.connected = false;
            }
        });

        // Return current state immediately while check runs (unless first time)
        if (lastXCheck.timestamp === 0) {
            // Wait a few seconds for the first check ever? No, just return current.
            return res.json({ connected: lastXCheck.connected, status: 'checking' });
        }

        res.json({ connected: lastXCheck.connected, status: 'verifying' });

    } catch (err) {
        console.error('[X-Status Error]', err);
        res.status(500).json({ error: err.message, connected: false });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI Image Assistant
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/images/suggest', async (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'Filename is required' });

        const imagePath = resolveImageFilePath(filename);
        if (!imagePath) {
            return res.status(404).json({ error: 'Image file not found' });
        }

        // Read image as base64
        const ext = path.extname(imagePath).slice(1) || 'webp';
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Data = imageBuffer.toString('base64');

        // Read data.json for current metadata
        let currentMetadata = {};
        if (fs.existsSync(DATA_FILE)) {
            const fullData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
            currentMetadata = fullData[filename] || {};
        }

        // Read tags_master.json for context
        let tagsList = "";
        if (fs.existsSync(path.join(__dirname, '../tags_master.json'))) {
            const tagsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../tags_master.json'), 'utf-8'));
            if (tagsData.categories) {
                tagsList = tagsData.categories.join(', ');
            }
        }

        const prompt = `You are a specialist in Hebrew puns (Kefel Lashon). 
Analyze the provided image and generate metadata for a gallery of puns.

IMAGE FILENAME: ${filename}
CURRENT TITLE: ${currentMetadata.title || 'None'}
CURRENT EXPLANATION: ${currentMetadata.explanation || 'None'}

CONSTRAINTS:
1. Provide a "title" (a brief, catchy name for the pun, usually in Hebrew).
2. Provide an "explanation" in Hebrew (2-3 sentences max) that clearly explains the wordplay or pun.
3. Suggest up to 5 "tags" (topic) from this specific list: [${tagsList}]. 
   You can also suggest 1-2 new relevant tags if absolutely necessary, but prioritize the list.
4. Output MUST be ONLY a JSON object with these keys: "title", "explanation", "topic" (comma separated string).

Hebrew output only for title and explanation.`;

        const result = await genAI.models.generateContent({
            model: geminiModel,
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: `image/${ext}`, data: base64Data } }
                ]
            }]
        });

        const responseText = result.candidates[0].content.parts[0].text;
        // Extract JSON from response (Gemini sometimes wraps in markdown blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Failed to parse AI response as JSON');

        const suggestion = JSON.parse(jsonMatch[0]);
        res.json(suggestion);

    } catch (err) {
        console.error('[AI-Suggest Error]', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Gem Browser Automation Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/gemini-gem/status', (req, res) => {
    try {
        const sessionPath = path.join(__dirname, '../.gemini-session');
        const hasSession = fs.existsSync(sessionPath) && fs.existsSync(path.join(sessionPath, 'Default'));
        res.json({ ok: true, hasSession });
    } catch (e) {
        res.json({ ok: false, hasSession: false, error: e.message });
    }
});

app.post('/api/gemini-gem/login', (req, res) => {
    try {
        const scriptPath = path.join(__dirname, 'scripts', 'gemini-gem-automation.js');
        const child = spawn(process.execPath, [scriptPath, '--login'], {
            stdio: 'ignore',
            detached: true,
            windowsHide: true
        });
        child.unref();
        res.json({ ok: true, message: 'חלון התחברות ל-Gemini Gem נפתח בדפדפן...' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────

const START_TIME = new Date().toISOString();
app.listen(3088, '127.0.0.1', () => {
    console.log(`[${START_TIME}] Server running on http://127.0.0.1:3088 (localhost only)`);

    // Proactive startup check if session exists
    const sessionPath = path.join(__dirname, '../.x-session');
    if (fs.existsSync(sessionPath)) {
        const scriptPath = path.join(__dirname, 'scripts', 'x-post-automation.js');
        const child = spawn(process.execPath, [scriptPath, '--check'], { windowsHide: true });
        let out = '';
        child.stdout.on('data', (d) => out += d);
        child.on('close', (code) => {
            if (code === 0) {
                const match = out.match(/JSON:({.*})/);
                if (match) {
                    try {
                        const result = JSON.parse(match[1]);
                        lastXCheck.connected = result.connected;
                        lastXCheck.timestamp = Date.now();
                        console.log(`[Social] Initial X status: ${result.connected ? 'CONNECTED' : 'NOT CONNECTED'}`);
                    } catch (e) { }
                }
            }
        });
    }

    if (process.env.IG_USER_ID && process.env.META_ACCESS_TOKEN) {
        fetch(`https://graph.facebook.com/v21.0/${process.env.IG_USER_ID}?fields=id,username&access_token=${process.env.META_ACCESS_TOKEN}`)
            .then(r => r.json())
            .then(data => {
                if (data?.id) {
                    lastIgCheck.connected = true;
                    lastIgCheck.username = data.username || '';
                    lastIgCheck.timestamp = Date.now();
                    console.log(`[Social] Initial Instagram status (Meta API): CONNECTED (@${data.username})`);
                } else {
                    console.log(`[Social] Initial Instagram status: NOT CONNECTED (${data.error?.message || 'Error'})`);
                }
            })
            .catch(err => {
                console.log(`[Social] Initial Instagram check failed: ${err.message}`);
            });
    }
});
