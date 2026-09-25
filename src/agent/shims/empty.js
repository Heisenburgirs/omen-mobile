// A module that exports nothing, for server-only dependencies that Ryvo's
// payment-channel package imports but the app never calls (its PostgreSQL
// ledger). Metro maps them here on native; see metro.config.js.
module.exports = {};
