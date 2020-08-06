// @ts-ignore
import convert from "./convert-units";


export function convertGramsToHumanReadable(g: number): string {
  const result = convert(g).from('g').toBest({exclude: ['g', 'kg', 'lb'], cutOffNumber: 2.0});
  const formattedResult = `${result.val.toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  })} ${result.plural.toLowerCase()}`
  console.log("formattedResult=", formattedResult);
  return formattedResult;
}