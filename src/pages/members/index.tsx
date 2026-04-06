import MemberGuard from '@/components/MemberGuard';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type MemberBooking = {
  id: string;
  status: string;
  paid: boolean;
  classes?: {
    title?: string | null;
  } | null;
};

export default function Members() {
  const [bookings, setBookings] = useState<MemberBooking[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const userId = data.session.user.id;
      const { data: rows } = await supabase.from('bookings').select('*, classes(*)').eq('user_id', userId).order('created_at', { ascending: false });
      setBookings(rows ?? []);
    });
  }, []);

  return (
    <MemberGuard>
      <main style={{ padding: 20 }}>
        <h1>Member area</h1>
        <h2>Your bookings</h2>
        <ul>
          {bookings.map(b => (
            <li key={b.id}>
              {b.classes?.title} — {b.status} — {b.paid ? 'Paid' : 'Unpaid'}
            </li>
          ))}
        </ul>
      </main>
    </MemberGuard>
  );
}
