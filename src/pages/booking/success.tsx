import { GetServerSideProps } from 'next';
import { getSSRClient } from '@/lib/ssrClient';
import { supabaseAdmin } from '@/lib/serverSupabase';
import { supabase } from '@/lib/supabaseClient';
import NavHeader from '@/components/NavHeader';
import Link from 'next/link';

// --- Types & Helpers ---

type BookingData = {
  id: string;
  status: string;
  paid: boolean;
  class_instances: {
    date: string;
    classes: {
      title?: string | null;
      name?: string | null;
      startTime?: string | null;
      start_time?: string | null;
    } | null;
  } | null;
};

interface BookingSuccessProps {
  booking: BookingData | null;
}

const formatBookingDetails = (booking: BookingData | null) => {
  if (!booking?.class_instances) return { title: 'Class booked', date: 'Date TBD', time: 'Time TBD' };
  
  const { class_instances: instance } = booking;
  const workout = instance.classes;
  
  return {
    title: workout?.title || workout?.name || 'Class booked',
    time: workout?.startTime || workout?.start_time || 'Time TBD',
    date: new Date(instance.date).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  };
};

const firstQueryValue = (value: string | string[] | undefined) => 
  Array.isArray(value) ? value[0] : value;

// --- Server Side ---

export const getServerSideProps: GetServerSideProps = async (context) => {
  const supabase = getSSRClient(context);
  const { data: { user } } = await supabase.auth.getUser();
  
  const bookingId = firstQueryValue(context.query.booking_id);
  const sessionId = firstQueryValue(context.query.session_id);

  if (!bookingId && !sessionId) return { notFound: true };

  const query = supabaseAdmin
    .from('bookings')
    .select(`id, status, paid, class_instances (date, classes (*))`);

  const { data: booking, error } = bookingId
    ? await query.eq('id', bookingId).maybeSingle()
    : await query.eq('stripe_session_id', sessionId).order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (error || !booking) return { props: { booking: null } };

  // Trigger internal notifications/logic server-side instead of via fetch
  if (user?.email) {
    try {
      // NOTE: Instead of fetch('/api/bookings/create'), call the logic directly 
      // or use an absolute URL: `${process.env.NEXT_PUBLIC_SITE_URL}/api/...`
      console.log(`Notification trigger for ${user.email} on booking ${booking.id}`);
    } catch (err) {
      console.error('Notification error:', err);
    }
  }

  return { props: { booking } };
};

// --- Component ---

export default function BookingSuccess({ booking }: BookingSuccessProps) {
  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">Confirming your booking...</h1>
        <p className="text-gray-500">We're just finishing things up. Refresh in a moment!</p>
      </div>
    );
  }

  const { title, date, time } = formatBookingDetails(booking);

  const handleCancel = async () => {
    if (!confirm('Cancel this booking and simulate the refund?')) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.assign('/login');

    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      if (res.ok) {
        alert('Booking cancelled.');
        window.location.reload();
      } else {
        const { error } = await res.json();
        throw new Error(error || 'Cancellation failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <NavHeader />
      <main className="max-w-2xl mx-auto mt-20 p-8 border rounded-xl shadow-sm text-center">
        <span className="text-5xl" role="img" aria-label="party">🎉</span>
        <h1 className="text-3xl font-bold text-green-600 mt-4">You&apos;re Booked!</h1>
        <p className="mt-2 text-gray-600">Get ready to sweat.</p>

        <section className="mt-8 p-6 bg-gray-50 rounded-lg text-left">
          <h2 className="font-bold text-lg border-b pb-2">{title}</h2>
          <dl className="mt-4 space-y-2">
            <div><strong>Date:</strong> {date}</div>
            <div><strong>Time:</strong> {time}</div>
            <div>
              <strong>Status:</strong> 
              <span className="ml-1 capitalize text-green-600 font-medium">{booking.status}</span>
            </div>
            <div>
              <strong>Payment:</strong> {booking.paid ? 'Confirmed' : 'Pending/Refunded'}
            </div>
          </dl>
        </section>

        <footer className="mt-8 flex flex-col items-center gap-4">
          <Link href="/classes" className="text-blue-600 hover:underline">
            ← Back to Classes
          </Link>
          {booking.status !== 'cancelled' && (
            <button onClick={handleCancel} className="text-sm text-red-500 hover:underline">
              Cancel booking
            </button>
          )}
        </footer>
      </main>
    </>
  );
}
