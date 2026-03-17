import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
const master = JSON.parse(fs.readFileSync('./tags_master.json', 'utf-8'));

// Additional specific tags we want to push for
const specificRules = {
    "פסח": ["פסח", "מצה", "מצות", "חמץ", "אפיקומן", "הגדה", "סדר", "שיעור אכילת פרס", "מצרים"],
    "סוכות": ["סוכות", "סוכה", "ארבעת המינים", "אתרוג", "לולב"],
    "חנוכה": ["חנוכה", "חנוכיה", "חנוכייה", "סופגניה", "סופגנייה", "סביבון", "לביבה", "כד השמן"],
    "פורים": ["פורים", "מגילה", "המן", "מרדכי", "אסתר", "תחפושת", "משלוח מנות"],
    "שבועות": ["שבועות", "מתן תורה", "ביכורים", "קציר"],
    "צה\"ל": ["צה\"ל", "צבא", "חייל", "חיילים", "מדים", "טנק", "טילים", "מלחמה", "רמטכ\"ל", "צב שמונה", "דגל שק"],
    "משטרה": ["משטרה", "שוטר", "ניידת", "מג\"ב", "מגבונים"],
    "כלב": ["כלב", "כלבים", "נאמן למקור"],
    "חתול": ["חתול", "חתולים", "טום לב", "חתולוטרה"],
    "אוכל": ["אוכל", "מאכל", "לחם", "עוגה", "פאי", "פיסטוק", "בטטה", "אבטיח", "ירקות", "מרק"],
    "ירושלים": ["ירושלים", "ביתר", "עיר"],
    "מירון": ["מירון", "רבי שמעון", "בר יוחאי", "לג בעומר"]
};

let refilledCount = 0;

for (const [filename, item] of Object.entries(data)) {
    if (!item.title || !item.explanation) continue;

    const text = (item.title + ' ' + item.explanation).toLowerCase();
    const currentTopics = new Set(item.topic ? item.topic.split(',').map(t => t.trim()).filter(Boolean) : []);
    const originalSize = currentTopics.size;

    for (const [tag, keywords] of Object.entries(specificRules)) {
        if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
            currentTopics.add(tag);
            
            // If it's a specific tag, also ensure its general category from master is there
            if (master.mappings[tag]) {
                currentTopics.add(master.mappings[tag]);
            }
        }
    }

    if (currentTopics.size > originalSize) {
        item.topic = Array.from(currentTopics).join(', ');
        refilledCount++;
    }
}

fs.writeFileSync('./data.json', JSON.stringify(data, null, 2), 'utf-8');
console.log(`Refined tags for ${refilledCount} images.`);
