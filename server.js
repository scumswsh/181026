require('dotenv').config();
const express = require('express');
const webhookRoutes = require('./src/routes/webhookRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');

const app = express();
const port = process.env.PORT || 3001;

// Special handling for Stripe webhooks - must be before express.json() middleware
// to preserve raw body for signature verification
app.use('/payment/webhook/stripe', express.raw({type: 'application/json'}));

// For all other routes, parse JSON
app.use(express.json());

app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// Use the webhook routes
app.use('/webhooks', webhookRoutes);

// Use payment routes
app.use('/payment', paymentRoutes);

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.use((req, res, next) => {
  console.log(`No route found for ${req.method} ${req.url}`);
  next();
});

app.use((req, res) => {
  console.log(`Unhandled request: ${req.method} ${req.url}`);
  res.status(404).send('Not Found');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});