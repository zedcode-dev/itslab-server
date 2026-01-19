const express = require('express');
const systemController = require('../controllers/systemController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

const router = express.Router();

// Public route to get basic settings (maintenance mode, etc)
router.get('/public', systemController.getPublicSettings);

// Protected Admin routes
router.use(authenticate);
router.use(checkRole('admin'));

router.get('/', systemController.getAllSettings);
router.put('/', systemController.updateSettings);

module.exports = router;
