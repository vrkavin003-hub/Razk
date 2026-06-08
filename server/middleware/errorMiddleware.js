const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  const duplicateField = err.code === 11000 ? Object.keys(err.keyValue || {})[0] : null;

  res.status(statusCode).json({
    message: duplicateField ? `${duplicateField} already exists` : err.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
};

module.exports = { errorHandler, notFound };
