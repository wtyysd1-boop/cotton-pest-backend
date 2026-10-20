const router = require('express').Router();
const uploadImage = require('../middleware/uploadImage');
router.post('/upload-image', ...uploadImage('image', 10));
module.exports = router;
