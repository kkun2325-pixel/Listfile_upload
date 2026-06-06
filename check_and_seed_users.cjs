/**
 * ユーザーアカウント作成スクリプト
 * 実行: cd csv-upload-app && node check_and_seed_users.cjs
 */
const { Pool } = require('pg')
const bcrypt   = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

const DB_URL = 'postgresql://listfile_user:ysZbkL3aHmCgSIpQYQG5aw@skiing-burro-16418.jxf.gcp-asia-southeast1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
const pool = new Pool({ connectionString: DB_URL, max: 3 })

async function main() {
  const client = await pool.connect()
  try {
    // 1. usersテーブルのカラム確認
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `)
    console.log('usersテーブルのカラム:')
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`))

    // 2. roleカラムがなければ追加
    const hasRole = cols.rows.some(r => r.column_name === 'role')
    if (!hasRole) {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'common'`)
      console.log('\n✅ roleカラムを追加しました')
    } else {
      console.log('\nroleカラム: 既存')
    }

    // 3. 既存ユーザー確認
    const existing = await client.query(`SELECT username, role FROM users`)
    console.log('\n既存ユーザー:')
    existing.rows.forEach(r => console.log(`  ${r.username} (${r.role ?? 'n/a'})`))

    // 4. ユーザー挿入
    const users = [
      { username: 'manager',              password: 'manager',      role: 'manager' },
      { username: 'k-okumura@deita.co.jp', password: 'deita5_2026', role: 'common'  },
    ]

    for (const u of users) {
      const exists = await client.query(`SELECT id FROM users WHERE username = $1`, [u.username])
      if (exists.rows.length > 0) {
        // パスワードとroleを更新
        const hash = await bcrypt.hash(u.password, 10)
        await client.query(
          `UPDATE users SET password_hash = $1, role = $2, updated_at = $3 WHERE username = $4`,
          [hash, u.role, new Date().toISOString(), u.username]
        )
        console.log(`\n🔄 更新: ${u.username} (role: ${u.role})`)
      } else {
        const hash = await bcrypt.hash(u.password, 10)
        const now  = new Date().toISOString()
        await client.query(
          `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), u.username, hash, u.role, now, now]
        )
        console.log(`✅ 作成: ${u.username} (role: ${u.role})`)
      }
    }

    // 5. 最終確認
    const final = await client.query(`SELECT username, role, created_at FROM users ORDER BY created_at`)
    console.log('\n--- 最終ユーザー一覧 ---')
    final.rows.forEach(r => console.log(`  ${r.username} | role: ${r.role}`))

  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
