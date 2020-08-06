import got from "got";
import {cleanUrl} from "./utils";
import stringHash from "string-hash";
import parse from "node-html-parser";
import parseCurrency from "parsecurrency";
import HTMLElement from "node-html-parser/dist/nodes/html";
import {ICustomParsedCurrency} from "./models/ICustomParsedCurrency";

export async function getAmazonCategoryToEpaCategoryMap() {
  const gSheetUrl = 'https://spreadsheets.google.com/feeds/cells/1cf76iwzx03XqE_jqq8XGlPv710RGqnSLGG-updJhy1I/1/public/full?alt=json'
  const response = await got(gSheetUrl)
  const gsheetAsJson = JSON.parse(response.body)

  const result: any = {}
  for (let i = 0; i < gsheetAsJson.feed.entry.length; i += 2) {
    if (i % 2 === 0) {
      result[gsheetAsJson.feed.entry[i].gs$cell.inputValue] = gsheetAsJson.feed.entry[i
      + 1].gs$cell.inputValue
    }
  }
  return result
}

export async function getEpaCategoryToCarbonFootprintMap() {
  const gSheetUrl = 'https://spreadsheets.google.com/feeds/cells/1BP586OIxOyhIH0gJYRZVE46d9Q9IIdvMy0lLXY_bAe0/5/public/full?alt=json'
  const response = await got(gSheetUrl)
  const gsheetAsJson = JSON.parse(response.body)

  const result: any = {}
  for (let i = 0; i < gsheetAsJson.feed.entry.length; i += 2) {
    if (i % 2 === 0) {
      result[gsheetAsJson.feed.entry[i].gs$cell.inputValue] = gsheetAsJson.feed.entry[i
      + 1].gs$cell.inputValue
    }
  }
  return result
}

export async function getCarbonFootprintInGrams(parsedPrice: ICustomParsedCurrency, amazonCategory: string) {
  const amazonCategoryToEPACategoryMap: any = await getAmazonCategoryToEpaCategoryMap();
  // epa category -> kg co2 e / $
  const epaCategoryToCarbonFootprintMap: any = await getEpaCategoryToCarbonFootprintMap();
  const priceInDollarsToday = parsedPrice.value
  console.log('priceInDollarsToday=', priceInDollarsToday)
  // inflation 2013 -> 2020 = 10.7%
  const priceInDollars2013 = priceInDollarsToday * 0.893
  console.log('priceInDollars2013=', priceInDollars2013)
  if (amazonCategory in amazonCategoryToEPACategoryMap) {
    const epaCategory = amazonCategoryToEPACategoryMap[amazonCategory]
    console.log('epaCategory=', epaCategory)

    const epaCategoryCarbonFootprint = epaCategoryToCarbonFootprintMap[epaCategory]
    console.log('epaCategoryFootprint=', epaCategoryCarbonFootprint)

    const result = priceInDollars2013 * epaCategoryCarbonFootprint
    console.log('result=', result)
  } else {
    // https://sustainability.aboutamazon.com/environment/sustainable-operations/carbon-footprint
    // the minimum co2e footprint per $1 is 122.8 in 2020 dollars
    const defaultCarbonFootprint = 122.8
    return priceInDollarsToday * defaultCarbonFootprint
  }
}

export async function getPriceForUrl(urlToParse: string) {
  const cleanedUrl = cleanUrl(urlToParse)
  const urlHashKey = stringHash(cleanedUrl);

  const response = await got(cleanedUrl);
  const [successInGettingPrice, price] = getPrice(parse(response.body))
  return {
    "successInGettingPrice": successInGettingPrice,
    "price": successInGettingPrice ? price : undefined,
    "parsedPrice": successInGettingPrice ? parseCurrency(price) : undefined
  }

}

export function getPrice(root: HTMLElement): [boolean, string] {
  try {
    if (root.querySelector('#priceblock_dealprice')) {
      const price = root.querySelector(
          '#priceblock_dealprice').childNodes[0].rawText
      return [true, price]
    } else if (root.querySelector('#priceblock_ourprice')) {
      const price = root.querySelector(
          '#priceblock_ourprice').childNodes[0].rawText
      return [true, price]
    } else if (root.querySelector('#priceblock_saleprice')) {
      const price = root.querySelector(
          '#priceblock_saleprice').childNodes[0].rawText
      return [true, price]
    } else if (root.querySelector('.offer-price')) {
      const price = root.querySelector('.offer-price').childNodes[0].rawText
      return [true, price]
    } else {
      return [false, 'NO_PRICE_FOUND']
    }
  } catch {
    return [false, 'NO_PRICE_FOUND']
  }
}