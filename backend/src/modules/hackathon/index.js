const hackathonRoutes = require('./routes/hackathonRoutes');
const HackathonApp = require('./models/HackathonApp');
const hackathonController = require('./controllers/hackathonController');

/**
 * Hackathon Module Wrapper
 * 
 * Bu modül hackathon süresince kullanılır.
 * Hackathon bittiğinde .env dosyasından `ENABLE_HACKATHON_MODULE=false` yapılarak
 * veya `src/modules/hackathon` klasörü silinerek tamamen devre dışı bırakılabilir.
 */
const isEnabled = () => {
  return process.env.ENABLE_HACKATHON_MODULE !== 'false';
};

module.exports = {
  routes: hackathonRoutes,
  model: HackathonApp,
  controller: hackathonController,
  isEnabled
};
