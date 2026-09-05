import { db } from './db.js';
import { config } from './config.js';
import { hashPassword } from './utils/auth.js';
// Ensure at least one admin account exists so the owner can log in.
export function ensureAdmin() {
    const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
    if (admin) return;
    db.prepare(
        `INSERT INTO users (role, name, email, password_hash, kyc_status, terms_accepted_at)
     VALUES ('admin', 'Platform Admin', ?, ?, 'verified', datetime('now'))`
    ).run(config.admin.email.toLowerCase(), hashPassword(config.admin.password));
    console.log(`[bootstrap] Created admin account: ${config.admin.email}`);
}
