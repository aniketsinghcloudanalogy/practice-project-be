const asyncHandler = require('../../utils/asyncHandler');
const schedulerService = require('./scheduler.service');
const ApiResponse = require('../../utils/ApiResponse');

const createMeeting = asyncHandler(async (req, res) => {
  const meeting = await schedulerService.createMeeting({
    userId: req.user.id,
    data: req.body,
  });

  return res.status(201).json(
    new ApiResponse(201, 'Meeting created successfully', meeting)
  );
});

const listMeetings = asyncHandler(async (req, res) => {
  const result = await schedulerService.listMeetings({
    userId: req.user.id,
    query: req.query,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Meetings fetched successfully', result)
  );
});

const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await schedulerService.getMeetingById({
    meetingId: req.params.id,
    userId: req.user.id,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Meeting fetched successfully', meeting)
  );
});

const updateMeeting = asyncHandler(async (req, res) => {
  const meeting = await schedulerService.updateMeeting({
    meetingId: req.params.id,
    userId: req.user.id,
    data: req.body,
    scope: req.query.scope || "series",
  });

  return res.status(200).json(
    new ApiResponse(200, 'Meeting updated successfully', meeting)
  );
});

const deleteMeeting = asyncHandler(async (req, res) => {
  const result = await schedulerService.deleteMeeting({
    meetingId: req.params.id,
    userId: req.user.id,
  });

  return res.status(200).json(
    new ApiResponse(200, 'Meeting deleted successfully', result)
  );
});

module.exports = {
  createMeeting,
  listMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
};