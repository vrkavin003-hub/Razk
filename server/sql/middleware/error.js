const sqlErrorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const payload = {
    message: statusCode === 500 ? "Internal server error" : error.message
  };

  if (error.details && process.env.NODE_ENV !== "production") payload.details = error.details;
  if (process.env.NODE_ENV !== "production" && statusCode === 500) payload.error = error.message;

  res.status(statusCode).json(payload);
};

module.exports = sqlErrorHandler;
