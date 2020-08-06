
import chai from 'chai'
const expect = chai.expect;

import path from 'path'
import fs from 'fs'
import {parse}  from 'node-html-parser'
import {getProductCategory} from "../src/productInfo";
import {
  getAmazonCategoryToEpaCategoryMap, getCarbonFootprintInGrams,
  getEpaCategoryToCarbonFootprintMap, getPrice
} from "../src/carbonCalculator";
import {convertGramsToHumanReadable} from "../src/convertUnits";

async function getTestFiles() : Promise<string[]> {
  const directoryPath = path.join(__dirname, 'pages');

  return new Promise((resolve, reject) => {
    let results: string[] = []
    fs.readdir(directoryPath, function (err: any, files: string[]) {
      //handling error
      if (err) {
        reject(err)
      }
      //listing all files using forEach
      files.forEach(function (file: string) {
        results.push(file)
      });
      resolve(results)
    });
  });
}
describe('Handle Opengraph', function () {
  describe('#getPrice', async function () {
    it('should get the same values as what has been cached', async function () {
      let files = await getTestFiles()
      files.forEach((fileName: string) => {
        let html = fs.readFileSync(path.join(__dirname, 'pages', fileName)).toString()
        let ogInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'og_info', fileName.split(".")[0] + ".json")).toString())
        let [successInGettingPrice, price] = getPrice(parse(html))
        expect(successInGettingPrice).to.equal(true)
        expect(successInGettingPrice).to.equal(ogInfo.pricingInfo.successInGettingPrice)
        expect(price).to.equal(ogInfo.pricingInfo.price)
      })
    });
  });
  describe('#getAmazonCategoryToEpaCategoryMap', async function () {
    it('should generate the expected map', async function () {
      let map = await getAmazonCategoryToEpaCategoryMap()
      console.log(map)
    });
  });
  describe('#getAmazonCategoryToEpaCategoryMap', async function () {
    it('should generate the expected map', async function () {
      let map = await getEpaCategoryToCarbonFootprintMap()
      console.log(map)
    });
  });
  // describe('#getCarbonFootprintInGrams', async function () {
  //   it('should generate the expected map', async function () {
  //     let footprint = await getCarbonFootprintInGrams({value: 1.00}, "Personal Computer")
  //     console.log(footprint)
  //   });
  // });
  describe('#getProductCategory', async function () {
    it('should generate the expected map', async function () {
      let files = await getTestFiles()
      files.forEach(fileName => {
        let ogInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'og_info', fileName.split(".")[0] + ".json")).toString())
        let category = getProductCategory(ogInfo.ogTitle)
        console.log("category=", category);
        expect(category).to.not.equal("UNKNOWN");
      })
    });
  });

  describe('#convertKgToHumanReadable', async function () {
    it('should generate the expected map', async function () {
      let g = 1000;
      let result = convertGramsToHumanReadable(g);
      console.log("result={}", result);
    });
  });
});
