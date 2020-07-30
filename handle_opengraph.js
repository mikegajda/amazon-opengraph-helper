const {promisify} = require('util');
const stringHash = require("string-hash");
let ogs = require('open-graph-scraper');
const potrace = require('potrace');
const SVGO = require('svgo');
const AWS = require('aws-sdk');
const fs = require('fs');
ogs = promisify(ogs).bind(ogs);
let Jimp = require('jimp');
const url = require('url');
const fetch = require('node-fetch');
const HTMLParser = require('node-html-parser');
const parseCurrency = require('parsecurrency');
const got = require('got')

let awsKeyId = process.env.MG_AWS_KEY_ID;
let awsSecretAccessKey = process.env.MG_AWS_SECRET_ACCESS_KEY;
let shotstackApiKey = process.env.SHOTSTACK_API_KEY;

const s3 = new AWS.S3({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey
});

let polly = new AWS.Polly({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: 'us-east-1'
})

async function uploadBufferToAmazon(buffer, filename) {
  // Setting up S3 upload parameters
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename, // File name you want to save as in S3
    Body: buffer,
    ACL: "public-read"
  };

  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.upload(params, function (err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  })
}

async function checkIfFileExistsInS3(filename) {
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename, // File name you want to save as in S3
  };
  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.headObject(params, function (err, data) {
      if (err) {
        resolve(false)
      } else {
        resolve(true)
      }
    });
  })
}

async function getFileInS3(filename) {
  const params = {
    Bucket: "cdn.mikegajda.com",
    Key: filename
  };
  return new Promise((resolve, reject) => {
    s3.getObject(params, function (err, data) {
      if (err) {
        reject(err)
      }

      resolve(data.Body.toString());
    });
  })

}

