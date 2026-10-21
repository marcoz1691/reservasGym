// Arma las imágenes fuente de ícono y splash (app/assets/) a partir del logo de
// public/brand. Después: npx capacitor-assets generate --android --ios
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const BG_LIGHT = '#F6F5F2'
const BG_DARK = '#0E1117'
const out = new URL('../assets/', import.meta.url)
const brand = (name) => new URL(`../public/brand/${name}`, import.meta.url).pathname

async function compose({ size, background, logo, logoWidth, file }) {
  const resized = await sharp(brand(logo))
    .resize({ width: logoWidth, kernel: 'lanczos3' })
    .toBuffer()
  const meta = await sharp(resized).metadata()
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
  await canvas
    .composite([{ input: resized, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png()
    .toFile(new URL(file, out).pathname)
}

await mkdir(out, { recursive: true })
await compose({ size: 1024, background: BG_LIGHT, logo: 'mark-color.png', logoWidth: 640, file: 'icon-only.png' })
// Android recorta el ícono adaptativo a un círculo: el logo debe caber en el 66 % central.
await compose({ size: 1024, logo: 'mark-color.png', logoWidth: 560, file: 'icon-foreground.png' })
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG_LIGHT } })
  .png()
  .toFile(new URL('icon-background.png', out).pathname)
await compose({ size: 2732, background: BG_LIGHT, logo: 'logo-color.png', logoWidth: 900, file: 'splash.png' })
await compose({ size: 2732, background: BG_DARK, logo: 'logo-white.png', logoWidth: 900, file: 'splash-dark.png' })

// Ficha de Google Play: ícono 512×512 y gráfico de funciones 1024×500.
await mkdir(new URL('store/', out), { recursive: true })
await sharp(new URL('icon-only.png', out).pathname).resize(512, 512).png().toFile(new URL('store/play-icon-512.png', out).pathname)
const banner = await sharp(brand('logo-white.png')).resize({ width: 620, kernel: 'lanczos3' }).toBuffer()
const bannerMeta = await sharp(banner).metadata()
await sharp({ create: { width: 1024, height: 500, channels: 4, background: BG_DARK } })
  .composite([{ input: banner, left: Math.round((1024 - bannerMeta.width) / 2), top: Math.round((500 - bannerMeta.height) / 2) }])
  .png()
  .toFile(new URL('store/play-feature-graphic-1024x500.png', out).pathname)
console.log('Listo: app/assets/')
