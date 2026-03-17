import fs from 'fs';
import path from 'path';

const dataPath = './data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// We'll collect all filenames from all apply-batch-*.mjs files
const files = fs.readdirSync('.').filter(f => f.startsWith('apply-batch-') && f.endsWith('.mjs'));

let totalMarked = 0;
const markerTag = "משופר ע\"י AI";

for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    // Extract keys from the improvements object. Look for "filename.ext":
    const regex = /"([^"]+\.(?:jpg|png))":/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const filename = match[1];
        if (data[filename]) {
            if (!data[filename].topics) data[filename].topics = [];
            if (!data[filename].topics.includes(markerTag)) {
                data[filename].topics.push(markerTag);
                totalMarked++;
            }
        }
    }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Successfully added tag "${markerTag}" to ${totalMarked} images.`);
