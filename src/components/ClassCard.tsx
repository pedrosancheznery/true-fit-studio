export default function ClassCard({ workout }: { workout: any }) {
  const date = new Date(workout.start_time).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });

  const time = new Date(workout.start_time).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {workout.duration_minutes} mins
          </span>
          <span className="text-sm font-medium text-slate-500">{workout.instructor}</span>
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">{workout.title}</h3>
        <p className="mb-4 line-clamp-2 text-sm text-slate-600">{workout.description}</p>
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-sm font-bold text-slate-900">{date}</p>
            <p className="text-xs text-slate-500">{time}</p>
          </div>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
}
