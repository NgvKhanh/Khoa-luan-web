// Chuyen svg/*.svg -> png/*.png bang Chrome headless (ti le 2x de in sac net).
// Chay sau "python ve_use_case.py":   node chup_png.js
// Neu Chrome nam o cho khac: dat bien moi truong CHROME_PATH tro toi chrome.exe / msedge.exe.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const chrome = CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('Khong tim thay Chrome/Edge. Dat CHROME_PATH roi chay lai.');
  process.exit(1);
}

const specPath = path.join(HERE, 'spec.json');
if (!fs.existsSync(specPath)) {
  console.error('Chua co spec.json - hay chay "python ve_use_case.py" truoc.');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
fs.mkdirSync(path.join(HERE, 'png'), { recursive: true });

for (const d of spec) {
  const svg = path.join(HERE, 'svg', `${d.key}.svg`);
  const png = path.join(HERE, 'png', `${d.key}.png`);
  const url = 'file:///' + svg.replace(/\\/g, '/');
  try {
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=2',
        `--window-size=${d.width},${d.height}`,
        `--screenshot=${png}`,
        url,
      ],
      { stdio: 'pipe', timeout: 60000 }
    );
  } catch (err) {
    console.error(`Loi khi chup ${d.key}:`, err.message);
    process.exit(1);
  }
  if (!fs.existsSync(png)) {
    console.error(`Chrome khong tao ra ${png}`);
    process.exit(1);
  }
  console.log(`${d.key}.png (${d.width}x${d.height} @2x)`);
}
