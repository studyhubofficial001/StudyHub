const requireAdmin = require('../middleware/requireAdmin');
const { protect } = require('../middleware/authMiddleware');

const express = require('express');
const router = express.Router();
const {getSubjects,updateSubject,deleteSubject,createSubject} = require('../controllers/adminController');

router.use(protect, requireAdmin);

router.get('/subjects', getSubjects);
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

module.exports = router;