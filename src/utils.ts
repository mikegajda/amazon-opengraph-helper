import stringHash from "string-hash";
import {checkIfFileExistsInS3, getFileInS3} from "./aws";
import url from "url";
import {fetchOgMetadataAndImagesAndUploadToAWS} from "./handleOpengraph";
import {CustomSuccessResult} from "./models/IOpenGraphInfo";

export function cleanUrl(urlToClean: string) {
  const parsedUrl = url.parse(urlToClean);
  const cleanedUrl = parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname
  console.log("cleanedUrl=", cleanedUrl);
  return cleanedUrl
}

export function getUrlHashKey(urlToParse: string){
  const cleanedUrl = cleanUrl(urlToParse).toString()
  const urlHashKey = stringHash(cleanedUrl).toString()
  return [cleanedUrl, urlHashKey]
}

export async function processUrl(urlToParse: string, breakCache: boolean, writeFiles: boolean) {
  const [cleanedUrl, urlHashKey] = getUrlHashKey(urlToParse)

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

export function instanceOfCustomSuccessResult(object: any): object is CustomSuccessResult {
  return object.error === false;
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

export function fixTitle(title: string) {
  title = title.replace(/’/g, "'")
  title = title.replace(/‘/g, "'")
  title = title.replace(/"/g, "'")
  title = title.replace(/“/g, "'")
  title = title.replace(/”/g, "'")
  title = title.replace(" — ", "-")
  title = title.replace(" — ", "-")
  return title
}