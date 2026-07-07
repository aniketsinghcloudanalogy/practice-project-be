const router = require('express').Router();
const mapController = require('./map/map.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validateSaveLocation } = require('./map/map.validation');

// Public route — anyone with shareToken can view
router.get('/share/:shareToken', mapController.getSharedLocation);

router.use(protect);

router.route('/').post(validateSaveLocation, mapController.saveLocation).get(mapController.getLocations);

router
  .route('/:locationId')
  .get(mapController.getLocation)
  .delete(mapController.deleteLocation);

module.exports = router;
