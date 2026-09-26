const express = require('express');
const {
  generateQRCode,
  getAllQRCodes,
  getQRCodeImage,
  resolveQRCode,
  scanQRCode,
  updateAssetStatusByQRCode,
} = require('../controllers/qrCodeController');

const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
// QR possession is not permission to view or change private inventory.
router.use(protect, authorize('Admin', 'IT Staff'));

// QR management and scanner endpoints.
router.get('/', getAllQRCodes);
router.post('/scan', scanQRCode);
router.patch('/status', updateAssetStatusByQRCode);
router.get('/resolve/:token', resolveQRCode);
router.post('/assets/:assetId/generate', generateQRCode);
router.get('/assets/:assetId/image', getQRCodeImage);

module.exports = router;
