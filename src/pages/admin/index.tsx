import type { GetServerSideProps } from 'next';
import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';

import NavHeader from '@/components/NavHeader';
import { getInstructorImageUrlMap } from '@/lib/instructorImages';
import { getSSRClient } from '@/lib/ssrClient';
import { supabaseAdmin } from '@/lib/serverSupabase';
import { supabase } from '@/lib/supabaseClient';

type Instructor = {
  bio: string | null;
  id: string;
  imageUrl: string | null;
  name: string;
};

type WorkoutClass = {
  capacity: number | null;
  day_of_week: string | null;
  description: string | null;
  duration: number | null;
  id: string;
  instructor_id: string | null;
  startTime: string | null;
  stripePriceId: string | null;
  title: string;
};

type BookingSummary = {
  createdAt: string;
  id: string;
  memberName: string;
  paid: boolean;
  status: string;
  userId: string;
};

type CalendarSession = {
  bookingCount: number;
  bookings: BookingSummary[];
  cancelledBookingCount: number;
  date: string;
  id: string;
  isCancelled: boolean;
  seatsRemaining: number | null;
  workoutClass: WorkoutClass | null;
};

type AdminPageProps = {
  calendarSessions: CalendarSession[];
  classes: WorkoutClass[];
  initialMonth: string;
  instructors: Instructor[];
  loadError: string | null;
};

type InstructorFormState = {
  bio: string;
  imageDataUrl: string;
  imagePreviewUrl: string | null;
  name: string;
};

type ClassFormState = {
  capacity: string;
  dayOfWeek: string;
  description: string;
  duration: string;
  firstDate: string;
  instructorId: string;
  sessionCount: string;
  startTime: string;
  stripePriceId: string;
  title: string;
};

type Feedback = {
  message: string;
  tone: 'error' | 'success';
};

type RawInstructorRow = {
  bio?: string | null;
  id: string;
  name?: string | null;
};

type RawClassRow = {
  capacity?: number | null;
  day_of_week?: string | null;
  description?: string | null;
  duration?: number | null;
  id: string;
  instructor_id?: string | null;
  startTime?: string | null;
  stripePriceId?: string | null;
  title?: string | null;
};

type RawClassInstanceRow = {
  class_id: string;
  date: string;
  id: string;
  is_cancelled?: boolean | null;
};

type RawBookingRow = {
  class_instance_id: string;
  created_at: string;
  id: string;
  paid?: boolean | null;
  profiles?: {
    full_name?: string | null;
  } | null;
  status?: string | null;
  user_id: string;
};

const STUDIO_DAY_OPTIONS = [
  { label: 'Saturday', value: '0' },
  { label: 'Sunday', value: '1' },
  { label: 'Monday', value: '2' },
  { label: 'Tuesday', value: '3' },
  { label: 'Wednesday', value: '4' },
  { label: 'Thursday', value: '5' },
  { label: 'Friday', value: '6' },
] as const;

