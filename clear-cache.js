// Fake script to clear local storage cache through a puppeteer instance
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.clear();
  });
  console.log("Local storage cleared via puppeteer");
  await browser.close();
})();
