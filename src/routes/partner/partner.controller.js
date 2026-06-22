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
  findProgramById,
  findProgramByIdWithPartner,
  updateProgramById,
  deleteProgramById,
  findAllPartnersWithPrograms,
} = require('./helper');
const prisma = require('../../config/prisma');

const addPartner = async (req, res) => {
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
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const addProgram = async (req, res) => {
  try {
    const { partnerName, partnerProgramName, description } = req.body;

    const partner = await findPartnerByPartnerName(partnerName);

    if (!partner) {
      throw new ApiError(404, 'Partner not found');
    }

    const newProgram = await createProgram({
      partnerProgramName: partnerName + '  ' + partnerProgramName,
      description,
      partnerId: partner.id,
    });

    return res.status(201).json(
      new ApiResponse(201, 'Program created successfully', newProgram)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getPartnerNames = async (req, res) => {
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
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getPartnerCount = async (req, res) => {
  try {
    const total = await countPartners();

    return res.status(200).json(
      new ApiResponse(200, 'Partner count fetched successfully', { total })
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const updatePartnerById = async (req, res) => {
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
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deletePartnerById = async (req, res) => {
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
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getPartnerPrograms = async (req, res) => {
  try {
    const { partnerId, partnerName } = req.query;

    let partner = null;

    if (partnerId !== undefined) {
      // partnerId is already a Number from validation middleware
      partner = await findPartnerById(partnerId);
    } else if (partnerName) {
      partner = await findPartnerByPartnerName(partnerName);
    }

    if (!partner) {
      // Return empty response instead of 404 to prevent frontend breakage
      return res.status(200).json(
        new ApiResponse(200, 'No partner found', {
          partner: null,
          total: 0,
          programs: [],
        })
      );
    }

    if (partnerId !== undefined && partnerName && partner.partnerName !== partnerName) {
      return res.status(200).json(
        new ApiResponse(200, 'partnerId and partnerName do not match', {
          partner: null,
          total: 0,
          programs: [],
        })
      );
    }

    const { programs, total } = await findPartnerProgramsWithTotal(partner.id);

    // If no programs, return early with empty array
    if (!programs || programs.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, 'Partner programs fetched successfully', {
          partner: {
            id: partner.id,
            partnerName: partner.partnerName,
          },
          total: 0,
          programs: [],
        })
      );
    }

    // Attach formStatus for each program from ProgramForm table
    const programIds = programs.map((p) => p.id);

    let formMap = {};

    if (programIds.length > 0) {
      try {
        const programForms = await prisma.programForm.findMany({
          where: { programId: { in: programIds } },
          select: { programId: true, status: true },
        });

        for (const pf of programForms) {
          formMap[pf.programId] = pf;
        }
      } catch (formError) {
        // If ProgramForm table query fails (e.g. table doesn't exist), continue without formStatus
        console.error('[getPartnerPrograms] ProgramForm query failed (non-blocking):', formError.message);
        formMap = {};
      }
    }

    const programsWithFormStatus = programs.map((prog) => {
      const form = formMap[prog.id];
      return {
        ...prog,
        formStatus: form?.status ?? null,
      };
    });

    return res.status(200).json(
      new ApiResponse(200, 'Partner programs fetched successfully', {
        partner: {
          id: partner.id,
          partnerName: partner.partnerName,
        },
        total,
        programs: programsWithFormStatus,
      })
    );
  } catch (error) {
    console.error('[getPartnerPrograms] Error:', error.message);

    // If the error is about ProgramForm table not existing, still try to return programs without form status
    if (error.message && error.message.includes('ProgramForm')) {
      try {
        const { partnerId, partnerName } = req.query;
        let partner = null;
        if (partnerId !== undefined) {
          partner = await findPartnerById(partnerId);
        } else if (partnerName) {
          partner = await findPartnerByPartnerName(partnerName);
        }
        if (partner) {
          const { programs, total } = await findPartnerProgramsWithTotal(partner.id);
          const programsWithNullForm = (programs || []).map((prog) => ({ ...prog, formStatus: null }));
          return res.status(200).json(
            new ApiResponse(200, 'Partner programs fetched successfully', {
              partner: { id: partner.id, partnerName: partner.partnerName },
              total,
              programs: programsWithNullForm,
            })
          );
        }
      } catch (retryError) {
        console.error('[getPartnerPrograms] Retry also failed:', retryError.message);
      }
    }

    const status = error.statusCode || error.status || 500;
    // Always return a safe structure so frontend doesn't break
    return res.status(status).json(
      new ApiResponse(status, error.message || 'Internal Server Error', {
        partner: null,
        total: 0,
        programs: [],
      })
    );
  }
};

const getPartnerStats = async (req, res) => {
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
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const toggleVerificationStep = async (req, res) => {
  try {
    const programId = req.programId;
    const { verificationStep } = req.body;

    const updated = await updateProgramVerification(programId, verificationStep);

    return res.status(200).json(
      new ApiResponse(200, 'Verification step updated successfully', updated)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const updateProgramController = async (req, res) => {
  try {
    const programId = req.programId;
    const { partnerProgramName, description } = req.body;

    const existing = await findProgramById(programId);
    if (!existing) {
      throw new ApiError(404, 'Program not found');
    }

    const updateData = {};
    if (partnerProgramName !== undefined) updateData.partnerProgramName = partnerProgramName;
    if (description !== undefined) updateData.description = description;

    const updated = await updateProgramById(programId, updateData);

    return res.status(200).json(
      new ApiResponse(200, 'Program updated successfully', updated)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deleteProgramController = async (req, res) => {
  try {
    const programId = req.programId;

    const existing = await findProgramById(programId);
    if (!existing) {
      throw new ApiError(404, 'Program not found');
    }

    // Delete associated program forms first
    try {
      await prisma.programForm.deleteMany({ where: { programId } });
    } catch (e) {
      // ProgramForm table might not exist, continue
    }

    const deleted = await deleteProgramById(programId);

    return res.status(200).json(
      new ApiResponse(200, 'Program deleted successfully', deleted)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getPartnerProgramById = async (req, res) => {
  try {
    const programId = req.programId;

    const program = await findProgramByIdWithPartner(programId);

    if (!program) {
      throw new ApiError(404, 'Program not found');
    }

    // Transform response to include partnerName at the top level
    const response = {
      ...program,
      partnerName: program.partner?.partnerName || null,
    };

    // Remove the nested partner object since we've flattened it
    delete response.partner;

    return res.status(200).json(
      new ApiResponse(200, 'Program fetched successfully', response)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getAllPartnersWithPrograms = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const search = (req.query.search || '').trim();

    const [partners, total] = await findAllPartnersWithPrograms({ page, limit, search });

    // Attach formStatus for all programs
    const allProgramIds = partners.flatMap((p) => p.programs.map((prog) => prog.id));
    let formMap = {};

    if (allProgramIds.length > 0) {
      try {
        const programForms = await prisma.programForm.findMany({
          where: { programId: { in: allProgramIds } },
          select: { programId: true, status: true },
        });
        for (const pf of programForms) {
          formMap[pf.programId] = pf;
        }
      } catch (e) {
        formMap = {};
      }
    }

    const result = partners.map((partner) => ({
      ...partner,
      programs: partner.programs.map((prog) => {
        const form = formMap[prog.id];
        return { ...prog, formStatus: form?.status ?? null };
      }),
    }));

    return res.status(200).json(
      new ApiResponse(200, 'All partners with programs fetched successfully', {
        partners: result,
        total,
        page,
        limit,
      })
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
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
  getPartnerProgramById,
  getPartnerStats,
  toggleVerificationStep,
  updateProgramController,
  deleteProgramController,
  getAllPartnersWithPrograms,
};
