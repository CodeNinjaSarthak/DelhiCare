/**
 * paginate — generic cursor-free pagination for Mongoose models.
 *
 * @param {import('mongoose').Model} Model
 * @param {object} filter   — Mongoose query filter
 * @param {object} options
 *   @param {number}   options.page     — 1-based page number (default: 1)
 *   @param {number}   options.limit    — items per page (default: 20, max: 100)
 *   @param {object}   options.sort     — Mongoose sort spec (default: { createdAt: -1 })
 *   @param {string|object} options.populate — Mongoose populate spec (optional)
 *   @param {string}   options.select   — Mongoose field selection (optional)
 *
 * @returns {{ data, page, limit, total, totalPages }}
 */
export const paginate = async (Model, filter, options = {}) => {
    const page  = Math.max(1, parseInt(options.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const skip  = (page - 1) * limit;
    const sort  = options.sort || { createdAt: -1 };

    let q = Model.find(filter).sort(sort).skip(skip).limit(limit);
    if (options.populate) q = q.populate(options.populate);
    if (options.select)   q = q.select(options.select);

    const [data, total] = await Promise.all([q, Model.countDocuments(filter)]);
    return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
};
