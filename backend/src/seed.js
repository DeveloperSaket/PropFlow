import { db, initSchema } from './db.js';
import { ensureAdmin } from './bootstrap.js';
import { hashPassword } from './utils/auth.js';
initSchema();
ensureAdmin();
console.log('[seed] seeding demo data...');
const upsertUser = db.prepare(`
  INSERT INTO users (role, name, email, password_hash, phone, kyc_status, terms_accepted_at)
  VALUES (@role, @name, @email, @password_hash, @phone, @kyc_status, datetime('now'))
  ON CONFLICT(email) DO UPDATE SET name=excluded.name
`);
function user(role, name, email, phone, kyc = 'verified') {
  upsertUser.run({
    role, name, email, phone,
    password_hash: hashPassword('Password@123'),
    kyc_status: kyc,
  });
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}
const seller1 = user('seller', 'Ravi Estates', 'ravi@seller.test', '9000000001');
const seller2 = user('seller', 'Metro Homes', 'metro@seller.test', '9000000002');
const buyer1 = user('buyer', 'Anita Buyer', 'anita@buyer.test', '9111111111');
user('buyer', 'Unverified Bob', 'bob@buyer.test', '9222222222', 'unverified');
const insertProp = db.prepare(`
  INSERT INTO properties
    (seller_id, title, description, property_type, listing_type, price, area_sqft,
     bedrooms, bathrooms, address, city, state, pincode, status, featured)
  VALUES
    (@seller_id, @title, @description, @property_type, @listing_type, @price, @area_sqft,
     @bedrooms, @bathrooms, @address, @city, @state, @pincode, @status, @featured)
`);
const insertImg = db.prepare('INSERT INTO property_images (property_id, url) VALUES (?, ?)');
// Clear demo properties to keep seed idempotent-ish
db.prepare("DELETE FROM properties WHERE title LIKE '[DEMO]%'").run();
const demo = [
  {
    seller_id: seller1.id, title: '[DEMO] 3BHK Lake View Apartment',
    description: 'Spacious 3BHK with lake view, modular kitchen, covered parking.',
    property_type: 'apartment', listing_type: 'sale', price: 9500000, area_sqft: 1450,
    bedrooms: 3, bathrooms: 3, address: '12 Lakeside Rd', city: 'Bengaluru',
    state: 'Karnataka', pincode: '560037', status: 'approved', featured: 1,
    img: 'https://picsum.photos/seed/prop1/800/500',
  },
  {
    seller_id: seller1.id, title: '[DEMO] Independent Villa with Garden',
    description: 'Luxury 4BHK villa, private garden, solar panels, gated community.',
    property_type: 'villa', listing_type: 'sale', price: 21500000, area_sqft: 3200,
    bedrooms: 4, bathrooms: 5, address: '9 Palm Grove', city: 'Pune',
    state: 'Maharashtra', pincode: '411045', status: 'approved', featured: 0,
    img: 'https://picsum.photos/seed/prop2/800/500',
  },
  {
    seller_id: seller2.id, title: '[DEMO] 2BHK Rental Near Metro',
    description: 'Well-maintained 2BHK, 5 min walk to metro, semi-furnished.',
    property_type: 'apartment', listing_type: 'rent', price: 28000, area_sqft: 980,
    bedrooms: 2, bathrooms: 2, address: '44 Station Rd', city: 'Hyderabad',
    state: 'Telangana', pincode: '500081', status: 'approved', featured: 0,
    img: 'https://picsum.photos/seed/prop3/800/500',
  },
  {
    seller_id: seller2.id, title: '[DEMO] Commercial Office Space',
    description: 'Grade-A office, 2500 sqft, 10 parking slots, 24x7 security.',
    property_type: 'commercial', listing_type: 'rent', price: 185000, area_sqft: 2500,
    bedrooms: null, bathrooms: 2, address: 'Tower B, Tech Park', city: 'Gurugram',
    state: 'Haryana', pincode: '122002', status: 'pending', featured: 0,
    img: 'https://picsum.photos/seed/prop4/800/500',
  },
  {
    seller_id: seller1.id, title: '[DEMO] Residential Plot',
    description: 'Corner plot, clear title, east-facing, ready to build.',
    property_type: 'plot', listing_type: 'sale', price: 6200000, area_sqft: 2400,
    bedrooms: null, bathrooms: null, address: 'Sector 5', city: 'Jaipur',
    state: 'Rajasthan', pincode: '302020', status: 'pending', featured: 0,
    img: 'https://picsum.photos/seed/prop5/800/500',
  },
];
for (const d of demo) {
  const { img, ...row } = d;
  const info = insertProp.run(row);
  insertImg.run(info.lastInsertRowid, img);
}
// A sample interest + appointment from Anita
const firstApproved = db.prepare("SELECT id, seller_id FROM properties WHERE status='approved' LIMIT 1").get();
db.prepare(
  'INSERT OR IGNORE INTO interests (property_id, buyer_id, message) VALUES (?, ?, ?)'
).run(firstApproved.id, buyer1.id, 'Is the price negotiable? Interested in a site visit.');
db.prepare(
  `INSERT INTO appointments (property_id, buyer_id, seller_id, scheduled_at, notes, status)
   VALUES (?, ?, ?, ?, ?, 'requested')`
).run(firstApproved.id, buyer1.id, firstApproved.seller_id,
  new Date(Date.now() + 3 * 864e5).toISOString(), 'Weekend visit preferred');
console.log('[seed] done.');
console.log('  admin : admin@propflow.test / Admin@12345');
console.log('  seller: ravi@seller.test / Password@123');
console.log('  buyer : anita@buyer.test / Password@123');
process.exit(0);