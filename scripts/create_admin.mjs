import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(r => rl.question(q, r));

(async () => {
  try {
    const name = process.env.ADMIN_NAME || await question('Admin name: ');
    const email = process.env.ADMIN_EMAIL || await question('Admin email: ');
    const password = process.env.ADMIN_PASSWORD || await question('Admin password: ');
    rl.close();

    if (!name || !email || !password) {
      console.error('Name, email, and password are required');
      process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    console.log('Creating user...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError) {
      console.error('Error creating user:', createError);
      process.exit(1);
    }

    const initials = name.split(' ').map(n=>n[0]||'').join('').slice(0,2).toUpperCase();
    const { error: profileError } = await supabase.from('profiles').insert({ id: newUser.user.id, name, email, role: 'admin', initials });
    if (profileError) {
      console.error('Error inserting profile:', profileError);
      // attempt to delete user
      try { await supabase.auth.admin.deleteUser(newUser.user.id); } catch {}
      process.exit(1);
    }

    console.log('Admin user created:', email);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
