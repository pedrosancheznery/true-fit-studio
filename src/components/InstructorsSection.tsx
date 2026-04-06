type InstructorCard = {
  bio?: string | null;
  id?: string;
  imageUrl?: string | null;
  name?: string | null;
  _id?: string;
};

export default function InstructorsSection({ instructors }: { instructors: InstructorCard[] }) {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Meet the Instructors</h2>
          <p className="mt-4 text-lg text-gray-600 italic">Expert guidance for every workout.</p>
        </div>

        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map((instructor) => (
            <div key={instructor.id ?? instructor._id ?? instructor.name} className="text-center group">
              <div className="relative inline-block">
                <img
                  className="mx-auto h-48 w-48 rounded-full object-cover shadow-lg group-hover:scale-105 transition-transform duration-300"
                  src={instructor.imageUrl || '/placeholder-avatar.png'}
                  alt={instructor.name || 'Instructor'}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = '/placeholder-avatar.png';
                  }}
                />
              </div>
              <div className="mt-6">
                <h3 className="text-xl font-bold text-gray-900">{instructor.name || 'Instructor'}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed px-4">
                  {instructor.bio}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
