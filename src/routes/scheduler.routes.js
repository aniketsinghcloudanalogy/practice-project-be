const express = require("express");
const router = express.Router();

const controller = require("../routes/scheduler/scheduler.controller");
const validation = require("../routes/scheduler/scheduler.validation");
const { protect } = require("../middlewares/auth.middleware");

router.use(protect);

router.post("/", validation.validateCreateMeeting, controller.createMeeting);
router.get("/", validation.validateListQuery, controller.listMeetings);
router.get("/:id", validation.validateMeetingIdParam, controller.getMeeting);
router.put("/:id", validation.validateMeetingIdParam, validation.validateEditScope, validation.validateUpdateMeeting, controller.updateMeeting);
router.delete("/:id", validation.validateMeetingIdParam, controller.deleteMeeting);

module.exports = router;