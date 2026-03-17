import fs from 'fs';
import path from 'path';

const dataPath = './data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// We'll collect all filenames from all apply-batch-*.mjs files
const files = fs.readdirSync('.').filter(f => f.startsWith('apply-batch-') && f.endsWith('.mjs'));

let totalCorrected = 0;
const markerTag = "משופר ע\"י AI";

for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    // Extract keys from the improvements object. Look for "filename.ext":
    const regex = /"([^"]+\.(?:jpg|png))":/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const filename = match[1];
        if (data[filename]) {
            // Fix the structure: remove topics array if it exists, use topic string
            let currentTopicStr = data[filename].topic || "";
            let currentTags = currentTopicStr.split(',').map(t => t.trim()).filter(Boolean);
            
            if (!currentTags.includes(markerTag)) {
                currentTags.push(markerTag);
                data[filename].topic = currentTags.join(', ');
                totalCorrected++;
            }
            
            // Crucial: Delete the misspelled/wrong-structure attribute
            if (data[filename].topics) {
                delete data[filename].topics;
            }
        }
    }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Successfully updated topic string and removed topics array for ${totalCorrected} images.`);
