require('dotenv').config();

const app = require('./app');
const config = require('./config');

const PORT = config.port || process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
