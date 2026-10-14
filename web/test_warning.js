import puppeteer from 'puppeteer-core'
import path from 'path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT_PATH = path.resolve('../docs/figures/ui_warning_banner.png')

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' })

  // Select all text in textarea and type mismatched text
  const textarea = await page.waitForSelector('textarea')
  await textarea.click()
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('We shall fight on the beaches, we shall fight on the landing grounds.')

  // Upload stay_hungry audio
  const fileInput = await page.waitForSelector('input[type="file"]')
  const audioFilePath = path.resolve('../data/raw/stay_hungry.wav')
  await fileInput.uploadFile(audioFilePath)

  // Click Analyze
  console.log('Clicking Analyze with mismatched transcript...')
  const analyzeBtn = await page.waitForSelector('button ::-p-text(Analyze)')
  await analyzeBtn.click()

  // Wait for warning banner and results
  console.log('Waiting for analysis and warning banner...')
  await page.waitForSelector('[data-testid="warning-banner"]', { timeout: 35000 })
  await page.waitForSelector('.panel-right .tabular', { timeout: 35000 })
  await new Promise(r => setTimeout(r, 2000))

  await page.screenshot({ path: OUT_PATH })
  console.log('Successfully captured warning banner screenshot at:', OUT_PATH)
  await browser.close()
}

run().catch(err => {
  console.error('Warning banner test failed:', err)
  process.exit(1)
})
