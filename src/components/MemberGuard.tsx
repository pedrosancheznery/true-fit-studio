import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
<<<<<<< HEAD
import { supabase } from '@lib/supabaseClient';
=======
import { supabase } from "@/lib/supabaseClient";
>>>>>>> dev

export default function MemberGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Not logged in? Send them to login
        router.push('/login');
      } else {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for sign-out events to kick them out immediately
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login');
    });

    return () => authListener.subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}
