const requireAdmin = require('../middleware/requireAdmin');
const { protect } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const { getSubjects, updateSubject, deleteSubject, createSubject, uploadResource, updateResource, deleteResource, getResources, sendFeatureAnnouncementToUsers, advanceStudentsToNextYear, rollbackStudentsYearAdvance } = require('../controllers/adminController');
const { getResourceDownloadUrl } = require('../controllers/resourceController');
const { getSyllabi, uploadSyllabus, updateSyllabus, deleteSyllabus, getSyllabusDownloadUrl } = require('../controllers/syllabusController');
const { getIngestionStatus, retryIngestion } = require('../controllers/ingestionController');
const { upload } = require('../config/b2Storage');

router.use(protect, requireAdmin);

router.get('/ingestion', getIngestionStatus);
router.post('/ingestion/:id/retry', retryIngestion);
router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);
router.post('/feature-announcement', sendFeatureAnnouncementToUsers);
router.post('/year-rollover', advanceStudentsToNextYear);
router.post('/year-rollover/rollback', rollbackStudentsYearAdvance);
router.post('/resources', upload.single('file'), uploadResource);
router.put('/resources/:id', updateResource);
router.delete('/resources/:id', deleteResource);
router.get('/resources', getResources);
router.get('/resources/:resourceId/download', getResourceDownloadUrl);
router.get('/syllabus', getSyllabi);
router.post('/syllabus', upload.single('file'), uploadSyllabus);
router.put('/syllabus/:id', upload.single('file'), updateSyllabus);
router.delete('/syllabus/:id', deleteSyllabus);
router.get('/syllabus/:syllabusId/download', getSyllabusDownloadUrl);

module.exports = router;