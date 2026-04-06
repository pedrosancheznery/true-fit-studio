<<<<<<< HEAD
import { GetServerSideProps } from 'next';
import { supabaseAdmin } from "@/lib/serverSupabase";
import { supabase } from '@/lib/supabaseClient';
import NavHeader from "@/components/NavHeader";
import { getSSRClient } from '@/lib/ssrClient';

type WorkoutClass = {
  id: string;
  title?: string | null;
  description?: string | null;
  capacity?: number | null;
  startTime?: string | null;
  start_time?: string | null;
};

type ClassInstance = {
  id: string;
  date: string;
  class_id: string;
  seatsRemaining: number;
  isBooked: boolean;
};

type BookingRow = {
  class_instance_id: string;
};

type ClassDetailsProps = {
  workoutClass: WorkoutClass;
  upcomingInstances: ClassInstance[];
};

export const getServerSideProps: GetServerSideProps<ClassDetailsProps> = async (context) => {
  const { id } = context.params as { id: string };
  const supabase = getSSRClient(context);

  const today = new Date().toISOString().split('T')[0];
  const { data: authData } = await supabase.auth.getUser();

  const [classRes, instancesRes] = await Promise.all([
    supabaseAdmin.from('classes').select('*').eq('id', id).single(),
    supabaseAdmin
      .from('class_instances')
      .select('*')
      .eq('class_id', id)
      .gte('date', today)
      .order('date', { ascending: true })
  ]);

  if (classRes.error || !classRes.data) {
    return {
      notFound: true,
    };
  }

  const instanceIds = instancesRes.data?.map((instance) => instance.id) ?? [];
  const { data: activeBookings } = instanceIds.length
    ? await supabaseAdmin
        .from('bookings')
        .select('class_instance_id')
        .in('class_instance_id', instanceIds)
        .neq('status', 'cancelled')
    : { data: [] };

  const { data: userBookings } = authData.user && instanceIds.length
    ? await supabaseAdmin
        .from('bookings')
        .select('class_instance_id')
        .eq('user_id', authData.user.id)
        .in('class_instance_id', instanceIds)
        .neq('status', 'cancelled')
    : { data: [] };

  const bookingsByInstance = new Map<string, number>();
  for (const booking of activeBookings ?? []) {
    const currentCount = bookingsByInstance.get(booking.class_instance_id) ?? 0;
    bookingsByInstance.set(booking.class_instance_id, currentCount + 1);
  }

  const bookedInstanceIds = new Set(
    (userBookings ?? []).map((booking) => (booking as BookingRow).class_instance_id)
  );

  const classCapacity = Number(classRes.data?.capacity ?? 0);
  const instancesWithCapacity = instancesRes.data?.map(inst => ({
    ...inst,
    seatsRemaining: classCapacity - (bookingsByInstance.get(inst.id) ?? 0),
    isBooked: bookedInstanceIds.has(inst.id),
  })) || [];

  return {
    props: {
      workoutClass: classRes.data,
      upcomingInstances: instancesWithCapacity,
    },
  };
};

export default function ClassDetails({ workoutClass, upcomingInstances }: ClassDetailsProps) {
  const classStartTime = workoutClass.startTime ?? workoutClass.start_time ?? 'Time TBD';

  const handleBooking = async (instanceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.assign('/login');
        return;
      }

      const response = await fetch('/api/create-fake-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          instanceId, // The specific date/session
          classId: workoutClass.id
        }),
      });

      const { error, url } = await response.json();
      if (!response.ok) {
        alert(error || 'Unable to book this class right now.');
        return;
      }

      if (url) window.location.assign(url);
    } catch (err) {
      console.error("Checkout failed:", err);
      alert('Unable to complete your booking right now.');
    }
  };
=======
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { supabase } from "@/lib/supabaseClient";
import NavHeader from "@/components/NavHeader";

