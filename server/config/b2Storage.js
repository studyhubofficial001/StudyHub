const {S3Client} = require("@aws-sdk/client-s3");
const multer = require("multer");

const endpoint = process.env.B2_ENDPOINT.startsWith('http')
  ? process.env.B2_ENDPOINT
  : `https://${process.env.B2_ENDPOINT}`;

const s3Client = new S3Client({
    endpoint: endpoint,
    region: process.env.B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = { s3Client, upload };