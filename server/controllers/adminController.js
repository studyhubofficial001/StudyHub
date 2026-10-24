const Subject = require('../models/Subjects');
const { DeleteObjectCommand, ListObjectVersionsCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  s3Client,
  hashFile,
  uploadFileToB2,
  cleanupTempFile,
  cleanupUploadedObject,
} = require("../config/b2Storage");
const Resource = require("../models/Resource");
const User = require('../models/User');
const AcademicRollout = require('../models/AcademicRollout');
const sendEmail = require('../utils/sendEmail');
const { inngest } = require('../config/inngest');

// Send an event to Inngest. Never throws: a lost 'uploaded' event is repaired by the hourly sweeper.
const sendIngestEvent = async (event) => {
  try {
    await inngest.send(event);
    return true;
  } catch (error) {
    console.error(`Inngest send failed for ${event.name}:`, error.message);
    return false;
  }
};

const isSupportedCodeFile = (fileName) =>
  /\.(c|cc|cpp|cxx|h|pdf|hh|hpp|hxx|py|java|js|jsx|ts|tsx|cs|go|rs|php|rb|swift|kt|kts|sql|sh|html|css|zip)$/i.test(fileName);

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildFeatureAnnouncementEmail = ({ featureName, featureDescription, howItWorks }) => {
  const safeFeatureName = escapeHtml(featureName || 'New Feature');
  const safeDescription = escapeHtml(featureDescription || '');
  const safeHowItWorks = escapeHtml(howItWorks || '');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0; padding:0; background-color:#f4f7f9; font-family:Arial, sans-serif; color:#1f2937;">
        <div style="max-width:640px; margin:0 auto; padding:32px 20px;">
          <div style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(15, 23, 42, 0.08);">
            <div style="background:linear-gradient(135deg, #111827, #374151); padding:24px 28px; color:#ffffff;">
              <h1 style="margin:0; font-size:28px;">StudyHub Update</h1>
            </div>
            <div style="padding:28px; line-height:1.7;">
              <p style="margin:0 0 16px; font-size:16px;">Hello student,</p>
              <p style="margin:0 0 20px; font-size:16px;">
                We’ve launched a new feature: <strong>${safeFeatureName}</strong>.
              </p>

              <div style="margin-bottom:20px;">
                <h2 style="margin:0 0 8px; font-size:20px; color:#111827;">Feature added</h2>
                <p style="margin:0; font-size:16px;">${safeDescription || 'This feature has been added to improve the StudyHub experience.'}</p>
              </div>

              <div style="margin-bottom:20px;">
                <h2 style="margin:0 0 8px; font-size:20px; color:#111827;">How this feature works</h2>
                <p style="margin:0; font-size:16px;">${safeHowItWorks || 'This feature is designed to make your study workflow simpler and more efficient.'}</p>
              </div>

              <div style="margin-bottom:24px;">
                <h2 style="margin:0 0 8px; font-size:20px; color:#111827;">How to use it</h2>
                <p style="margin:0; font-size:16px;">${safeHowItWorks || 'Open the app, navigate to the relevant section, and follow the steps shown in the interface.'}</p>
              </div>

              <p style="margin:0; font-size:16px;">Thank you for using StudyHub. We hope this update makes your learning experience even better.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const buildYearPromotionEmail = ({ newYear }) => {
  const safeYear = Number(newYear) || 1;
  const yearLabel = safeYear === 1 ? '1st Year' : safeYear === 2 ? '2nd Year' : safeYear === 3 ? '3rd Year' : safeYear === 4 ? '4th Year' : `${safeYear}th Year`;

  return {
    subject: `StudyHub: You have moved to ${yearLabel}`,
    text: `Hello student,\n\nYour academic year has been updated to ${yearLabel}.\n\nThis means your dashboard, resources, and subject access have been adjusted for the new academic year.\n\nPlease log in to view your updated year and continue your studies.\n\nThank you for using StudyHub.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <body style="margin:0; padding:0; background-color:#f4f7f9; font-family:Arial, sans-serif; color:#1f2937;">
          <div style="max-width:640px; margin:0 auto; padding:32px 20px;">
            <div style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(15, 23, 42, 0.08);">
              <div style="background:linear-gradient(135deg, #111827, #374151); padding:24px 28px; color:#ffffff;">
                <h1 style="margin:0; font-size:28px;">StudyHub Update</h1>
              </div>
              <div style="padding:28px; line-height:1.7;">
                <p style="margin:0 0 16px; font-size:16px;">Hello student,</p>
                <p style="margin:0 0 20px; font-size:16px;">
                  Your academic year has been updated to <strong>${yearLabel}</strong>.
                </p>

                <div style="margin-bottom:20px;">
                  <h2 style="margin:0 0 8px; font-size:20px; color:#111827;">What changed</h2>
                  <p style="margin:0; font-size:16px;">Your dashboard and subject access have been updated for the new academic year.</p>
                </div>

                <div style="margin-bottom:20px;">
                  <h2 style="margin:0 0 8px; font-size:20px; color:#111827;">How to use it</h2>
                  <p style="margin:0; font-size:16px;">Log in to your StudyHub account and continue with the resources and subjects available for ${yearLabel}.</p>
                </div>

                <p style="margin:0; font-size:16px;">Thank you for using StudyHub. We hope your new academic year goes smoothly.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };
};

const sendFeatureAnnouncementToUsers = async (req, res) => {
  try {
    const { featureName, featureDescription, howItWorks } = req.body;

    if (!featureName?.trim() || !featureDescription?.trim() || !howItWorks?.trim()) {
      return res.status(400).json({
        message: 'Feature name, description, and usage details are required.',
      });
    }

    const users = await User.find({ verified: true, isProfileComplete: true }).select('email username');

    if (!users.length) {
      return res.status(200).json({
        message: 'No verified users with completed profiles were found to receive the feature update.',
        sentCount: 0,
      });
    }

    const formattedFeatureName = featureName.trim();
    const emailSubject = `StudyHub Update: ${formattedFeatureName} is now live`;
    const emailHtml = buildFeatureAnnouncementEmail({
      featureName: formattedFeatureName,
      featureDescription: featureDescription.trim(),
      howItWorks: howItWorks.trim(),
    });

    let sentCount = 0;

    for (const user of users) {
      if (!user.email) continue;

      try {
        await sendEmail(
          user.email,
          emailSubject,
          `Hello ${user.username || 'Student'},\n\nWe’ve added a new feature: ${formattedFeatureName}.\n\nFeature added: ${featureDescription.trim()}\n\nHow it works and how to use it: ${howItWorks.trim()}\n\nThank you for using StudyHub.`,
          emailHtml
        );
        sentCount += 1;
      } catch (error) {
        console.error(`Failed to send feature email to ${user.email}:`, error);
      }
    }

    res.status(200).json({
      message: `Feature update sent to ${sentCount} verified users with completed profiles.`,
      sentCount,
      totalRecipients: users.length,
    });
  } catch (error) {
    console.error('Error sending feature announcement:', error);
    res.status(500).json({ message: 'Failed to send feature announcement email.' });
  }
};

const getAcademicRolloutWindow = () => {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 6, 1, 0, 0, 0, 0);
  const end = new Date(year, 6, 15, 23, 59, 59, 999);

  return { start, end, cycleKey: `july-rollover-${year}` };
};

const advanceStudentsToNextYear = async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    if (month !== 7 || day < 1 || day > 15) {
      return res.status(400).json({
        message: 'Academic year promotion is only allowed from 1 July to 15 July.',
      });
    }

    const { start, end, cycleKey } = getAcademicRolloutWindow();
    const existingRollout = await AcademicRollout.findOne({ cycleKey });

    if (existingRollout && existingRollout.status === 'completed') {
      return res.status(409).json({
        message: 'This academic rollover has already been completed for the current cycle.',
        cycleKey,
      });
    }

    if (existingRollout && existingRollout.status === 'in_progress') {
      return res.status(409).json({
        message: 'An academic rollover is already in progress for this cycle.',
        cycleKey,
      });
    }

    const rolloutRecord = await AcademicRollout.findOneAndUpdate(
      { cycleKey },
      {
        cycleKey,
        windowStart: start,
        windowEnd: end,
        status: 'in_progress',
        triggeredBy: req.user._id,
        triggeredAt: now,
        notes: 'Admin-triggered annual student year promotion',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const eligibleUsersQuery = {
      verified: true,
      isProfileComplete: true,
      year: { $gte: 1, $lt: 4 },
    };

    const eligibleUsers = await User.find(eligibleUsersQuery).select('_id year');
    const updatedResult = await User.updateMany(
      eligibleUsersQuery,
      [
        {
          $set: {
            year: { $add: ['$year', 1] },
            lastYearPromotionCycle: cycleKey,
            lastYearPromotionAt: now,
            lastYearPromotionBy: req.user._id,
          },
        },
      ]
    );

    const advancedUsers = await User.find({
      verified: true,
      isProfileComplete: true,
      lastYearPromotionCycle: cycleKey,
    }).select('_id email username year');

    for (const user of advancedUsers) {
      if (!user.email) continue;
      const emailData = buildYearPromotionEmail({ newYear: user.year });

      try {
        await sendEmail(user.email, emailData.subject, emailData.text, emailData.html);
      } catch (emailError) {
        console.error(`Failed to send year promotion email to ${user.email}:`, emailError);
      }
    }

    await AcademicRollout.findByIdAndUpdate(rolloutRecord._id, {
      status: 'completed',
      promotedCount: updatedResult.modifiedCount || eligibleUsers.length,
      triggeredBy: req.user._id,
      triggeredAt: now,
      updatedAt: now,
    });

    return res.status(200).json({
      message: 'Academic year promotion completed successfully.',
      cycleKey,
      eligibleUsers: eligibleUsers.length,
      updatedUsers: updatedResult.modifiedCount || eligibleUsers.length,
      emailsSent: advancedUsers.length,
      window: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error advancing academic years:', error);
    return res.status(500).json({
      message: 'Failed to advance students to the next academic year.',
      error: error.message,
    });
  }
};

const rollbackStudentsYearAdvance = async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    if (month !== 7 || day < 1 || day > 15) {
      return res.status(400).json({
        message: 'Academic rollback is only allowed during the same July rollover window.',
      });
    }

    const { cycleKey } = getAcademicRolloutWindow();
    const rolloutRecord = await AcademicRollout.findOne({ cycleKey, status: 'completed' });

    if (!rolloutRecord) {
      return res.status(404).json({
        message: 'No completed academic rollover was found for the current cycle to roll back.',
      });
    }

    const currentEligibleUsers = await User.find({
      verified: true,
      isProfileComplete: true,
      lastYearPromotionCycle: cycleKey,
    }).select('_id year');

    if (!currentEligibleUsers.length) {
      return res.status(200).json({
        message: 'No users were promoted in this cycle, so there was nothing to roll back.',
        cycleKey,
      });
    }

    const rollbackResult = await User.updateMany(
      {
        verified: true,
        isProfileComplete: true,
        lastYearPromotionCycle: cycleKey,
      },
      [
        {
          $set: {
            year: { $subtract: ['$year', 1] },
            lastYearPromotionCycle: null,
            lastYearPromotionAt: null,
            lastYearPromotionBy: null,
          },
        },
      ]
    );

    await AcademicRollout.findByIdAndUpdate(rolloutRecord._id, {
      status: 'rolled_back',
      rolledBackBy: req.user._id,
      rolledBackAt: now,
      notes: 'Admin-initiated rollback of the current academic year promotion',
    });

    return res.status(200).json({
      message: 'Academic year promotion rolled back successfully.',
      cycleKey,
      revertedUsers: rollbackResult.modifiedCount || currentEligibleUsers.length,
    });
  } catch (error) {
    console.error('Error rolling back academic years:', error);
    return res.status(500).json({
      message: 'Failed to roll back the academic year promotion.',
      error: error.message,
    });
  }
};

const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ createdAt: -1 });
    res.status(200).json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, year, category } = req.body;
    const createdBy = req.user._id; // Assuming the user is authenticated and their ID is available in req.user
    if (name.trim() === '' || year === '' || category.trim() === '') {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newSubject = new Subject({
      name: name.trim(),
      year: year,
      category: category.trim(),
      createdBy,
    });
    let alreadyExists = await Subject.findOne({ name: name.trim() });
    if (alreadyExists) {
      return res.status(400).json({ message: 'Subject already exists' });
    }
    await newSubject.save();
    res.status(201).json(newSubject);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, year, category } = req.body;

    if (name.trim() === '' || year === '' || category.trim() === '') {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const existingSubject = await Subject.findOne({ name: name.trim(), _id: { $ne: id } });
    if (existingSubject) {
      return res.status(400).json({ message: 'Another subject with this name already exists' });
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      { name: name.trim(), year: year, category: category.trim() },
      { new: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.status(200).json(updatedSubject);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSubject = await Subject.findByIdAndDelete(id);

    if (!deletedSubject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    res.status(200).json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const uploadResource = async (req, res) => {
  const file = req.file;
  try {
    const resourceType = req.body.resourceType || 'resource';
    if (!['resource', 'pyq', 'code'].includes(resourceType)) {
      return res.status(400).json({ message: 'Invalid resource type' });
    }

    const subject = await Subject.findOne({ name: req.body.subject });
    const title = req.body.title?.trim();
    if (!title) {
      return res.status(400).json({ message: 'Resource title is required' });
    }
    const existingResource = await Resource.findOne({
      title,
      subject: req.body.subject,
      year: req.body.year,
      category: req.body.category,
    });

    if (existingResource) {
      return res.status(400).json({ message: "A resource with this title already exists for the specified subject, year, and category" });
    }

    if (
      !subject ||
      Number(req.body.year) !== subject.year ||
      subject.category !== req.body.category
    ) {
      return res.status(400).json({
        message: "Your subject does not match the existing name, year, or category"
      });
    }

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (resourceType === 'code' && !isSupportedCodeFile(file.originalname)) {
      return res.status(400).json({
        message: 'Code uploads must use a supported source-code file extension or .zip archive',
      });
    }

    const fileHash = await hashFile(file.path);
    const existing = await Resource.findOne({ fileHash });
    if (existing) {
      return res.status(409).json({
        message: "This file has already been uploaded",
        resource: existing,
      });
    }

    const fileExtension = file.originalname.split('.').pop();
    const fileKey = `resources/${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExtension}`;
    const uploadResponse = await uploadFileToB2({
      filePath: file.path,
      key: fileKey,
      contentType: file.mimetype,
    });

    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);

    let resource;
    try {
      resource = await Resource.create({
        title: req.body.title,
        subject: req.body.subject,
        year: req.body.year,
        category: req.body.category,
        resourceType,
        originalName: file.originalname,
        uploadedBy: req.user._id,
        fileKey: fileKey,
        versionId: uploadResponse.VersionId,
        fileHash: fileHash,
        fileSize: file.size,
        status: isPdf ? 'queued' : 'skipped',
      });
    } catch (error) {
      await cleanupUploadedObject({ key: fileKey, versionId: uploadResponse.VersionId });
      throw error;
    }

    // start OCR + embedding automatically (only PDFs are processed)
    if (isPdf) {
      await sendIngestEvent({
        id: `ingest-${resource._id}`,            // the same id twice = Inngest ignores the second event
        name: 'resource/uploaded',
        data: { resourceId: String(resource._id) },
      });
    }

    res.status(201).json({ message: 'Resource uploaded successfully', resource });
  } catch (error) {
    console.error("Error uploading resource:", error);
    res.status(500).json({ message: "Error uploading resource", error: error.message });
  } finally {
    await cleanupTempFile(file?.path);
  }
};

const updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, year, category } = req.body;

    if (!title?.trim() || !subject?.trim() || !year || !category) {
      return res.status(400).json({ message: 'Title, subject, year, and category are required' });
    }

    const existingResource = await Resource.findById(id);
    if (!existingResource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const resourceType = req.body.resourceType || existingResource.resourceType || 'resource';
    if (!['resource', 'pyq', 'code'].includes(resourceType)) {
      return res.status(400).json({ message: 'Invalid resource type' });
    }
    if (resourceType === 'code' && !isSupportedCodeFile(existingResource.originalName)) {
      return res.status(400).json({
        message: 'Code files must use a supported source-code file extension or .zip archive',
      });
    }

    const matchingSubject = await Subject.findOne({ name: subject.trim() });
    if (!matchingSubject) {
      return res.status(400).json({ message: 'Selected subject does not exist' });
    }

    if (Number(year) !== matchingSubject.year || matchingSubject.category !== category) {
      return res.status(400).json({
        message: 'The selected subject, year, and category do not match an existing subject combination',
      });
    }

    const duplicateResource = await Resource.findOne({
      _id: { $ne: id },
      title: title.trim(),
      subject: subject.trim(),
      year: String(year),
      category,
    });

    if (duplicateResource) {
      return res.status(400).json({
        message: 'A resource with this title already exists for the selected subject, year, and category',
      });
    }

    const metadataChanged =
      existingResource.subject !== subject.trim() ||
      existingResource.year !== String(year) ||
      existingResource.category !== category;

    existingResource.title = title.trim();
    existingResource.subject = subject.trim();
    existingResource.year = String(year);
    existingResource.category = category;
    existingResource.resourceType = resourceType;

    await existingResource.save();

    // subject/year/category are also stored on every vector in Qdrant: keep them in sync
    if (metadataChanged) {
      await sendIngestEvent({ name: 'resource/updated', data: { resourceId: String(existingResource._id) } });
    }

    res.status(200).json({ message: 'Resource updated successfully', resource: existingResource });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ message: 'Error updating resource', error: error.message });
  }
};

const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findById(id);

    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    // tell the ingestion steps to stop writing (if B2 deletion fails below, press delete again)
    await Resource.updateOne({ _id: id }, { $set: { status: 'deleting' } });

    // List ALL versions + delete markers for this specific key
    const versionsResult = await s3Client.send(new ListObjectVersionsCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: resource.fileKey,
      MaxKeys: 1000,
    }));

    // Combine actual versions AND delete markers
    const allVersions = [
      ...(versionsResult.Versions || []),
      ...(versionsResult.DeleteMarkers || []),
    ];

    console.log(`Found ${allVersions.length} version(s) to delete for: ${resource.fileKey}`);

    // Permanently delete each one by its VersionId
    for (const v of allVersions) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: v.Key,
        VersionId: v.VersionId,  // ← this is the key that makes it a HARD delete
      }));
    }

    await Resource.findByIdAndDelete(id);

    // cancels a running ingestion and removes this resource's vectors and page texts
    await sendIngestEvent({ name: 'resource/deleted', data: { resourceId: String(id) } });

    res.status(200).json({ message: "Resource deleted successfully" });
  } catch (error) {
    console.error("Error deleting resource:", error);
    res.status(500).json({ message: "Error deleting resource", error: error.message });
  }
};

const getResources = async (req, res) => {
  try {
    const resources = await Resource.find().populate('uploadedBy', 'username email').sort({ createdAt: -1 });
    res.status(200).json(resources);
  } catch (error) {
    console.error("Error fetching resources:", error);
    res.status(500).json({ message: "Error fetching resources", error: error.message });
  }
};

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  uploadResource,
  updateResource,
  deleteResource,
  getResources,
  sendFeatureAnnouncementToUsers,
  advanceStudentsToNextYear,
  rollbackStudentsYearAdvance,
};