type ClassRow = {
  id: string;
  title: string;
  description?: string | null;
  start_ts: string;
  end_ts?: string | null;
  location?: string | null;
  price_cents?: number | null;
  price_id?: string | null; // Stripe Price ID if used
};

export default function ClassDetail({ classItem }: { classItem: ClassRow | null }) {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then((r: any) => {
      const u = r?.data?.session?.user;
      if (u) setUser({ id: u.id, email: u.email || undefined });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email || undefined } : null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  if (!classItem) {
    return (
      <>
        <NavHeader />
        <main className="max-w-3xl mx-auto px-4 py-10">
          <p className="text-center text-red-600">Class not found.</p>
          <div className="mt-4 text-center">
            <Link href="/classes" className="underline">Back to classes</Link>
          </div>
        </main>
      </>
    );
  }

  const start = new Date(classItem.start_ts);
  const end = classItem.end_ts ? new Date(classItem.end_ts) : null;
  const priceDisplay = classItem.price_cents != null ? `$${(classItem.price_cents/100).toFixed(2)}` : "Free";

  async function handleBook() {
    if (!user) {
      router.push(`/login?redirect=/classes/${classItem.id}`);
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classItem.id,
          priceId: classItem.price_id, // or omit and let server use price_cents
          userId: user.id,
        }),
      });
      const { url, error } = await resp.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Booking failed");
      setBusy(false);
    }
  }
>>>>>>> dev

  return (
    <>
      <NavHeader />
<<<<<<< HEAD
      <div className="p-8">
        <h1 className="text-3xl font-bold">{workoutClass.title ?? 'Class details'}</h1>
        <p className="mt-4">{workoutClass.description ?? 'Description coming soon.'}</p>
        
        <h2 className="mt-8 text-xl font-semibold">Pick a Date:</h2>
        <div className="grid gap-4 mt-4">
          {upcomingInstances.map((instance) => {
            const isFull = instance.seatsRemaining <= 0;
            const isBooked = instance.isBooked;
            const isUnavailable = isFull || isBooked;
            
            return (
              <button 
                key={instance.id}
                disabled={isUnavailable}
                className={`p-4 border rounded flex justify-between ${
                  isUnavailable
                    ? 'bg-gray-200 cursor-not-allowed opacity-60 text-gray-500'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleBooking(instance.id)}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">
                    {new Date(instance.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-sm text-gray-500">
                    {isBooked ? 'Booked' : isFull ? 'Sold Out' : `${instance.seatsRemaining} spots left`}
                  </span>
                </div>
                <span>{classStartTime}</span>
              </button>
            );
          })}
        </div>
      </div> 
    </> // 3. Properly closed tags
  );
}
=======
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{classItem.title}</h1>
          <div className="text-sm text-slate-600">
            {isNaN(start.getTime()) ? "TBA" : start.toLocaleString()}
            {end ? ` — ${end.toLocaleTimeString()}` : ""}
            {classItem.location ? ` • ${classItem.location}` : ""}
          </div>
        </div>

        <div className="prose mb-6 text-slate-800">
          <p>{classItem.description || "No description provided."}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-lg font-medium">{priceDisplay}</div>
          <button
            onClick={handleBook}
            disabled={busy}
            className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-60"
          >
            {busy ? "Processing…" : "Book Now"}
          </button>
          <Link href="/classes" className="text-sm underline">Back</Link>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {

  const { id } = ctx.params as { id?: string };
  if (!id) return { props: { classItem: null } };

  try {
    const { supabaseAdmin } = await import("../../lib/serverSupabase"); // ensure this file exports supabaseAdmin
    const { data, error } = await supabaseAdmin
      .from("classes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    
    console.log('SSR fetch', { id, data, error });

    if (error) {
      console.error("Supabase error:", error);
      return { props: { classItem: null } };
    }

    return { props: { classItem: data ?? null } };
  } catch (err) {
    console.error(err);
    return { props: { classItem: null } };
  }
};

>>>>>>> dev
