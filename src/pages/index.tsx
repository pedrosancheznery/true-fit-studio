import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const [classes, setClasses] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('classes').select('*').order('start_ts', { ascending: true }).then(r => {
      if (!r.error) setClasses(r.data ?? []);
    });
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1>My Fitness Studio</h1>
      <Link href="/members">Member area</Link> | <Link href="/login">Login / Sign up</Link>
      <h2>Upcoming classes</h2>
      <ul>
        {classes.map(c => (
          <li key={c.id}>
            <strong>{c.title}</strong> — {new Date(c.start_ts).toLocaleString()} — <Link href={`/book/${c.id}`}>Book</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
