// pages/members/profile.tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSSRClient } from '@/lib/ssrClient';
import { supabase } from '@/lib/supabaseClient';
import NavHeader from '@/components/NavHeader';
import ProfileForm from '@/components/ProfileForm'; // Adjust path if needed

type Profile = {
  id?: string | null;
  full_name?: string | null;
  membership_level?: string | null;
  created_at?: string | null;
  role?: string | null;
} | null;

type ProfileProps = {
  initialProfile: Profile[];
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = getSSRClient(ctx);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { redirect: { destination: '/login', permanent: false } };

  // Updated: Query by 'id' matching user.id (per schema)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, membership_level, created_at')
    .eq('id', user.id) // Fixed: Was 'user_id'
    .maybeSingle(); // Use maybeSingle for single row (or limit(1) if not populated)

  console.log('Fetched profile:', profile); // Fixed: Log the profile
  return { props: { initialProfile: profile ? [profile] : [] } };
};

export default function Profile({ initialProfile }: ProfileProps) {
  // State for profile data (separate from auth)
  const [profileState, setProfileState] = useState<Profile>(initialProfile[0] || null);
  const [authUser, setAuthUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    // Auth state setup (separate from profile)
    const fetchAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAuthUser({ id: session.user.id, email: session.user.email || undefined });
      }
    };
    fetchAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUser({ id: session.user.id, email: session.user.email || undefined });
      } else {
        setAuthUser(null);
      }
    });

    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavHeader />
      <main className="max-w-4xl mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500">Manage your profile settings.</p>
        </header>

        <div className="space-y-4">
          <div className="container mx-auto p-4 max-w-2xl">
            {profileState ? (
              <ProfileForm profile={profileState} onUpdate={setProfileState} />
            ) : (
              <p>Loading or no profile found.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
