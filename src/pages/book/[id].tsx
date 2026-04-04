import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import MemberGuard from '../../components/MemberGuard';

export default function BookPage() {
  const r = useRouter();
  const { id } = r.query;
  const [cls, setCls] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase.from('classes').select('*').eq('id', id).single().then(res => {
      if (!res.error) setCls(res.data);
    });
  }, [id]);

  async function handleBook() {
    setMsg('Processing...');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return setMsg('Please login first.');

    const token = await sessionData.session.access_token;
    const resp = await fetch('/api/create-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classId: id }),
    });
    const json = await resp.json();
    if (json.checkoutUrl) window.location.href = json.checkoutUrl;
    else if (json.success) setMsg('Booked (free class).');
    else setMsg(json.error || 'Unknown error');
  }

  if (!cls) return <div>Loading class...</div>;
  return (
    <MemberGuard>
    <main style={{ padding: 20 }}>
      <h1>{cls.title}</h1>
      <p>{cls.description}</p>
      <button onClick={handleBook}>Book class{cls.price ? ` — $${cls.price}` : ''}</button>
      <div>{msg}</div>
    </main>
  </MemberGuard>
  );
}
