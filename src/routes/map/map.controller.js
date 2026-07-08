const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const locationModel = require('./helper');

const saveLocation = asyncHandler(async (req, res) => {
  const location = await locationModel.saveLocation(req.user.id, req.body);
  return res.status(201).json(new ApiResponse(201, 'Location saved successfully', location));
});

const getLocations = asyncHandler(async (req, res) => {
  const locations = await locationModel.getLocations(req.user.id);
  return res.status(200).json(new ApiResponse(200, 'Locations fetched successfully', locations));
});

const getLocation = asyncHandler(async (req, res) => {
  const location = await locationModel.getLocationById(req.params.locationId, req.user.id);
  if (!location) throw new ApiError(404, 'Location not found');
  return res.status(200).json(new ApiResponse(200, 'Location fetched successfully', location));
});

const getSharedLocation = asyncHandler(async (req, res) => {
  const location = await locationModel.getLocationByShareToken(req.params.shareToken);
  if (!location) throw new ApiError(404, 'Shared location not found');
  return res.status(200).json(new ApiResponse(200, 'Shared location fetched successfully', location));
});

const deleteLocation = asyncHandler(async (req, res) => {
  const result = await locationModel.deleteLocation(req.params.locationId, req.user.id);
  if (result.count === 0) throw new ApiError(404, 'Location not found');
  return res.status(200).json(new ApiResponse(200, 'Location deleted successfully', null));
});

const shareLocation = asyncHandler(async (req, res) => {
  const { locationId, sharedToId } = req.body;
  if (!locationId || !sharedToId) throw new ApiError(400, 'locationId and sharedToId are required');
  if (sharedToId === req.user.id) throw new ApiError(400, 'Cannot share with yourself');
  const shared = await locationModel.shareLocationWithUser(locationId, req.user.id, sharedToId);
  return res.status(201).json(new ApiResponse(201, 'Location shared successfully', shared));
});

const getSharedWithMe = asyncHandler(async (req, res) => {
  const shared = await locationModel.getSharedWithMe(req.user.id);
  return res.status(200).json(new ApiResponse(200, 'Shared locations fetched', shared));
});

const getUsersForSharing = asyncHandler(async (req, res) => {
  const users = await locationModel.getUsersForSharing(req.user.id);
  return res.status(200).json(new ApiResponse(200, 'Users fetched', users));
});

module.exports = { saveLocation, getLocations, getLocation, getSharedLocation, deleteLocation, shareLocation, getSharedWithMe, getUsersForSharing };
