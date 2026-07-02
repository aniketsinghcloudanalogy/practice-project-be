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
        // Ignore invalid tokens and continue as anonymous.
      }
    }

    const contact = await contactusModel.createContact(req.body);

    if (hasContactMailConfig()) {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
      const safeMessage = String(contact.message || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br />');

      try {
        await transporter.sendMail({
          from: config.smtp.user,
          to: config.smtp.to,
          replyTo: contact.email,
          subject: `New Contact Request - ${contact.subject}`,
          html: `
            <h2>New Contact Request</h2>
            <p><strong>Name:</strong> ${fullName || 'Anonymous'}</p>
            <p><strong>Email:</strong> ${contact.email}</p>
            <p><strong>Phone:</strong> ${contact.primaryContact}</p>
            <p><strong>Secondary Phone:</strong> ${contact.secondaryContact || 'N/A'}</p>
            <p><strong>Subject:</strong> ${contact.subject}</p>
            <p><strong>Message:</strong></p>
            <p>${safeMessage}</p>
          `,
        });
      } catch (error) {
        console.error('Failed to send contact notification email:', error.message);
      }
    } else {
      console.warn('Skipping contact notification email: SMTP configuration is incomplete.');
    }

    return res.status(201).json(
      new ApiResponse(
        201,
        'Message submitted successfully',
        contact
      )
    );
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    return res.status(status).json(new ApiResponse(status, error.message || 'Internal Server Error', null));
  }
};

module.exports = {
  createContact,
};