const CALENDAR_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async (ctx) => {
  const supabase = getSSRClient(ctx);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, roles(name)')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.roles?.name !== 'admin') {
    console.log(profile.roles.name);
    return {
      redirect: {
        destination: '/members/my-bookings',
        permanent: false,
      },
    };
  }

  const [classesRes, instructorsRes, instancesRes] = await Promise.all([
    supabaseAdmin
      .from('classes')
      .select(`
        id,
        title,
        description,
        capacity,
        duration,
        startTime,
        day_of_week,
        stripePriceId,
        instructor_id
      `)
      .order('title', { ascending: true }),
    supabaseAdmin.from('instructors').select('id, name, bio').order('name', { ascending: true }),
    supabaseAdmin
      .from('class_instances')
      .select('id, class_id, date, is_cancelled')
      .order('date', { ascending: true }),
  ]);

  const rawInstances = (instancesRes.data ?? []) as RawClassInstanceRow[];
  const instanceIds = rawInstances.map((instance) => instance.id);
  const bookingsRes = instanceIds.length
    ? await supabaseAdmin
        .from('bookings')
        .select(`
          id,
          user_id,
          class_instance_id,
          status,
          paid,
          created_at,
          profiles(full_name)
        `)
        .in('class_instance_id', instanceIds)
        .order('created_at', { ascending: false })
    : { data: [], error: null };

  const errors = [
    classesRes.error?.message,
    instructorsRes.error?.message,
    instancesRes.error?.message,
    bookingsRes.error?.message ?? null,
  ].filter((message): message is string => Boolean(message));

  for (const message of errors) {
    console.error('Admin dashboard data load failed:', message);
  }

  const classes = ((classesRes.data ?? []) as RawClassRow[])
    .map(normalizeWorkoutClass)
    .sort((left, right) => left.title.localeCompare(right.title));

  const rawInstructorRows = (instructorsRes.data ?? []) as RawInstructorRow[];
  let instructorImageUrlMap = new Map<string, string>();
  try {
    instructorImageUrlMap = await getInstructorImageUrlMap(
      rawInstructorRows.map((instructor) => instructor.id)
    );
  } catch (imageError) {
    const message =
      imageError instanceof Error
        ? imageError.message
        : 'Instructor images could not be loaded.';
    errors.push(message);
    console.error('Admin instructor image load failed:', message);
  }

  const instructors = rawInstructorRows
    .map((row) => normalizeInstructor(row, instructorImageUrlMap.get(row.id) ?? null))
    .sort((left, right) => left.name.localeCompare(right.name));

  const classById = new Map(classes.map((workoutClass) => [workoutClass.id, workoutClass]));
  const bookingsByInstance = new Map<string, BookingSummary[]>();

  for (const row of (bookingsRes.data ?? []) as RawBookingRow[]) {
    const booking = normalizeBooking(row);
    const currentBookings = bookingsByInstance.get(row.class_instance_id) ?? [];
    currentBookings.push(booking);
    bookingsByInstance.set(row.class_instance_id, currentBookings);
  }

  const calendarSessions = rawInstances
    .map((instance) => {
      const workoutClass = classById.get(instance.class_id) ?? null;
      const bookings = bookingsByInstance.get(instance.id) ?? [];
      const bookingCount = bookings.filter((booking) => booking.status !== 'cancelled').length;
      const cancelledBookingCount = bookings.length - bookingCount;
      const capacity = workoutClass?.capacity ?? null;

      return {
        id: instance.id,
        date: instance.date,
        isCancelled: Boolean(instance.is_cancelled),
        workoutClass,
        bookings,
        bookingCount,
        cancelledBookingCount,
        seatsRemaining:
          typeof capacity === 'number' ? Math.max(capacity - bookingCount, 0) : null,
      };
    })
    .sort(sortCalendarSessions);

  return {
    props: {
      calendarSessions,
      classes,
      initialMonth: getMonthStartIso(todayIsoDate()),
      instructors,
      loadError: errors.length > 0 ? errors.join(' ') : null,
    },
  };
};

