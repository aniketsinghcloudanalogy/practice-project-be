const config = require('../../config');
const transporter = require('../../config/mail');

const contactModel = require('./helper');
const ApiResponse = require('../../utils/ApiResponse');
const { verifyAccessToken } = require('../../utils/jwt');

const createContact = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const decoded = verifyAccessToken(token);
        if (decoded && decoded.id) {
          req.body.userId = decoded.id;
        }
      } catch (err) {
        // ignore invalid token and continue as anonymous
      }
    }

    const contact = await contactModel.createContact(req.body);

    await transporter.sendMail({
      from: config.smtp.user,
      to: config.smtp.to,
      subject: `New Contact Request - ${contact.subject}`,
      html: `
        <h2>New Contact Request</h2>

        <p><strong>Name:</strong> ${contact.firstName} ${contact.lastName ?? ''}</p>
        <p><strong>Email:</strong> ${contact.email}</p>
        <p><strong>Phone:</strong> ${contact.primaryContact}</p>

        <p><strong>Message:</strong></p>
        <p>${contact.message}</p>
      `,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        'Contact submitted successfully',
        contact
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createContact,
};