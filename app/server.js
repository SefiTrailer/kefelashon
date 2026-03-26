import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import multer from 'multer'; // Import multer
import sharp from 'sharp';
import { generateAHash, getHammingDistance } from './utils/image-hash.js';
import dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const geminiModel = "gemini-flash-latest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the git repository (one level up from /app)
const REPO_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

// Diagnostic logger
app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

const IMAGES_DIR = path.resolve(__dirname, '../app/public/images');
const NEW_IMAGES_DIR = path.resolve(__dirname, '../תמונות חדשות');
const DATA_FILE = path.resolve(__dirname, '../data.json');
const HASHES_FILE = path.resolve(__dirname, '../hashes.json');
const SOURCE_BACKUP_DIR = path.resolve(__dirname, '../app/תמונות מקור'); // Keep for legacy if needed

console.log('IMAGES_DIR:', IMAGES_DIR);
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
        // Keep original filename or sanitize it slightly
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use('/images', express.static(IMAGES_DIR));
app.use('/images', express.static(NEW_IMAGES_DIR));

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
        files.forEach(file => {
            try {
                const dir = fileSources[file] === 'new' ? NEW_IMAGES_DIR : IMAGES_DIR;
                const stat = fs.statSync(path.join(dir, file));
                fileStats[file] = stat.size;
            } catch (err) {
                fileStats[file] = 0;
            }
        });

        res.json({ files, data, fileStats, fileSources });
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
        const { filename, title, explanation, topic, isApproved, isAIGenerated } = req.body;
        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        let newFilename = filename;

        // Detect current source
        const currentInNew = fs.existsSync(path.join(NEW_IMAGES_DIR, filename));
        const currentInSource = fs.existsSync(path.join(IMAGES_DIR, filename));

        let oldFilePath = currentInNew ? path.join(NEW_IMAGES_DIR, filename) : path.join(IMAGES_DIR, filename);

        // If it's a new image, we MUST move it to source (and public) even if title doesn't change
        const isFromNewFolder = currentInNew;

        // If there's a title, we try to rename the file
        if (title && title.trim() !== '') {
            const ext = path.extname(filename).toLowerCase();
            // Sanitize title for Windows filename
            let sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '').trim();
            if (sanitizedTitle) {
                let targetFilename = sanitizedTitle + ext;
                let targetPath = path.join(IMAGES_DIR, targetFilename);

                // If it's a different name, or it's from New folder (must move)
                if (filename !== targetFilename || isFromNewFolder) {
                    let counter = 1;
                    // Keep looking for a non-conflicting name
                    while (fs.existsSync(targetPath)) {
                        // If it's the SAME file we are already editing (case-insensitive check on Windows)
                        // we only allow it if it's not from 'new'
                        if (!isFromNewFolder && targetFilename.toLowerCase() === filename.toLowerCase()) {
                            break;
                        }
                        targetFilename = `${sanitizedTitle} ${counter}${ext}`;
                        targetPath = path.join(IMAGES_DIR, targetFilename);
                        counter++;
                    }

                    if (fs.existsSync(oldFilePath)) {
                        fs.renameSync(oldFilePath, targetPath);
                        newFilename = targetFilename;
                    }
                }
            }
        } else if (isFromNewFolder) {
            // No title, but it's in the new folder - just move it to source as is
            const ext = path.extname(filename).toLowerCase();
            const base = path.basename(filename, ext);
            let targetFilename = filename;
            let targetPath = path.join(IMAGES_DIR, targetFilename);

            let counter = 1;
            while (fs.existsSync(targetPath)) {
                targetFilename = `${base} ${counter}${ext}`;
                targetPath = path.join(IMAGES_DIR, targetFilename);
                counter++;
            }
            fs.renameSync(oldFilePath, targetPath);
            newFilename = targetFilename;
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
        const { filename } = req.params;
        const sourceFilePath = path.join(IMAGES_DIR, filename);
        const newImagesPath = path.join(NEW_IMAGES_DIR, filename);

        // Delete the physical file from folders if they exist
        if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);
        if (fs.existsSync(newImagesPath)) fs.unlinkSync(newImagesPath);

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
            const publicWebpPath = path.join(IMAGES_DIR, webpFilename);

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

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        for (const resItem of resolutions) {
            const { filename, action, metadata } = resItem;
            const filePath = path.join(IMAGES_DIR, filename);
            const newPath = path.join(NEW_IMAGES_DIR, filename);

            if (action === 'delete') {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
                delete data[filename];
            } else if (action === 'keep') {
                // Move from 'new' to 'images' if it's there
                if (fs.existsSync(newPath) && !fs.existsSync(filePath)) {
                    fs.renameSync(newPath, filePath);
                }

                // Update metadata if provided
                if (metadata) {
                    data[filename] = {
                        ...(data[filename] || {}),
                        title: metadata.title || data[filename]?.title || '',
                        explanation: metadata.explanation || data[filename]?.explanation || '',
                        topic: metadata.topic || data[filename]?.topic || '',
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
        if (!filenames || filenames.length < 2) {
            return res.status(400).json({ error: 'Need at least two filenames to ignore.' });
        }

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        // Cross-mark all as "not duplicates" of each other
        for (const f of filenames) {
            if (!data[f]) data[f] = {};
            if (!data[f].not_duplicate_with) data[f].not_duplicate_with = [];
            
            for (const other of filenames) {
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
    return execSync(command, { cwd, encoding: 'utf-8' }).trim();
}

// GET /api/publish/status — returns last commit hash + message + timestamp
app.get('/api/publish/status', (req, res) => {
    try {
        const log = runGit('git log -1 "--format=%H|||%s|||%ci"');
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
        // 1. Convert new images to WebP automatically before updating data
        log.push('🖼️  ממיר תמונות ל-WebP...');
        try {
            const convertOut = execSync('node convert-to-webp.mjs', {
                cwd: REPO_ROOT,
                encoding: 'utf-8',
                timeout: 120000
            }).trim();
            // Optional: log.push(convertOut.split('\n').pop() || 'המרה הסתיימה');
        } catch (e) {
            log.push(`⚠️  שגיאה בהמרת WebP: ${e.message}`);
        }

        // 2. Regenerate public-data.json from data.json (fast — no image recompression)
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

// ── WhatsApp Client Setup ──────────────────────────────────────────────────
let whatsappQR = null;
let whatsappStatus = 'DISCONNECTED'; // DISCONNECTED | SCAN_QR | CONNECTED | INITIALIZING | LOADING

const whatsappClient = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.resolve(__dirname, '../.wwebjs_auth')
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

whatsappClient.on('qr', (qr) => {
    console.log('[WhatsApp] QR Received');
    qrcode.toDataURL(qr, (err, url) => {
        whatsappQR = url;
        whatsappStatus = 'SCAN_QR';
    });
});

whatsappClient.on('ready', () => {
    console.log('[WhatsApp] Client is ready!');
    whatsappStatus = 'CONNECTED';
    whatsappQR = null;
});

whatsappClient.on('authenticated', () => {
    console.log('[WhatsApp] Authenticated');
    whatsappStatus = 'LOADING';
});

whatsappClient.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Auth failure:', msg);
    whatsappStatus = 'DISCONNECTED';
    whatsappQR = null;
});

whatsappClient.on('disconnected', (reason) => {
    console.log('[WhatsApp] Disconnected:', reason);
    whatsappStatus = 'DISCONNECTED';
    whatsappQR = null;
});

// Start initialization
whatsappClient.initialize().catch(err => {
    console.error('[WhatsApp] Initialization error:', err);
});

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

// --- Background Bulk Task Management ---
let bulkTask = {
  isActive: false,
  queue: [],
  currentIndex: 0,
  platforms: [],
  status: 'Idle',
  nextPostTime: 0,
  results: [],
  timer: null
};

async function postSingleImageForBulk(filename, platforms, shareToFacebook = false) {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const fbPageId = process.env.FB_PAGE_ID;
    const igUserId = process.env.IG_USER_ID;
    const imageUrl = `https://kefelashon.co.il/images/${encodeURIComponent(filename)}`;
    
    const results = [];
    for (const platform of platforms) {
        try {
            if (platform === 'instagram' && igUserId && accessToken) {
                const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        image_url: imageUrl, 
                        share_to_facebook: shareToFacebook,
                        access_token: accessToken 
                    })
                });
                const containerData = await containerRes.json();
                if (containerRes.ok) {
                    await new Promise(r => setTimeout(r, 10000)); // 10s wait for processing
                    const pRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken })
                    });
                    if (pRes.ok) {
                        recordSocialPost(filename, 'instagram');
                        results.push({ platform: 'instagram', ok: true });
                    } else results.push({ platform: 'instagram', ok: false, error: 'Publish failed' });
                } else results.push({ platform: 'instagram', ok: false, error: 'Container failed' });
            }
            if (platform === 'facebook' && fbPageId && accessToken) {
                const fbRes = await fetch(`https://graph.facebook.com/v21.0/${fbPageId}/photos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: imageUrl, access_token: accessToken })
                });
                if (fbRes.ok) {
                    recordSocialPost(filename, 'facebook');
                    results.push({ platform: 'facebook', ok: true });
                } else results.push({ platform: 'facebook', ok: false, error: 'FB failed' });
            }
            if (platform === 'whatsapp' && whatsappStatus === 'CONNECTED') {
                try {
                    const filePath = path.join(IMAGES_DIR, filename);
                    const media = MessageMedia.fromFilePath(filePath);
                    
                    // Priority: ENV vars, then fallbacks
                    const targetId = process.env.WA_TARGET_ID; 
                    if (targetId) {
                        await whatsappClient.sendMessage(targetId, media);
                        recordSocialPost(filename, 'whatsapp');
                        results.push({ platform: 'whatsapp', ok: true });
                    } else {
                        results.push({ platform: 'whatsapp', ok: false, error: 'WA_TARGET_ID not set' });
                    }
                } catch (e) {
                    results.push({ platform: 'whatsapp', ok: false, error: e.message });
                }
            }
        } catch (e) {
            results.push({ platform, ok: false, error: e.message });
        }
    }
    return results;
}

async function runBulkTick() {
    if (!bulkTask.isActive || bulkTask.currentIndex >= bulkTask.queue.length) {
        bulkTask.isActive = false;
        bulkTask.status = 'Completed';
        return;
    }

    const currentFilename = bulkTask.queue[bulkTask.currentIndex];
    bulkTask.status = `מפרסם: ${currentFilename}...`;
    
    // Actually post
    await postSingleImageForBulk(currentFilename, bulkTask.platforms, bulkTask.shareToFacebook);
    
    bulkTask.currentIndex++;
    
    if (bulkTask.currentIndex < bulkTask.queue.length) {
        const delay = 300 + Math.floor(Math.random() * 300); // 5-10 mins
        bulkTask.nextPostTime = Date.now() + (delay * 1000);
        bulkTask.status = 'ממתין לפוסט הבא...';
        bulkTask.timer = setTimeout(runBulkTick, delay * 1000);
    } else {
        bulkTask.isActive = false;
        bulkTask.status = 'Completed';
        bulkTask.nextPostTime = 0;
    }
}

app.post('/api/social/bulk', (req, res) => {
    const { filenames, platforms, shareToFacebook } = req.body;
    if (bulkTask.isActive) return res.status(400).json({ error: 'Bulk task already running' });
    if (!filenames?.length || !platforms?.length) return res.status(400).json({ error: 'Missing filenames or platforms' });

    bulkTask = {
        isActive: true,
        queue: filenames,
        currentIndex: 0,
        platforms: platforms,
        status: 'Starting...',
        nextPostTime: Date.now(),
        shareToFacebook: shareToFacebook === true,
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
        countdown: bulkTask.nextPostTime > Date.now() ? Math.ceil((bulkTask.nextPostTime - Date.now()) / 1000) : 0
    });
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
        console.log(`[Social] Manual request received: ${platform} for ${filename}`);
        if (!filename || !platform) {
            return res.status(400).json({ error: 'Missing filename or platform' });
        }
        recordSocialPost(filename, platform);
        res.json({ ok: true });
    } catch (e) {
        console.error('[Social] Manual request error:', e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.get('/api/social/meta/status', async (req, res) => {
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) return res.json({ connected: false, error: 'Token missing in .env' });

    try {
        const checkRes = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}`);
        const data = await checkRes.json();
        if (checkRes.ok && data.id) {
            return res.json({ connected: true });
        } else {
            return res.json({ connected: false, error: data.error?.message || 'Invalid token' });
        }
    } catch (e) {
        res.json({ connected: false, error: e.message });
    }
});

