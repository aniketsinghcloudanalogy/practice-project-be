const contactsModel = require('./helper');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');

const createContact = async (req, res) => {
  try {
    const contact = await contactsModel.createContact(req.user.id, req.body);

    return res.status(201).json(
      new ApiResponse(201, 'Contact created successfully', contact)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getContacts = async (req, res) => {
  try {
    const contacts = await contactsModel.findContactsByUserId(req.user.id);

    return res.status(200).json(
      new ApiResponse(200, 'Contacts fetched successfully', contacts)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const getContact = async (req, res) => {
  try {
    const contact = await contactsModel.findContactByIdAndUserId(
      req.params.contactId,
      req.user.id
    );

    if (!contact) {
      throw new ApiError(404, 'Contact not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Contact fetched successfully', contact)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const updateContact = async (req, res) => {
  try {
    const result = await contactsModel.updateContact(
      req.params.contactId,
      req.user.id,
      req.body
    );

    if (result.count === 0) {
      throw new ApiError(404, 'Contact not found');
    }

    const contact = await contactsModel.findContactByIdAndUserId(
      req.params.contactId,
      req.user.id
    );

    return res.status(200).json(
      new ApiResponse(200, 'Contact updated successfully', contact)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

const deleteContact = async (req, res) => {
  try {
    const result = await contactsModel.deleteContact(
      req.params.contactId,
      req.user.id
    );

    if (result.count === 0) {
      throw new ApiError(404, 'Contact not found');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Contact deleted successfully')
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = {
  createContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
};
