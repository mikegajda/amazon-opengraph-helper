import AWS, {AWSError} from "aws-sdk";

const awsKeyId = process.env.MG_AWS_KEY_ID;
const awsSecretAccessKey = process.env.MG_AWS_SECRET_ACCESS_KEY;

export const s3 = new AWS.S3({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey
});

const polly = new AWS.Polly({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: 'us-east-1'
})

export async function getFileInS3(filename: string): Promise<string> {
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename
  };
  return new Promise((resolve, reject) => {
    s3.getObject(params, (err, data) => {
      if (err) {
        reject(err)
      }

      resolve(data.Body.toString());
    });
  })

}

export async function checkIfFileExistsInS3(filename: string) {
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename, // File name you want to save as in S3
  };
  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.headObject(params, (err: AWSError, data) => {
      if (err) {
        resolve(false)
      } else {
        resolve(true)
      }
    });
  })
}

export async function uploadBufferToAmazon(buffer: Buffer | string, filename: string) {
  // Setting up S3 upload parameters
  const params = {
    Bucket: "cdn.carboncalculator.org",
    Key: filename, // File name you want to save as in S3
    Body: buffer,
    ACL: "public-read"
  };

  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.upload(params, (err: Error, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  })
}