export default function AdminDashboard({
  calendarSessions,
  classes,
  initialMonth,
  instructors,
  loadError,
}: AdminPageProps) {
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(
    getPreferredDateForMonth(initialMonth, calendarSessions)
  );
  const [editingInstructorId, setEditingInstructorId] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [instructorForm, setInstructorForm] = useState<InstructorFormState>({
    bio: '',
    imageDataUrl: '',
    imagePreviewUrl: null,
    name: '',
  });
  const [classForm, setClassForm] = useState<ClassFormState>(() => createDefaultClassForm());
  const [instructorFeedback, setInstructorFeedback] = useState<Feedback | null>(null);
  const [classFeedback, setClassFeedback] = useState<Feedback | null>(null);
  const [isSavingInstructor, setIsSavingInstructor] = useState(false);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const isEditingInstructor = editingInstructorId !== null;
  const isEditingClass = editingClassId !== null;

  const sessionsByDate = groupSessionsByDate(calendarSessions);
  const visibleMonthSessions = calendarSessions.filter((session) =>
    session.date.startsWith(visibleMonth.slice(0, 7))
  );
  const selectedDaySessions = sessionsByDate.get(selectedDate) ?? [];
  const instructorNameById = new Map(instructors.map((instructor) => [instructor.id, instructor.name]));
  const sessionsPerClass = countSessionsPerClass(calendarSessions);
  const totalActiveBookings = calendarSessions.reduce(
    (total, session) => total + session.bookingCount,
    0
  );
  const monthlyBookings = visibleMonthSessions.reduce(
    (total, session) => total + session.bookingCount,
    0
  );

  function startInstructorEdit(instructor: Instructor) {
    setEditingInstructorId(instructor.id);
    setInstructorForm({
      bio: instructor.bio ?? '',
      imageDataUrl: '',
      imagePreviewUrl: instructor.imageUrl,
      name: instructor.name,
    });
    setInstructorFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelInstructorEdit() {
    setEditingInstructorId(null);
    setInstructorForm({
      bio: '',
      imageDataUrl: '',
      imagePreviewUrl: null,
      name: '',
    });
    setInstructorFeedback(null);
  }

  function startClassEdit(workoutClass: WorkoutClass) {
    setEditingClassId(workoutClass.id);
    setClassForm(createClassFormFromClass(workoutClass));
    setClassFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelClassEdit() {
    setEditingClassId(null);
    setClassForm(createDefaultClassForm());
    setClassFeedback(null);
  }

  async function handleSaveInstructor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInstructorFeedback(null);
    setIsSavingInstructor(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setIsSavingInstructor(false);
        return;
      }

      const response = await fetch(
        isEditingInstructor
          ? `/api/admin/instructors/${editingInstructorId}`
          : '/api/admin/instructors',
        {
          method: isEditingInstructor ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            bio: instructorForm.bio,
            imageDataUrl: instructorForm.imageDataUrl || undefined,
            name: instructorForm.name,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setInstructorFeedback({
          message: readErrorMessage(
            payload,
            isEditingInstructor
              ? 'Unable to update the instructor right now.'
              : 'Unable to create the instructor right now.'
          ),
          tone: 'error',
        });
        return;
      }

      setInstructorFeedback({
        message: payload.message ?? (isEditingInstructor ? 'Instructor updated. Refreshing…' : 'Instructor created. Refreshing…'),
        tone: 'success',
      });
      window.location.assign('/admin');
    } catch (error) {
      setInstructorFeedback({
        message: error instanceof Error ? error.message : 'Unable to save the instructor.',
        tone: 'error',
      });
    } finally {
      setIsSavingInstructor(false);
    }
  }

  async function handleSaveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClassFeedback(null);
    setIsSavingClass(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setIsSavingClass(false);
        return;
      }

      const response = await fetch(
        isEditingClass ? `/api/admin/classes/${editingClassId}` : '/api/admin/classes',
        {
          method: isEditingClass ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(classForm),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setClassFeedback({
          message: readErrorMessage(
            payload,
            isEditingClass
              ? 'Unable to update the class right now.'
              : 'Unable to create the class right now.'
          ),
          tone: 'error',
        });
        return;
      }

      setClassFeedback({
        message: payload.message ?? (isEditingClass ? 'Class updated. Refreshing…' : 'Class created. Refreshing…'),
        tone: 'success',
      });
      window.location.assign('/admin');
    } catch (error) {
      setClassFeedback({
        message: error instanceof Error ? error.message : 'Unable to save the class.',
        tone: 'error',
      });
    } finally {
      setIsSavingClass(false);
    }
  }

  function shiftVisibleMonth(direction: number) {
    const nextMonth = shiftMonth(visibleMonth, direction);
    setVisibleMonth(nextMonth);
    setSelectedDate(getPreferredDateForMonth(nextMonth, calendarSessions));
  }

  function selectCalendarDate(date: string) {
    setSelectedDate(date);

    const monthStart = getMonthStartIso(date);
    if (monthStart !== visibleMonth) {
      setVisibleMonth(monthStart);
    }
  }

  function updateClassDayOfWeek(dayOfWeek: string) {
    setClassForm((current) => ({
      ...current,
      dayOfWeek,
      firstDate: isDateMatchingStudioDay(current.firstDate, dayOfWeek)
        ? current.firstDate
        : getNextDateForStudioDay(dayOfWeek),
    }));
  }

  async function handleInstructorImageChange(event: ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const file = inputElement.files?.[0];
    if (!file) {
      return;
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      setInstructorForm((current) => ({
        ...current,
        imageDataUrl,
        imagePreviewUrl: imageDataUrl,
      }));
      setInstructorFeedback(null);
    } catch (error) {
      setInstructorFeedback({
        message: error instanceof Error ? error.message : 'Unable to read the selected image.',
        tone: 'error',
      });
    } finally {
      inputElement.value = '';
    }
  }

  return (
    <>
      <NavHeader />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                Admin
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
                Studio Control Panel
              </h1>
              <p className="mt-3 max-w-3xl text-base text-slate-600">
                Create instructors, publish bookable classes with weekly sessions, and track
                bookings on the calendar in one place.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Visible Month
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatMonthLabel(visibleMonth)}
              </p>
            </div>
          </header>

          {loadError && (
            <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Some admin data could not be loaded cleanly. {loadError}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Classes" value={String(classes.length)} />
            <MetricCard label="Instructors" value={String(instructors.length)} />
            <MetricCard label="Scheduled Sessions" value={String(calendarSessions.length)} />
            <MetricCard label="Booked Seats" value={String(totalActiveBookings)} />
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  {isEditingInstructor ? 'Edit Instructor' : 'Add Instructor'}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {isEditingInstructor ? 'Update coach profile' : 'Create a new coach profile'}
                </h2>
              </div>

              <form className="space-y-4" onSubmit={handleSaveInstructor}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="instructor-name">
                    Name
                  </label>
                  <input
                    id="instructor-name"
                    value={instructorForm.name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setInstructorForm((current) => ({
                        ...current,
                        name: value,
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    placeholder="Susana Ortega"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="instructor-bio">
                    Bio
                  </label>
                  <textarea
                    id="instructor-bio"
                    value={instructorForm.bio}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setInstructorForm((current) => ({
                        ...current,
                        bio: value,
                      }));
                    }}
                    className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    placeholder="Short instructor intro, specialties, and training style."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="instructor-image">
                    Photo
                  </label>
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                    <img
                      src={instructorForm.imagePreviewUrl || '/placeholder-avatar.png'}
                      alt={instructorForm.name || 'Instructor preview'}
                      className="h-24 w-24 rounded-2xl object-cover shadow-sm"
                    />
                    <div className="flex-1">
                      <input
                        id="instructor-image"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleInstructorImageChange}
                        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-slate-800"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Upload JPG, PNG, WEBP, or GIF. The newest uploaded photo becomes the instructor profile image.
                      </p>
                    </div>
                  </div>
                </div>

                <FeedbackMessage feedback={instructorFeedback} />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSavingInstructor}
                    className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingInstructor
                      ? isEditingInstructor
                        ? 'Saving Changes…'
                        : 'Saving Instructor…'
                      : isEditingInstructor
                        ? 'Save Instructor Changes'
                        : 'Create Instructor'}
                  </button>
                  {isEditingInstructor && (
                    <button
                      type="button"
                      onClick={cancelInstructorEdit}
                      className="inline-flex rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  {isEditingClass ? 'Edit Class' : 'Add Class'}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  {isEditingClass ? 'Update class details' : 'Create a class and schedule it'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {isEditingClass
                    ? 'This edit updates the class record. Existing generated session dates stay in place.'
                    : 'The first date must match the selected weekday. The page generates weekly class instances so the class becomes bookable immediately.'}
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSaveClass}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-title">
                      Title
                    </label>
                    <input
                      id="class-title"
                      value={classForm.title}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setClassForm((current) => ({
                          ...current,
                          title: value,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      placeholder="Morning Strength"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-description">
                      Description
                    </label>
                    <textarea
                      id="class-description"
                      value={classForm.description}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setClassForm((current) => ({
                          ...current,
                          description: value,
                        }));
                      }}
                      className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      placeholder="What members can expect from this class."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-instructor">
                      Instructor
                    </label>
                    <select
                      id="class-instructor"
                      value={classForm.instructorId}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setClassForm((current) => ({
                          ...current,
                          instructorId: value,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                    >
                      <option value="">Unassigned / TBA</option>
                      {instructors.map((instructor) => (
                        <option key={instructor.id} value={instructor.id}>
                          {instructor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isEditingClass ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-day-readonly">
                        Weekly Day
                      </label>
                      <input
                        id="class-day-readonly"
                        value={formatStudioDayLabel(classForm.dayOfWeek)}
                        readOnly
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-day">
                        Weekly Day
                      </label>
                      <select
                        id="class-day"
                        value={classForm.dayOfWeek}
                        onChange={(event) => updateClassDayOfWeek(event.currentTarget.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      >
                        {STUDIO_DAY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-time">
                      Start Time
                    </label>
                    <input
                      id="class-time"
                      type="time"
                      value={classForm.startTime}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setClassForm((current) => ({
                          ...current,
                          startTime: value,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-duration">
                      Duration (minutes)
                    </label>
                    <input
                      id="class-duration"
                      type="number"
                      min="1"
                      value={classForm.duration}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setClassForm((current) => ({
                          ...current,
                          duration: value,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-capacity">
                      Capacity
                    </label>
                    <input
                      id="class-capacity"
                      type="number"
                      min="1"
                      value={classForm.capacity}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setClassForm((current) => ({
                          ...current,
                          capacity: value,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      required
                    />
                  </div>

                  {!isEditingClass && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-first-date">
                          First Session Date
                        </label>
                        <input
                          id="class-first-date"
                          type="date"
                          value={classForm.firstDate}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setClassForm((current) => ({
                              ...current,
                              firstDate: value,
                            }));
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-session-count">
                          Number of Weekly Sessions
                        </label>
                        <input
                          id="class-session-count"
                          type="number"
                          min="1"
                          max="52"
                          value={classForm.sessionCount}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setClassForm((current) => ({
                              ...current,
                              sessionCount: value,
                            }));
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="class-stripe-price-id">
                      Stripe Price ID
                    </label>
                    <input
                      id="class-stripe-price-id"
                      value={classForm.stripePriceId}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setClassForm((current) => ({
                          ...current,
                          stripePriceId: value,
                        }));
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <FeedbackMessage feedback={classFeedback} />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSavingClass}
                    className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingClass
                      ? isEditingClass
                        ? 'Saving Changes…'
                        : 'Creating Class…'
                      : isEditingClass
                        ? 'Save Class Changes'
                        : 'Create Class'}
                  </button>
                  {isEditingClass && (
                    <button
                      type="button"
                      onClick={cancelClassEdit}
                      className="inline-flex rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Booking Calendar
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">See classes and bookings by day</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {visibleMonthSessions.length} sessions and {monthlyBookings} active bookings in{' '}
                  {formatMonthLabel(visibleMonth)}.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => shiftVisibleMonth(-1)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Prev
                </button>
                <div className="min-w-40 text-center text-sm font-semibold text-slate-900">
                  {formatMonthLabel(visibleMonth)}
                </div>
                <button
                  type="button"
                  onClick={() => shiftVisibleMonth(1)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <div>
                <div className="grid grid-cols-7 gap-2">
                  {CALENDAR_DAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {buildCalendarDays(visibleMonth).map((day) => {
                    const daySessions = sessionsByDate.get(day.date) ?? [];
                    const isSelected = day.date === selectedDate;
                    const isToday = day.date === todayIsoDate();

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => selectCalendarDate(day.date)}
                        className={`min-h-32 rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                            : day.isCurrentMonth
                              ? 'border-slate-200 bg-slate-50 hover:bg-white'
                              : 'border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {formatDayNumber(day.date)}
                          </span>
                          {isToday && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                                isSelected
                                  ? 'bg-white/15 text-white'
                                  : 'bg-slate-900 text-white'
                              }`}
                            >
                              Today
                            </span>
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          {daySessions.length === 0 ? (
                            <p
                              className={`text-xs ${
                                isSelected ? 'text-white/70' : 'text-slate-400'
                              }`}
                            >
                              No sessions
                            </p>
                          ) : (
                            <>
                              {daySessions.slice(0, 2).map((session) => (
                                <div
                                  key={session.id}
                                  className={`rounded-xl px-2 py-1.5 text-xs ${
                                    isSelected
                                      ? 'bg-white/10 text-white'
                                      : 'bg-white text-slate-700 shadow-sm'
                                  }`}
                                >
                                  <div className="font-semibold">
                                    {session.workoutClass?.title ?? 'Untitled class'}
                                  </div>
                                  <div
                                    className={
                                      isSelected ? 'text-white/70' : 'text-slate-500'
                                    }
                                  >
                                    {session.workoutClass?.startTime ?? 'Time TBD'} ·{' '}
                                    {session.bookingCount} booked
                                  </div>
                                </div>
                              ))}
                              {daySessions.length > 2 && (
                                <div
                                  className={`text-xs font-semibold ${
                                    isSelected ? 'text-white/75' : 'text-slate-500'
                                  }`}
                                >
                                  +{daySessions.length - 2} more
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  Selected Date
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {formatLongDate(selectedDate)}
                </h3>

                <div className="mt-5 space-y-4">
                  {selectedDaySessions.length > 0 ? (
                    selectedDaySessions.map((session) => (
                      <article
                        key={session.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-semibold text-slate-900">
                              {session.workoutClass?.title ?? 'Untitled class'}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              {session.workoutClass?.startTime ?? 'Time TBD'} ·{' '}
                              {formatStudioDayLabel(session.workoutClass?.day_of_week)}
                            </p>
                          </div>
                          <StatusPill
                            tone={session.isCancelled ? 'error' : 'neutral'}
                            label={session.isCancelled ? 'Cancelled' : 'Scheduled'}
                          />
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <InfoTile label="Booked" value={String(session.bookingCount)} />
                          <InfoTile
                            label="Cancelled"
                            value={String(session.cancelledBookingCount)}
                          />
                          <InfoTile
                            label="Seats Left"
                            value={
                              session.seatsRemaining === null
                                ? 'Unlimited'
                                : String(session.seatsRemaining)
                            }
                          />
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Bookings
                          </p>
                          {session.bookings.length > 0 ? (
                            <ul className="mt-3 space-y-2">
                              {session.bookings.map((booking) => (
                                <li
                                  key={booking.id}
                                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                                >
                                  <div>
                                    <div className="text-sm font-medium text-slate-800">
                                      {booking.memberName}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {booking.paid ? 'Paid' : 'Unpaid'} ·{' '}
                                      {formatCreatedAt(booking.createdAt)}
                                    </div>
                                  </div>
                                  <StatusPill
                                    tone={booking.status === 'cancelled' ? 'error' : 'success'}
                                    label={booking.status}
                                  />
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-slate-500">No bookings for this session yet.</p>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                      No class sessions are scheduled for this date.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                Instructor Roster
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Current instructors</h2>

              {instructors.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {instructors.map((instructor) => (
                    <li
                      key={instructor.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-start gap-4">
                            <img
                              src={instructor.imageUrl || '/placeholder-avatar.png'}
                              alt={instructor.name}
                              className="h-16 w-16 rounded-2xl object-cover shadow-sm"
                            />
                            <div>
                              <div className="font-semibold text-slate-900">{instructor.name}</div>
                              <p className="mt-1 text-sm text-slate-500">
                                {instructor.bio || 'No bio added yet.'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => startInstructorEdit(instructor)}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          Edit
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-slate-500">No instructors added yet.</p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                Class Catalog
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Current classes</h2>

              {classes.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {classes.map((workoutClass) => (
                    <li
                      key={workoutClass.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{workoutClass.title}</div>
                          <p className="mt-1 text-sm text-slate-500">
                            {instructorNameById.get(workoutClass.instructor_id ?? '') ??
                              'Unassigned'}{' '}
                            · {formatStudioDayLabel(workoutClass.day_of_week)} ·{' '}
                            {workoutClass.startTime ?? 'Time TBD'}
                          </p>
                        </div>
                        <StatusPill
                          tone="neutral"
                          label={`${sessionsPerClass.get(workoutClass.id) ?? 0} sessions`}
                        />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => startClassEdit(workoutClass)}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          Edit
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-slate-500">No classes created yet.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'error' | 'neutral' | 'success';
}) {
  const styles =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'error'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-200 text-slate-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles}`}>
      {label}
    </span>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm ${
        feedback.tone === 'success'
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      {feedback.message}
    </div>
  );
}

function createDefaultClassForm(): ClassFormState {
  return {
    capacity: '15',
    dayOfWeek: '1',
    description: '',
    duration: '50',
    firstDate: getNextDateForStudioDay('1'),
    instructorId: '',
    sessionCount: '8',
    startTime: '10:00',
    stripePriceId: '',
    title: '',
  };
}

function createClassFormFromClass(workoutClass: WorkoutClass): ClassFormState {
  return {
    capacity: String(workoutClass.capacity ?? 1),
    dayOfWeek: workoutClass.day_of_week ?? '1',
    description: workoutClass.description ?? '',
    duration: String(workoutClass.duration ?? 1),
    firstDate: '',
    instructorId: workoutClass.instructor_id ?? '',
    sessionCount: '',
    startTime: workoutClass.startTime ?? '10:00',
    stripePriceId: workoutClass.stripePriceId ?? '',
    title: workoutClass.title,
  };
}

function normalizeInstructor(
  row: RawInstructorRow,
  imageUrl: string | null
): Instructor {
  return {
    bio: row.bio?.trim() || null,
    id: row.id,
    imageUrl,
    name: row.name?.trim() || 'Unnamed Instructor',
  };
}

function normalizeWorkoutClass(row: RawClassRow): WorkoutClass {
  return {
    capacity: row.capacity ?? null,
    day_of_week: row.day_of_week ?? null,
    description: row.description?.trim() || null,
    duration: row.duration ?? null,
    id: row.id,
    instructor_id: row.instructor_id ?? null,
    startTime: row.startTime ?? null,
    stripePriceId: row.stripePriceId ?? null,
    title: row.title?.trim() || 'Untitled Class',
  };
}

function normalizeBooking(row: RawBookingRow): BookingSummary {
  return {
    createdAt: row.created_at,
    id: row.id,
    memberName: row.profiles?.full_name?.trim() || `Member ${row.user_id.slice(0, 8)}`,
    paid: Boolean(row.paid),
    status: row.status ?? 'unknown',
    userId: row.user_id,
  };
}

function sortCalendarSessions(left: CalendarSession, right: CalendarSession) {
  const dateCompare = left.date.localeCompare(right.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const timeCompare = (left.workoutClass?.startTime ?? '').localeCompare(
    right.workoutClass?.startTime ?? ''
  );
  if (timeCompare !== 0) {
    return timeCompare;
  }

  return (left.workoutClass?.title ?? '').localeCompare(right.workoutClass?.title ?? '');
}

function groupSessionsByDate(calendarSessions: CalendarSession[]) {
  const grouped = new Map<string, CalendarSession[]>();

  for (const session of calendarSessions) {
    const current = grouped.get(session.date) ?? [];
    current.push(session);
    grouped.set(session.date, current);
  }

  return grouped;
}

function countSessionsPerClass(calendarSessions: CalendarSession[]) {
  const counts = new Map<string, number>();

  for (const session of calendarSessions) {
    const classId = session.workoutClass?.id;
    if (!classId) {
      continue;
    }

    counts.set(classId, (counts.get(classId) ?? 0) + 1);
  }

  return counts;
}

function buildCalendarDays(monthIsoDate: string) {
  const monthStart = parseIsoDate(monthIsoDate);
  const calendarStart = addUtcDays(monthStart, -monthStart.getUTCDay());
  const monthKey = monthIsoDate.slice(0, 7);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addUtcDays(calendarStart, index);
    const isoDate = formatIsoDate(date);

    return {
      date: isoDate,
      isCurrentMonth: isoDate.startsWith(monthKey),
    };
  });
}

function getPreferredDateForMonth(monthIsoDate: string, calendarSessions: CalendarSession[]) {
  const monthKey = monthIsoDate.slice(0, 7);
  const firstSessionInMonth = calendarSessions.find((session) =>
    session.date.startsWith(monthKey)
  );

  return firstSessionInMonth?.date ?? monthIsoDate;
}

function shiftMonth(monthIsoDate: string, amount: number) {
  const currentMonth = parseIsoDate(monthIsoDate);
  const shiftedMonth = new Date(currentMonth.getTime());
  shiftedMonth.setUTCMonth(shiftedMonth.getUTCMonth() + amount, 1);
  return formatIsoDate(shiftedMonth);
}

function todayIsoDate() {
  const now = new Date();
  return formatIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

function getMonthStartIso(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return formatIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

function getNextDateForStudioDay(dayOfWeek: string) {
  const today = parseIsoDate(todayIsoDate());
  let currentDate = today;

  for (let index = 0; index < 14; index += 1) {
    if (toStudioDayValue(currentDate) === dayOfWeek) {
      return formatIsoDate(currentDate);
    }

    currentDate = addUtcDays(currentDate, 1);
  }

  return formatIsoDate(today);
}

function isDateMatchingStudioDay(isoDate: string, dayOfWeek: string) {
  if (!isoDate) {
    return false;
  }

  return toStudioDayValue(parseIsoDate(isoDate)) === dayOfWeek;
}

function formatMonthLabel(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parseIsoDate(isoDate));
}

function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(parseIsoDate(isoDate));
}

function formatDayNumber(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parseIsoDate(isoDate));
}

function formatCreatedAt(isoDateTime: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(isoDateTime));
}

function formatStudioDayLabel(dayOfWeek: string | null | undefined) {
  return STUDIO_DAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ?? 'Day TBA';
}

function toStudioDayValue(date: Date) {
  return String((date.getUTCDay() + 1) % 7);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, amount: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + amount);
  return nextDate;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const { error } = payload as { error?: unknown };
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
  }

  return fallback;
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.assign('/login');
    return null;
  }

  return session.access_token;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Could not read the selected image.'));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read the selected image.'));
    };

    reader.readAsDataURL(file);
  });
}
