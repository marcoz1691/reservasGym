import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SLIDE = { width: 1280, height: 720 };

/** Chrome del sistema: no descargamos binario, usamos el que ya esta instalado. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
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
  // Escala 1 + JPEG: PDF liviano para WhatsApp (antes ~1.6 MB con scale 2).
  await page.setViewport({ ...SLIDE, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(HERE, 'presentacion.html')).href, {
    waitUntil: 'networkidle0',
    timeout: 90_000,
  });
  await page.evaluate(() => document.fonts.ready);

  const slides = await page.$$('.slide');
  const jpegBuffers = [];

  for (const [index, slide] of slides.entries()) {
    const name = `${String(index + 1).padStart(2, '0')}.jpg`;
    const outPath = join(slidesDir, name);
    const buffer = await slide.screenshot({
      type: 'jpeg',
      quality: 72,
      encoding: 'binary',
    });
    writeFileSync(outPath, buffer);
    jpegBuffers.push(buffer);
    console.log(`IMG  -> slides/${name}`);
  }

  // PDF armado con JPEG comprimidos (mucho mas liviano que page.pdf del HTML).
  const pdf = await PDFDocument.create();
  for (const buffer of jpegBuffers) {
    const image = await pdf.embedJpg(buffer);
    const pagePdf = pdf.addPage([SLIDE.width, SLIDE.height]);
    pagePdf.drawImage(image, {
      x: 0,
      y: 0,
      width: SLIDE.width,
      height: SLIDE.height,
    });
  }

  const pdfPath = resolve(HERE, 'ReservasGym-Presentacion.pdf');
  writeFileSync(pdfPath, await pdf.save());
  console.log(`PDF  -> ${pdfPath}`);
  console.log(`\n${slides.length} laminas generadas.`);
} finally {
  await browser.close();
}
