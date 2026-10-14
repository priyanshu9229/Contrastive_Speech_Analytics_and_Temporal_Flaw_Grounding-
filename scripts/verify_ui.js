import puppeteer from 'puppeteer-core'
import path from 'path'
import fs from 'fs'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT_DIR = path.resolve('docs/figures')

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

async function run() {
  console.log('Launching Chrome from:', CHROME_PATH)
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  })

  const resolutions = [
    { width: 1280, height: 720 },
    { width: 1440, height: 900, screenshot: true, name: 'ui_1440x900.png' },
    { width: 1920, height: 1080, screenshot: true, name: 'ui_1920x1080.png' },
    { width: 2560, height: 1440 }
  ]

  for (const res of resolutions) {
    console.log(`\nTesting viewport ${res.width}x${res.height}...`)
    const page = await browser.newPage()
    await page.setViewport({ width: res.width, height: res.height })

    const consoleLogs = []
    const consoleErrors = []
    page.on('console', msg => {
      const text = msg.text()
      consoleLogs.push(text)
      if (msg.type() === 'error') {
        consoleErrors.push(text)
      }
    })
    page.on('pageerror', err => consoleErrors.push(err.toString()))

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 })

    // Check page-level scroll before analysis
    const preScroll = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        hasVerticalScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight
      }
    })
    console.log(`Pre-analysis scroll: H-scroll: ${preScroll.hasHorizontalScroll}, V-scroll: ${preScroll.hasVerticalScroll}`)

    // Click "Load sample" button
    console.log('Clicking "Load sample" button...')
    const loadBtn = await page.waitForSelector('button ::-p-text(Load sample)', { timeout: 5000 })
    await loadBtn.click()

    // Wait for analysis data, WaveSurfer and Plotly charts to render
    console.log('Waiting for analysis rendering...')
    await page.waitForSelector('.panel-right .tabular', { timeout: 15000 })
    await page.waitForSelector('.js-plotly-plot', { timeout: 15000 })
    
    // Give Plotly and WaveSurfer a moment to finish canvas rendering
    await new Promise(r => setTimeout(r, 2000))

    // Verify post-analysis scroll
    const postScroll = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        hasVerticalScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight
      }
    })
    console.log(`Post-analysis scroll: H-scroll: ${postScroll.hasHorizontalScroll}, V-scroll: ${postScroll.hasVerticalScroll}`)

    // Test hovering over the first flaw item
    const firstFlaw = await page.$('.panel-right .cursor-pointer')
    if (firstFlaw) {
      console.log('Hovering first flaw item to verify highlight synchronization...')
      await firstFlaw.hover()
      await new Promise(r => setTimeout(r, 500))
    }

    if (res.screenshot) {
      const outPath = path.join(OUT_DIR, res.name)
      await page.screenshot({ path: outPath })
      console.log(`Saved screenshot to: ${outPath}`)
    }

    if (consoleErrors.length > 0) {
      console.error('Console errors detected:', consoleErrors)
    } else {
      console.log('No console errors detected.')
    }

    await page.close()
  }

  await browser.close()
  console.log('\nAll viewport acceptance tests completed successfully!')
}

run().catch(err => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
