import { db, initSchema } from './db.js';
import { ensureAdmin } from './bootstrap.js';
import { hashPassword } from './utils/auth.js';
initSchema();
ensureAdmin();
console.log('[seed] seeding demo data...');
const upsertUser = db.prepare(`
  INSERT INTO users (role, name, email, password_hash, phone, is_agent, kyc_status, terms_accepted_at)
  VALUES (@role, @name, @email, @password_hash, @phone, @is_agent, @kyc_status, datetime('now'))
  ON CONFLICT(email) DO UPDATE SET role=excluded.role, name=excluded.name,
    phone=excluded.phone, is_agent=excluded.is_agent
`);
function user(role, name, email, phone, kyc = 'verified', isAgent = false) {
  upsertUser.run({
    role, name, email, phone,
    password_hash: hashPassword('Password@123'),
    kyc_status: kyc,
    is_agent: isAgent ? 1 : 0,
  });
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}
const seller1 = user('member', 'Maple Key Realty', 'agent@maplekey.test', '+1-416-555-0142', 'verified', true);
const seller2 = user('member', 'Jordan Ellis', 'jordan@homeseller.test', '+1-604-555-0176');
const buyer1 = user('member', 'Olivia Martin', 'olivia@buyer.test', '+1-613-555-0108');
user('member', 'Unverified Noah Chen', 'noah@buyer.test', '+1-780-555-0164', 'unverified');
const insertProp = db.prepare(`
  INSERT INTO properties
    (seller_id, title, description, property_type, listing_type, price, area_sqft,
     bedrooms, bathrooms, address, city, state, country, pincode, status, featured)
  VALUES
    (@seller_id, @title, @description, @property_type, @listing_type, @price, @area_sqft,
     @bedrooms, @bathrooms, @address, @city, @state, @country, @pincode, @status, @featured)
`);
const insertImg = db.prepare('INSERT INTO property_images (property_id, url) VALUES (?, ?)');
// Clear demo properties to keep seed idempotent-ish
db.prepare("DELETE FROM properties WHERE title LIKE '[DEMO]%'").run();
const demo = [
  {
    seller_id: seller1.id, title: '[DEMO] Detached Home Near Lake Ontario',
    description: 'Bright three-bedroom home with a renovated kitchen, deck, and attached garage.',
    property_type: 'detached', listing_type: 'sale', price: 1249000, area_sqft: 1850,
    bedrooms: 3, bathrooms: 3, address: '12 Lakeshore Avenue', city: 'Toronto',
    state: 'Ontario', country: 'Canada', pincode: 'M5V 2T6', status: 'approved', featured: 1,
    img: 'https://picsum.photos/seed/prop1/800/500',
  },
  {
    seller_id: seller1.id, title: '[DEMO] Semi-Detached Home in Montreal',
    description: 'Well-kept three-bedroom home with a finished basement and private garden.',
    property_type: 'semi_detached', listing_type: 'sale', price: 799000, area_sqft: 1700,
    bedrooms: 3, bathrooms: 2, address: '44 Cedarvale Avenue', city: 'Montreal',
    state: 'Quebec', country: 'Canada', pincode: 'H2Y 1C6', status: 'approved', featured: 0,
    img: 'https://picsum.photos/seed/prop2/800/500',
  },
  {
    seller_id: seller2.id, title: '[DEMO] Freehold Townhouse in Calgary',
    description: 'Three-bedroom townhouse with a finished basement, balcony, and two parking spaces.',
    property_type: 'freehold_townhouse', listing_type: 'sale', price: 625000, area_sqft: 1800,
    bedrooms: 3, bathrooms: 3, address: '88 Aspen Ridge Crescent', city: 'Calgary',
    state: 'Alberta', country: 'Canada', pincode: 'T2P 1J9', status: 'approved', featured: 0,
    img: 'https://picsum.photos/seed/prop3/800/500',
  },
  {
    seller_id: seller2.id, title: '[DEMO] Condo Townhouse Near Downtown Ottawa',
    description: 'Low-maintenance three-bedroom home with shared amenities and transit nearby.',
    property_type: 'condo_townhouse', listing_type: 'sale', price: 589000, area_sqft: 1420,
    bedrooms: 3, bathrooms: 2, address: '16 Wellington Street', city: 'Ottawa',
    state: 'Ontario', country: 'Canada', pincode: 'K1Y 2C7', status: 'approved', featured: 0,
    img: 'https://picsum.photos/seed/prop4/800/500',
  },
  {
    seller_id: seller2.id, title: '[DEMO] Condo Apartment Steps from Vancouver Seawall',
    description: 'Two-bedroom condo with in-suite laundry, balcony, and secure underground parking.',
    property_type: 'condo_apt', listing_type: 'rent', price: 2850, area_sqft: 850,
    bedrooms: 2, bathrooms: 2, address: '520 Pacific Boulevard', city: 'Vancouver',
    state: 'British Columbia', country: 'Canada', pincode: 'V6B 1A1', status: 'approved', featured: 0,
    img: 'https://picsum.photos/seed/prop5/800/500',
  },
  {
    seller_id: seller1.id, title: '[DEMO] Link Home in Markham',
    description: 'Three-bedroom link home with a finished lower level and a fenced backyard.',
    property_type: 'link', listing_type: 'sale', price: 998000, area_sqft: 1800,
    bedrooms: 3, bathrooms: 3, address: '27 Willow Heights Boulevard', city: 'Markham',
    state: 'Ontario', country: 'Canada', pincode: 'L3R 4G5', status: 'pending', featured: 0,
    img: 'https://picsum.photos/seed/prop6/800/500',
  },
  {
    seller_id: seller1.id, title: '[DEMO] Vacant Residential Lot in Kelowna',
    description: 'Serviced residential lot in an established neighbourhood, ready for your plans.',
    property_type: 'vacant_land', listing_type: 'sale', price: 475000, area_sqft: 5200,
    bedrooms: null, bathrooms: null, address: '740 Glenmore Road', city: 'Kelowna',
    state: 'British Columbia', country: 'Canada', pincode: 'V1Y 6H2', status: 'pending', featured: 0,
    img: 'https://picsum.photos/seed/prop7/800/500',
  },
  {
    seller_id: seller2.id, title: '[DEMO] Mixed-Use Commercial Space in Halifax',
    description: 'Flexible street-level commercial space with office area and customer parking nearby.',
    property_type: 'other', listing_type: 'rent', price: 4200, area_sqft: 2500,
    bedrooms: null, bathrooms: 2, address: '105 Barrington Street', city: 'Halifax',
    state: 'Nova Scotia', country: 'Canada', pincode: 'B3J 1S9', status: 'pending', featured: 0,
    img: 'https://picsum.photos/seed/prop8/800/500',
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
console.log('  seller: agent@maplekey.test / Password@123');
console.log('  buyer : olivia@buyer.test / Password@123');
process.exit(0);