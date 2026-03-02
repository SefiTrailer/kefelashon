import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const IMAGES_DIR = path.resolve(__dirname, '../תמונות מקור משחקי מילים');
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

app.listen(3088, () => {
    console.log('Server running on http://localhost:3088');
});
