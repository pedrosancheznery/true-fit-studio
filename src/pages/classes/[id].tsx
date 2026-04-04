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

  return (
    <>
      <NavHeader />
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

