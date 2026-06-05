const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const config = require('../../config');
const {
  generateAccessToken,
  generateRefreshTokenString,
} = require('../../utils/jwt');
const { hashPassword, comparePassword } = require('../../utils/password');
const {
  findUserByEmail,
  findUserByProviderAccount,
  findUserById,
  findUserByIdWithContacts,
  createUser,
  updateUser,
  createRefreshToken,
  findActiveRefreshTokenByUserId,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  updateUserActiveStatus,
  findAdminsByRole,
  findAllUsers,
} = require('./helper');

const AUTH_PROVIDER = {
  CREDENTIALS: 'CREDENTIALS',
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
};

const normalizedUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

const buildAuthResponse = async (user) => {
  const safeUser = normalizedUser(user);

  const refreshTokenString = generateRefreshTokenString();
  await createRefreshToken({
    userId: safeUser.id,
    token: refreshTokenString,
    expiresAt: new Date(Date.now() + config.jwtRefreshExpiresInDays * 24 * 60 * 60 * 1000),
  });

  return {
    user: safeUser,
    accessToken: generateAccessToken({ id: safeUser.id, email: safeUser.email, role: safeUser.role }),
  };
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const mapProvider = (provider) => {
  const normalizedProvider = provider.trim().toLowerCase();

  if (normalizedProvider === 'google') return AUTH_PROVIDER.GOOGLE;
  if (
    normalizedProvider === 'microsoft' ||
    normalizedProvider === 'azure-ad'
  ) {
    return AUTH_PROVIDER.MICROSOFT;
  }

  throw new ApiError(400, 'Unsupported OAuth provider');
};

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new ApiError(409, 'Email already exists');
    }

    const hashedPassword = await hashPassword(password);
    
    // Check if email domain is maildrop.cc to assign ADMIN role
    const emailDomain = normalizedEmail.split('@')[1];
    const role = emailDomain === 'maildrop.cc' ? 'ADMIN' : 'USER';
    const isActive = role === 'ADMIN' ? false : true; // Admin accounts are inactive by default
    
    const user = await createUser({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      image: null,
      role,
      isActive,
      authProvider: AUTH_PROVIDER.CREDENTIALS,
      providerAccountId: null,
    });

    if (!user.isActive) {
      return res.status(201).json(new ApiResponse(201, 'Signup successful. Your account is pending activation by a Super Admin.', null));
    }

    const result = await buildAuthResponse(user);
    return res.status(201).json(new ApiResponse(201, 'Signup successful', result));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(normalizedEmail);

    if (!user || !user.password) {
      throw new ApiError(401, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
    }

    const passwordMatches = await comparePassword(password, user.password);

    if (!passwordMatches) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const result = await buildAuthResponse(user);
    return res.status(200).json(new ApiResponse(200, 'Login successful', result));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const logout = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      throw new ApiError(401, 'Unauthorized');
    }

    await revokeAllRefreshTokensForUser(req.user.id);

    return res.status(200).json(new ApiResponse(200, 'Logout successful', null));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const refresh = async (req, res) => {
  try {
    const internalSecret = req.headers['x-internal-secret'];

    if (!config.internalAuthSecret || internalSecret !== config.internalAuthSecret) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { userId } = req.body;

    if (!userId) {
      throw new ApiError(400, 'userId is required');
    }

    const activeToken = await findActiveRefreshTokenByUserId(userId);

    if (!activeToken) {
      throw new ApiError(401, 'No active session found');
    }

    const user = await findUserById(userId);
    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    if (!user.isActive) {
      await revokeAllRefreshTokensForUser(userId);
      throw new ApiError(403, 'Your account has been deactivated.');
    }

    await revokeRefreshToken(activeToken.token);
    const result = await buildAuthResponse(user);

    return res.status(200).json(new ApiResponse(200, 'Token refreshed', result));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const oauth = async (req, res) => {
  try {
    const internalSecret = req.headers['x-internal-secret'];

    if (!config.internalAuthSecret || internalSecret !== config.internalAuthSecret) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { provider, providerAccountId, email, name, image } = req.body;
    const authProvider = mapProvider(provider);
    const normalizedEmail = normalizeEmail(email);

    const existingByProvider = await findUserByProviderAccount(authProvider, providerAccountId);

    if (existingByProvider) {
      if (!existingByProvider.isActive) {
        throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
      }
      const updatedUser = await updateUser(existingByProvider.id, {
        email: normalizedEmail,
        name: name?.trim() || existingByProvider.name,
        image: image ?? existingByProvider.image,
        authProvider,
        providerAccountId,
      });

      const result = await buildAuthResponse(updatedUser);
      return res.status(200).json(new ApiResponse(200, 'OAuth login successful', result));
    }

    const existingByEmail = await findUserByEmail(normalizedEmail);

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
      }
      const updatedUser = await updateUser(existingByEmail.id, {
        name: name?.trim() || existingByEmail.name,
        image: image ?? existingByEmail.image,
        authProvider,
        providerAccountId,
      });

      const result = await buildAuthResponse(updatedUser);
      return res.status(200).json(new ApiResponse(200, 'OAuth login successful', result));
    }

    const createdUser = await createUser({
      name: name?.trim() || null,
      email: normalizedEmail,
      password: null,
      image: image ?? null,
      role: 'USER',
      authProvider,
      providerAccountId,
    });

    const result = await buildAuthResponse(createdUser);
    return res.status(200).json(new ApiResponse(200, 'OAuth login successful', result));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const me = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const user = await findUserByIdWithContacts(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const { contacts, ...userWithoutContacts } = user;

    return res.status(200).json(
      new ApiResponse(200, 'Current user fetched successfully', {
        user: normalizedUser(userWithoutContacts),
        contacts,
      })
    );
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const activateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    // Only SUPER_ADMIN can activate admins
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only Super Admin can activate admins');
    }

    const admin = await findUserById(adminId);

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      throw new ApiError(400, 'User is not an admin');
    }

    const updatedAdmin = await updateUserActiveStatus(adminId, true);

    return res.status(200).json(new ApiResponse(200, 'Admin activated successfully', normalizedUser(updatedAdmin)));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const deactivateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    // Only SUPER_ADMIN can deactivate admins
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only Super Admin can deactivate admins');
    }

    const admin = await findUserById(adminId);

    if (!admin) {
      throw new ApiError(404, 'Admin not found');
    }

    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      throw new ApiError(400, 'User is not an admin');
    }

    // Prevent deactivating the requesting super admin
    if (adminId === req.user.id) {
      throw new ApiError(400, 'You cannot deactivate your own account');
    }

    const updatedAdmin = await updateUserActiveStatus(adminId, false);
    
    // Revoke all refresh tokens for the deactivated admin
    await revokeAllRefreshTokensForUser(adminId);

    return res.status(200).json(new ApiResponse(200, 'Admin deactivated successfully', normalizedUser(updatedAdmin)));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const listAdmins = async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only Super Admin can list admins');
    }

    const admins = await findAdminsByRole('ADMIN');
    const normalizedAdmins = admins.map(admin => normalizedUser(admin));

    return res.status(200).json(new ApiResponse(200, 'Admins fetched successfully', normalizedAdmins));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const listUsers = async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const users = await findAllUsers(isSuperAdmin);
    return res.status(200).json(new ApiResponse(200, 'Users fetched successfully', users.map(normalizedUser)));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const toggleUserActive = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new ApiError(400, 'isActive must be a boolean');
    }

    // Prevent self-deactivation
    if (userId === req.user.id && !isActive) {
      throw new ApiError(400, 'You cannot deactivate your own account');
    }

    const target = await findUserById(userId);
    if (!target) throw new ApiError(404, 'User not found');

    // Only SUPER_ADMIN can toggle ADMIN or SUPER_ADMIN accounts
    if ((target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') && req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only Super Admin can activate or deactivate admin accounts');
    }

    const updated = await updateUserActiveStatus(userId, isActive);
    if (!updated) throw new ApiError(404, 'User not found');

    if (!isActive) await revokeAllRefreshTokensForUser(userId);

    return res.status(200).json(new ApiResponse(200, `User ${isActive ? 'activated' : 'deactivated'} successfully`, normalizedUser(updated)));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

module.exports = {
  signup,
  login,
  logout,
  refresh,
  oauth,
  me,
  activateAdmin,
  deactivateAdmin,
  listAdmins,
  listUsers,
  toggleUserActive,
};
