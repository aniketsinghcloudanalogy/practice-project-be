const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const customerModel = require('./helper');

const createCustomer = async (req, res) => {
  try {
    const customer = await customerModel.createCustomer(req.user.id, req.body);

    return res.status(201).json(
      new ApiResponse(201, 'Customer created successfully', customer)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getCustomers = async (req, res) => {
  try {
    const customers = await customerModel.findCustomersByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(200, 'Customers fetched successfully', customers)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getCustomer = async (req, res) => {
  try {
    const customer = await customerModel.findCustomerByIdAndUserId(
      req.params.customerId,
      req.user.id
    );

    if (!customer) {
      throw new ApiError(404, 'Customer not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Customer fetched successfully', customer)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const updateCustomer = async (req, res) => {
  try {
    const result = await customerModel.updateCustomer(
      req.params.customerId,
      req.user.id,
      req.body
    );

    if (result.count === 0) {
      throw new ApiError(404, 'Customer not found');
    }

    const customer = await customerModel.findCustomerByIdAndUserId(
      req.params.customerId,
      req.user.id
    );

    return res.status(200).json(
      new ApiResponse(200, 'Customer updated successfully', customer)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const result = await customerModel.deleteCustomer(
      req.params.customerId,
      req.user.id
    );

    if (result.count === 0) {
      throw new ApiError(404, 'Customer not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Customer deleted successfully', null)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
};
