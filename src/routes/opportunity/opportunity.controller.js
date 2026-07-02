const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const opportunityModel = require('./helper');

const createOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityModel.createOpportunity(req.user.id, req.body);

    return res.status(201).json(
      new ApiResponse(201, 'Opportunity created successfully', opportunity)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getOpportunities = async (req, res) => {
  try {
    const { customerId } = req.query;

    const opportunities = customerId
      ? await opportunityModel.findOpportunitiesByCustomerId(customerId, req.user.id)
      : await opportunityModel.findOpportunitiesByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(200, 'Opportunities fetched successfully', opportunities)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getOpportunity = async (req, res) => {
  try {
    const opportunity = await opportunityModel.findOpportunityByIdAndUserId(
      req.params.opportunityId,
      req.user.id
    );

    if (!opportunity) {
      throw new ApiError(404, 'Opportunity not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Opportunity fetched successfully', opportunity)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const updateOpportunity = async (req, res) => {
  try {
    const result = await opportunityModel.updateOpportunity(
      req.params.opportunityId,
      req.user.id,
      req.body
    );

    if (result.count === 0) {
      throw new ApiError(404, 'Opportunity not found');
    }

    const opportunity = await opportunityModel.findOpportunityByIdAndUserId(
      req.params.opportunityId,
      req.user.id
    );

    return res.status(200).json(
      new ApiResponse(200, 'Opportunity updated successfully', opportunity)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deleteOpportunity = async (req, res) => {
  try {
    const result = await opportunityModel.deleteOpportunity(
      req.params.opportunityId,
      req.user.id
    );

    if (result.count === 0) {
      throw new ApiError(404, 'Opportunity not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Opportunity deleted successfully', null)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = {
  createOpportunity,
  getOpportunities,
  getOpportunity,
  updateOpportunity,
  deleteOpportunity,
};
