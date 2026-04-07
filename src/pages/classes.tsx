import type { GetServerSideProps } from 'next';
import ClassCard from '../components/ClassCard';
import NavHeader from '@/components/NavHeader';
import { supabaseAdmin } from '@/lib/serverSupabase';
import { getSSRClient } from '@/lib/ssrClient';

type ClassRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  duration?: number | null;
  day_of_week?: string | null;
  startTime?: string | null;
  start_time?: string | null;
  instructor_id?: string | null;
  instructor?: string | { name?: string | null } | null;
  isBooked?: boolean;
};

type ClassGalleryProps = {
  classes: ClassRow[];
  fetchError: string | null;
};

type InstructorRow = {
  id: string;
  name?: string | null;
};

type ClassInstanceRow = {
  id: string;
  class_id: string;
};

type BookingRow = {
  class_instance_id: string;
};

export const getServerSideProps: GetServerSideProps<ClassGalleryProps> = async (context) => {
  const supabase = getSSRClient(context);
  const today = new Date().toISOString().split('T')[0];

  const [{ data, error }, { data: authData }] = await Promise.all([
    supabaseAdmin.from('classes').select('*'),
    supabase.auth.getUser(),
  ]);

  if (error) {
    console.error('Failed to load classes gallery:', error.message);
  }

  const classesData = data ?? [];
  const instructorIds = [...new Set(
    classesData
      .map((item) => item.instructor_id)
      .filter((id): id is string => Boolean(id))
  )];

  let instructorNameById = new Map<string, string>();
  if (instructorIds.length > 0) {
    const { data: instructors, error: instructorError } = await supabaseAdmin
      .from('instructors')
      .select('id, name')
      .in('id', instructorIds);

    if (instructorError) {
      console.error('Failed to load instructors for classes gallery:', instructorError.message);
    } else {
      instructorNameById = new Map(
        (instructors ?? []).flatMap((instructor: InstructorRow) =>
          instructor.name ? [[instructor.id, instructor.name]] : []
        )
      );
    }
  }

  const user = authData.user;
  const classIds = classesData.map((item) => item.id);
  const bookedClassIds = new Set<string>();

  if (user && classIds.length > 0) {
    const { data: upcomingInstances, error: instancesError } = await supabaseAdmin
      .from('class_instances')
      .select('id, class_id')
      .in('class_id', classIds)
      .gte('date', today);

    if (instancesError) {
      console.error('Failed to load class instances for booking state:', instancesError.message);
    } else {
      const classIdByInstanceId = new Map(
        (upcomingInstances ?? []).map((instance: ClassInstanceRow) => [instance.id, instance.class_id])
      );
      const instanceIds = [...classIdByInstanceId.keys()];

      if (instanceIds.length > 0) {
        const { data: userBookings, error: bookingsError } = await supabaseAdmin
          .from('bookings')
          .select('class_instance_id')
          .eq('user_id', user.id)
          .in('class_instance_id', instanceIds)
          .neq('status', 'cancelled');

        if (bookingsError) {
          console.error('Failed to load booked classes for gallery:', bookingsError.message);
        } else {
          for (const booking of userBookings ?? []) {
            const classId = classIdByInstanceId.get((booking as BookingRow).class_instance_id);
            if (classId) {
              bookedClassIds.add(classId);
            }
          }
        }
      }
    }
  }

  const classes = classesData
    .map((item) => ({
      ...item,
      instructor: resolveInstructorName(item, instructorNameById.get(item.instructor_id ?? '')),
      isBooked: bookedClassIds.has(item.id),
    }))
    .sort(compareClasses);

  return {
    props: {
      classes,
      fetchError: error?.message ?? null,
    },
  };
};

export default function ClassGallery({ classes, fetchError }: ClassGalleryProps) {
  return (
    <>
    <NavHeader />
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

        {fetchError ? (
          <div className="text-center py-20">
            <p className="text-slate-500 italic">Unable to load classes right now.</p>
          </div>
        ) : classes.length > 0 ? (
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
    </>
  );
}

function compareClasses(a: ClassRow, b: ClassRow) {
  const dayCompare = compareNullableValues(a.day_of_week, b.day_of_week);
  if (dayCompare !== 0) {
    return dayCompare;
  }

  const timeCompare = compareNullableValues(
    a.startTime ?? a.start_time,
    b.startTime ?? b.start_time
  );
  if (timeCompare !== 0) {
    return timeCompare;
  }

  return compareNullableValues(a.title ?? a.name, b.title ?? b.name);
}

function compareNullableValues(a?: string | null, b?: string | null) {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();

  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left.localeCompare(right, undefined, { numeric: true });
}

function resolveInstructorName(
  workoutClass: ClassRow,
  instructorName?: string | null
) {
  if (instructorName?.trim()) {
    return instructorName.trim();
  }

  if (typeof workoutClass.instructor === 'string' && workoutClass.instructor.trim()) {
    return workoutClass.instructor.trim();
  }

  if (
    typeof workoutClass.instructor === 'object' &&
    workoutClass.instructor?.name?.trim()
  ) {
    return workoutClass.instructor.name.trim();
  }

  return null;
}
