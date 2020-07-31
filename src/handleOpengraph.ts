import ogs from 'open-graph-scraper'
import fs from 'fs'
import Jimp from 'jimp'
import parse from 'node-html-parser'
import parseCurrency from 'parsecurrency'
import {getProductCategory} from "./productInfo";
import {uploadBufferToAmazon} from "./aws";
import {extractHostname, fixTitle} from "./utils";
import {getPrice} from "./carbonCalculator";


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
