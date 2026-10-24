const { s3Client } = require("../config/b2Storage");
const Resource = require("../models/Resource");
const Subject = require("../models/Subjects");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("node:crypto");

// Files up to this size are served through the Vercel cache (Vercel can't send bigger ones)
const CACHEABLE_MAX_BYTES = 4 * 1024 * 1024;

// Same link for every user => Vercel keeps one cached copy => B2 is touched only once
const makeCachedLink = (fileKey) => {
    const sig = crypto
        .createHmac("sha256", process.env.FILE_LINK_SECRET)
        .update(fileKey)
        .digest("hex");
    return `${process.env.FILE_BASE_URL}/api/file?key=${encodeURIComponent(fileKey)}&sig=${sig}`;
};

const canUseCache = (resource) =>
    Boolean(process.env.FILE_LINK_SECRET && process.env.FILE_BASE_URL) &&
    resource.fileSize > 0 &&
    resource.fileSize <= CACHEABLE_MAX_BYTES;

const getResourceDownloadUrl = async (req, res) => {
    try {
        const resourceId = req.params.resourceId;
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ message: "Resource not found" }); 
        }
        // Small file: give the cached Vercel link (same link the students get)
        if (canUseCache(resource)) {
            return res.status(200).json({
                originalName: resource.originalName,
                downloadUrl: makeCachedLink(resource.fileKey),
            }); 
        }

        // Big file: straight from B2 with a temporary link
        const command = new GetObjectCommand({ 
            Bucket: process.env.B2_BUCKET_NAME,
            Key: resource.fileKey,
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.status(200).json({
            originalName: resource.originalName,
            downloadUrl: signedUrl,
            expiresInMinutes: 60,
        });
    } catch (error) {
        console.error("Error generating download URL:", error);
        res.status(500).json({ message: "Error generating download URL", error: error.message });
    }
};

const getUserResourceDownloadUrl = async (req, res) => {
    try {
        if (!req.user || !req.user.year) {
            return res.status(403).json({ message: "User year is required to access resources" });
        }

        const resource = await Resource.findById(req.params.resourceId);
        if (!resource || resource.year !== String(req.user.year)) {
            return res.status(404).json({ message: "Resource not found" });
        }

        // Small file: give the cached Vercel link (same URL for everybody)
        if (canUseCache(resource)) {
            return res.status(200).json({
                originalName: resource.originalName,
                downloadUrl: makeCachedLink(resource.fileKey),
            });
        }

        // Big file: straight from B2 with a temporary link (as before)
        const command = new GetObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: resource.fileKey,
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.status(200).json({
            originalName: resource.originalName,
            downloadUrl: signedUrl,
            expiresInMinutes: 60,
        });
    } catch (error) {
        console.error("Error generating user resource download URL:", error);
        res.status(500).json({ message: "Error generating download URL", error: error.message });
    }
};

const getResourcesForUser = async (req, res) => {
    try {
        if (!req.user || !req.user.year) {
            return res.status(403).json({ message: "User year is required to access resources" });
        }

        const resources = await Resource.find({
            year: String(req.user.year),
            resourceType: { $nin: ['pyq', 'code'] },
        }).sort({ createdAt: -1 });

        if (!resources.length) {
            return res.status(404).json({ message: "No resources found for your year" });
        }

        res.status(200).json(resources);
    } catch (error) {
        console.error("Error fetching resources for user:", error);
        res.status(500).json({ message: "Error fetching resources", error: error.message });
    }
};

const getUserPyqCodeResources = async (req, res) => {
    try {
        if (!req.user || !req.user.year) {
            return res.status(403).json({ message: "User year is required to access resources" });
        }

        const subjects = await Subject.find({ year: Number(req.user.year) }).select("name");
        const subjectNames = subjects.map((subject) => subject.name);
        if (!subjectNames.length) {
            return res.status(200).json([]);
        }

        const resources = await Resource.find({
            year: String(req.user.year),
            subject: { $in: subjectNames },
            resourceType: { $in: ['pyq', 'code'] },
        }).sort({ createdAt: -1 });

        return res.status(200).json(resources);
    } catch (error) {
        console.error("Error fetching PYQ and code resources:", error);
        return res.status(500).json({ message: "Error fetching PYQ and code resources", error: error.message });
    }
};

const getUserPyqCodeResourceDownloadUrl = async (req, res) => {
    try {
        if (!req.user || !req.user.year) {
            return res.status(403).json({ message: "User year is required to access resources" });
        }

        const resource = await Resource.findOne({
            _id: req.params.resourceId,
            year: String(req.user.year),
            resourceType: { $in: ['pyq', 'code'] },
        });
        if (!resource) {
            return res.status(404).json({ message: "Resource not found" });
        }

        const subjectExists = await Subject.exists({
            name: resource.subject,
            year: Number(req.user.year),
        });
        if (!subjectExists) {
            return res.status(404).json({ message: "Resource not found" });
        }

        if (canUseCache(resource)) {
            return res.status(200).json({
                originalName: resource.originalName,
                downloadUrl: makeCachedLink(resource.fileKey),
            });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: resource.fileKey,
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return res.status(200).json({
            originalName: resource.originalName,
            downloadUrl: signedUrl,
            expiresInMinutes: 60,
        });
    } catch (error) {
        console.error("Error generating PYQ or code download URL:", error);
        return res.status(500).json({ message: "Error generating download URL", error: error.message });
    }
};

module.exports = {
    getResourceDownloadUrl,
    getUserResourceDownloadUrl,
    getResourcesForUser,
    getUserPyqCodeResources,
    getUserPyqCodeResourceDownloadUrl,
};