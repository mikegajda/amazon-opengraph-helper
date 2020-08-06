import express from 'express'
import serverless from 'serverless-http'
import cors from 'cors'
import {processUrl} from "./utils";
import {getPriceForUrl, refreshGoogleSheetsCache} from "./carbonCalculator";
import {convertGramsToHumanReadable} from "./convertUnits";

export const app = express();

const allowedDomains = [
  "https://mikegajda.com",
  "https://michaelgajda.com",
  /\.mikegajda\.com$/,
  /\.michaelgajda\.com$/,
  /\.mikegajda\.netlify\.app$/
]
app.use(express.json())
app.use(cors({
               origin: allowedDomains
             }))

const router = express.Router()
router.get('/opengraph-info', async (req, res) => {
  const response = await processUrl(req.query.url as string,
                                    req.query.breakCache === "true",
                                    req.query.writeFiles === "true")
  res.json(response);
});

router.get('/get-price', async (req, res) => {
  const response = await getPriceForUrl(req.query.url as string)
  res.json(response);
});

router.get('/human-readable-mass', async (req, res) => {
  const response = await convertGramsToHumanReadable(Number.parseFloat(req.query.weight as string))
  res.json(response);
});

router.get('/google-sheets/refresh', async (req, res) => {
  const response = await refreshGoogleSheetsCache();
  res.json(response);
});
// point the base route at the router
app.use('/', router)

// special for netlify functions, point /.netlify/functions at the router
app.use('/.netlify/functions/app', router) // route to netlify lambda

module.exports.handler = serverless(app);