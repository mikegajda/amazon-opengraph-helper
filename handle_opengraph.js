const {promisify} = require('util');
const stringHash = require("string-hash");
let ogs = require('open-graph-scraper');
const potrace = require('potrace');
const SVGO = require('svgo');
const AWS = require('aws-sdk');
ogs = promisify(ogs).bind(ogs);
let Jimp = require('jimp');
const url = require('url');
const fetch = require('node-fetch');

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

svgo = new SVGO({
  multipass: true,
  floatPrecision: 0,
  plugins: [
    {
      removeViewBox: false,
    },
    {
      addAttributesToSVGElement: {
        attributes: [
          {
            preserveAspectRatio: `none`,
          },
        ],
      },
    },
  ],
});

async function uploadBufferToAmazon(buffer, filename) {
  // Setting up S3 upload parameters
  const params = {
    Bucket: "cdn.mikegajda.com",
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

async function createSvg(buffer, params) {
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, params, function (err, svg) {
      if (err) {
        reject();
      } else {
        svgo.optimize(svg).then(function (optimizedSvg) {
          resolve(optimizedSvg.data);
        })
      }
    });
  });

}

async function checkIfFileExistsInS3(filename) {
  const params = {
    Bucket: "cdn.mikegajda.com",
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

async function getOpenGraphInfo(url) {
  return new Promise((resolve, reject) => {
    ogs({
      url: url
    }, function (error, results) {
      resolve(results)
    });
  })
}

async function getPollySpeechBufferForText(text){
  return new Promise((resolve, reject) => {
    var params = {
      Engine: "neural",
      LanguageCode: "en-US",
      OutputFormat: "mp3",
      Text: `<speak><amazon:domain name="news">${text}</amazon:domain></speak>`,
      TextType: "ssml",
      VoiceId: "Joanna"
    };

    polly.synthesizeSpeech(params, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else     resolve(data.AudioStream);           // successful response
      /*
      data = {
       AudioStream: <Binary String>,
       ContentType: "audio/mpeg",
       RequestCharacters: 37
      }
      */
    });
  })
}

async function postToShotStack(body){
  // complex POST request with JSON, headers:
  return new Promise((resolve, reject) => {
    fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': `${shotstackApiKey}`
      },
      body: JSON.stringify(body)
    }).then( r => {
      resolve( r.json());
    })
    .catch((error) => {
      reject(error)
    })
  })
}

async function getShotStackResult(id){
  // complex POST request with JSON, headers:
  return new Promise((resolve, reject) => {
    fetch(`https://api.shotstack.io/stage/render/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': `${shotstackApiKey}`
      },
    }).then( r => {
      resolve( r.json());
    })
    .catch((error) => {
      reject(error)
    })
  })
}

async function createShotStack(urlToParse){
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);
  //
  let stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
  let ogData = JSON.parse(stringifiedJson)

  let shotStackPostBody = {
    "timeline": {
      "background": "#01BC84",
      "tracks": [
        {
          "clips": [
            {
              "asset": {
                "type": "audio",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}.mp3`
              },
              "start": 1,
              "length": 9
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_ig_story.jpg`
              },
              "start": 1,
              "length": 9,
              "transition": {
                "in": "reveal"
              }
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_ig_story_without_text.jpg`
              },
              "start": 0,
              "length": 5,
              "transition": {
                "in": "reveal"
              }
            }
          ]
        }
      ],
      "soundtrack": {
        "src": "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/Music_for_Video/Jahzzar/Tumbling_Dishes_Like_Old-Mans_Wishes/Jahzzar_-_09_-_The_Shine.mp3",
        "effect": "fadeInFadeOut",
        "volume": 0.05
      }
    },
    "output": {
      "format": "mp4",
      "resolution": "1080",
      "aspectRatio": "9:16"
    }
  }
  let shotStackResponse = await postToShotStack(shotStackPostBody)
  ogData['shotStackResponse'] = shotStackResponse;
  let updatedOgDataResponse = await uploadBufferToAmazon(JSON.stringify(ogData), `${urlHashKey}.json`)
  console.log("updatedOgDataLocation=", updatedOgDataResponse.Location);
  return shotStackResponse

}

