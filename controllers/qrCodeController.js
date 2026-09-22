const mongoose = require('mongoose');
const QRCodeImage = require('qrcode');
const Asset = require('../models/Asset');
const QRCode = require('../models/QRCode');

const ASSET_STATUSES = ['Available', 'Allocated', 'Maintenance', 'Retired'];
const TOKEN_PATTERN = /^[a-f0-9]{48}$/i;

// QR images contain this URL. The same resolver also accepts a raw token.
const buildQRValue = (req, token) => {
  const baseUrl = (process.env.QR_PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`)
    .replace(/\/$/, '');
  return `${baseUrl}/api/qr/resolve/${token}`;
};

const serializeQRCode = (req, record) => {
  const qrCode = record.toObject ? record.toObject() : record;

  return {
    ...qrCode,
    qrValue: buildQRValue(req, qrCode.token),
    imageUrl: `/api/qr/assets/${qrCode.asset?._id || qrCode.asset}/image`,
  };
};

// Accept either the raw token or the complete URL returned by a scanner.
const extractToken = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;

  const input = value.trim();
  if (TOKEN_PATTERN.test(input)) return input.toLowerCase();

  try {
    const url = new URL(input);
    const token = url.pathname.split('/').filter(Boolean).pop();
    return TOKEN_PATTERN.test(token || '') ? token.toLowerCase() : null;
  } catch {
    return null;
  }
};

const findScannedQRCode = async (code, countScan = true) => {
  const token = extractToken(code);
  if (!token) return { error: 'Invalid QR code', status: 400 };

  const query = { token };
  const qrCode = countScan
    ? await QRCode.findOneAndUpdate(
        query,
        { $inc: { scanCount: 1 }, $set: { lastScannedAt: new Date() } },
        { new: true }
      ).populate('asset')
    : await QRCode.findOne(query).populate('asset');

  if (!qrCode || !qrCode.asset) return { error: 'Asset QR code not found', status: 404 };
  return { qrCode };
};

// Return every generated QR code with its related asset information.
exports.getAllQRCodes = async (req, res) => {
  try {
    // Backfill QR identities for assets created before this module existed.
    const [assets, registeredAssetIds] = await Promise.all([
      Asset.find().select('_id').lean(),
      QRCode.distinct('asset'),
    ]);
    const registered = new Set(registeredAssetIds.map(String));
    const missingAssets = assets.filter((asset) => !registered.has(String(asset._id)));

    if (missingAssets.length > 0) {
      await QRCode.bulkWrite(
        missingAssets.map((asset) => ({
          updateOne: {
            filter: { asset: asset._id },
            update: {
              $setOnInsert: {
                asset: asset._id,
                token: QRCode.createToken(),
                generatedAt: new Date(),
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }

    const records = await QRCode.find().populate('asset').sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: records.filter((record) => record.asset).map((record) => serializeQRCode(req, record)),
    });
  } catch (err) {
    console.error('getAllQRCodes error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch QR codes' });
  }
};

// Create an asset QR code, or rotate its token when regenerate is true.
exports.generateQRCode = async (req, res) => {
  try {
    const { assetId } = req.params;
    const regenerate = req.body?.regenerate === true;

    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID' });
    }

    const asset = await Asset.findById(assetId).lean();
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    let created = false;
    let qrCode = await QRCode.findOne({ asset: assetId });
    if (!qrCode) {
      qrCode = await QRCode.create({ asset: assetId });
      created = true;
    } else if (regenerate) {
      qrCode.token = QRCode.createToken();
      qrCode.generatedAt = new Date();
      qrCode.scanCount = 0;
      qrCode.lastScannedAt = null;
      await qrCode.save();
    }

    await qrCode.populate('asset');
    const data = serializeQRCode(req, qrCode);
    data.imageDataUrl = await QRCodeImage.toDataURL(data.qrValue, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 420,
    });

    return res.status(created ? 201 : 200).json({
      success: true,
      message: regenerate ? 'QR code regenerated successfully' : 'QR code generated successfully',
      data,
    });
  } catch (err) {
    console.error('generateQRCode error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
};

// Return a printable PNG for an asset's existing QR code.
exports.getQRCodeImage = async (req, res) => {
  try {
    const { assetId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID' });
    }

    const qrCode = await QRCode.findOne({ asset: assetId }).populate('asset');
    if (!qrCode || !qrCode.asset) {
      return res.status(404).json({ success: false, message: 'Asset QR code not found' });
    }

    const png = await QRCodeImage.toBuffer(buildQRValue(req, qrCode.token), {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 720,
    });

    const filename = `${qrCode.asset.assetName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr.png`;
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${filename}"`);
    return res.send(png);
  } catch (err) {
    console.error('getQRCodeImage error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create QR image' });
  }
};

// Resolve a QR value submitted by a camera scanner or manually in Postman.
exports.scanQRCode = async (req, res) => {
  try {
    const result = await findScannedQRCode(req.body?.code);
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });

    return res.status(200).json({
      success: true,
      data: serializeQRCode(req, result.qrCode),
    });
  } catch (err) {
    console.error('scanQRCode error:', err);
    return res.status(500).json({ success: false, message: 'Failed to scan QR code' });
  }
};

// Allow the URL encoded in a QR image to retrieve the asset directly.
exports.resolveQRCode = async (req, res) => {
  try {
    const result = await findScannedQRCode(req.params.token);
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });

    return res.status(200).json({
      success: true,
      data: serializeQRCode(req, result.qrCode),
    });
  } catch (err) {
    console.error('resolveQRCode error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve asset information' });
  }
};

// Identify an asset by QR code and update only its status field.
exports.updateAssetStatusByQRCode = async (req, res) => {
  try {
    const { code, status } = req.body || {};
    if (!ASSET_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${ASSET_STATUSES.join(', ')}`,
      });
    }

    const result = await findScannedQRCode(code, false);
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });

    const asset = await Asset.findByIdAndUpdate(
      result.qrCode.asset._id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Asset status updated successfully',
      data: { ...serializeQRCode(req, result.qrCode), asset },
    });
  } catch (err) {
    console.error('updateAssetStatusByQRCode error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update asset status' });
  }
};
