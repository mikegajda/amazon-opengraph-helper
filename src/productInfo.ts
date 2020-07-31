export function getProductCategory(ogTitle: string) {
  let ogTitleSplit = ogTitle.split(" : ")
  try {
    if (ogTitleSplit.length >= 2) {
      return ogTitleSplit[2].trim();
    } else {
      ogTitleSplit = ogTitle.split(":")
      if (ogTitleSplit.length >= 2) {
        return ogTitleSplit[2].trim();
      }
      return "UNKNOWN";
    }
  } catch {
    return "UNKOWN"
  }
}