import {IOpenGraphInfo} from "./models/IOpenGraphInfo";

export function convertGramsToReadableKg(kg: number) {
  kg = kg/1000
  return `${kg.toLocaleString(undefined, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  })}`
}

export function generateIgCopy(ogData: IOpenGraphInfo) {
  const copy =
      `Before you buy “${ogData.ogResult.ogTitle}” consider the #environment. The estimated carbon footprint of this is equivalent to the weight of ${ogData.co2eFootprint.humanReadable.value} (that's equal to ${convertGramsToReadableKg(ogData.co2eFootprint.metric.value)}kg)!
.
~ #Reduce, #Reuse, #Recycle ~
Consider buying used or resting what you already have instead of buying new.
.
~ About Carbon Calculator ~
At Carbon Calculator we believe knowledge is power. Knowing approximately how much carbon is released in the manufacture, shipping and selling of items will help make us more conscious consumers: picking to buy used where possible, reusing more of what we already have, and recycling the things we can no longer use.
.
~ About Carbon Calculator’s Estimates ~
Carbon Calculator looks at a product listing and attempts to match the product category to a North American Industry Classification System (NAICS) category. If a match is made, Carbon Calculator can use publicly available estimates of the carbon intensity of the NAICS category to make a fairly precise estimate of the carbon footprint of the item. If Carbon Calculator is unable to find the NAICS category, we will still make an estimate, but it will be less accurate.
.
~ What is #CO2e? ~
CO2e or carbon dioxide equivalent is a standard unit for measuring a carbon footprint. This metric takes into account greenhouse gases (GHG) such as carbon dioxide, methane, nitrous oxide, and more. While CO2 is the most common green house gas, other GHGs are far more harmful for the environment. CO2e describes the different greenhouse gases as a single unit, with each green house gas converted to its CO2 equivalent (ex. 1kg of methane = 25kg of carbon dioxide)

Carbon Calculator uses CO2e to give you the most accurate measure of how much of an impact a given product has on the environment
.
#environmentalism #environmentaljustice #environmentallyfriendly #consumerismsucks #plasticfree #pollutionfree #reducereuserecycle♻️ #saveourplanet #intersectionalenvironmentalism #environmentallyfriendly #environmentalracism #extinctionrebellion #greenhousegases #co2emissions
  `
  return copy
}