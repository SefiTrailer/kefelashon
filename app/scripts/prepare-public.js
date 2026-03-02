import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.resolve(__dirname, '../../תמונות מקור משחקי מילים');
const DATA_FILE = path.resolve(__dirname, '../../data.json');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PUBLIC_IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const PUBLIC_DATA_FILE = path.join(PUBLIC_DIR, 'public-data.json');

console.log('Preparing public assets...');

// Ensure public directories exist
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
    fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
}

// Read the main data
let data = {};
if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

const publicFiles = [];
const publicData = {};
const fileStats = {};

// Clean existing public images first to handle deletions/renames
if (fs.existsSync(PUBLIC_IMAGES_DIR)) {
    fs.readdirSync(PUBLIC_IMAGES_DIR).forEach(file => {
        fs.unlinkSync(path.join(PUBLIC_IMAGES_DIR, file));
    });
}

// Get all images
const allSourceFiles = fs.readdirSync(IMAGES_DIR).filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));

// Build the array
async function buildPublicGallery() {
    for (const filename of allSourceFiles) {
        const metadata = data[filename] || {};
        const sourcePath = path.join(IMAGES_DIR, filename);

        // Convert everything to jpg for consistency and better compression
        const ext = path.extname(filename);
        const newFilename = filename.replace(ext, '.jpg');
        const destPath = path.join(PUBLIC_IMAGES_DIR, newFilename);

        if (fs.existsSync(sourcePath)) {
            try {
                // Compress and resize
                await sharp(sourcePath)
                    .resize({ width: 1280, withoutEnlargement: true })
                    .jpeg({ quality: 80, mozjpeg: true })
                    .toFile(destPath);

                publicFiles.push(newFilename);
                if (metadata.title && metadata.explanation) {
                    publicData[newFilename] = metadata;
                }

                const stat = fs.statSync(destPath); // Stat the newly created file instead
                fileStats[newFilename] = stat.size;
            } catch (err) {
                console.error(`Failed to process ${filename}:`, err);
            }
        }
    }

    // Sort publicFiles: tagged first, then untagged, then alphabetically
    publicFiles.sort((a, b) => {
        const aTagged = publicData[a]?.title ? 1 : 0;
        const bTagged = publicData[b]?.title ? 1 : 0;
        if (aTagged !== bTagged) {
            return bTagged - aTagged; // Tagged (1) before untagged (0)
        }
        return a.localeCompare(b);
    });

    // Write the public data file
    const finalPublicJson = {
        files: publicFiles,
        data: publicData,
        fileStats: fileStats
    };

    fs.writeFileSync(PUBLIC_DATA_FILE, JSON.stringify(finalPublicJson, null, 2));

    console.log(`Public assets preparation complete. Exported ${publicFiles.length} images.`);
}

buildPublicGallery();


