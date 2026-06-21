const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./db/database');

const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const cartRoutes = require('./routes/cart');
const sortingRoutes = require('./routes/sorting');
const deliveryRoutes = require('./routes/delivery');
const afterSaleRoutes = require('./routes/aftersale');
const statsRoutes = require('./routes/stats');
const pickupPointRoutes = require('./routes/pickupPoints');
const deliveryStaffRoutes = require('./routes/deliveryStaff');
const supplierRoutes = require('./routes/suppliers');

const app = express();
const PORT = process.env.PORT || 8508;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/sorting', sortingRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/aftersale', afterSaleRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/pickup-points', pickupPointRoutes);
app.use('/api/delivery-staff', deliveryStaffRoutes);
app.use('/api/suppliers', supplierRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '社区团购系统运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`后端服务器运行在 http://localhost:${PORT}`);
  });
}

module.exports = { app, db };
