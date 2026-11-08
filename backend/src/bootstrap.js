import { db, withTransaction } from './db.js';
import { config } from './config.js';
import { hashPassword } from './utils/auth.js';
// Ensure at least one admin account exists so the owner can log in.
export async function ensureAdmin() {
    const admin = await db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
    if (admin) return;
    if (!config.admin.email || !config.admin.password) {
        throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured before creating the first admin account');
    }
    if (
        process.env.NODE_ENV === 'production' &&
        (config.admin.email === 'admin@propflow.test' || config.admin.password === 'Admin@12345')
    ) {
        throw new Error('Replace the development admin credentials before creating the production admin account');
    }
    await withTransaction(async (tx) => {
        const info = await tx.prepare(
            `INSERT INTO users (role, name, email, password_hash, kyc_status, terms_accepted_at)
       VALUES ('admin', 'Platform Admin', ?, ?, 'verified', datetime('now'))`
        ).run(config.admin.email.toLowerCase(), hashPassword(config.admin.password));
        const ownerRole = await tx.prepare("SELECT id FROM roles WHERE role_key = 'owner'").get();
        if (!ownerRole) throw new Error('Owner role is missing from the PostgreSQL role catalog');
        await tx.prepare('INSERT INTO staff_profiles (user_id) VALUES (?)').run(info.lastInsertRowid);
        await tx.prepare(`
          INSERT INTO user_roles (user_id, role_id)
          VALUES (?, ?)
        `).run(info.lastInsertRowid, ownerRole.id);
    });
    console.log(`[bootstrap] Created admin account: ${config.admin.email}`);
}
