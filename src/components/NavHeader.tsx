import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from '@/lib/supabaseClient';

export default function NavHeader() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<{ name?: string } | null>(null);
  const [isAdmin, setAdmin] = useState(false);

  useEffect(() => {
    // 1. Handle the initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ 
          id: session.user.id, 
          email: session.user.email || undefined 
        });
      }
    });

    // 2. Handle auth changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ 
          id: session.user.id, 
          email: session.user.email || undefined 
        });
      } else {
        setUser(null);
        setRole(null); // Clear role on logout
        setAdmin(false);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const getProfile = async () => {
      // Only fetch if we have a user and don't have a role yet
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('roles(name)')
        .eq('id', user.id)
        .single();

      // The 'any' cast here helps if your Supabase types aren't fully generated
      const profileData = data as any; 

      if (profileData?.roles?.name) {
        setRole(profileData.roles.name);
        setAdmin(profileData.roles.name === "admin");
      }
    };

    getProfile();
  }, [user]); // This triggers automatically as soon as setUser is called above

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/"); 
  }

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium ${router.pathname === path ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`;

  return (
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="text-xl font-semibold">Studio</Link>

            <nav className="hidden sm:flex space-x-1">
              <Link href="/classes" className={linkClass("/classes")}>Gallery</Link>
              <Link href="/members/my-bookings" className={linkClass("/members/my-bookings")}>My Bookings</Link>
              {user && (
                <Link href="/members/profile" className={linkClass("/members/profile")}>My Profile</Link>
              )}
              {isAdmin && (
                <Link href="/admin/classes" className={linkClass("/admin/classes")}>Admin Classes</Link>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block">
              {user ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-slate-700">{user.email ? user.email.split("@")[0] : `Member`}</div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1 rounded-md bg-red-500 text-white text-sm hover:bg-red-600"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link href="/login" className="px-3 py-1 rounded-md bg-slate-700 text-white text-sm hover:bg-slate-800">Login</Link>
              )}
            </div>

            <div className="sm:hidden">
              <button
                onClick={() => setOpen((v) => !v)}
                className="p-2 rounded-md text-slate-700 hover:bg-slate-100"
                aria-label="Toggle menu"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div className="sm:hidden py-2">
            <Link href="/classes" className="block px-3 py-2 rounded-md text-base font-medium">Gallery</Link>
            <Link href="/members/my-bookings" className="block px-3 py-2 rounded-md text-base font-medium">My Bookings</Link>
            <div className="border-t mt-2 pt-2">
              {user ? (
                <div className="flex items-center justify-between px-3">
                  <span className="text-sm">{user.email ? user.email.split("@")[0] : "Member"}</span>
                  <button onClick={handleLogout} className="px-3 py-1 rounded-md bg-red-500 text-white text-sm">Logout</button>
                </div>
              ) : (
                <Link href="/login" className="block px-3 py-2 rounded-md bg-slate-700 text-white text-center">Login</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
