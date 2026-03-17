import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

const missingExplanations = [];

for (const filename in data) {
    const entry = data[filename];
    if (!entry.explanation || entry.explanation.trim() === "") {
        missingExplanations.push({
            filename,
            title: entry.title
        });
    }
}

console.log(`Found ${missingExplanations.length} images without explanations.`);
console.log('\n--- Missing Explanations ---');
missingExplanations.forEach(img => {
    console.log(`File: ${img.filename}`);
    console.log(`Title: ${img.title}`);
    console.log('---');
});
