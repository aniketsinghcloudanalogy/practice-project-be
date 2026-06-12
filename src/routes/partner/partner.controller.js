const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const {
  findPartnerByPartnerName,
  findPartnerById,
  createPartner,
  findAllPartnerNames,
  countPartners,
  updatePartner,
  deletePartner,
  createProgram,
  findPartnerProgramsWithTotal,
  countAllPrograms,
  countPendingPrograms,
  updateProgramVerification,
} = require('./helper');

const addPartner = async (req, res, next) => {
  try {
    const existingPartner = await findPartnerByPartnerName(req.body.partnerName);

    if (existingPartner) {
      throw new ApiError(400, 'Partner with this name already exists');
    }

    const newPartner = await createPartner(req.body);

    return res.status(201).json(
      new ApiResponse(201, 'Partner created successfully', newPartner)
    );
  } catch (error) {
    next(error);
  }
};

const addProgram = async (req, res, next) => {
  try {
    const { partnerName, partnerProgramName, description } = req.body;

    const partner = await findPartnerByPartnerName(partnerName);

    if (!partner) {
      throw new ApiError(404, "Partner not found");
    }

    const newProgram = await createProgram({
      partnerProgramName: partnerName + "  " + partnerProgramName,
      description,
      partnerId: partner.id,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        "Program created successfully",
        newProgram
      )
    );
  } catch (error) {
    next(error);
  }
};
const getPartnerNames = async (req, res, next) => {
  try {
    const partners = await findAllPartnerNames();

    if (partners.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, 'No partners found', [])
      );
    }

    return res.status(200).json(
      new ApiResponse(200, 'Partner names fetched successfully', partners)
    );
  } catch (error) {
    next(error);
  }
};

const getPartnerCount = async (req, res, next) => {
  try {
    const total = await countPartners();

    return res.status(200).json(
      new ApiResponse(200, 'Partner count fetched successfully', { total })
    );
  } catch (error) {
    next(error);
  }
};

const updatePartnerById = async (req, res, next) => {
  try {
    const partnerId = req.partnerId;
    const updateData = req.body;

    const existingPartner = await findPartnerById(partnerId);

    if (!existingPartner) {
      throw new ApiError(404, 'Partner not found');
    }

    if (
      updateData.partnerName &&
      updateData.partnerName !== existingPartner.partnerName
    ) {
      const partnerWithSameName = await findPartnerByPartnerName(
        updateData.partnerName
      );

      if (partnerWithSameName) {
        throw new ApiError(400, 'Partner with this name already exists');
      }
    }

    const updatedPartner = await updatePartner(partnerId, updateData);


    return res.status(200).json(
      new ApiResponse(200, 'Partner updated successfully', updatedPartner)
    );
  } catch (error) {
    next(error);
  }
};

const deletePartnerById = async (req, res, next) => {
  try {
    const partnerId = req.partnerId;

    const existingPartner = await findPartnerById(partnerId);

    if (!existingPartner) {
      throw new ApiError(404, 'Partner not found');
    }

    const deletedPartner = await deletePartner(partnerId);

    return res.status(200).json(
      new ApiResponse(200, 'Partner deleted successfully', deletedPartner)
    );
  } catch (error) {
    next(error);
  }
};

const getPartnerPrograms = async (req, res, next) => {
  try {
    const { partnerId, partnerName } = req.query;

    let partner = null;

    if (partnerId !== undefined) {
      partner = await findPartnerById(partnerId);
    } else {
      partner = await findPartnerByPartnerName(partnerName);
    }

    if (!partner) {
      throw new ApiError(404, 'Partner not found');
    }

    if (partnerId !== undefined && partnerName && partner.partnerName !== partnerName) {
      throw new ApiError(400, 'partnerId and partnerName do not match');
    }

    const { programs, total } = await findPartnerProgramsWithTotal(partner.id);

    return res.status(200).json(
      new ApiResponse(200, 'Partner programs fetched successfully', {
        partner: {
          id: partner.id,
          partnerName: partner.partnerName,
        },
        total,
        programs,
      })
    );
  } catch (error) {
    next(error);
  }
};

const getPartnerStats = async (req, res, next) => {
  try {
    const [totalPartners, totalPrograms, pending] = await Promise.all([
      countPartners(),
      countAllPrograms(),
      countPendingPrograms(),
    ]);

    return res.status(200).json(
      new ApiResponse(200, 'Partner stats fetched successfully', { totalPartners, totalPrograms, pending })
    );
  } catch (error) {
    next(error);
  }
};

const toggleVerificationStep = async (req, res, next) => {
  try {
    const programId = req.programId;
    const { verificationStep } = req.body;

    const updated = await updateProgramVerification(programId, verificationStep);

    return res.status(200).json(
      new ApiResponse(200, 'Verification step updated successfully', updated)
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addPartner,
  addProgram,
  getPartnerNames,
  getPartnerCount,
  updatePartnerById,
  deletePartnerById,
  getPartnerPrograms,
  getPartnerStats,
  toggleVerificationStep,
};
