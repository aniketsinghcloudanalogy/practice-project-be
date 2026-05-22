const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const config = require('../../config');
const { generateAccessToken } = require('../../utils/jwt');
const { hashPassword, comparePassword } = require('../../utils/password');
const userModel = require('./user.model');

const AUTH_PROVIDER = {
  CREDENTIALS: 'CREDENTIALS',
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT'
};

const normalizedUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

const buildAuthResponse = (user) => {
  const safeUser = normalizedUser(user);

  return {
    user: safeUser,
    token: generateAccessToken({
      id: safeUser.id,
      email: safeUser.email,
      role: safeUser.role
    })
  };
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const mapProvider = (provider) => {
  const normalizedProvider = provider.trim().toLowerCase();

  if (normalizedProvider === 'google') return AUTH_PROVIDER.GOOGLE;
  if (normalizedProvider === 'microsoft' || normalizedProvider === 'microsoft-entra-id') return AUTH_PROVIDER.MICROSOFT;

  throw new ApiError(400, 'Unsupported OAuth provider');
};

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await userModel.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new ApiError(409, 'Email already exists');
    }

    const hashedPassword = await hashPassword(password);
    const user = await userModel.createUser({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      image: null,
      role: 'USER',
      authProvider: AUTH_PROVIDER.CREDENTIALS,
      providerAccountId: null
    });

    const result = buildAuthResponse(user);
    return res.status(201).json(new ApiResponse(201, 'Signup successful', result));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const user = await userModel.findUserByEmail(normalizedEmail);

    if (!user || !user.password) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const passwordMatches = await comparePassword(password, user.password);

    if (!passwordMatches) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const result = buildAuthResponse(user);
    return res.status(200).json(new ApiResponse(200, 'Login successful', result));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const logout = async (req, res) => {
  try {
    return res.status(200).json(new ApiResponse(200, 'Logout successful', null));
  } catch (err) {
    return res.status(500).json(new ApiResponse(500, 'Internal Server Error', null));
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

    const existingByProvider = await userModel.findUserByProviderAccount(authProvider, providerAccountId);

    if (existingByProvider) {
      const updatedUser = await userModel.updateUser(existingByProvider.id, {
        email: normalizedEmail,
        name: name?.trim() || existingByProvider.name,
        image: image ?? existingByProvider.image,
        authProvider,
        providerAccountId
      });

      const result = buildAuthResponse(updatedUser);
      return res.status(200).json(new ApiResponse(200, 'OAuth login successful', result));
    }

    const existingByEmail = await userModel.findUserByEmail(normalizedEmail);

    if (existingByEmail) {
      const updatedUser = await userModel.updateUser(existingByEmail.id, {
        name: name?.trim() || existingByEmail.name,
        image: image ?? existingByEmail.image,
        authProvider,
        providerAccountId
      });

      const result = buildAuthResponse(updatedUser);
      return res.status(200).json(new ApiResponse(200, 'OAuth login successful', result));
    }

    const createdUser = await userModel.createUser({
      name: name?.trim() || null,
      email: normalizedEmail,
      password: null,
      image: image ?? null,
      role: 'USER',
      authProvider,
      providerAccountId
    });

    const result = buildAuthResponse(createdUser);
    return res.status(200).json(new ApiResponse(200, 'OAuth login successful', result));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

const me = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const user = await userModel.findUserById(userId);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return res.status(200).json(new ApiResponse(200, 'Current user fetched successfully', { user: normalizedUser(user) }));
  } catch (err) {
    return res.status(err.status || 500).json(new ApiResponse(err.status || 500, err.message || 'Internal Server Error', null));
  }
};

module.exports = {
  signup,
  login,
  logout,
  oauth,
  me
};