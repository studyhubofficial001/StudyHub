// client/api/file.js   (this file must be in the "api" folder at the ROOT of the client project)
import crypto from "node:crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel cannot send bigger responses than ~4.5 MB

const s3 = new S3Client({
  region: process.env.B2_REGION,
  endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APP_KEY,
  },
});

// Same recipe the backend uses to create the link
const makeSig = (key) =>
  crypto
    .createHmac("sha256", process.env.FILE_LINK_SECRET)
    .update(key)
    .digest("hex");

export default async function handler(req, res) {
  const { key, sig } = req.query;

  // 1. Check the link is real (only your backend can make a correct sig)
  if (typeof key !== "string" || typeof sig !== "string" || !key.startsWith("resources/") || key.includes("..")) {
    return res.status(400).send("Bad request");
  }
  const expected = Buffer.from(makeSig(key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return res.status(403).send("Forbidden");
  }

  // 2. Get the file from the private B2 bucket
  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: process.env.BUCKET, Key: key })
    );

    if (obj.ContentLength > MAX_BYTES) {
      obj.Body.destroy?.();
      return res.status(413).send("File too large for this route");
    }

    const bytes = await obj.Body.transformToByteArray();

    res.setHeader("Content-Type", obj.ContentType || "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    // Same URL for every user, so Vercel's CDN keeps ONE copy for everybody
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res.status(200).send(Buffer.from(bytes));
  } catch (err) {
    if (err.name === "NoSuchKey" || err.name === "NotFound") {
      return res.status(404).send("File not found");
    }
    console.error(err);
    return res.status(500).send("Server error");
  }
}