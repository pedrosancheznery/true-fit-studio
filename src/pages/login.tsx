import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setMsg(error.message);
    else setMsg('Check your email for a sign-in link.');
  }
  return (
    <main style={{ padding: 20 }}>
      <h1>Sign in</h1>
      <form onSubmit={signIn}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" />
        <button type="submit">Send link</button>
      </form>
      <div>{msg}</div>
    </main>
  );
}
