const { createReadStream } = require("node:fs");
const { unlink } = require("node:fs/promises");
const os = require("node:os");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { DeleteObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
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
    requestHandler: {
        connectionTimeout: 10_000,
        requestTimeout: 120_000,
    },
});

const storage = multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
});
const upload = multer({ storage });

const hashFile = async (filePath) => {
    const hash = crypto.createHash("sha256");
    await pipeline(createReadStream(filePath), hash);
    return hash.digest("hex");
};

const uploadFileToB2 = async ({ filePath, key, contentType }) => {
    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: process.env.B2_BUCKET_NAME,
            Key: key,
            Body: createReadStream(filePath),
            ContentType: contentType,
        },
        partSize: 15 * 1024 * 1024,
        queueSize: 2,
        leavePartsOnError: false,
    });

    return upload.done();
};

const cleanupTempFile = async (filePath) => {
    if (!filePath) return;

    try {
        await unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error("Error removing temporary upload file:", error);
        }
    }
};

const cleanupUploadedObject = async ({ key, versionId }) => {
    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: key,
            ...(versionId ? { VersionId: versionId } : {}),
        }));
    } catch (error) {
        console.error(`Error cleaning up uploaded B2 object ${key}:`, error);
    }
};

module.exports = {
    s3Client,
    upload,
    hashFile,
    uploadFileToB2,
    cleanupTempFile,
    cleanupUploadedObject,
};