import stringHash from 'string-hash'
import ogs from 'open-graph-scraper'
import AWS, {AWSError} from 'aws-sdk'
import fs from 'fs'
import Jimp from 'jimp'
import url from 'url'
import parse from 'node-html-parser'
import parseCurrency from 'parsecurrency'
import got from 'got'
import HTMLElement from "node-html-parser/dist/nodes/html";

const awsKeyId = process.env.MG_AWS_KEY_ID;
const awsSecretAccessKey = process.env.MG_AWS_SECRET_ACCESS_KEY;
const shotstackApiKey = process.env.SHOTSTACK_API_KEY;

const s3 = new AWS.S3({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey
});

const polly = new AWS.Polly({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: 'us-east-1'
})

export async function uploadBufferToAmazon(buffer: Buffer | string, filename: string) {
  // Setting up S3 upload parameters
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename, // File name you want to save as in S3
    Body: buffer,
    ACL: "public-read"
  };

  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.upload(params, (err: Error, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  })
}

export async function checkIfFileExistsInS3(filename: string) {
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename, // File name you want to save as in S3
  };
  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.headObject(params,  (err: AWSError, data) => {
      if (err) {
        resolve(false)
      } else {
        resolve(true)
      }
    });
  })
}

export function getProductCategory(ogTitle: string) {
  let ogTitleSplit = ogTitle.split(" : ")
  try {
    if (ogTitleSplit.length >= 2) {
      return ogTitleSplit[2].trim();
    } else {
      ogTitleSplit = ogTitle.split(":")
      if (ogTitleSplit.length >= 2) {
        return ogTitleSplit[2].trim();
      }
      return "UNKNOWN";
    }
  } catch {
    return "UNKOWN"
  }

}

export async function getFileInS3(filename: string): Promise<string> {
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename
  };
  return new Promise((resolve, reject) => {
    s3.getObject(params, (err, data) => {
      if (err) {
        reject(err)
      }

      resolve(data.Body.toString());
    });
  })

}