async function getShotStack(urlToParse){
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);
  let stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
  let ogData = JSON.parse(stringifiedJson)

  if (ogData['shotStackResponse'] && ogData['shotStackResponse']['success'] ){
    let shotStackId = ogData['shotStackResponse']['response']['id']
    let shotStackResponse = await getShotStackResult(shotStackId)
    if (shotStackResponse['success']){
      return shotStackResponse['response']['url']
    }
    else {
      return shotStackResponse
    }
  }
}
async function processOgData(ogData, urlHashKey, backgroundColor, fontColorSuffix) {
  let awsResponse

  if (ogData.ogImage && ogData.ogImage.url) {
    let ogImage = await Jimp.read(ogData.ogImage.url)
    if (ogImage.getWidth() > 1400) {
      ogImage = ogImage.resize(1400, Jimp.AUTO);
    }
    ogImage = ogImage.quality(90)

    let imageBufferPromise = ogImage.getBufferAsync("image/jpeg");
    let pollyBufferPromise = getPollySpeechBufferForText(ogData.ogTitle);
    let igFeedBufferPromise = processIgFeedImageToBuffer(ogData, ogImage,
        backgroundColor, fontColorSuffix);
    //
    // let igFeedWhiteTextBufferPromise = processIgFeedImageToBuffer(ogData, ogImage,
    //     backgroundColor, '-white');

    let igStoryBufferPromise = processIgStoryImageToBuffer(ogData, ogImage,
        backgroundColor, fontColorSuffix, true);

    let igStoryBufferWithoutTextPromise = processIgStoryImageToBuffer(ogData, ogImage,
        backgroundColor, fontColorSuffix, false);

    let [imageBuffer, igFeedBuffer, igStoryBuffer, igStoryWithoutTextBuffer, pollyBuffer] = await Promise.all(
        [imageBufferPromise, igFeedBufferPromise, igStoryBufferPromise, igStoryBufferWithoutTextPromise, pollyBufferPromise])
    console.log("got image buffers")

    let imageBufferAwsPromise = uploadBufferToAmazon(imageBuffer,
        `${urlHashKey}.jpg`);

    let igStoryBufferBufferAwsPromise = uploadBufferToAmazon(igStoryBuffer,
        `${urlHashKey}_ig_story.jpg`)

    let igStoryBufferWithoutTextAwsPromise = uploadBufferToAmazon(igStoryWithoutTextBuffer,
        `${urlHashKey}_ig_story_without_text.jpg`)

    let igFeedBufferBufferAwsPromise = uploadBufferToAmazon(igFeedBuffer,
        `${urlHashKey}_ig_feed.jpg`);

    // let igFeedWhiteTextBufferBufferAwsPromise = uploadBufferToAmazon(igFeedWhiteTextBuffer,
    //     `${urlHashKey}_ig_feed_white_text.jpg`);

    let pollyBufferAwsPromise = uploadBufferToAmazon(pollyBuffer,
        `${urlHashKey}.mp3`);

    let [response1, response2, response3, response4, response5, response6] = await Promise.all(
        [imageBufferAwsPromise, igStoryBufferBufferAwsPromise,
          igFeedBufferBufferAwsPromise, igStoryBufferWithoutTextAwsPromise, pollyBufferAwsPromise])
    console.log("awsResponse=", response1.Location);
    console.log("awsResponse=", response2.Location);
    console.log("awsResponse=", response3.Location);
    console.log("awsResponse=", response4.Location);
    console.log("awsResponse=", response5.Location);

    ogData["processedImageHash"] = `${urlHashKey}.jpg`
  }

  awsResponse = await uploadBufferToAmazon(JSON.stringify(ogData),
      urlHashKey + ".json");
  console.log("awsResponse=", awsResponse.Location);
  return ogData;
}

async function fetchOgMetadataAndImagesAndUploadToAWS(url, urlHashKey,
    backgroundColor, fontColorSuffix) {

  let ogInfo = await getOpenGraphInfo(url);
  // if there is no url in the metadata, use the one that was requested from
  if (ogInfo['data']['ogUrl'] === undefined){
    ogInfo['data']['ogUrl'] = url
  }

  console.log("ogInfo=", ogInfo)

  if (ogInfo["success"]) {
    ogInfo["data"]["success"] = true
    return await processOgData(ogInfo["data"], urlHashKey, backgroundColor, fontColorSuffix)
  } else {
    return {
      success: false,
      ogUrl: url
    }
  }
}

function cleanUrl(urlToClean){
  let parsedUrl = url.parse(urlToClean);
  let cleanUrl = parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname
  console.log("cleanUrl=", cleanUrl);
  return cleanUrl
}

