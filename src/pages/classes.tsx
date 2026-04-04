import { createClient } from '@supabase/supabase-js';
import ClassCard from '../components/ClassCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getServerSideProps() {
  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .order('start_ts', { ascending: true });

  return {
    props: {
      classes: classes || [],
    },
  };
}

export default function ClassGallery({ classes }: { classes: any[] }) {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Upcoming Classes
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Find your next workout and book your spot in seconds.
          </p>
        </header>

        {classes.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((item) => (
              <ClassCard key={item.id} workout={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-500 italic">No classes scheduled yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
