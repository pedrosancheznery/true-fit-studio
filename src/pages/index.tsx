import { useEffect, useState } from "react";
import Link from "next/link";
import NavHeader from "@/components/NavHeader";
import { supabase } from "@/lib/supabaseClient";

type ClassRow = {
  id: string;
  title: string;
  start_ts: string; // ISO timestamp
  location?: string | null;
  price_id?: string | null;
};

export default function Home() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .from<ClassRow>("classes")
      .select("*")
      .order("start_ts", { ascending: true })
      .then((res) => {
        if (!mounted) return;
        if (res.error) {
          console.error(res.error);
          setError(res.error.message);
        } else {
          setClasses(res.data ?? []);
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <NavHeader />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">My Fitness Studio</h1>
          <p className="text-sm text-slate-600">Browse upcoming classes and manage your bookings.</p>
        </div>

        <div className="flex gap-4 mb-6">
          <Link href="/classes" className="text-sm text-slate-700 underline">
            Gallery
          </Link>
          <Link href="/members/my-bookings" className="text-sm text-slate-700 underline">
            My Bookings
          </Link>
          <Link href="/login" className="text-sm text-slate-700 underline">
            Login / Sign up
          </Link>
        </div>

        <section>
          <h2 className="text-xl font-medium mb-3">Upcoming classes</h2>

          {loading && <p className="text-sm text-slate-500">Loading classes…</p>}
          {error && <p className="text-sm text-red-600">Error: {error}</p>}

          {!loading && classes.length === 0 && <p className="text-sm text-slate-500">No upcoming classes.</p>}

          <ul className="space-y-4">
            {classes.map((c) => {
              const date = new Date(c.start_ts);
              return (
                <li key={c.id} className="p-4 border rounded-md flex justify-between items-center">
                  <div>
                    <div className="font-medium text-slate-800">{c.title}</div>
                    <div className="text-sm text-slate-600">
                      {isNaN(date.getTime()) ? "TBA" : date.toLocaleString()}
                      {c.location ? ` • ${c.location}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link href={`/classes/${c.id}`} className="text-sm text-slate-700 underline">
                      Details
                    </Link>
                    <Link href={`/book/${c.id}`} className="px-3 py-1 rounded bg-slate-900 text-white text-sm">
                      Book
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
