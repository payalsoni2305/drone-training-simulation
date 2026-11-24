// CesiumJS loads web workers, textures and styles at runtime. Copy them next to the app
// (public/cesium) so Vite serves them in dev and includes them in the production build.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'

const from = 'node_modules/cesium/Build/Cesium'
const to = 'public/cesium'

if (!existsSync(from)) {
  console.error('cesium is not installed. Run `npm install` in frontend/ first.')
  process.exit(1)
}
rmSync(to, { recursive: true, force: true })
mkdirSync(to, { recursive: true })
// Widgets (icons, map picker images) are not needed: we only use the bare CesiumWidget, and its
// CSS is bundled by Vite. Skip the globe-picker textures we never show as well.
for (const dir of ['Workers', 'ThirdParty', 'Assets']) {
  cpSync(`${from}/${dir}`, `${to}/${dir}`, { recursive: true })
}
for (const unused of ['NaturalEarthII', 'maki', 'LensFlare']) {
  rmSync(`${to}/Assets/Textures/${unused}`, { recursive: true, force: true })
}
console.log('Copied CesiumJS runtime assets to public/cesium')
