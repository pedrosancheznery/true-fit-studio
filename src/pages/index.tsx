import type { GetServerSideProps } from 'next';
import { useEffect, useState } from "react";
import Link from "next/link";
import NavHeader from "@/components/NavHeader";
import InstructorsSection from "@/components/InstructorsSection";
import { getInstructorImageUrlMap } from '@/lib/instructorImages';
import { supabaseAdmin } from '@/lib/serverSupabase';
import { supabase } from "@/lib/supabaseClient";

type ClassRow = {
  id: string;
  title?: string | null;
  start_time: string; 
  location?: string | null;
  duration?: number | null;
  startTime?: string | null;
};

type InstructorRow = {
  bio?: string | null;
  id: string;
  imageUrl?: string | null;
  name?: string | null;
};

type HomeProps = {
  instructors: InstructorRow[];
};

const getDayName = (dayValue: string) => {
  const days: Record<string, string> = {
    '0': 'Saturday',
    '1': 'Sunday',
    '2': 'Monday',
    '3': 'Tuesday',
    '4': 'Wednesday',
    '5': 'Thursday',
    '6': 'Friday',
  };
  return days[dayValue] || 'TBA';
};

export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  const { data, error } = await supabaseAdmin.from('instructors').select('id, name, bio');
  if (error) {
    console.error('Failed to load instructors gallery:', error.message);
  }

  let imageUrlMap = new Map<string, string>();
  try {
    imageUrlMap = await getInstructorImageUrlMap((data ?? []).map((instructor) => instructor.id));
  } catch (imageError) {
    console.error(
      'Failed to load instructor images:',
      imageError instanceof Error ? imageError.message : 'Unknown error'
    );
  }

  const instructors = (data ?? []).map((instructor) => ({
    ...instructor,
    imageUrl: imageUrlMap.get(instructor.id) ?? null,
  }));

  return {
    props: {
      instructors: instructors ?? []
    },
  };
};

export default function Home({ instructors }: HomeProps) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
        // Fetch from Supabase
        const { data, error } = await supabase.from("classes").select("*");
        if (error) throw error;
        setClasses(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  return (
    <>
      <NavHeader />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            True Fit By Susana
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Browse upcoming classes and manage your bookings.
          </p>
        </header>

        <section className="grid gap-8 sm:grid-cols-1 lg:grid-cols-2">
          <h2 className="text-xl font-medium mb-3">Upcoming classes</h2>
          {loading && <p className="text-sm text-slate-500">Loading classes…</p>}
          {!loading && classes.length === 0 && <p className="text-sm text-slate-500">No upcoming classes.</p>}
        </section>
        <section className="grid gap-8 sm:grid-cols-1 lg:grid-cols-2">
          {classes.map((c) => (
          <div key={c.id} 
            className='overflow-hidden rounded-xl border border-slate-200 shadow-sm transition bg-slate-100 text-slate-500 opacity-80'>
            <div className="p-6">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className='rounded-full px-3 py-1 text-xs font-semibold bg-slate-200 text-slate-600'>
                    {c.duration ? `${c.duration} mins` : 'Duration TBD'}
                  </span>
                </div>
              </div>
              <h3 className='mb-2 text-xl font-bold text-slate-900'>
                {c.title}
              </h3>
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div>
                  <p className='text-sm font-bold text-slate-900'>
                    {getDayName(c.day_of_week)} @ {c.startTime}
                  </p>
                </div>
                <Link
                  href={`/classes/${c.id}`}
                  className='rounded-lg px-4 py-2 text-sm font-semibold transition bg-slate-900 text-white hover:bg-slate-800'>
                  Details
                </Link>
              </div>
            </div>
          </div>
          ))}
        </section>

        <InstructorsSection instructors={instructors} />
      </main>
    </>
  );
}
