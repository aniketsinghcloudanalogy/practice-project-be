const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const { findUserById } = require('../routes/user/helper');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Unauthorized'));
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return next(new ApiError(401, 'Unauthorized'));
  }

  try {
    const tokenUser = verifyAccessToken(token);

    if (!tokenUser || !tokenUser.id) {
      return next(new ApiError(401, 'Unauthorized'));
    }

    const user = await findUserById(tokenUser.id);

    if (!user) {
      return next(new ApiError(401, 'User not found'));
    }

    if (!user.isActive) {
      return next(new ApiError(403, 'Your account is not active'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      image: user.image,
      authProvider: user.authProvider,
      providerAccountId: user.providerAccountId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid token'));
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden'));
  }
  return next();
};

module.exports = {
  protect,
  authorize,
};
