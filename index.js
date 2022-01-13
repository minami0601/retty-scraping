const puppeteer = require('puppeteer');

(async () => {
  const options = {
    headless: false, // ヘッドレスをオフに
    slowMo: 100  // 動作を遅く
  };
  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();
  await page.goto('https://anotherkyoto.jp/mypage/');
  await page.type('input[name="mail_addr"]', 'moroishi@applet-jp.com');
  await page.type('input[name="userpass"]', 'aaaa1111');
  await page.click('.btn-submit');

  // await browser.close();

})();

<a href="https://retty.me/restaurant-search/search-result/?page=5&amp;free_word_area=%E7%9B%AE%E9%BB%92%E9%A7%85&amp;station_id=1371&amp;budget_meal_type=2&amp;min_budget=6&amp;max_budget=9">5</a>
//*[@id="js-search-result"]/div/section/ul/li[5]/a