async function processUrl(urlToParse, breakCache, backgroundColor = '01bc84', fontColorSuffix = '') {
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
      return await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl, urlHashKey,
          backgroundColor, fontColorSuffix)
    }
  } else {
    let response = await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl,
        urlHashKey, backgroundColor, fontColorSuffix)
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

function fixTitle(title){
  title = title.replace(/’/g, "'")
  title = title.replace(/‘/g, "'")
  title = title.replace(/"/g,"'")
  title = title.replace(/“/g, "'")
  title = title.replace(/”/g, "'")
  title = title.replace(" — ", "-")
  title = title.replace(" — ", "-")
  return title
}

async function getRelatedHashTags(hashTag, numberOfHashTagsToInclude = 15){
  return new Promise((resolve, reject) => {
    fetch(`https://apidisplaypurposes.com/tag/${hashTag}`)
    .then(res => res.json())
    .then(json => {
      let results = json['results']
      console.log("length =", results.length)
      if (results.length < numberOfHashTagsToInclude){
        numberOfHashTagsToInclude = results.length
      }
      let hashtags = ""
      for (let i = 0; i < numberOfHashTagsToInclude; i++){
        hashtags += `#${results[i]['tag']} `
      }
      resolve(hashtags)
    })
  })

}

async function processIgStoryImageToBuffer(ogData, ogImage, backgroundColor, fontColorSuffix, printText = true) {
  ogImage = ogImage.cover(1080, 960);
  // let imageBuffer = await ogImage.getBufferAsync("image/jpeg");

  let background = await new Jimp(1080, 1920, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, 185);

  // generated with https://ttf2fnt.com/
  let titleFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-85${fontColorSuffix}/GothicA1-SemiBold.ttf.fnt`);
  let urlFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-50${fontColorSuffix}/GothicA1-Regular.ttf.fnt`);

  if (printText){
    let url = extractHostname(ogData.ogUrl)
    let title = fixTitle(ogData.ogTitle)
    let footerText = "Link in bio"
    outputImage = await outputImage.print(urlFont, 50, 1180, url, 970);
    outputImage = await outputImage.print(titleFont, 50, 1255, title, 970);
    outputImage = await outputImage.print(urlFont, 50, 1815,
        {text: footerText, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER}, 970);
  }

  return await outputImage.getBufferAsync("image/jpeg");

}

async function processIgFeedImageToBuffer(ogData, ogImage, backgroundColor, fontColorSuffix) {
  // generated with https://ttf2fnt.com/
  let titleFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-50${fontColorSuffix}/GothicA1-SemiBold.ttf.fnt`);
  let urlFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32${fontColorSuffix}/GothicA1-Regular.ttf.fnt`);

  let url = extractHostname(ogData.ogUrl)
  let title = fixTitle(ogData.ogTitle)

  let titleHeight = Jimp.measureTextHeight(titleFont, title, 1020);
  let lineHeight = 63;
  let linesCount = titleHeight/lineHeight;

  console.log("titleHeight=", titleHeight)
  console.log("linesCount=", linesCount)

  // this is the maximum size of the image, calculated manually
  let maxImageHeight = 981;
  let imageHeight = maxImageHeight - (linesCount * lineHeight)
  // this is the minimum y axis value, based on the number of lines, this should go up
  // calculated this manually
  let minImageYAxis = 99;
  let imageYAxis = minImageYAxis + (linesCount * lineHeight)

  // now generate everything
  ogImage = ogImage.cover(1080, imageHeight);

  let background = await new Jimp(1080, 1080, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, imageYAxis);


  outputImage = await outputImage.print(urlFont, 30, 30, url, 1020);

  outputImage = await outputImage.print(titleFont, 30, 85, title, 1020);


  return await outputImage.getBufferAsync("image/jpeg");

}

// (async () => {
//   try {
//     let ogData = await processUrl(
//         'https://www.nytimes.com/interactive/2020/06/07/us/george-floyd-protest-aerial-photos.html?action=click&module=Top%20Stories&pgtype=Homepage', true)
//     // await processIgStoryImageToBuffer(ogData);
//     // await processIgFeedImageToBuffer(ogData);
//   } catch (e) {
//     console.error(e)
//     // Deal with the fact the chain failed
//   }
// })();

module.exports.processUrl = processUrl
module.exports.createShotStack = createShotStack
module.exports.getShotStack = getShotStack
module.exports.getRelatedHashTags = getRelatedHashTags