export async function getOpenGraphInfo(urlToProcess: string, useRobotUserAgent = false) {
  return new Promise((resolve, reject) => {
    const options: any = {
      url: urlToProcess
    }
    if (useRobotUserAgent) {
      options.headers = {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    }
    ogs(options,  (error, results, response) => {
      resolve({
        results,
        response
      })
    });
  })
}

export async function processOgData(ogData: any, urlHashKey: string) {
  let awsResponse: any

  if (ogData.ogImage && ogData.ogImage.url) {
    let ogImage = await Jimp.read(ogData.ogImage.url)
    if (ogImage.getWidth() > 1080) {
      ogImage = ogImage.resize(1080, Jimp.AUTO);
    }
    ogImage = ogImage.quality(85)

    const imageBufferPromise = ogImage.getBufferAsync("image/jpeg");

    // let pollyBufferPromise = getPollySpeechBufferForText(ogData.ogTitle);
    // let igFeedBufferPromise = processIgFeedImageToBuffer(ogData, ogImage,
    //     backgroundColor, includeReaction, reactionImage);
    // //
    // // let igFeedWhiteTextBufferPromise = processIgFeedImageToBuffer(ogData, ogImage,
    // //     backgroundColor, '-white');
    //
    // let igStoryBufferPromise = processIgStoryImageToBuffer(ogData, ogImage,
    //     backgroundColor,  includeReaction, reactionImage, true);
    //
    // let igStoryBufferWithoutTextPromise = processIgStoryImageToBuffer(ogData,
    //     ogImage,
    //     backgroundColor, false, reactionImage, true);

    const [imageBuffer, igFeedBuffer, igStoryBuffer, igStoryWithoutTextBuffer, pollyBuffer] = await Promise.all(
        [imageBufferPromise])
    // igFeedBufferPromise, igStoryBufferPromise, igStoryBufferWithoutTextPromise, pollyBufferPromise])
    console.log("got image buffers")

    const imageBufferAwsPromise: any = uploadBufferToAmazon(imageBuffer,
        `${urlHashKey}.jpg`);

    // let igStoryBufferBufferAwsPromise = uploadBufferToAmazon(igStoryBuffer,
    //     `${urlHashKey}_ig_story.jpg`)
    //
    // let igStoryBufferWithoutTextAwsPromise = uploadBufferToAmazon(
    //     igStoryWithoutTextBuffer,
    //     `${urlHashKey}_ig_story_without_text.jpg`)
    //
    // let igFeedBufferBufferAwsPromise = uploadBufferToAmazon(igFeedBuffer,
    //     `${urlHashKey}_ig_feed.jpg`);

    // let igFeedWhiteTextBufferBufferAwsPromise = uploadBufferToAmazon(igFeedWhiteTextBuffer,
    //     `${urlHashKey}_ig_feed_white_text.jpg`);
    //
    // let pollyBufferAwsPromise = uploadBufferToAmazon(pollyBuffer,
    //     `${urlHashKey}.mp3`);

    const [response1, response2, response3, response4, response5, response6] = await Promise.all(
        [imageBufferAwsPromise])
    console.log("awsResponse=", response1.Location);

    ogData.processedImageHash = `${urlHashKey}.jpg`
  }

  awsResponse = await uploadBufferToAmazon(JSON.stringify(ogData),
      urlHashKey + ".json");
  console.log("awsResponse=", awsResponse.Location);
  return ogData;
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

export async function getCarbonFootprintInGrams(parsedPrice: any, amazonCategory: string) {
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
    console.log('epaCategoryFootrpint=', epaCategoryCarbonFootprint)

    const result = priceInDollars2013 * epaCategoryCarbonFootprint * 1000
    console.log('result=', result)
  } else {
    //
    const defaultCarbonFootprint = 0.10
    return priceInDollars2013 * defaultCarbonFootprint * 1000
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

export async function fetchOgMetadataAndImagesAndUploadToAWS(urlToProcess: string, urlHashKey: string,
                                                      writeHtmlToTestFolder = true) {

  const ogInfo: any = await getOpenGraphInfo(urlToProcess, false);
  const ogInfoRobot: any = await getOpenGraphInfo(urlToProcess, true);

  if (writeHtmlToTestFolder) {
    fs.writeFileSync(`test/pages/${urlHashKey}.html`,
        ogInfoRobot.response.body.toString());
  }

  // console.log("ogInfo['results']=", ogInfo['results'])
  // console.log("ogInfo['response']=", ogInfo['response']['childNodes'][1])
  // if there is no urlToProcess in the metadata, use the one that was requested from
  if (ogInfo.results.data.ogUrl === undefined) {
    ogInfo.results.data.ogUrl = urlToProcess
  }
  ogInfo.results.data.ogImage = ogInfoRobot.results.data.ogImage
  ogInfo.results.data.urlHashKey = urlHashKey
  ogInfo.results.data.productCategory = getProductCategory(ogInfo.results.data.ogTitle)

  const [successInGettingPrice, price] = getPrice(
      parse(ogInfoRobot.response.body.toString()))
  ogInfo.results.data.pricingInfo = {
    successInGettingPrice,
    parsedPrice: successInGettingPrice ? parseCurrency(price) : undefined,
    price: successInGettingPrice ? price : undefined
  }
  console.log("price=", price)
  if (writeHtmlToTestFolder) {
    fs.writeFileSync(`test/og_info/${urlHashKey}.json`,
        JSON.stringify(ogInfo.results.data));
  }

  // console.log("ogInfo=", JSON.stringify(ogInfo))

  if (ogInfo.results.success) {
    ogInfo.results.data.success = true
    return await processOgData(ogInfo.results.data, urlHashKey)
  } else {
    return {
      success: false,
      ogUrl: urlToProcess
    }
  }
}

export function cleanUrl(urlToClean: string) {
  const parsedUrl = url.parse(urlToClean);
  const cleanedUrl = parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname
  console.log("cleanedUrl=", cleanedUrl);
  return cleanedUrl
}

export async function processUrl(urlToParse: string, breakCache: boolean, writeFiles: boolean) {
  const cleanedUrl = cleanUrl(urlToParse).toString()
  const urlHashKey = stringHash(cleanedUrl).toString()

  const existsInS3 = await checkIfFileExistsInS3(`${urlHashKey}.json`)
  if (existsInS3 && !breakCache) {
    try {
      console.log("found in S3, will return early")
      const stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
      return JSON.parse(stringifiedJson)
    } catch (e) {
      console.error("Error while fetching file, will instead do a new fetch")
      return await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl,
          urlHashKey, writeFiles)
    }
  } else {
    const response = await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl,
        urlHashKey, writeFiles)
    return response
  }
}

export function extractHostname(urlToProcess: string) {
  let hostname;
  // find & remove protocol (http, ftp, etc.) and get hostname

  if (urlToProcess.indexOf("//") > -1) {
    hostname = urlToProcess.split('/')[2];
  } else {
    hostname = urlToProcess.split('/')[0];
  }

  // find & remove port number
  hostname = hostname.split(':')[0];
  // find & remove "?"
  hostname = hostname.split('?')[0];

  // remove www. if it exists
  if (hostname.indexOf("www.") > -1) {
    hostname = hostname.split('www.')[1];
  }

  return hostname;
}

function fixTitle(title: string) {
  title = title.replace(/’/g, "'")
  title = title.replace(/‘/g, "'")
  title = title.replace(/"/g, "'")
  title = title.replace(/“/g, "'")
  title = title.replace(/”/g, "'")
  title = title.replace(" — ", "-")
  title = title.replace(" — ", "-")
  return title
}

export async function processIgStoryImageToBuffer(ogData: any, ogImage: any, backgroundColor: string,
                                                  includeReaction: boolean, reactionImage: any, printText = true) {
  ogImage = ogImage.cover(1080, 680);
  // let imageBuffer = await ogImage.getBufferAsync("image/jpeg");

  const background = await new Jimp(1080, 1920, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, 630);

  if (includeReaction) {
    outputImage = outputImage.composite(reactionImage, 67, 1300)
  }

  if (printText) {
    // generated with https://ttf2fnt.com/
    const titleFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-60/GothicA1-SemiBold.ttf.fnt`);
    const urlFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);

    const extractedUrl = extractHostname(ogData.ogUrl)
    const title = fixTitle(ogData.ogTitle)

    const maxWidth = 910
    const titleHeight = Jimp.measureTextHeight(titleFont, title, maxWidth);
    const lineHeight = 75
    const lines = titleHeight / lineHeight

    const titleMaxY = 585
    const titleY = titleMaxY - titleHeight
    console.log("igStory titleHeight", titleHeight)
    console.log("igStory lineCount", lines)
    outputImage = await outputImage.print(urlFont, 80, 580, extractedUrl, maxWidth);
    outputImage = await outputImage.print(titleFont, 80, titleY, title,
        maxWidth);
  }

  return await outputImage.getBufferAsync("image/jpeg");

}

export async function processIgFeedImageToBuffer(ogData: any, ogImage: any, backgroundColor: string,
                                                 includeReaction: boolean, reactionImage: any) {
  // generated with https://ttf2fnt.com/
  const titleFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-50/GothicA1-SemiBold.ttf.fnt`);
  const urlFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);

  const extractedUrl = extractHostname(ogData.ogUrl)
  const title = fixTitle(ogData.ogTitle)

  const titleHeight = Jimp.measureTextHeight(titleFont, title, 1020);
  const lineHeight = 63;
  const linesCount = titleHeight / lineHeight;

  console.log("titleHeight=", titleHeight)
  console.log("linesCount=", linesCount)

  // this is the maximum size of the image, calculated manually
  let maxImageHeight = 819;
  // image should be larger if we don't have a reaction
  if (!includeReaction) {
    maxImageHeight += 135
  }
  const imageHeight = maxImageHeight - (linesCount * lineHeight)
  // this is the minimum y axis value, based on the number of lines, this should go up
  // calculated this manually
  const minImageYAxis = 82;
  const imageYAxis = minImageYAxis + (linesCount * lineHeight)

  // now generate everything
  ogImage = ogImage.cover(1080, imageHeight);

  const background = await new Jimp(1080, 1080, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, imageYAxis);

  if (includeReaction) {
    outputImage = outputImage.composite(reactionImage, 130, 887)
  }

  outputImage = await outputImage.print(titleFont, 30, 30, title, 1020);
  // here, the y value is just slightly less than 30 + titleHeight on purpose, so that
  // the extractedUrl looks more attached to the title
  outputImage = await outputImage.print(urlFont, 30, 22 + titleHeight, extractedUrl,
      1020);

  return await outputImage.getBufferAsync("image/jpeg");

}
