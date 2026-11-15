---
description: הפעלת המערכת המלאה (ניהול + גלריה ציבורית + בקנד) במקביל
---

הפקודה הבאה מרימה את כל חלקי המערכת כדי שתוכל לעבוד על הכל במקביל.

// turbo-all
1. הפעל את שרת הבקנד (Port 3088):
```bash
cd app; node server.js
```

2. הפעל את ממשק הניהול (Port 5555):
```bash
cd app; npm run dev -- --mode admin --port 5555
```

3. הפעל את הגלריה לקהל (Port 5556):
```bash
cd app; npm run dev -- --mode production --port 5556
```
