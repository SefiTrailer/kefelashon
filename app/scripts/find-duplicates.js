import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGES_DIR = path.resolve(__dirname, '../../תמונות מקור משחקי מילים');

function findDuplicates() {
    console.log(`Scanning directory: ${IMAGES_DIR}`);
    if (!fs.existsSync(IMAGES_DIR)) {
        console.error('Directory not found!');
        return;
    }

    const files = fs.readdirSync(IMAGES_DIR).filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));
    console.log(`Found ${files.length} images. Analyzing exact byte sizes...`);

    const sizeMap = new Map();

    files.forEach(file => {
        const filePath = path.join(IMAGES_DIR, file);
        try {
            const stat = fs.statSync(filePath);
            const size = stat.size;

            if (!sizeMap.has(size)) {
                sizeMap.set(size, []);
            }
            sizeMap.get(size).push(file);
        } catch (err) {
            console.error(`Error reading ${file}: ${err.message}`);
        }
    });

    let duplicateCount = 0;
    console.log('\n--- EXACT DUPLICATES FOUND (by byte size) ---\n');

    for (const [size, fileList] of sizeMap.entries()) {
        if (fileList.length > 1) {
            duplicateCount++;
            const sizeInKb = (size / 1024).toFixed(1);
            console.log(`[GROUP ${duplicateCount}] Size: ${size} Bytes (${sizeInKb} KB) - ${fileList.length} files:`);
            fileList.forEach(f => console.log(`   - ${f}`));
            console.log('');
        }
    }

    if (duplicateCount === 0) {
        console.log('No exact duplicates found based on byte size.');
    } else {
        console.log(`\nFound ${duplicateCount} groups of files with identical byte sizes.`);
        console.log('Note: If you delete one of these via the UI, ensure you keep the one you want to tag.');
    }
}

findDuplicates();
