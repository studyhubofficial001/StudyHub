const { DeleteObjectCommand, ListObjectVersionsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  s3Client,
  hashFile,
  uploadFileToB2,
  cleanupTempFile,
  cleanupUploadedObject,
} = require('../config/b2Storage');
const Syllabus = require('../models/Syllabus');

const getSyllabi = async (req, res) => {
  try {
    const syllabi = await Syllabus.find().populate('uploadedBy', 'username email').sort({ createdAt: -1 });
    res.status(200).json(syllabi);
  } catch (error) {
    console.error('Error fetching syllabi:', error);
    res.status(500).json({ message: 'Error fetching syllabi', error: error.message });
  }
};

const uploadSyllabus = async (req, res) => {
  const file = req.file;
  try {
    const existingSyllabus = await Syllabus.findOne();
    if (existingSyllabus) {
      return res.status(409).json({
        message: 'A global syllabus already exists. Replace or delete the current file before uploading a new one.',
      });
    }

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const allowedMimeTypes = ['application/pdf', 'application/octet-stream'];
    if (!allowedMimeTypes.includes(file.mimetype) && !file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ message: 'Only PDF syllabus files are allowed' });
    }

    const fileHash = await hashFile(file.path);
    const duplicateSyllabus = await Syllabus.findOne({ fileHash });
    if (duplicateSyllabus) {
      return res.status(409).json({
        message: 'This syllabus file has already been uploaded',
        syllabus: duplicateSyllabus,
      });
    }

    const fileExtension = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
    const fileKey = `syllabus/${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExtension}`;

    const uploadResponse = await uploadFileToB2({
      filePath: file.path,
      key: fileKey,
      contentType: file.mimetype || 'application/pdf',
    });

    let syllabus;
    try {
      syllabus = await Syllabus.create({
        originalName: file.originalname,
        uploadedBy: req.user._id,
        fileKey,
        fileHash,
      });
    } catch (error) {
      await cleanupUploadedObject({ key: fileKey, versionId: uploadResponse.VersionId });
      throw error;
    }

    res.status(201).json({ message: 'Syllabus uploaded successfully', syllabus });
  } catch (error) {
    console.error('Error uploading syllabus:', error);
    res.status(500).json({ message: 'Error uploading syllabus', error: error.message });
  } finally {
    await cleanupTempFile(file?.path);
  }
};

const updateSyllabus = async (req, res) => {
  const file = req.file;
  try {
    const { id } = req.params;

    if (!file) {
      return res.status(400).json({ message: 'A new PDF file is required to replace the syllabus' });
    }

    const allowedMimeTypes = ['application/pdf', 'application/octet-stream'];
    if (!allowedMimeTypes.includes(file.mimetype) && !file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ message: 'Only PDF syllabus files are allowed' });
    }

    const syllabus = await Syllabus.findById(id);
    if (!syllabus) {
      return res.status(404).json({ message: 'Syllabus not found' });
    }

    const fileHash = await hashFile(file.path);
    const duplicateSyllabus = await Syllabus.findOne({ _id: { $ne: id }, fileHash });
    if (duplicateSyllabus) {
      return res.status(409).json({
        message: 'This syllabus file is already stored in the system',
      });
    }

    const fileExtension = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
    const fileKey = `syllabus/${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExtension}`;

    const uploadResponse = await uploadFileToB2({
      filePath: file.path,
      key: fileKey,
      contentType: file.mimetype || 'application/pdf',
    });

    const oldFileKey = syllabus.fileKey;
    try {
      syllabus.fileKey = fileKey;
      syllabus.originalName = file.originalname;
      syllabus.fileHash = fileHash;
      syllabus.uploadedBy = req.user._id;

      await syllabus.save();
    } catch (error) {
      await cleanupUploadedObject({ key: fileKey, versionId: uploadResponse.VersionId });
      throw error;
    }

    try {
      const versionsResult = await s3Client.send(new ListObjectVersionsCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Prefix: oldFileKey,
        MaxKeys: 1000,
      }));

      const allVersions = [
        ...(versionsResult.Versions || []),
        ...(versionsResult.DeleteMarkers || []),
      ];

      for (const version of allVersions) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: version.Key,
          VersionId: version.VersionId,
        }));
      }
    } catch (error) {
      console.error(`Error cleaning up replaced syllabus object ${oldFileKey}:`, error);
    }

    res.status(200).json({ message: 'Syllabus replaced successfully', syllabus });
  } catch (error) {
    console.error('Error replacing syllabus:', error);
    res.status(500).json({ message: 'Error replacing syllabus', error: error.message });
  } finally {
    await cleanupTempFile(file?.path);
  }
};

const deleteSyllabus = async (req, res) => {
  try {
    const { id } = req.params;
    const syllabus = await Syllabus.findById(id);

    if (!syllabus) {
      return res.status(404).json({ message: 'Syllabus not found' });
    }

    const versionsResult = await s3Client.send(new ListObjectVersionsCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: syllabus.fileKey,
      MaxKeys: 1000,
    }));

    const allVersions = [
      ...(versionsResult.Versions || []),
      ...(versionsResult.DeleteMarkers || []),
    ];

    for (const version of allVersions) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: version.Key,
        VersionId: version.VersionId,
      }));
    }

    await Syllabus.findByIdAndDelete(id);

    res.status(200).json({ message: 'Syllabus deleted successfully' });
  } catch (error) {
    console.error('Error deleting syllabus:', error);
    res.status(500).json({ message: 'Error deleting syllabus', error: error.message });
  }
};

const getCurrentSyllabus = async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne().sort({ createdAt: -1 });

    if (!syllabus) {
      return res.status(404).json({ message: 'Syllabus not found' });
    }

    res.status(200).json(syllabus);
  } catch (error) {
    console.error('Error fetching current syllabus:', error);
    res.status(500).json({ message: 'Error fetching current syllabus', error: error.message });
  }
};

const getSyllabusDownloadUrl = async (req, res) => {
  try {
    const { syllabusId } = req.params;
    const syllabus = await Syllabus.findById(syllabusId);

    if (!syllabus) {
      return res.status(404).json({ message: 'Syllabus not found' });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: syllabus.fileKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({
      originalName: syllabus.originalName,
      downloadUrl: signedUrl,
      expiresInMinutes: 60,
    });
  } catch (error) {
    console.error('Error generating syllabus download URL:', error);
    res.status(500).json({ message: 'Error generating syllabus download URL', error: error.message });
  }
};

const getCurrentSyllabusDownloadUrl = async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne().sort({ createdAt: -1 });

    if (!syllabus) {
      return res.status(404).json({ message: 'Syllabus not found' });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: syllabus.fileKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({
      originalName: syllabus.originalName,
      downloadUrl: signedUrl,
      expiresInMinutes: 60,
    });
  } catch (error) {
    console.error('Error generating current syllabus download URL:', error);
    res.status(500).json({ message: 'Error generating current syllabus download URL', error: error.message });
  }
};

module.exports = {
  getSyllabi,
  getCurrentSyllabus,
  uploadSyllabus,
  updateSyllabus,
  deleteSyllabus,
  getSyllabusDownloadUrl,
  getCurrentSyllabusDownloadUrl,
};
