import { GetServerSideProps } from 'next';
import { supabaseAdmin } from '@/lib/serverSupabase';
import { supabase } from '@/lib/supabaseClient';
import NavHeader from '@/components/NavHeader';
import Link from 'next/link';

type BookingSuccessProps = {
  booking: {
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
  } | null;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const bookingId = firstQueryValue(context.query.booking_id);
  const sessionId = firstQueryValue(context.query.session_id);

  if (!bookingId && !sessionId) {
    return { notFound: true };
  }

  const bookingQuery = supabaseAdmin
    .from('bookings')
    .select(`
      id,
      status,
      paid,
      class_instances (
        date,
        classes (*)
      )
    `);

  const bookingResult = bookingId
    ? await bookingQuery.eq('id', bookingId).maybeSingle()
    : await bookingQuery
        .eq('stripe_session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

  const { data: booking, error } = bookingResult;

  if (error || !booking) {
    return { props: { booking: null } };
  }

  return {
    props: { booking },
  };
};

export default function BookingSuccess({ booking }: BookingSuccessProps) {
  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">Confirming your booking...</h1>
        <p className="text-gray-500">We&apos;re just finishing things up. Refresh in a moment!</p>
      </div>
    );
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this booking and simulate the refund?')) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.assign('/login');
      return;
    }

    const res = await fetch('/api/bookings/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    if (res.ok) {
      alert('Booking cancelled. Refund simulation complete.');
      window.location.reload();
    } else {
      const { error } = await res.json().catch(() => ({ error: null }));
      alert(error || 'Cancellation failed. Please contact support.');
    }
  };

  const classInstance = booking.class_instances;
  const workoutClass = classInstance?.classes ?? {};
  const classTitle = workoutClass.title ?? workoutClass.name ?? 'Class booked';
  const classStartTime = workoutClass.startTime ?? workoutClass.start_time ?? 'Time TBD';
  const classDate = classInstance
    ? new Date(classInstance.date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : 'Date TBD';

  return (
    <>
      <NavHeader />
      <div className="max-w-2xl mx-auto mt-20 p-8 border rounded-xl shadow-sm text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-green-600">You&apos;re Booked!</h1>
        <p className="mt-2 text-gray-600">Get ready to sweat.</p>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg text-left">
          <h2 className="font-bold text-lg border-b pb-2">{classTitle}</h2>
          <div className="mt-4 space-y-2">
            <p><strong>Date:</strong> {classDate}</p>
            <p><strong>Time:</strong> {classStartTime}</p>
            <p><strong>Status:</strong> <span className="capitalize text-green-600 font-medium">{booking.status}</span></p>
            <p><strong>Payment:</strong> {booking.paid ? 'Simulated successfully' : 'Refund simulated'}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link href="/classes" className="text-blue-600 hover:underline">
            ← Back to Classes
          </Link>
          {booking.status !== 'cancelled' && (
            <button 
              onClick={handleCancel}
              className="text-sm text-red-500 hover:text-red-700 underline"
            >
              Cancel booking
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
