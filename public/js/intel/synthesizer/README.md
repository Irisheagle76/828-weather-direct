Asheville‑Aware Narrative Engine (Option B + Tone 3 + Strong Diversity)
This folder contains the full narrative synthesizer for the Human‑Action (HA) layer.
It transforms raw comfort intel into expressive, Asheville‑aware weather stories with:
- Medium‑length narratives (2–3 sentences)
- Strong diversity between Today and Tomorrow
- Category‑aware tone
- Goldilocks as a first‑class mode
- Asheville microclimate flavor (Option B)
- Warm + professional hybrid voice (Tone 3)
The synthesizer is fully modular and easy to extend.


/intel/synthesizer/
    index.js        ← Main orchestrator
    assemble.js     ← Builds narratives, bullets, headlines, emojis
    contrast.js     ← Ensures Today ≠ Tomorrow (strong diversity)
    temporal.js     ← Temporal framing engine
    categories.js   ← Category templates (incl. Goldilocks)
    phrases.js      ← 200+ micro‑phrases (temp, moisture, wind, etc.)
    bullets.js      ← 40+ Asheville‑aware micro‑bullets
    emojis.js       ← Emoji pools per category
    README.md       ← This file


 How It Works
1. index.js
This is the entry point.
It:
- receives Today + Tomorrow intel
- detects comfort category
- detects Goldilocks
- generates raw narratives via assemble.js
- applies strong contrast rules via contrast.js
- returns the final narrative objects
Usage:
import { generateNarrative } from "./intel/synthesizer/index.js";

const result = generateNarrative(intelToday, intelTomorrow);

console.log(result.today);
console.log(result.tomorrow);


2. assemble.js
This is the heart of the synthesizer.
It:
- selects temporal framing
- selects category templates
- selects micro‑phrases
- builds a 2–3 sentence narrative
- builds bullets
- builds headline
- builds emoji
It returns a raw narrative object:
{
  emoji: "🌤️",
  title: "A mild, manageable day",
  narrative: "This afternoon brings balanced warmth and crisp air...",
  mainTemplate: "...",
  temporal: "...",
  bullets: ["...", "...", "..."]
}

{
  emoji: "🌤️",
  title: "A mild, manageable day",
  narrative: "This afternoon brings balanced warmth and crisp air...",
  mainTemplate: "...",
  temporal: "...",
  bullets: ["...", "...", "..."]
}

3. contrast.js
This module enforces Option C (strong diversity).
It ensures:
- different emoji
- different headline
- different narrative template
- different temporal framing
- different bullet set
Even if Today and Tomorrow have identical weather.
Goldilocks days get special contrast handling.

4. temporal.js
Provides day‑aware opening phrases:
- Today: “This afternoon…”, “Later today…”
- Tomorrow: “Tomorrow morning…”, “By midday tomorrow…”
- Goldilocks: special just‑right framing
This gives the narrative its rhythm and human warmth.

5. categories.js
Defines headline + narrative templates for:
- Goldilocks
- Very Comfortable
- Comfortable
- Slightly Uncomfortable
- Uncomfortable
- Harsh
Each category has:
- 5–6 headline templates
- 5–6 narrative templates
These templates provide the “voice” of the engine.


6. phrases.js
Contains 200+ micro‑phrases, grouped by:
- temperature
- moisture
- wind
- cloud/light
- microclimate
- atmospheric pattern
These are the building blocks of your medium‑length narratives.


7. bullets.js
Contains 40+ Asheville‑aware micro‑bullets, grouped by factor.
Goldilocks has its own premium bullet pool.

8. emojis.js
Emoji pools per category, including Goldilocks.
The contrast engine ensures no repetition between days.


Goldilocks Mode
Goldilocks is treated as a premium narrative state:
- its own headline pool
- its own narrative pool
- its own bullet pool
- its own emoji pool
- its own temporal framing
- its own contrast rules
This ensures Goldilocks always feels special and intentional.

Extending the Synthesizer
You can safely extend:
✔ Phrase libraries
Add more micro‑phrases to phrases.js.
✔ Bullet pools
Add more bullets to bullets.js.
✔ Category templates
Add more headlines or narratives to categories.js.
✔ Temporal framing
Add more framing options to temporal.js.
✔ Contrast rules
Modify or expand logic in contrast.js.
The system is designed to scale without breaking.
