// @ts-ignore
import ogs from 'open-graph-scraper'
import fs from 'fs'
import Jimp from 'jimp'
import parse from 'node-html-parser'
import parseCurrency from 'parsecurrency'
import {getProductCategory} from "./productInfo";
import {uploadBufferToAmazon} from "./aws";
import {
  extractHostname,
  fixTitle,
  getUrlHashKey,
  instanceOfCustomSuccessResult,
} from "./utils";
import {getCarbonFootprintInGrams, getPrice} from "./carbonCalculator";
import {CustomSuccessResult, IOpenGraphInfo} from "./models/IOpenGraphInfo";
import {PassThrough} from "stream";
import {ICustomParsedCurrency} from "./models/ICustomParsedCurrency";
import {convertGramsToHumanReadable} from "./convertUnits";


export async function getOpenGraphInfo(urlToProcess: string,
                                       useRobotUserAgent = false): Promise<IOpenGraphInfo> {
  const [cleanedUrl, urlHashKey] = getUrlHashKey(urlToProcess);
  return new Promise((resolve, reject) => {
    const options: any = {
      url: urlToProcess
    }
    const userAgents = [
      // 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      // 'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'facebookexternalhit/1.1'
      // 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0;
      // +http://www.bing.com/bingbot.htm) Chrome/W.X.Y.Z Safari/537.36 Edg/W.X.Y.Z'
      //  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/600.2.5 (KHTML, like Gecko) Version/8.0.2
      // Safari/600.2.5 (Applebot/0.1)'
      // 'Mozilla/5.0 (Linux; Android 4.2.1; en-us; Nexus 5 Build/JOP40D) AppleWebKit/535.19 (KHTML, like Gecko;
      // googleweblight) Chrome/38.0.1025.166 Mobile Safari/535.19'
    ]
    const randomIndex = Math.floor(Math.random() * userAgents.length)
    if (useRobotUserAgent) {
      options.headers = {
        'user-agent': userAgents[randomIndex]
      }
    }
    ogs(options, (error: boolean, results: any, response: PassThrough) => {
      if (!error) {
        const customResult: CustomSuccessResult = {
          error: false,
          ogResult: results.data,
          productInfo: {
            productCategory: getProductCategory(results.data.ogTitle)
          },
          co2eFootprint: {
            metric: {
              value: undefined,
              unit: 'g'
            },
            humanReadable: {
              value: undefined
            }
          },
          response,
          urlHashKey,
        }
        if (customResult.ogResult.ogUrl === undefined) {
          customResult.ogResult.ogUrl = cleanedUrl;
        }
        resolve(customResult)
      } else {
        console.error("things have gone wrong")
        console.error(results);
        resolve(results)
      }
    });
  })
}

export async function processOgData(ogData: IOpenGraphInfo, urlHashKey: string) {
  let awsResponse: any

  if (ogData.ogResult.ogImage && ogData.ogResult.ogImage.url) {
    let ogImage = await Jimp.read(ogData.ogResult.ogImage.url)
    if (ogImage.getWidth() > 1080) {
      ogImage = ogImage.resize(1080, Jimp.AUTO);
    }
    ogImage = ogImage.quality(85)

    const imageBufferPromise = ogImage.getBufferAsync("image/jpeg");

    // let pollyBufferPromise = getPollySpeechBufferForText(ogData.ogTitle);
    const igFeedBufferPromise = processIgFeedImageToBuffer(ogData, ogImage);
    // //
    // let igFeedWhiteTextBufferPromise = processIgFeedImageToBuffer(ogData, ogImage);
    //
    // let igStoryBufferPromise = processIgStoryImageToBuffer(ogData, ogImage,
    //     backgroundColor,  includeReaction, reactionImage, true);
    //
    // let igStoryBufferWithoutTextPromise = processIgStoryImageToBuffer(ogData,
    //     ogImage,
    //     backgroundColor, false, reactionImage, true);

    const [
      imageBuffer, igFeedBuffer,
      // igStoryBuffer, igStoryWithoutTextBuffer, pollyBuffer
    ] = await Promise.all(
        [imageBufferPromise, igFeedBufferPromise])
    // igFeedBufferPromise, igStoryBufferPromise, igStoryBufferWithoutTextPromise, pollyBufferPromise])
    console.log(`[${new Date().toUTCString()}]`, "got image buffers")

    const imageBufferAwsPromise: any = uploadBufferToAmazon(imageBuffer,
                                                            `${urlHashKey}.jpg`);

    // let igStoryBufferBufferAwsPromise = uploadBufferToAmazon(igStoryBuffer,
    //     `${urlHashKey}_ig_story.jpg`)
    //
    // let igStoryBufferWithoutTextAwsPromise = uploadBufferToAmazon(
    //     igStoryWithoutTextBuffer,
    //     `${urlHashKey}_ig_story_without_text.jpg`)
    //
    const igFeedBufferBufferAwsPromise: any = uploadBufferToAmazon(igFeedBuffer,
                                                                   `${urlHashKey}_ig_feed.jpg`);

    // let igFeedWhiteTextBufferBufferAwsPromise = uploadBufferToAmazon(igFeedWhiteTextBuffer,
    //     `${urlHashKey}_ig_feed_white_text.jpg`);
    //
    // let pollyBufferAwsPromise = uploadBufferToAmazon(pollyBuffer,
    //     `${urlHashKey}.mp3`);

    const [
      response1, response2,
      // response3, response4, response5, response6
    ] = await Promise.all(
        [imageBufferAwsPromise, igFeedBufferBufferAwsPromise])
    console.log(`[${new Date().toUTCString()}]`, "awsResponse=", response1.Location);
    console.log(`[${new Date().toUTCString()}]`, "awsResponse=", response2.Location);

    // ogData.processedImageHash = `${urlHashKey}.jpg`
  }

  awsResponse = await uploadBufferToAmazon(JSON.stringify(ogData),
                                           urlHashKey + ".json");
  console.log("awsResponse=", awsResponse.Location);
  return ogData;
}

