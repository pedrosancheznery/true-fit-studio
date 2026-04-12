import { GetServerSideProps } from 'next';
import { getSSRClient } from '@/lib/ssrClient';
import { supabase } from '@/lib/supabaseClient';
import NavHeader from '@/components/NavHeader';
import { useState } from 'react';
// Email
import { sendEmail } from '@/lib/email';

type BookingClass = {
  title?: string | null;
  name?: string | null;
  startTime?: string | null;
  start_time?: string | null;
} | null;

type BookingInstance = {
  date: string;
  classes: BookingClass;
} | null;

type Booking = {
  id: string;
  status: string;
  paid: boolean;
  created_at: string;
  class_instances: BookingInstance;
};

type DashboardProps = {
  initialBookings: Booking[];
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = getSSRClient(ctx);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { redirect: { destination: '/login', permanent: false } };

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, status, paid, created_at,
      class_instances (
        date,
        classes (*)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return { props: { initialBookings: bookings ?? [] } };
};

export default function Dashboard({ initialBookings }: DashboardProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);

  const onCancel = async (id: string) => {
    if (!confirm('Cancel this booking and simulate the refund?')) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.assign('/login');
      return;
    }

    // Call cancel API
    const res = await fetch('/api/bookings/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ bookingId: id }),
    });

    if (res.ok) {
      setBookings((prev) =>
        prev.map((booking) =>
          booking.id === id
            ? { ...booking, status: 'cancelled', paid: false }
            : booking
        )
      );

      // Notify cancelled endpoint with user email
      try {
        await fetch(`/api/bookings/cancelled`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: id, to: encodeURIComponent(session.user.email) }),
        });
      } catch (err) {
        console.error('Failed to notify cancelled endpoint', err);
      }
    } else {
      const { error } = await res.json().catch(() => ({ error: null }));
      alert(error || 'Unable to cancel this booking right now.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavHeader />
      <main className="max-w-4xl mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Workouts</h1>
          <p className="text-gray-500">Manage your upcoming classes and history.</p>
        </header>

        <div className="space-y-4">
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking} 
                onCancel={() => onCancel(booking.id)} 
              />
            ))
          ) : (
            <EmptyState />
          )}
        </div>
      </main>
    </div>
  );
}

function BookingCard({
  booking,
  onCancel,
}: {
  booking: Booking;
  onCancel: () => void;
}) {
  const classInstance = booking.class_instances;
  const workoutClass = classInstance?.classes ?? {};
  const classTitle = workoutClass.title ?? workoutClass.name ?? 'Class booked';
  const classStartTime = workoutClass.startTime ?? workoutClass.start_time ?? 'Time TBD';
  const isConfirmed = booking.status === 'confirmed';
  const classDate = classInstance
    ? new Date(classInstance.date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
    : 'Date TBD';

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm flex justify-between items-center transition hover:shadow-md">
      <div>
        <h3 className="font-bold text-lg text-gray-800">{classTitle}</h3>
        <p className="text-gray-600">
          {classDate}
          <span className="mx-2 text-gray-300">|</span> 
          {classStartTime}
        </p>
        <StatusBadge status={booking.status} />
      </div>
      
      {isConfirmed && (
        <button 
          onClick={onCancel} 
          className="text-sm font-semibold text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-block mt-2 text-xs font-bold px-2 py-1 rounded uppercase ${
    status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  }`}>
    {status}
  </span>
);

const EmptyState = () => (
  <div className="text-center py-20 bg-white border-2 border-dashed rounded-xl">
    <p className="text-gray-400">No bookings found. Time to hit the gym!</p>
  </div>
);
