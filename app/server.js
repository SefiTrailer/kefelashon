import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import multer from 'multer'; // Import multer
import { generateAHash, getHammingDistance } from './utils/image-hash.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the git repository (one level up from /app)
const REPO_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

const IMAGES_DIR = path.resolve(__dirname, '../app/public/images');
const NEW_IMAGES_DIR = path.resolve(__dirname, '../תמונות חדשות');
const DATA_FILE = path.resolve(__dirname, '../data.json');
const HASHES_FILE = path.resolve(__dirname, '../hashes.json');
const SOURCE_BACKUP_DIR = path.resolve(__dirname, '../app/תמונות מקור'); // Keep for legacy if needed

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Automatically create destination directory if it doesn't exist
        if (!fs.existsSync(IMAGES_DIR)){
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
app.post('/api/upload', upload.array('images'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }
        res.json({ success: true });

        let data = {};
        if (fs.existsSync(DATA_FILE)) {
            data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }

        const uploadedFilenames = [];

        req.files.forEach(file => {
            const originalPath = file.path;
            const publicPath = path.join(PUBLIC_DIR, file.filename);

            // Copy to public directory
            fs.copyFileSync(originalPath, publicPath);

            // Initialize metadata if it doesn't exist
            if (!data[file.filename]) {
                data[file.filename] = {
                    title: "",
                    explanation: "",
                    topic: "",
                    isAIGenerated: false,
                    createdAt: Date.now()
                };
            }
            uploadedFilenames.push(file.filename);
        });

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

                if (hashMatch || titleMatch || filenameMatch) {
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
        } catch(e) {
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

// ─────────────────────────────────────────────────────────────────────────────

app.listen(3088, () => {
    console.log('Server running on http://localhost:3088');
});
