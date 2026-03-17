/**
 * convert-to-webp.mjs
 * Converts logo.png, qrcode.png, and all gallery images to WebP.
 * Run from inside the `app` folder: node convert-to-webp-run.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const IMAGES_DIR = path.join(PUBLIC, 'images');

let totalOriginalBytes = 0;
let totalWebpBytes = 0;
let converted = 0;
let skipped = 0;
let errors = 0;

async function convertFile(inputPath, outputPath, options = {}) {
    const { quality = 82, lossless = false } = options;

    // Skip if output already exists and is newer
    if (fs.existsSync(outputPath)) {
        const inputStat = fs.statSync(inputPath);
        const outputStat = fs.statSync(outputPath);
        if (outputStat.mtimeMs >= inputStat.mtimeMs) {
            skipped++;
            return;
        }
    }

    try {
        const inputStat = fs.statSync(inputPath);
        await sharp(inputPath)
            .webp({ quality, lossless })
            .toFile(outputPath);
        const outputStat = fs.statSync(outputPath);

        totalOriginalBytes += inputStat.size;
        totalWebpBytes += outputStat.size;
        converted++;

        const reduction = (((inputStat.size - outputStat.size) / inputStat.size) * 100).toFixed(1);
        const originalKB = (inputStat.size / 1024).toFixed(0);
        const webpKB = (outputStat.size / 1024).toFixed(0);
        console.log(`✓ ${path.basename(outputPath)} | ${originalKB}KB → ${webpKB}KB (-${reduction}%)`);
    } catch (err) {
        errors++;
        console.error(`✗ Error converting ${path.basename(inputPath)}: ${err.message}`);
    }
}

async function main() {
    console.log('🎨 Starting WebP conversion...\n');

    // 1. Convert logo.png
    const logoPng = path.join(PUBLIC, 'logo.png');
    const logoWebp = path.join(PUBLIC, 'logo.webp');
    if (fs.existsSync(logoPng)) {
        console.log('📌 Converting logo...');
        await convertFile(logoPng, logoWebp, { quality: 90 });
    }

    // 2. Convert qrcode.png (lossless to keep QR scannable)
    const qrPng = path.join(PUBLIC, 'qrcode.png');
    const qrWebp = path.join(PUBLIC, 'qrcode.webp');
    if (fs.existsSync(qrPng)) {
        console.log('📌 Converting QR code (lossless)...');
        await convertFile(qrPng, qrWebp, { lossless: true });
    }

    // 3. Convert all gallery images
    console.log('\n📌 Converting gallery images...');
    const files = fs.readdirSync(IMAGES_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    console.log(`Found ${imageFiles.length} images to process.\n`);

    // Process in batches of 8 to avoid memory issues
    const BATCH_SIZE = 8;
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(file => {
            const inputPath = path.join(IMAGES_DIR, file);
            const outputPath = path.join(IMAGES_DIR, file.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
            const isPng = file.toLowerCase().endsWith('.png');
            return convertFile(inputPath, outputPath, { quality: isPng ? 85 : 82 });
        }));

        if ((i + BATCH_SIZE) % 80 === 0 || i + BATCH_SIZE >= imageFiles.length) {
            console.log(`  ── Progress: ${Math.min(i + BATCH_SIZE, imageFiles.length)}/${imageFiles.length}`);
        }
    }

    // Summary
    const savedMB = ((totalOriginalBytes - totalWebpBytes) / 1024 / 1024).toFixed(1);
    const savedPct = totalOriginalBytes > 0
        ? (((totalOriginalBytes - totalWebpBytes) / totalOriginalBytes) * 100).toFixed(1)
        : 0;
    const origTotalMB = (totalOriginalBytes / 1024 / 1024).toFixed(1);
    const webpTotalMB = (totalWebpBytes / 1024 / 1024).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Done! Converted: ${converted} | Skipped: ${skipped} | Errors: ${errors}`);
    console.log(`📦 Original: ${origTotalMB}MB → WebP: ${webpTotalMB}MB`);
    console.log(`💾 Saved: ${savedMB}MB (${savedPct}% reduction)`);
    console.log('='.repeat(60));
}

main().catch(console.error);
