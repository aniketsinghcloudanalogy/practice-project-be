const config = require('../../config');
const transporter = require('../../config/mail');

const contactusModel = require('./helper');
const ApiResponse = require('../../utils/ApiResponse');
const { verifyAccessToken } = require('../../utils/jwt');

const hasContactMailConfig = () => {
  const { host, port, user, pass, to } = config.smtp;
  return Boolean(host && port && user && pass && to);
};

const createContact = async (req, res) => {
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

    const contact = await contactusModel.createContact(req.body);

    if (hasContactMailConfig()) {
      transporter.sendMail({
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
      }).catch((error) => {
        console.error('Failed to send contact notification email:', error.message);
      });
    } else {
      console.warn('Skipping contact notification email: SMTP configuration is incomplete.');
    }

    return res.status(201).json(
      new ApiResponse(201, 'Contact submitted successfully', contact)
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = {
  createContact,
};
