import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

let count = 0;
for (const filename in data) {
    if (data[filename].aiSuggestion !== undefined) {
        delete data[filename].aiSuggestion;
        count++;
    }
}

fs.writeFileSync('./data.json', JSON.stringify(data, null, 2), 'utf-8');
console.log(`Cleared aiSuggestion from ${count} images.`);
