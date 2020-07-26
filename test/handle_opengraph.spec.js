let handle_opengraph = require("../handle_opengraph");

const chai = require('chai')
const expect = chai.expect;

const path = require('path');
const fs = require('fs');
const HTMLParser = require('node-html-parser');

async function getTestFiles(){
  const directoryPath = path.join(__dirname, 'pages');

  return new Promise((resolve, reject) => {
    let results = []
    fs.readdir(directoryPath, function (err, files) {
      //handling error
      if (err) {
        reject(err)
      }
      //listing all files using forEach
      files.forEach(function (file) {
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
      files.forEach(fileName => {
        let html = fs.readFileSync(path.join(__dirname, 'pages', fileName))
        let ogInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'og_info', fileName.split(".")[0] + ".json")))
        let [successInGettingPrice, price] = handle_opengraph.getPrice(HTMLParser.parse(html))
        expect(successInGettingPrice).to.equal(true)
        expect(successInGettingPrice).to.equal(ogInfo.pricingInfo.successInGettingPrice)
        expect(price).to.equal(ogInfo.pricingInfo.price)
      })
    });
  });
});