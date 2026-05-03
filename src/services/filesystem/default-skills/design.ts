import type { DefaultSkillManifestEntry } from "./types";

const REPO = "bergside/awesome-design-skills";
const SOURCE_ROOT =
	"https://github.com/bergside/awesome-design-skills/tree/main";
const RAW_ROOT =
	"https://raw.githubusercontent.com/bergside/awesome-design-skills/main";

const DESIGN_SKILL_SOURCES = [
	{
		slug: "agentic",
		description:
			"Conversational AI-first interface with minimal controls, clear outcomes, and delegated task flows for agentic workflows.",
	},
	{
		slug: "artistic",
		description:
			"High-contrast, expressive style with creative typography and bold color choices for visually striking interfaces.",
	},
	{
		slug: "bold",
		description:
			"Strong visual presence with heavyweight typography, high-contrast colors, and commanding layouts.",
	},
	{
		slug: "brutalism",
		description:
			"Raw, anti-design aesthetic inspired by concrete architecture with unadorned elements, jarring layouts, and functional minimalism.",
	},
	{
		slug: "cafe",
		description:
			"Cozy cafe-inspired interface with warm tones, soft typography, and clean layouts for a relaxed browsing experience.",
	},
	{
		slug: "claymorphism",
		description:
			"Soft, rounded 3D-like shapes mimicking malleable clay with playful, puffy elements and colorful surfaces.",
	},
	{
		slug: "clean",
		description:
			"Simplicity-focused design with ample whitespace, legible typography, and a limited color palette to reduce visual clutter.",
	},
	{
		slug: "colorful",
		description:
			"Vibrant, high-contrast palettes and gradients for engaging, memorable, and modern user experiences.",
	},
	{
		slug: "contemporary",
		description:
			"Current-era minimalist design with bento grids, dark mode support, and high-performance accessible layouts.",
	},
	{
		slug: "corporate",
		description:
			"Professional, brand-aligned design with structured grids, minimalist layouts, and consistent enterprise patterns.",
	},
	{
		slug: "cosmic",
		description:
			"Futuristic sci-fi aesthetic with dark themes, vibrant neon accents, and immersive spatial elements.",
	},
	{
		slug: "creative",
		description:
			"Playful, character-driven design with expressive typography and bold graphics for landing pages and creative projects.",
	},
	{
		slug: "dithered",
		description:
			"Dot-pattern rendering technique that simulates shades with a limited palette for nostalgic, retro, high-contrast visuals.",
	},
	{
		slug: "doodle",
		description:
			"Hand-drawn, sketch-like style with doodles, handwritten fonts, and imperfect lines for a playful, informal feel.",
	},
	{
		slug: "dramatic",
		description:
			"High-contrast, theatrical design with bold layouts, immersive visuals, and unconventional compositions that command attention.",
	},
	{
		slug: "editorial",
		description:
			"Magazine-inspired editorial layout with refined serif typography, structured grids, and elegant reading experiences.",
	},
	{
		slug: "elegant",
		description:
			"Graceful, refined aesthetic with delicate typography, minimal palettes, and polished layouts that exude sophistication.",
	},
	{
		slug: "energetic",
		description:
			"Dynamic, vibrant style with thick borders, geometric shapes, high-contrast colors, and expressive typography conveying motion and vitality.",
	},
	{
		slug: "enterprise",
		description:
			"Clean, high-contrast enterprise design for data-driven workflows with intuitive drag-and-drop patterns and structured layouts.",
	},
	{
		slug: "expressive",
		description:
			"Vibrant, personality-driven design with bold colors, playful graphics, and dynamic layouts that balance creativity with structure.",
	},
	{
		slug: "fantasy",
		description:
			"Game-inspired fantasy aesthetic with bold, premium visuals, rich color palettes, and immersive thematic elements.",
	},
	{
		slug: "flat",
		description:
			"Two-dimensional minimalist style with vibrant colors, clean typography, and no 3D effects for fast, user-friendly interfaces.",
	},
	{
		slug: "friendly",
		description:
			"Approachable, intuitive design with rounded elements, ample whitespace, and soft pastel color palettes.",
	},
	{
		slug: "futuristic",
		description:
			"Forward-looking design with tech-inspired typography, modern layouts, and a sleek, innovation-driven aesthetic.",
	},
	{
		slug: "glassmorphism",
		description:
			"Frosted glass effect with translucent layers, subtle blur, and luminous borders for depth and modern elegance.",
	},
	{
		slug: "gradient",
		description:
			"Smooth color transitions and gradient-rich surfaces for modern, playful interfaces with visual depth.",
	},
	{
		slug: "luxury",
		description:
			"High-end dark aesthetic with bold headings, monochromatic palette, and premium feel for luxury brand experiences.",
	},
	{
		slug: "material",
		description:
			"Google's Material Design with layered surfaces, dynamic theming, built-in motion, and responsive cross-platform patterns.",
	},
	{
		slug: "minimal",
		description:
			"Stripped-back design emphasizing whitespace, clean typography, and restrained color for maximum clarity and focus.",
	},
	{
		slug: "modern",
		description:
			"Contemporary editorial style with serif typography, minimal palettes, and clean layouts for polished digital products.",
	},
	{
		slug: "mono",
		description:
			"Monospace-driven, matrix-inspired design with high-contrast elements, compact density, and a hacker-chic aesthetic.",
	},
	{
		slug: "neobrutalism",
		description:
			"Modern take on brutalism with bold borders, vivid accent colors, and raw, high-contrast layouts on warm surfaces.",
	},
	{
		slug: "neon",
		description:
			"Electric neon glow effects with high-contrast color pairings for bold, attention-grabbing interfaces.",
	},
	{
		slug: "neumorphism",
		description:
			"Soft, extruded UI elements with inner and outer shadows on monochromatic surfaces for a tactile, embedded look.",
	},
	{
		slug: "pacman",
		description:
			"Retro arcade-inspired design with pixel fonts, dotted borders, playful high-contrast colors, and 8-bit game aesthetics.",
	},
	{
		slug: "paper",
		description:
			"Paper-textured, print-inspired design with minimal colors, clean serif/sans typography, and tactile surface qualities.",
	},
	{
		slug: "perspective",
		description:
			"Spatial depth design with isometric views, vanishing points, and layered elements that guide attention through 3D-like realism.",
	},
	{
		slug: "premium",
		description:
			"Apple-inspired premium aesthetic with precise spacing, modern typography, and a refined, polished visual language.",
	},
	{
		slug: "professional",
		description:
			"Polished, business-ready design with modern typography, structured layouts, and a trustworthy visual identity.",
	},
	{
		slug: "publication",
		description:
			"Print-inspired visual language for books, magazines, and reports with editorial grids and expressive typography.",
	},
	{
		slug: "refined",
		description:
			"Carefully curated, modern minimal style with elegant serif typography and understated, sophisticated palettes.",
	},
	{
		slug: "retro",
		description:
			"Throwback design with vintage-inspired typography, high-contrast retro palettes, and nostalgic visual elements.",
	},
	{
		slug: "shadcn",
		description:
			"Shadcn/ui-inspired design with minimal, clean components, monochrome palette, and utility-first patterns.",
	},
	{
		slug: "simple",
		description:
			"Straightforward, no-frills design with clean typography, neutral colors, and intuitive layouts that stay out of the way.",
	},
	{
		slug: "skeumorphism",
		description:
			"Real-world mimicry with textured surfaces, 3D effects, and familiar physical metaphors for intuitive digital interfaces.",
	},
	{
		slug: "sleek",
		description:
			"Modern minimalist aesthetic with clean lines, intentional color palette, subtle interactions, and consistent spacing.",
	},
	{
		slug: "spacious",
		description:
			"Generous whitespace, consistent padding, and grid-based layouts for clean, readable, and breathing interfaces.",
	},
	{
		slug: "storytelling",
		description:
			"Narrative-driven design using visuals, copy, and interaction to guide users through engaging, emotionally resonant journeys.",
	},
	{
		slug: "tetris",
		description:
			"Classic block-game inspired design with playful colors, bold display fonts, and compact, high-energy layouts.",
	},
	{
		slug: "vibrant",
		description:
			"Lively, colorful design with bold playful typography, warm accents, and dynamic visual energy.",
	},
	{
		slug: "vintage",
		description:
			"1950s-1990s nostalgia with skeuomorphic touches, grainy textures, retro color palettes, and pixel-style typography.",
	},
	{
		slug: "levels",
		description:
			"Conversion-focused design that removes friction and guides users toward action through clarity, trust, and speed.",
	},
	{
		slug: "bento",
		description:
			"Modular grid layout with card-like blocks, clear hierarchy, soft spacing, and subtle visual contrast for organized, scannable interfaces.",
	},
	{
		slug: "lingo",
		description:
			"Playful, minimal design with bright colors, rounded shapes, tactile 3D borders, and friendly illustrations for approachable interfaces.",
	},
	{
		slug: "dashboard",
		description:
			"Dark-themed cloud-platform aesthetic with modular grids, glass-like panels, and strong data hierarchy for productivity dashboards.",
	},
	{
		slug: "application",
		description:
			"App dashboard with purple-themed aesthetic, top-bar navigation, card-based layouts, and developer-first workflows.",
	},
	{
		slug: "ant",
		description:
			"Structured, enterprise-focused design system emphasizing clarity, consistency, and efficiency for data-dense web applications.",
	},
] as const;

export const DESIGN_DEFAULT_SKILLS: DefaultSkillManifestEntry[] =
	DESIGN_SKILL_SOURCES.map(({ slug, description }) => ({
		name: slug,
		description,
		publisher: "Bergside",
		collection: "design-skills",
		repo: REPO,
		sourceUrl: `${SOURCE_ROOT}/skills/${slug}`,
		rawUrls: [
			`${RAW_ROOT}/skills/${slug}/SKILL.md`,
			`${RAW_ROOT}/skills/${slug}/DESIGN.md`,
		],
	}));
