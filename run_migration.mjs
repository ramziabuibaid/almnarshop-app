import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres',
    });

    try {
        await client.connect();
        const sql = fs.readFileSync(path.join(process.cwd(), 'migrations/add_legacy_fields_to_promissory_notes.sql'), 'utf8');
        await client.query(sql);
        console.log('Migration executed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.end();
    }
}

runMigration();
