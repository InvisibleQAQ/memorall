import type { DefaultSkillManifestEntry } from "../types";

const body = `
# ASCII Art Image Generator

Generate ASCII art images from a text description, an uploaded image, or a concept. Output rich, detailed ASCII representations using the full Unicode box-drawing and block-element character set.

---

## When to use this skill

Trigger when the user asks to:
- Draw or sketch something in ASCII
- Convert an image to ASCII
- Create a diagram, scene, character, logo, map, or chart in text form
- Generate pixel-art-style or wireframe-style ASCII output

---

## Character Palettes

### Density ramp (darkest → lightest)

    █ ▓ ▒ ░   (block fill)
    @ # % * + = - : . \` (printable ramp)
      (space = lightest / background)

### Box-drawing (wireframes & UI)

    Single:  ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼
    Double:  ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬
    Mixed:   ╒ ╓ ╕ ╖ ╘ ╙ ╛ ╜ ╞ ╟ ╡ ╢ ╤ ╥ ╧ ╨ ╪ ╫
    Rounded: ╭ ╮ ╰ ╯

### Arrows & connectors

    → ← ↑ ↓ ↔ ↕ ⇒ ⇐ ⇑ ⇓ ➜ ▶ ◀ ▲ ▼

### Shading & texture

    ░░ light   ▒▒ medium   ▓▓ dark   ██ solid

---

## Output Rules

1. Always wrap output in a fenced code block — use \`\`\`art or \`\`\`text so the renderer uses a monospace font.
2. Aspect ratio: terminal characters are ~2× taller than wide — compensate by making images wider than they are tall.
3. Width: default to 60–80 columns unless the user specifies otherwise.
4. Shading accuracy: map luminosity regions to the density ramp above.
5. Annotations: add a short legend or label below the art when it aids comprehension.
6. Detail over speed: spend extra tokens producing a larger, more detailed image. Do not produce a tiny or sparse result when a detailed one is possible.
7. No placeholders: never output [IMAGE] or ... — draw every section fully.

---

## Workflow

### Step 1 — Analyse the subject
Identify: overall shape, major regions, light source (if applicable), foreground vs background, and any text elements.

### Step 2 — Choose style

| Subject type         | Style                          |
|----------------------|--------------------------------|
| UI / wireframe       | Box-drawing characters         |
| Portrait / face      | Density ramp + shading         |
| Landscape / scene    | Mixed ramp + texture fills     |
| Logo / icon          | Bold fills + clean outlines    |
| Diagram / flowchart  | Arrows + boxes + labels        |
| Pixel art            | Block elements (█ ▓ ▒ ░ · )   |

### Step 3 — Build the image
- Sketch the outline first, then fill regions.
- Use darker characters for shadows/depth, lighter for highlights.
- For images with text, render the text inside the art.

### Step 4 — Refine
- Check symmetry where expected.
- Confirm columns are consistent.
- Add caption or legend line below.

---

## Examples

### Portrait shading

\`\`\`art
          ░░▒▒▒▒▒▒░░
        ░▒▓▓▓▓▓▓▓▓▓▒░
       ░▒▓█▓░    ░▓█▓▒░
       ░▒▓░  ██  ██ ░▓▒░
       ▒▓▓░        ░▓▓▒
       ▒▓▓▓░  __  ░▓▓▓▒
        ░▒▓▓▓▓▓▓▓▓▓▒░
          ░░▒▒▒▒▒▒░░
\`\`\`

### UI wireframe

\`\`\`art
╭──────────────────────────────────────────╮
│  ☰  MyApp                    🔔  👤     │
├──────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────────────┐  │
│  │ Navigation │  │  Main Content      │  │
│  │            │  │                    │  │
│  │ ▶ Home     │  │  ┌──────────────┐  │  │
│  │   Dashboard│  │  │  Chart Area  │  │  │
│  │   Reports  │  │  │  ░░▒▒▓▓██▓▒  │  │  │
│  │   Settings │  │  └──────────────┘  │  │
│  │            │  │                    │  │
│  │ [  Login ] │  │  [ Save ]  [Cancel]│  │
│  └────────────┘  └────────────────────┘  │
╰──────────────────────────────────────────╯
\`\`\`

### Scene

\`\`\`art
       *  .  *    .        *
  .  *    ☽    *   .    *    .
 ____________________________
|░░░░░  🏠  ░░░░░░░░░░░░░░|
|░░░░░░░░░░░░░  🌲  ░░░░░░|
|▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓|
|████████  road  ████████|
 ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾
\`\`\`

### Flowchart

\`\`\`art
  ┌─────────────┐
  │    Start    │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     Yes    ┌──────────┐
  │  Condition? │──────────▶ │ Action A │
  └──────┬──────┘            └──────────┘
         │ No
         ▼
  ┌─────────────┐
  │  Action B   │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │     End     │
  └─────────────┘
\`\`\`

---

## Image input

When the user attaches an image:
1. Describe the luminosity regions you observe (darkest → lightest zones).
2. Map them to the density ramp.
3. Reproduce major edges, outlines, and shading in ASCII.
4. Aim for at least 40 rows × 80 columns for meaningful detail.

---

## Quality bar

A good ASCII image produced by this skill should be:
- **Recognisable** — a viewer should identify the subject without reading the caption.
- **Detailed** — fills regions with appropriate texture, not blank space.
- **Consistent** — column alignment is exact; no ragged right edges.
- **Well-labelled** — title or legend line follows the code block.
`.trim();

export const ASCII_ART_SKILL: DefaultSkillManifestEntry = {
	name: "ascii-art",
	description:
		"Generate detailed ASCII art images from a description, uploaded image, or concept. Supports portraits, scenes, UI wireframes, flowcharts, logos, and pixel art using the full Unicode box-drawing and block-element character set.",
	publisher: "Second Sky",
	collection: "design-skills",
	repo: "secondsky/memorall",
	sourceUrl: "",
	body,
};
