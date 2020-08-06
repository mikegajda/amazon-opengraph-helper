import {PassThrough} from "stream";
import {ICustomParsedCurrency} from "./ICustomParsedCurrency";

export type IOpenGraphInfo = CustomSuccessResult

export interface CustomSuccessResult {
  error: false
  ogResult: {
    ogDescription?: string
    ogImage?: {
      height: string
      type: string
      url: string
      width: string
    }
    ogTitle?: string
    ogType?: string
    ogUrl?: string
    requestUrl: string
    success: true
  };
  response: any
  urlHashKey: string
  productInfo: {
    productCategory: string | undefined
    price?: ICustomParsedCurrency
  }
  co2eFootprint: {
    metric: {
      value: number | undefined
      unit: string
    }
    humanReadable: {
      value: string
    }
  }
  igCopy?: string
}