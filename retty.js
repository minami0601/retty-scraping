const puppeteer = require('puppeteer')
const fs = require('fs')
require('dotenv').config()
const {createObjectCsvWriter} = require('csv-writer')

const OUTPUT_PATH = "retty"
let BROWSER

const VIEWPORT = {
  width : 1280,
  height: 1024
}

const xpath = {
  searchResult: {
    restaurantLinks: '//a[contains(@class, "restaurant__block-link")]',
    nextPageLink: '//li[contains(@class, "pager__item--current")]/following-sibling::li[1]/a',
    nextPageItem: '//li[contains(@class, "pager__item--current")]/following-sibling::li[1]'
  },
  restaurantDetail: {
    restaurantInformation: '//*[@id="restaurant-info"]/dl[1]',
  }
}

const selector = {
  searchResult: {
    hitCount: '.search-result__hit-count'
  },
  restaurantDetail: {
    lastPageLink: '#js-search-result > div > section > ul > li:last-child > a',
    pagerCurrent: 'li.pager__item.pager__item--current'
  }
}

;(async() => {
  /**** setup ****/
  const options = process.env.HF
    ? {
      headless: false,
      slowMo: 100
    }
    : {}
  BROWSER = await puppeteer.launch(options)
  let page = await BROWSER.newPage()
  let newPage
  await page.setViewport({
    width : VIEWPORT.width,
    height: VIEWPORT.height
  })
  /**** setup ****/

  let data = []

  const url = "https://retty.me/restaurant-search/search-result/?budget_meal_type=2&max_budget=9&min_budget=6&latlng=35.633923%2C139.715775&free_word_area=%E7%9B%AE%E9%BB%92%E9%A7%85&station_id=1371"
  await page.goto(url, {waitUntil: "domcontentloaded"})
  const lastPageNum = await getTextBySelector(page, (selector.restaurantDetail.lastPageLink))
  const hitCount = await getTextBySelector(page, selector.searchResult.hitCount)
  console.log("総ページ数: " + lastPageNum + ", 総件数: " + hitCount)
  
  let currentPageNumber
  
  while(true) {
    currentPageNumber = await getTextBySelector(page, selector.restaurantDetail.pagerCurrent)
    
    let restaurantsList = await page.$x(xpath.searchResult.restaurantLinks)
    for(let i = 0; i < restaurantsList.length; ++i) {
      console.log(currentPageNumber + "ページ目【" + (i+1) + "件目】")
      await restaurantsList[i].click()
      newPage = await getNewPage(page)
      await newPage.waitForXPath(xpath.restaurantDetail.restaurantInformation)

        /***** retrieve page contents *****/
      const dataArray = await Promise.all([
        20*(currentPageNumber-1) + i + 1,
        getName(newPage, getTableInfoXPath("店名") + '/ruby/span', getTableInfoXPath("店名") + '/ruby/rt'),
        getTextByXPath(newPage, getTableInfoXPath("予約")),
        getTextByXPath(newPage, getTableInfoXPath("住所") + '/div/a'),
        getTextByXPath(newPage, getTableInfoXPath("定休日")),
        getTextByXPath(newPage, getTableInfoXPath("ジャンル") + '/ul/li'),
        getTextByXPath(newPage, getTableInfoXPath("座席")),
        getTextByXPath(newPage, getTableInfoXPath("営業時間")),
        newPage.url()
      ])
      console.log(dataArray[1]) // restaurant name
      /***** retrieve page contents *****/

      data.push({id: dataArray[0], name: dataArray[1], phone: dataArray[2], address: dataArray[3], holiday: dataArray[4], genre: dataArray[5], chairs: dataArray[6], hours: dataArray[7], url: dataArray[8]})
      await newPage.close()
    }
    await csvWrite(data, currentPageNumber)

    const nextPageLinkHandle = await page.$x(xpath.searchResult.nextPageLink)
    let nextPageLink = nextPageLinkHandle[0]
    const nextPageItemHandle = await page.$x(xpath.searchResult.nextPageItem)
    let nextPagerItem = nextPageItemHandle[0]

    if(nextPageLink == null) {
      if(nextPagerItem == null) {
        break
      } else {
        // 最後のページャーの前に...があるとき
        // 例：最後のページが37で、36ページにいるとき→ 35 36 ... 37
        nextPageLink = await page.$(selector.restaurantDetail.lastPageLink)
      }
    }
    await Promise.all([
      page.waitForNavigation({waitUntil: "domcontentloaded"}),
      nextPageLink.click()
    ])
  }

  BROWSER.close()
})()

