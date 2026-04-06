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
            True Fitness By Susana
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Browse upcoming classes and manage your bookings.
          </p>
        </header>

        <section className="mb-20">
          <h2 className="text-xl font-medium mb-3">Upcoming classes</h2>
          {loading && <p className="text-sm text-slate-500">Loading classes…</p>}
          {!loading && classes.length === 0 && <p className="text-sm text-slate-500">No upcoming classes.</p>}

          <ul className="space-y-4">
            {classes.map((c) => (
              <li key={c.id} className="p-4 border rounded-md flex justify-between items-center">
                <div>
                  <div className="font-medium text-slate-800">{c.title}</div>
                  <div className="text-sm text-slate-600">
                    {c.startTime} {c.duration ? ` • ${c.duration}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/classes/${c.id}`} className="text-sm text-slate-700 underline">
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* This now receives the data correctly from getStaticProps */}
        <InstructorsSection instructors={instructors} />
      </main>
    </>
  );
}
