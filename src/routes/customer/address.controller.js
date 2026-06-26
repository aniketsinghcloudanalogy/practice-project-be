const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const addressModel = require('./address.helper');
const customerModel = require('./helper');

const verifyCustomer = async (customerId, userId) => {
  const customer = await customerModel.findCustomerByIdAndUserId(customerId, userId);
  if (!customer) throw new ApiError(404, 'Customer not found');
};

const createAddress = asyncHandler(async (req, res) => {
  await verifyCustomer(req.params.customerId, req.user.id);
  const address = await addressModel.createAddress(req.user.id, req.params.customerId, req.body);
  return res.status(201).json(new ApiResponse(201, 'Address created successfully', address));
});

const getAddresses = asyncHandler(async (req, res) => {
  await verifyCustomer(req.params.customerId, req.user.id);
  const addresses = await addressModel.findAddressesByCustomer(req.user.id, req.params.customerId);
  return res.status(200).json(new ApiResponse(200, 'Addresses fetched successfully', addresses));
});

const getAddress = asyncHandler(async (req, res) => {
  await verifyCustomer(req.params.customerId, req.user.id);
  const address = await addressModel.findAddressById(req.params.addressId, req.user.id, req.params.customerId);
  if (!address) throw new ApiError(404, 'Address not found');
  return res.status(200).json(new ApiResponse(200, 'Address fetched successfully', address));
});

const updateAddress = asyncHandler(async (req, res) => {
  await verifyCustomer(req.params.customerId, req.user.id);
  const address = await addressModel.updateAddress(req.params.addressId, req.user.id, req.params.customerId, req.body);
  if (!address) throw new ApiError(404, 'Address not found');
  return res.status(200).json(new ApiResponse(200, 'Address updated successfully', address));
});

const deleteAddress = asyncHandler(async (req, res) => {
  await verifyCustomer(req.params.customerId, req.user.id);
  const result = await addressModel.deleteAddress(req.params.addressId, req.user.id, req.params.customerId);
  if (result.count === 0) throw new ApiError(404, 'Address not found');
  return res.status(200).json(new ApiResponse(200, 'Address deleted successfully', null));
});

module.exports = { createAddress, getAddresses, getAddress, updateAddress, deleteAddress };