export async function fetchOgMetadataAndImagesAndUploadToAWS(urlToProcess: string, urlHashKey: string,
                                                             writeHtmlToTestFolder = false) {

  const ogInfo: IOpenGraphInfo = await getOpenGraphInfo(urlToProcess, true);
  // const ogInfoRobot: IOpenGraphInfo = await getOpenGraphInfo(urlToProcess, true);

  // console.log("ogInfo=", ogInfo)
  // console.log("ogInfoRobot=", ogInfoRobot)

  if (instanceOfCustomSuccessResult(ogInfo)) {
    if (writeHtmlToTestFolder) {
      fs.writeFileSync(`test/pages/${urlHashKey}.html`,
                       ogInfo.response.body.toString());
    }

    // console.log("ogInfo['results']=", ogInfo['results'])
    // console.log("ogInfo['response']=", ogInfo['response']['childNodes'][1])

    // ogInfo.ogResult.ogImage = ogInfoRobot.ogResult.ogImage
    // ogInfo.productInfo.productCategory = getProductCategory(ogInfo.ogResult.ogTitle)


    const [successInGettingPrice, price] = getPrice(
        parse(ogInfo.response.body.toString()))
    if (successInGettingPrice) {
      ogInfo.productInfo.price = successInGettingPrice ? parseCurrency(price) : undefined
      console.log(`[${new Date().toUTCString()}]`, "price=", ogInfo.productInfo.price)


      const carbonFootprintInGrams = await getCarbonFootprintInGrams(ogInfo.productInfo.price,
                                                                     ogInfo.productInfo.productCategory);
      console.log(`[${new Date().toUTCString()}]`, "carbonFootprint=", carbonFootprintInGrams)

      ogInfo.co2eFootprint.metric.value = carbonFootprintInGrams;
      ogInfo.co2eFootprint.humanReadable.value = convertGramsToHumanReadable(carbonFootprintInGrams);
      console.log(`[${new Date().toUTCString()}]`, "humanReadable=", ogInfo.co2eFootprint.humanReadable.value)
    }

    console.log(`[${new Date().toUTCString()}]`, "price=", price)
    if (writeHtmlToTestFolder) {
      fs.writeFileSync(`test/og_info/${urlHashKey}.json`,
                       JSON.stringify(ogInfo));
    }
    ogInfo.response = undefined;

    await processOgData(ogInfo, urlHashKey)
    return ogInfo;
  } else {
    console.error("something went wrong fetching ogInfo")
    // console.error(ogInfoRobot.error)
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

export async function processIgFeedImageToBuffer(ogData: IOpenGraphInfo, ogImage: any) {
  // generated with https://ttf2fnt.com/

  const [workSans30, ebGaramond100, ebGaramond50, ebGaramond35Italic] = await Promise.all([
                                                                                            Jimp.loadFont(
                                                                                                `https://s3.amazonaws.com/cdn.carboncalculator.org/WorkSans-VariableFont_wght.ttf/WorkSans-VariableFont_wght.ttf.fnt`),
                                                                                            Jimp.loadFont(
                                                                                                `https://s3.amazonaws.com/cdn.carboncalculator.org/EBGaramond-SemiBold-100/EBGaramond-SemiBold.ttf.fnt`),
                                                                                            Jimp.loadFont(
                                                                                                `https://s3.amazonaws.com/cdn.carboncalculator.org/EBGaramond-SemiBold-50/EBGaramond-SemiBold.ttf.fnt`),
                                                                                            Jimp.loadFont(
                                                                                                `https://s3.amazonaws.com/cdn.carboncalculator.org/EBGaramond-Italic-35/EBGaramond-Italic.ttf.fnt`)
                                                                                          ])
  // const extractedUrl = extractHostname(ogData.ogUrl)

  //
  // const titleHeight = Jimp.measureTextHeight(titleFont, title, 1020);
  // const lineHeight = 63;
  // const linesCount = titleHeight / lineHeight;
  //
  // console.log("titleHeight=", titleHeight)
  // console.log("linesCount=", linesCount)

  // // this is the maximum size of the image, calculated manually
  // let maxImageHeight = 819;
  // // image should be larger if we don't have a reaction
  // const imageHeight = maxImageHeight - (linesCount * lineHeight)
  // // this is the minimum y axis value, based on the number of lines, this should go up
  // // calculated this manually
  // const minImageYAxis = 82;
  // const imageYAxis = minImageYAxis + (linesCount * lineHeight)

  // now generate everything
  ogImage = ogImage.crop(166, 0, 268, 288);
  ogImage = ogImage.cover(212, 230)

  let background = await new Jimp(1080, 1080, `#FCDA90`)
  const backgroundSecondary = await new Jimp(1080, 330, `#FCE8CF`)
  const backgroundThird = await new Jimp(1080, 280, `#D8EC84`)

  background = background.composite(backgroundSecondary, 0, 470)
  background = background.composite(backgroundThird, 0, 800)


  let outputImage = background.composite(ogImage, 786, 100);

  const [add, speaker, plant, heart] = await Promise.all([
                                                           Jimp.read(
                                                               'https://s3.amazonaws.com/cdn.carboncalculator.org/icons/add.png'),
                                                           Jimp.read(
                                                               'https://s3.amazonaws.com/cdn.carboncalculator.org/icons/speaker.png'),
                                                           Jimp.read(
                                                               'https://s3.amazonaws.com/cdn.carboncalculator.org/icons/plant.png'),
                                                           Jimp.read(
                                                               'https://s3.amazonaws.com/cdn.carboncalculator.org/icons/heart.png')
                                                         ])


  outputImage = outputImage.composite(add, 842, 284);

  outputImage = outputImage.composite(speaker, 71, 583);

  outputImage = outputImage.composite(plant, 71, 826);

  outputImage = outputImage.composite(heart, 892, 948);


  const purchasingText = 'Thinking of purchasing?'
  outputImage = outputImage.print(workSans30, 83, 154, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: purchasingText
  }, 620)

  let title = ogData.ogResult.ogTitle
  title = fixTitle(title)
  outputImage = outputImage.print(ebGaramond50, 55, 200, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: title
  }, 680)

  const estimateText = 'We estimate creating this released the weight of'
  outputImage = outputImage.print(workSans30, 182, 518, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: estimateText
  }, 862)

  const co2HumanReadable = ogData.co2eFootprint.humanReadable.value
  outputImage = outputImage.print(ebGaramond100, 191, 550, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: co2HumanReadable
  }, 862)
  const estimateText2 = 'worth of carbon into the environment.'
  outputImage = outputImage.print(workSans30, 182, 675, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: estimateText2
  }, 862)

  const grams = ogData.co2eFootprint.metric.value
  const kilograms = grams / 1000;
  const kilogramsText = `${kilograms.toLocaleString(undefined, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  })}`
  const co2disclaimerText = `(That's ${kilogramsText}kg of CO2e)`
  outputImage = outputImage.print(ebGaramond35Italic, 240, 716, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: co2disclaimerText
  }, 746)

  const plantText = 'Consider buying used or reusing what you have instead of buying new.'
  outputImage = outputImage.print(ebGaramond35Italic, 210, 826, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: plantText
  }, 662)

  const supportText = 'Enjoyed this? Give this a like to help support us and tag a friend who should know about this.'
  outputImage = outputImage.print(ebGaramond35Italic, 210, 948, {
    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    text: supportText
  }, 674)
  // outputImage = await outputImage.print(titleFont, 30, 30, title, 1020);
  // // here, the y value is just slightly less than 30 + titleHeight on purpose, so that
  // // the extractedUrl looks more attached to the title
  // outputImage = await outputImage.print(urlFont, 30, 22 + titleHeight, extractedUrl,
  //                                       1020);

  return await outputImage.getBufferAsync("image/jpeg");

}
