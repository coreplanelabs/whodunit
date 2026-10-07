import fs from "node:fs";

const faces = [
  ["DM Sans", "dm-sans", 400],
  ["DM Sans", "dm-sans", 600],
  ["DM Sans", "dm-sans", 700],
  ["DM Mono", "dm-mono", 400],
];
const css = faces
  .map(([family, slug, weight]) => {
    const data = fs
      .readFileSync(`site/assets/${slug}-latin-${weight}-normal.woff`)
      .toString("base64");
    return `@font-face{font-family:"Whodunit ${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("data:font/woff;base64,${data}") format("woff")}`;
  })
  .join("\n");
fs.writeFileSync(
  "src/report-assets.ts",
  `// Generated local fonts; SIL OFL licenses are bundled with the skill.
export const reportFonts =
  '${css.replaceAll("\n", "\\n")}';
`,
);
fs.mkdirSync("skill/whodunit/assets", { recursive: true });
for (const name of ["dmsans-OFL.txt", "dmmono-OFL.txt"])
  fs.copyFileSync(`site/assets/${name}`, `skill/whodunit/assets/${name}`);
