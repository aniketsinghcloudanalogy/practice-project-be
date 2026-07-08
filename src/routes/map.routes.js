const router = require('express').Router();
const mapController = require('./map/map.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validateSaveLocation } = require('./map/map.validation');

// Public route — anyone with shareToken can view
router.get('/share/:shareToken', mapController.getSharedLocation);

router.use(protect);

router.route('/').post(validateSaveLocation, mapController.saveLocation).get(mapController.getLocations);
router.post('/share', mapController.shareLocation);
router.get('/shared-with-me', mapController.getSharedWithMe);
router.get('/users-for-sharing', mapController.getUsersForSharing);

router
  .route('/:locationId')
  .get(mapController.getLocation)
  .delete(mapController.deleteLocation);

module.exports = router;
