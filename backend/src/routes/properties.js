import { Router } from 'express';
import { db } from '../db.js';
import {
  authenticate,
  optionalAuth,
  requireRole,
  requireKyc,
} from '../middleware/auth.js';
import { required, oneOf, toNumber, HttpError } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
const router = Router();
const PROPERTY_TYPES = ['apartment', 'house', 'plot', 'commercial', 'villa'];
const LISTING_TYPES = ['sale', 'rent'];
const insertProperty = db.prepare(`
  INSERT INTO properties
    (seller_id, title, description, property_type, listing_type, price, area_sqft,
     bedrooms, bathrooms, address, city, state, country, pincode, status)
  VALUES
    (@seller_id, @title, @description, @property_type, @listing_type, @price, @area_sqft,
     @bedrooms, @bathrooms, @address, @city, @state, @country, @pincode, @status)
`);
const insertImage = db.prepare(
  'INSERT INTO property_images (property_id, url) VALUES (?, ?)'
);
const getPropertyRow = db.prepare(`
  SELECT p.*, u.name AS seller_name, u.email AS seller_email, u.phone AS seller_phone,
         u.kyc_status AS seller_kyc
  FROM properties p JOIN users u ON u.id = p.seller_id
  WHERE p.id = ?
`);
const getImages = db.prepare(
  'SELECT url FROM property_images WHERE property_id = ?'
);
const countInterests = db.prepare(
  'SELECT COUNT(*) AS c FROM interests WHERE property_id = ?'
);
function hydrate(row) {
  if (!row) return null;
  const images = getImages.all(row.id).map((r) => r.url);
  const interest_count = countInterests.get(row.id).c;
  return { ...row, images, interest_count };
}
// GET /api/properties  — public search with filters
// Query: q, type, listing, city, state, minPrice, maxPrice, bedrooms,
//        sort (price_asc|price_desc|newest), page, limit, status (admin/seller only)
router.get('/', optionalAuth, (req, res) => {
  const {
    q,
    type,
    listing,
    city,
    state,
    minPrice,
    maxPrice,
    bedrooms,
    sort = 'newest',
    page = 1,
    limit = 12,
    mine,
  } = req.query;
  const where = [];
  const params = {};
  // Visibility: public sees only approved. Sellers can see their own (mine=1).
  // Admins can pass status=any.
  if (mine === '1' && req.user) {
    where.push('p.seller_id = @seller_id');
    params.seller_id = req.user.id;
    if (req.query.status) {
      oneOf(req.query.status, ['draft', 'pending', 'approved', 'rejected', 'sold'], 'status');
      where.push('p.status = @status');
      params.status = req.query.status;
    }
  } else if (req.user && req.user.role === 'admin' && req.query.status) {
    oneOf(req.query.status, ['draft', 'pending', 'approved', 'rejected', 'sold'], 'status');
    where.push('p.status = @status');
    params.status = req.query.status;
  } else {
    where.push("p.status = 'approved'");
  }
  if (q) {
    where.push('(p.title LIKE @q OR p.description LIKE @q OR p.address LIKE @q)');
    params.q = `%${q}%`;
  }
  if (type) {
    oneOf(type, PROPERTY_TYPES, 'type');
    where.push('p.property_type = @type');
    params.type = type;
  }
  if (listing) {
    oneOf(listing, LISTING_TYPES, 'listing');
    where.push('p.listing_type = @listing');
    params.listing = listing;
  }
  if (city) {
    where.push('p.city LIKE @city');
    params.city = `%${city}%`;
  }
  if (state) {
    where.push('p.state LIKE @state');
    params.state = `%${state}%`;
  }
  const min = toNumber(minPrice);
  const max = toNumber(maxPrice);
  if (min !== undefined) {
    where.push('p.price >= @minPrice');
    params.minPrice = min;
  }
  if (max !== undefined) {
    where.push('p.price <= @maxPrice');
    params.maxPrice = max;
  }
  const beds = toNumber(bedrooms);
  if (beds !== undefined) {
    where.push('p.bedrooms >= @bedrooms');
    params.bedrooms = beds;
  }
  const orderBy =
    {
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
      newest: 'p.created_at DESC',
    }[sort] || 'p.created_at DESC';
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM properties p ${whereSql}`)
    .get(params).c;
  const pageNum = Math.max(1, toNumber(page, 1));
  const pageSize = Math.min(50, Math.max(1, toNumber(limit, 12)));
  params.limit = pageSize;
  params.offset = (pageNum - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT p.*, u.name AS seller_name
       FROM properties p JOIN users u ON u.id = p.seller_id
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT @limit OFFSET @offset`
    )
    .all(params);
  res.json({
    data: rows.map(hydrate),
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    },
  });
});
// GET /api/properties/:id
router.get('/:id', optionalAuth, (req, res) => {
  const row = getPropertyRow.get(req.params.id);
  if (!row) throw new HttpError(404, 'Property not found');
  const isOwner = req.user && req.user.id === row.seller_id;
  const isAdmin = req.user && req.user.role === 'admin';
  if (row.status !== 'approved' && !isOwner && !isAdmin) {
    throw new HttpError(404, 'Property not found');
  }
  // increment views for public (non-owner) visits
  if (!isOwner) {
    db.prepare('UPDATE properties SET views = views + 1 WHERE id = ?').run(row.id);
  }
  res.json({ data: hydrate(getPropertyRow.get(req.params.id)) });
});
// POST /api/properties — seller creates a listing (requires KYC)
router.post('/', authenticate, requireRole('seller'), requireKyc, (req, res) => {
  const b = req.body;
  required(b, ['title', 'property_type', 'listing_type', 'price']);
  oneOf(b.property_type, PROPERTY_TYPES, 'property_type');
  oneOf(b.listing_type, LISTING_TYPES, 'listing_type');
  const price = toNumber(b.price);
  if (price === undefined || price <= 0)
    throw new HttpError(400, 'Price must be a positive number');
  // New listings start in "pending" for admin compliance review
  const status = b.saveDraft ? 'draft' : 'pending';
  const info = insertProperty.run({
    seller_id: req.user.id,
    title: b.title,
    description: b.description || null,
    property_type: b.property_type,
    listing_type: b.listing_type,
    price,
    area_sqft: toNumber(b.area_sqft, null),
    bedrooms: toNumber(b.bedrooms, null),
    bathrooms: toNumber(b.bathrooms, null),
    address: b.address || null,
    city: b.city || null,
    state: b.state || null,
    country: b.country || 'India',
    pincode: b.pincode || null,
    status,
  });
  const id = info.lastInsertRowid;
  if (Array.isArray(b.images)) {
    for (const url of b.images.slice(0, 12)) {
      if (typeof url === 'string' && url.trim()) insertImage.run(id, url.trim());
    }
  }
  audit({
    actorId: req.user.id,
    action: 'property.create',
    entity: 'property',
    entityId: id,
    meta: { status },
    ip: req.ip,
  });
  res.status(201).json({ data: hydrate(getPropertyRow.get(id)) });
});
// PUT /api/properties/:id — owner updates (re-enters pending review)
router.put('/:id', authenticate, requireRole('seller', 'admin'), (req, res) => {
  const row = getPropertyRow.get(req.params.id);
  if (!row) throw new HttpError(404, 'Property not found');
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && row.seller_id !== req.user.id)
    throw new HttpError(403, 'You can only edit your own listings');
  const b = req.body;
  if (b.property_type) oneOf(b.property_type, PROPERTY_TYPES, 'property_type');
  if (b.listing_type) oneOf(b.listing_type, LISTING_TYPES, 'listing_type');
  const fields = {
    title: b.title ?? row.title,
    description: b.description ?? row.description,
    property_type: b.property_type ?? row.property_type,
    listing_type: b.listing_type ?? row.listing_type,
    price: toNumber(b.price, row.price),
    area_sqft: toNumber(b.area_sqft, row.area_sqft),
    bedrooms: toNumber(b.bedrooms, row.bedrooms),
    bathrooms: toNumber(b.bathrooms, row.bathrooms),
    address: b.address ?? row.address,
    city: b.city ?? row.city,
    state: b.state ?? row.state,
    country: b.country ?? row.country,
    pincode: b.pincode ?? row.pincode,
  };
  // A seller editing an approved/rejected listing sends it back to review.
  let status = row.status;
  if (!isAdmin && ['approved', 'rejected'].includes(row.status)) {
    status = 'pending';
  }
  if (isAdmin && b.status) {
    oneOf(b.status, ['draft', 'pending', 'approved', 'rejected', 'sold'], 'status');
    status = b.status;
  }
  db.prepare(
    `UPDATE properties SET
       title=@title, description=@description, property_type=@property_type,
       listing_type=@listing_type, price=@price, area_sqft=@area_sqft,
       bedrooms=@bedrooms, bathrooms=@bathrooms, address=@address, city=@city,
       state=@state, country=@country, pincode=@pincode, status=@status,
       updated_at=datetime('now')
     WHERE id=@id`
  ).run({ ...fields, status, id: row.id });
  if (Array.isArray(b.images)) {
    db.prepare('DELETE FROM property_images WHERE property_id = ?').run(row.id);
    for (const url of b.images.slice(0, 12)) {
      if (typeof url === 'string' && url.trim()) insertImage.run(row.id, url.trim());
    }
  }
  audit({
    actorId: req.user.id,
    action: 'property.update',
    entity: 'property',
    entityId: row.id,
    meta: { status },
    ip: req.ip,
  });
  res.json({ data: hydrate(getPropertyRow.get(row.id)) });
});
// PATCH /api/properties/:id/sold — owner marks as sold
router.patch('/:id/sold', authenticate, requireRole('seller', 'admin'), (req, res) => {
  const row = getPropertyRow.get(req.params.id);
  if (!row) throw new HttpError(404, 'Property not found');
  if (req.user.role !== 'admin' && row.seller_id !== req.user.id)
    throw new HttpError(403, 'Not your listing');
  db.prepare("UPDATE properties SET status='sold', updated_at=datetime('now') WHERE id=?").run(
    row.id
  );
  audit({ actorId: req.user.id, action: 'property.sold', entity: 'property', entityId: row.id, ip: req.ip });
  res.json({ data: hydrate(getPropertyRow.get(row.id)) });
});
// DELETE /api/properties/:id
router.delete('/:id', authenticate, requireRole('seller', 'admin'), (req, res) => {
  const row = getPropertyRow.get(req.params.id);
  if (!row) throw new HttpError(404, 'Property not found');
  if (req.user.role !== 'admin' && row.seller_id !== req.user.id)
    throw new HttpError(403, 'Not your listing');
  db.prepare('DELETE FROM properties WHERE id = ?').run(row.id);
  audit({ actorId: req.user.id, action: 'property.delete', entity: 'property', entityId: row.id, ip: req.ip });
  res.json({ ok: true });
});
export default router;