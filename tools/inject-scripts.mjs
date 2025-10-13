import fs from "fs";

const p = "package.json";
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));

pkg.scripts = {
  ...pkg.scripts,

  // --- PRODUCTION PLUGIN PACKAGING ---
  "clean": "rimraf dist wordpress-plugin/mortgage-master-toolkit-main/assets/build wordpress-plugin/mortgage-master-toolkit-main.zip",

  "build:js": "vite build",

  // Change the input path if your Tailwind directives live elsewhere.
  // Using src/index.css is common for Vite+Tailwind projects.
  "build:css": "tailwindcss -i ./src/index.css -o ./wordpress-plugin/mortgage-master-toolkit-main/assets/build/style.css --minify",

  // Copy Vite output into the plugin and normalize the main JS to index.js
  "stage:plugin": "shx mkdir -p wordpress-plugin/mortgage-master-toolkit-main/assets/build && rimraf wordpress-plugin/mortgage-master-toolkit-main/assets/build/* && cpy \"dist/assets/*.js\" \"wordpress-plugin/mortgage-master-toolkit-main/assets/build\" --rename=index.js && cpy \"dist/assets/*.css\" \"wordpress-plugin/mortgage-master-toolkit-main/assets/build\" --flat && cpy \"dist/assets/*.{woff,woff2,ttf,eot,svg,png,jpg,jpeg,gif,webp}\" \"wordpress-plugin/mortgage-master-toolkit-main/assets/build\" --flat --no-overwrite",

  "zip:plugin": "bestzip wordpress-plugin/mortgage-master-toolkit-main.zip wordpress-plugin/mortgage-master-toolkit-main/**",

  "package:plugin": "npm run clean && npm run build:js && npm run build:css && npm run stage:plugin && npm run zip:plugin"
};

fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("✅ Injected packaging scripts into package.json");
