const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const MAX_BYTES = 4 * 1024 * 1024; // files up to 4 MB go through Vercel cache

const s3 = new S3Client({
  region: process.env.B2_REGION,
  endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
});

module.exports = async (req, res) => {
  const name = req.query.name;
  if (!name || name.includes("..")) {
    return res.status(400).send("Bad request");
  }

  // TODO: add your login check here, before anything is sent.
  // If the user is not allowed, return res.status(401).send("Not allowed");

  try {
    // Ask B2 how big the file is
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: process.env.BUCKET, Key: name })
    );

    // SMALL file: send it ourselves and let Vercel cache it
    if (head.ContentLength <= MAX_BYTES) {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: process.env.BUCKET, Key: name })
      );
      const bytes = await obj.Body.transformToByteArray();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate"
      );
      return res.status(200).send(Buffer.from(bytes));
    }

    // BIG file: send the user straight to B2 with a temporary link
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.BUCKET,
        Key: name,
        ResponseContentType: "application/pdf",
        ResponseCacheControl: "private, max-age=86400", // browser keeps it 1 day
      }),
      { expiresIn: 600 } // link works for 10 minutes
    );
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, url);
  } catch (err) {
    if (err.name === "NotFound" || err.name === "NoSuchKey") {
      return res.status(404).send("File not found");
    }
    console.error(err);
    return res.status(500).send("Server error");
  }
};