/**
 * 新しく開いたページを取得
 * @param {page} page もともと開いていたページ
 * @returns {page} 別タブで開いたページ
 */
async function getNewPage(page) {
  const pageTarget = await page.target()
  const newTarget = await BROWSER.waitForTarget(target => target.opener() === pageTarget)
  const newPage = await newTarget.page()
  await newPage.setViewport({
    width : VIEWPORT.width,
    height: VIEWPORT.height
  })
  await newPage.waitForSelector('body')
  return newPage
}

/**
 * 渡したデータをcsvに出力するメソッド。ページ数を渡すことで、ページごとに区別してcsvを出力できる。
 * @param {Object.<string, string>} data csvに書き込まれるデータ。csvのヘッダと対応するkeyと、実際に書き込まれるvalueを持ったobjectになっている。
 * @param {number} pageNumber 現在のページ数
 */
async function csvWrite(data, pageNumber) {
  if (!fs.existsSync(OUTPUT_PATH)) {
    fs.mkdirSync(OUTPUT_PATH)
  }
  var exec = require('child_process').exec
  exec(`touch ${OUTPUT_PATH}/page${pageNumber}.csv`, function(err, stdout, stderr) {
    　　if (err) { console.log(err) }
  })
  const csvfilepath =  `${OUTPUT_PATH}/page${pageNumber}.csv`
  const csvWriter = createObjectCsvWriter({
    path: csvfilepath,
    header: [
      {id: 'id', title: 'No.'},
      {id: 'name', title: '店舗名'},
      {id: 'phone', title: '電話番号'},
      {id: 'address', title: '住所'},
      {id: 'holiday', title: '定休日'},
      {id: 'genre', title: 'ジャンル'},
      {id: 'chairs', title: '座席・設備'},
      {id: 'hours', title: '営業時間'},
      {id: 'url', title: 'URL'}
    ],
    encoding:'utf8',
    append :false,
  })
  csvWriter.writeRecords(data)
  .then(() => {
      console.log('...Done')
  })
}

/**
 * セレクターで指定した要素のテキストを取得できる。
 * @param {page} page 
 * @param {string} paramSelector 
 * @returns {string} 改行と空白を取り除いた要素のテキスト。要素を取得できなかった時は空文字が返る。
 */
async function getTextBySelector(page, paramSelector) {
  const element = await page.$(paramSelector) 
  let text = ""
  if(element) {
    text = await (await element.getProperty('textContent')).jsonValue()
    text = text.replace(/[\s　]/g, "")
  }
  return text
}

/**
 * XPathで指定した要素のテキストを取得できる。
 * @param page 
 * @param {string} xpath 取得したい要素のxpath。
 * @returns {string} 改行と空白を取り除いた要素のテキスト。要素を取得できなかった時は空文字が返る。
 */
async function getTextByXPath(page, xpath) {
  const elements = await page.$x(xpath) 
  let text = ""
  if(elements[0]) {
    text = await (await elements[0].getProperty('textContent')).jsonValue()
    text = text.replace(/[\s　]/g, "")
  }
  return text
}

async function getName(page, nameXpath, rubyXpath) {
  let name = await getTextByXPath(page, nameXpath)
  const nameRuby = await getTextByXPath(page, rubyXpath)
  name += '(' + nameRuby + ')'
  return name
}

function getTableInfoXPath(infoName) {
  return `//dt[contains(text(), "${infoName}")]/following-sibling::dd`
}