async function getOpenGraphInfo(url, useRobotUserAgent = false) {
  return new Promise((resolve, reject) => {
    let options = {
      url: url
    }
    if (useRobotUserAgent) {
      options['headers'] = {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    }
    ogs(options, function (error, results, response) {
      resolve({
        results: results,
        response: response
      })
    });
  })
}

async function processOgData(ogData, urlHashKey, backgroundColor,
    includeReaction,
    reaction) {
  let awsResponse

  if (ogData.ogImage && ogData.ogImage.url) {
    let ogImage = await Jimp.read(ogData.ogImage.url)
    if (ogImage.getWidth() > 1080) {
      ogImage = ogImage.resize(1080, Jimp.AUTO);
    }
    ogImage = ogImage.quality(85)

    let imageBufferPromise = ogImage.getBufferAsync("image/jpeg");

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

    let [imageBuffer, igFeedBuffer, igStoryBuffer, igStoryWithoutTextBuffer, pollyBuffer] = await Promise.all(
        [imageBufferPromise])
    // igFeedBufferPromise, igStoryBufferPromise, igStoryBufferWithoutTextPromise, pollyBufferPromise])
    console.log("got image buffers")

    let imageBufferAwsPromise = uploadBufferToAmazon(imageBuffer,
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

    let [response1, response2, response3, response4, response5, response6] = await Promise.all(
        [imageBufferAwsPromise])
    console.log("awsResponse=", response1.Location);

    ogData["processedImageHash"] = `${urlHashKey}.jpg`
  }

  awsResponse = await uploadBufferToAmazon(JSON.stringify(ogData),
      urlHashKey + ".json");
  console.log("awsResponse=", awsResponse.Location);
  return ogData;
}

async function getPriceForUrl(urlToParse) {
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);

  const response = await got(cleanedUrl);
  let [successInGettingPrice, price] = getPrice(HTMLParser.parse(response.body))
  return {
    "successInGettingPrice": successInGettingPrice,
    "price": successInGettingPrice ? price : undefined,
    "parsedPrice": successInGettingPrice ? parseCurrency(price) : undefined
  }

}

async function getAmazonCategoryToEpaCategoryMap() {
  let gSheetUrl = 'https://spreadsheets.google.com/feeds/cells/1cf76iwzx03XqE_jqq8XGlPv710RGqnSLGG-updJhy1I/1/public/full?alt=json'
  let response = await got(gSheetUrl)
  let gsheetAsJson = JSON.parse(response.body)

  let result = {}
  for (let i = 0; i < gsheetAsJson['feed']['entry'].length; i += 2) {
    if (i % 2 === 0) {
      result[gsheetAsJson['feed']['entry'][i]['gs$cell'].inputValue] = gsheetAsJson['feed']['entry'][i
      + 1]['gs$cell'].inputValue
    }
  }
  return result
}

async function getEpaCategoryToCarbonFootprintMap() {
  let gSheetUrl = 'https://spreadsheets.google.com/feeds/cells/1BP586OIxOyhIH0gJYRZVE46d9Q9IIdvMy0lLXY_bAe0/5/public/full?alt=json'
  let response = await got(gSheetUrl)
  let gsheetAsJson = JSON.parse(response.body)

  let result = {}
  for (let i = 0; i < gsheetAsJson['feed']['entry'].length; i += 2) {
    if (i % 2 === 0) {
      result[gsheetAsJson['feed']['entry'][i]['gs$cell'].inputValue] = gsheetAsJson['feed']['entry'][i
      + 1]['gs$cell'].inputValue
    }
  }
  return result
}

async function getCarbonFootprintInGrams(parsedPrice, amazonCategory) {
  let amazonCategoryToEPACategoryMap = await getAmazonCategoryToEpaCategoryMap();
  // epa category -> kg co2 e / $
  let epaCategoryToCarbonFootprintMap = await getEpaCategoryToCarbonFootprintMap();
  let priceInDollarsToday = parsedPrice.value
  console.log('priceInDollarsToday=', priceInDollarsToday)
  // inflation 2013 -> 2020 = 10.7%
  let priceInDollars2013 = priceInDollarsToday * 0.893
  console.log('priceInDollars2013=', priceInDollars2013)
  if (amazonCategory in amazonCategoryToEPACategoryMap){
    let epaCategory = amazonCategoryToEPACategoryMap[amazonCategory]
    console.log('epaCategory=', epaCategory)

    let epaCategoryCarbonFootprint = epaCategoryToCarbonFootprintMap[epaCategory]
    console.log('epaCategoryFootrpint=', epaCategoryCarbonFootprint)

    let result = priceInDollars2013 * epaCategoryCarbonFootprint * 1000
    console.log('result=', result)
  }
  else {
    //
    let defaultCarbonFootprint = 0.10
    return priceInDollars2013 * defaultCarbonFootprint * 1000
  }
}

function getPrice(root) {
  try {
    if (root.querySelector('#priceblock_dealprice')) {
      let price = root.querySelector(
          '#priceblock_dealprice').childNodes[0].rawText
      return [true, price]
    } else if (root.querySelector('#priceblock_ourprice')) {
      let price = root.querySelector(
          '#priceblock_ourprice').childNodes[0].rawText
      return [true, price]
    } else if (root.querySelector('#priceblock_saleprice')) {
      let price = root.querySelector(
          '#priceblock_saleprice').childNodes[0].rawText
      return [true, price]
    } else if (root.querySelector('.offer-price')) {
      let price = root.querySelector('.offer-price').childNodes[0].rawText
      return [true, price]
    } else {
      return [false, 'NO_PRICE_FOUND']
    }
  } catch {
    return [false, 'NO_PRICE_FOUND']
  }
}

async function fetchOgMetadataAndImagesAndUploadToAWS(url, urlHashKey,
    writeHtmlToTestFolder = true) {

  let ogInfo = await getOpenGraphInfo(url, false);
  let ogInfoRobot = await getOpenGraphInfo(url, true);

  if (writeHtmlToTestFolder) {
    fs.writeFileSync(`test/pages/${urlHashKey}.html`,
        ogInfoRobot['response'].body.toString());
  }

  // console.log("ogInfo['results']=", ogInfo['results'])
  // console.log("ogInfo['response']=", ogInfo['response']['childNodes'][1])
  // if there is no url in the metadata, use the one that was requested from
  if (ogInfo['results']['data']['ogUrl'] === undefined) {
    ogInfo['results']['data']['ogUrl'] = url
  }
  ogInfo['results']['data']['ogImage'] = ogInfoRobot['results']['data']['ogImage']
  ogInfo['results']['data']['urlHashKey'] = urlHashKey

  let [successInGettingPrice, price] = getPrice(
      HTMLParser.parse(ogInfoRobot['response'].body.toString()))
  ogInfo['results']['data']['pricingInfo'] = {
    successInGettingPrice: successInGettingPrice,
    parsedPrice: successInGettingPrice ? parseCurrency(price) : undefined,
    price: successInGettingPrice ? price : undefined
  }
  console.log("price=", price)
  if (writeHtmlToTestFolder) {
    fs.writeFileSync(`test/og_info/${urlHashKey}.json`,
        JSON.stringify(ogInfo['results']['data']));
  }

  // console.log("ogInfo=", JSON.stringify(ogInfo))

  if (ogInfo['results']["success"]) {
    ogInfo['results']["data"]["success"] = true
    return await processOgData(ogInfo['results']["data"], urlHashKey)
  } else {
    return {
      success: false,
      ogUrl: url
    }
  }
}

function cleanUrl(urlToClean) {
  let parsedUrl = url.parse(urlToClean);
  let cleanUrl = parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname
  console.log("cleanUrl=", cleanUrl);
  return cleanUrl
}

async function processUrl(urlToParse, breakCache, backgroundColor = '01bc84',
    includeReaction = true, reaction = '') {
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);

  let existsInS3 = await checkIfFileExistsInS3(`${urlHashKey}.json`)
  if (existsInS3 && !breakCache) {
    try {
      console.log("found in S3, will return early")
      let stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
      return JSON.parse(stringifiedJson)
    } catch (e) {
      console.error("Error while fetching file, will instead do a new fetch")
      return await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl,
          urlHashKey)
    }
  } else {
    let response = await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl,
        urlHashKey)
    return response
  }
}

