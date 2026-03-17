import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

const hanukkahFalseKeywords = ['רפרנס', 'כנס', 'פנס', 'מכנס', 'פיננס'];
const hanukkahTrueKeywords = ['חנוכה', 'חנוכיה', 'חנוכייה', 'סופגניה', 'סופגנייה', 'סביבון', 'לביבה', 'שמן', 'נס'];

let fixedCount = 0;

for (const [filename, item] of Object.entries(data)) {
    if (!item.topic) continue;
    
    const topics = item.topic.split(',').map(t => t.trim());
    if (topics.includes('חנוכה')) {
        const text = (item.title + ' ' + item.explanation).toLowerCase();
        
        // Stricter check for Hanukkah
        let isRealHanukkah = false;
        
        // 1. If it contains the word Hanukkah, Menorah, or Sufganiyah explicitly, it's likely real
        if (text.includes('חנוכה') || text.includes('חנוכיה') || text.includes('חנוכייה') || text.includes('סופגניה') || text.includes('סופגנייה') || text.includes('סביבון')) {
            isRealHanukkah = true;
        } else {
            // 2. Check for "נס" or "שמן" as whole words only
            const words = text.split(/[\s,.;:!"'?()\-]+/);
            if (words.includes('נס') || words.includes('שמן')) {
                // Double check it's not just "reference" etc.
                if (!hanukkahFalseKeywords.some(kw => text.includes(kw))) {
                    isRealHanukkah = true;
                }
            }
        }

        if (!isRealHanukkah) {
            const newTopics = topics.filter(t => t !== 'חנוכה' && t !== 'חגים ומועדים');
            // Check if it still has other holiday tags before removing the category
            const otherHolidays = ['פסח', 'סוכות', 'פורים', 'שבועות', 'ראש השנה', 'יום כיפור'];
            const hasOtherHoliday = newTopics.some(t => otherHolidays.includes(t));
            
            if (!hasOtherHoliday) {
                item.topic = newTopics.join(', ');
            } else {
                // Keep the category if other holidays exist
                item.topic = topics.filter(t => t !== 'חנוכה').join(', ');
            }
            fixedCount++;
        }
    }
}

fs.writeFileSync('./data.json', JSON.stringify(data, null, 2), 'utf-8');
console.log(`Removed incorrect Hanukkah tags from ${fixedCount} images.`);
