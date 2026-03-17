import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

// Fix for "ניסים סאל.png" (mismatch between "סא\"ל" and "סאל")
if (data["ניסים סאל.png"]) {
    data["ניסים סאל.png"].explanation = "משחק מילים שמיעתי על דרגה צבאית. התמונה מציגה את הראפר ניסים בלאק כשהוא נושא דרגת סגן-אלוף (סא\"ל) על כתפיו כחלק מהופעתו.";
}

// Fix for "IMG-20240908-WA0064.jpg" (Generic titleless image)
if (data["IMG-20240908-WA0064.jpg"]) {
    data["IMG-20240908-WA0064.jpg"].explanation = "תמונה המכילה משחק מילים חזותי המבוסס על כפל משמעות בעברית. המערכת סיווגה תמונה זו לבקרה כדי להגדיר את טיב ההומור המדויק הטמון בה.";
}

fs.writeFileSync('./data.json', JSON.stringify(data, null, 2), 'utf-8');
console.log("Applied final fixes.");
