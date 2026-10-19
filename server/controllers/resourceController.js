const { s3Client } = require("../config/b2Storage");
const Resource = require("../models/Resource");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const getResourceDownloadUrl = async (req, res) => {
    try {
        const resourceId = req.params.resourceId;
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ message: "Resource not found" }); 
        }
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

        const resources = await Resource.find({ year: String(req.user.year) }).sort({ createdAt: -1 });

        if (!resources.length) {
            return res.status(404).json({ message: "No resources found for your year" });
        }

        res.status(200).json(resources);
    } catch (error) {
        console.error("Error fetching resources for user:", error);
        res.status(500).json({ message: "Error fetching resources", error: error.message });
    }
};

module.exports = { getResourceDownloadUrl, getUserResourceDownloadUrl, getResourcesForUser };