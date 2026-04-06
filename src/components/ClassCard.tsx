import Link from 'next/link';

type WorkoutCardRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  duration?: number | null;
  day_of_week?: string | null;
  startTime?: string | null;
  start_time?: string | null;
  instructor?: string | { name?: string | null } | null;
  isBooked?: boolean;
};

export default function ClassCard({ workout }: { workout: WorkoutCardRow }) {
  const instructorName = getInstructorName(workout.instructor);
  const title = workout.title ?? workout.name ?? 'Untitled class';
  const description = workout.description ?? 'Description coming soon.';
  const startTime = workout.startTime ?? workout.start_time ?? 'Time TBD';
  const isBooked = workout.isBooked === true;

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

  const dayLabel = workout.day_of_week
    ? `${getDayName(workout.day_of_week)}s`
    : 'Date TBA';

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 shadow-sm transition ${
        isBooked
          ? 'bg-slate-100 text-slate-500 opacity-80'
          : 'bg-white hover:shadow-md'
      }`}
    >
      <div className="p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isBooked
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {workout.duration ? `${workout.duration} mins` : 'Duration TBD'}
            </span>
            {isBooked && (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                Booked
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-slate-500">{instructorName}</span>
        </div>
        <h3 className={`mb-2 text-xl font-bold ${isBooked ? 'text-slate-700' : 'text-slate-900'}`}>
          {title}
        </h3>
        <p className="mb-4 line-clamp-2 text-sm text-slate-600">{description}</p>
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className={`text-sm font-bold ${isBooked ? 'text-slate-700' : 'text-slate-900'}`}>
              {dayLabel} @ {startTime}
            </p>
          </div>
          <Link
            href={`/classes/${workout.id}`}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              isBooked
                ? 'bg-slate-300 text-slate-700 hover:bg-slate-300'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            View Dates
          </Link>
        </div>
      </div>
    </div>
  );
}

function getInstructorName(instructor: WorkoutCardRow['instructor']) {
  if (typeof instructor === 'string' && instructor.trim()) {
    return instructor.trim();
  }

  if (instructor && typeof instructor !== 'string' && instructor.name?.trim()) {
    return instructor.name.trim();
  }

  return 'Instructor TBA';
}