app.get('/api/social/whatsapp/status', (req, res) => {
    res.json({ status: whatsappStatus, qr: whatsappQR });
});

app.post('/api/social/whatsapp/logout', async (req, res) => {
    try {
        await whatsappClient.logout();
        whatsappStatus = 'DISCONNECTED';
        whatsappQR = null;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/social/post', async (req, res) => {
    try {
        const { filename, caption, platform, shareToFacebook } = req.body;

        const accessToken = process.env.META_ACCESS_TOKEN;
        const fbPageId = process.env.FB_PAGE_ID;
        const igUserId = process.env.IG_USER_ID;

        if (!accessToken) {
            return res.status(400).json({ error: 'META_ACCESS_TOKEN is not configured in .env' });
        }

        const imageUrl = `https://kefelashon.co.il/images/${encodeURIComponent(filename)}`;
        console.log(`[Social] Posting to ${platform}: ${filename}`);

        if (platform === 'instagram') {
            if (!igUserId) return res.status(400).json({ error: 'IG_USER_ID is not configured' });

            // 1. Create Media Container
            const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: imageUrl,
                    caption: caption,
                    share_to_facebook: shareToFacebook === true,
                    access_token: accessToken
                })
            });
            const containerData = await containerRes.json();
            if (!containerRes.ok) {
                console.error('[Social] Instagram Error Details:', JSON.stringify(containerData, null, 2));
                const msg = containerData.error?.message || 'Failed to create Instagram container';
                const subcode = containerData.error?.error_subcode ? ` (Subcode: ${containerData.error.error_subcode})` : '';
                throw new Error(`Instagram (Step 1): ${msg}${subcode}`);
            }

            const creationId = containerData.id;
            console.log(`[Social] Created Instagram container: ${creationId}. Waiting for it to be ready...`);

            // 1.5 Poll for readiness (Up to 30 seconds)
            let isReady = false;
            let attempts = 0;
            while (!isReady && attempts < 10) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s

                const statusRes = await fetch(`https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${accessToken}`);
                const statusData = await statusRes.json();

                if (statusData.status_code === 'FINISHED') {
                    isReady = true;
                } else if (statusData.status_code === 'ERROR') {
                    throw new Error(`Instagram (Step 1.5): Rendering failed - ${statusData.error_message || 'Unknown processing error'}. דאג שהתמונה כבר פורסמה לאתר (GitHub Sync).`);
                } else {
                    console.log(`[Social] Container ${creationId} status: ${statusData.status_code}. Attempt ${attempts}...`);
                }
            }

            if (!isReady) {
                throw new Error('Instagram (Step 1.5): Timeout waiting for media to be ready. Please try again in a minute.');
            }

            // 2. Publish Media
            const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: creationId,
                    access_token: accessToken
                })
            });
            const publishData = await publishRes.json();
            if (!publishRes.ok) {
                const msg = publishData.error?.message || 'Failed to publish to Instagram';
                throw new Error(`Instagram (Step 2): ${msg}`);
            }

            recordSocialPost(filename, 'instagram');
            return res.json({ success: true, platform: 'instagram', data: publishData });
        }

        if (platform === 'x') {
            console.log(`[Social] Using X Automation for: ${filename}`);

            // Get absolute path to the image
            const imagePath = path.resolve(IMAGES_DIR, filename);
            if (!fs.existsSync(imagePath)) {
                throw new Error(`Image not found at ${imagePath}`);
            }

            // Create a unique task name to avoid collisions
            const taskId = Date.now();
            const taskPath = path.join(__dirname, 'scripts', `task_${taskId}.json`);
            fs.writeFileSync(taskPath, JSON.stringify({ imagePath, caption }));

            // Spawn the automation script with the task file
            const scriptPath = path.join(__dirname, 'scripts', 'x-post-automation.js');
            const { spawn } = await import('child_process');

            return new Promise((resolve, reject) => {
                const child = spawn('node', [
                    scriptPath,
                    `--task=${taskPath}`
                ], { shell: true });

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => stdout += data.toString());
                child.stderr.on('data', (data) => stderr += data.toString());

                child.on('close', (code) => {
                    console.log(`[X-Automation] Exit code: ${code}`);
                    if (code === 0) {
                        recordSocialPost(filename, 'x');
                        resolve(res.json({ success: true, platform: 'x', output: stdout }));
                    } else {
                        console.error(`[X-Automation] Failed: ${stderr}`);
                        // Use reject to trigger the catch block in the express handler
                        reject(new Error(`X Automation failed (Exit ${code}): ${stderr || stdout}`));
                    }
                });
            });
        }

        if (platform === 'facebook') {
            if (!fbPageId) return res.status(400).json({ error: 'FB_PAGE_ID is not configured' });

            const fbRes = await fetch(`https://graph.facebook.com/v21.0/${fbPageId}/photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: imageUrl,
                    caption: caption,
                    access_token: accessToken
                })
            });
            const fbData = await fbRes.json();
            if (fbRes.ok) {
                recordSocialPost(filename, 'facebook');
                return res.json({ ok: true, id: fbData.id });
            } else {
                return res.status(fbRes.status).json({ error: fbData.error?.message || 'Facebook upload failed' });
            }
        }

        if (platform === 'whatsapp') {
            if (whatsappStatus !== 'CONNECTED') {
                return res.status(400).json({ error: 'WhatsApp is not connected' });
            }
            try {
                const filePath = path.join(IMAGES_DIR, filename);
                const media = MessageMedia.fromFilePath(filePath);
                const targetId = req.body.targetId || process.env.WA_TARGET_ID;
                
                if (!targetId) {
                    return res.status(400).json({ error: 'WA_TARGET_ID is not configured' });
                }

                await whatsappClient.sendMessage(targetId, media, { caption: caption || '' });
                recordSocialPost(filename, 'whatsapp');
                return res.json({ ok: true });
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        res.status(400).json({ error: 'Invalid platform specified' });

    } catch (e) {
        console.error('[Social Error]', e.message.substring(0, 500));
        // Ensure error is a clean string without huge logs
        const errorMsg = e.message.length > 1000 ? e.message.substring(0, 1000) + '...' : e.message;
        res.status(500).json({ error: errorMsg });
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

        const child = spawn('node', [scriptPath, '--login'], {
            stdio: 'inherit',
            shell: true
        });

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

        const child = spawn('node', [scriptPath, '--check'], { shell: true });
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

        let imagePath = path.join(IMAGES_DIR, filename);
        if (!fs.existsSync(imagePath)) {
            imagePath = path.join(NEW_IMAGES_DIR, filename);
        }
        
        if (!fs.existsSync(imagePath)) {
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

const START_TIME = new Date().toISOString();
app.listen(3088, () => {
    console.log(`[${START_TIME}] Server running on http://localhost:3088`);

    // Proactive startup check if session exists
    const sessionPath = path.join(__dirname, '../.x-session');
    if (fs.existsSync(sessionPath)) {
        const scriptPath = path.join(__dirname, 'scripts', 'x-post-automation.js');
        const child = spawn('node', [scriptPath, '--check'], { shell: true });
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
});