function extractHostname(url) {
  var hostname;
  //find & remove protocol (http, ftp, etc.) and get hostname

  if (url.indexOf("//") > -1) {
    hostname = url.split('/')[2];
  } else {
    hostname = url.split('/')[0];
  }

  //find & remove port number
  hostname = hostname.split(':')[0];
  //find & remove "?"
  hostname = hostname.split('?')[0];

  // remove www. if it exists
  if (hostname.indexOf("www.") > -1) {
    hostname = hostname.split('www.')[1];
  }

  return hostname;
}

function fixTitle(title) {
  title = title.replace(/’/g, "'")
  title = title.replace(/‘/g, "'")
  title = title.replace(/"/g, "'")
  title = title.replace(/“/g, "'")
  title = title.replace(/”/g, "'")
  title = title.replace(" — ", "-")
  title = title.replace(" — ", "-")
  return title
}

async function processIgStoryImageToBuffer(ogData, ogImage, backgroundColor,
    includeReaction, reactionImage, printText = true) {
  ogImage = ogImage.cover(1080, 680);
  // let imageBuffer = await ogImage.getBufferAsync("image/jpeg");

  let background = await new Jimp(1080, 1920, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, 630);

  if (includeReaction) {
    outputImage = outputImage.composite(reactionImage, 67, 1300)
  }

  if (printText) {
    // generated with https://ttf2fnt.com/
    let titleFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-60/GothicA1-SemiBold.ttf.fnt`);
    let urlFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);

    let url = extractHostname(ogData.ogUrl)
    let title = fixTitle(ogData.ogTitle)

    let maxWidth = 910
    let titleHeight = Jimp.measureTextHeight(titleFont, title, maxWidth);
    let lineHeight = 75
    let lines = titleHeight / lineHeight

    let titleMaxY = 585
    let titleY = titleMaxY - titleHeight
    console.log("igStory titleHeight", titleHeight)
    console.log("igStory lineCount", lines)
    outputImage = await outputImage.print(urlFont, 80, 580, url, maxWidth);
    outputImage = await outputImage.print(titleFont, 80, titleY, title,
        maxWidth);
  }

  return await outputImage.getBufferAsync("image/jpeg");

}

async function processIgFeedImageToBuffer(ogData, ogImage, backgroundColor,
    includeReaction, reactionImage) {
  // generated with https://ttf2fnt.com/
  let titleFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-50/GothicA1-SemiBold.ttf.fnt`);
  let urlFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);

  let url = extractHostname(ogData.ogUrl)
  let title = fixTitle(ogData.ogTitle)

  let titleHeight = Jimp.measureTextHeight(titleFont, title, 1020);
  let lineHeight = 63;
  let linesCount = titleHeight / lineHeight;

  console.log("titleHeight=", titleHeight)
  console.log("linesCount=", linesCount)

  // this is the maximum size of the image, calculated manually
  let maxImageHeight = 819;
  // image should be larger if we don't have a reaction
  if (!includeReaction) {
    maxImageHeight += 135
  }
  let imageHeight = maxImageHeight - (linesCount * lineHeight)
  // this is the minimum y axis value, based on the number of lines, this should go up
  // calculated this manually
  let minImageYAxis = 82;
  let imageYAxis = minImageYAxis + (linesCount * lineHeight)

  // now generate everything
  ogImage = ogImage.cover(1080, imageHeight);

  let background = await new Jimp(1080, 1080, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, imageYAxis);

  if (includeReaction) {
    outputImage = outputImage.composite(reactionImage, 130, 887)
  }

  outputImage = await outputImage.print(titleFont, 30, 30, title, 1020);
  // here, the y value is just slightly less than 30 + titleHeight on purpose, so that
  // the url looks more attached to the title
  outputImage = await outputImage.print(urlFont, 30, 22 + titleHeight, url,
      1020);

  return await outputImage.getBufferAsync("image/jpeg");

}

module.exports.processUrl = processUrl
module.exports.getPriceForUrl = getPriceForUrl
module.exports.getPrice = getPrice
module.exports.getAmazonCategoryToEpaCategoryMap = getAmazonCategoryToEpaCategoryMap
module.exports.getEpaCategoryToCarbonFootprintMap = getEpaCategoryToCarbonFootprintMap
module.exports.getCarbonFootprintInGrams = getCarbonFootprintInGrams
// module.exports.createShotStack = createShotStack
// module.exports.getShotStack = getShotStack
// module.exports.processReaction = processReaction
// module.exports.getRelatedHashTags = getRelatedHashTags
