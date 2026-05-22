const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const ApiError = require('./utils/ApiError');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors({
	origin: config.clientUrl || true,
	credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.env === 'development') {
	app.use(morgan('dev'));
}

app.use('/api', routes);

app.use((req, res, next) => {
	next(new ApiError(404, 'Route not found'));
});

app.use(errorHandler);

module.exports = app;
