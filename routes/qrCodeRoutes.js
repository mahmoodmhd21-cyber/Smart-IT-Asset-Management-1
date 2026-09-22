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

// QR management and scanner endpoints.
router.get('/', getAllQRCodes);
router.post('/scan', scanQRCode);
router.patch('/status', updateAssetStatusByQRCode);
router.get('/resolve/:token', resolveQRCode);
router.post('/assets/:assetId/generate', generateQRCode);
router.get('/assets/:assetId/image', getQRCodeImage);

module.exports = router;
