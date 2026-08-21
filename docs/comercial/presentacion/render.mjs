import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLIDE = { width: 1280, height: 720 };

/** Chrome del sistema: no descargamos binario, usamos el que ya esta instalado. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/local/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No se encontro Chrome. Define CHROME_PATH con la ruta al ejecutable.');
  process.exit(1);
}

const slidesDir = join(HERE, 'slides');
rmSync(slidesDir, { recursive: true, force: true });
mkdirSync(slidesDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ ...SLIDE, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(join(HERE, 'presentacion.html')).href, {
    waitUntil: 'networkidle0',
    timeout: 90_000,
  });
  await page.evaluate(() => document.fonts.ready);

  const pdfPath = resolve(HERE, 'ReservasGym-Presentacion.pdf');
  await page.pdf({
    path: pdfPath,
    width: `${SLIDE.width}px`,
    height: `${SLIDE.height}px`,
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log(`PDF  -> ${pdfPath}`);

  // Laminas sueltas en JPEG 1080p: es el formato que mejor viaja por WhatsApp
  // cuando el cliente prefiere ver imagenes en vez de abrir el PDF.
  await page.setViewport({ ...SLIDE, deviceScaleFactor: 1.5 });
  const slides = await page.$$('.slide');
  for (const [index, slide] of slides.entries()) {
    const name = `${String(index + 1).padStart(2, '0')}.jpg`;
    await slide.screenshot({ path: join(slidesDir, name), type: 'jpeg', quality: 92 });
    console.log(`IMG  -> slides/${name}`);
  }
  console.log(`\n${slides.length} laminas generadas.`);
} finally {
  await browser.close();
}
