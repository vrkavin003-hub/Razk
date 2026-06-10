const toPositiveInt = (value, fallback, max) => {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
};

const pagination = (query) => {
  const page = toPositiveInt(query.page, 1, 100000);
  const limit = toPositiveInt(query.limit, 20, 100);
  return {
    limit,
    offset: (page - 1) * limit,
    page
  };
};

const pagedResponse = (items, total, page, limit) => ({
  items,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  }
});

module.exports = {
  pagedResponse,
  pagination
};
