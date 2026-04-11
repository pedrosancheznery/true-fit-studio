// pages/admin/classes.tsx
import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSSRClient } from '@/lib/ssrClient';
import NavHeader from '@/components/NavHeader';
import { supabase } from '@/lib/supabaseClient';

type Instance = { id: string; date: string; is_cancelled: boolean; classes: { title: string } };

type AdminProps = {
  instances: Instance[];
  isAdmin: boolean;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = getSSRClient(ctx);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { redirect: { destination: '/login', permanent: false } };

  // New: Join profiles with roles via role_id FK to check role name
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles(name)') // Assumes 'roles' table has 'name' column
    .eq('id', user.id)
    .single();
  
  // Use optional chaining and index [0] to access the first role
  const isAdmin = (profile?.roles as any)?.[0]?.name === 'admin';
  //const isAdmin = profile?.roles?.name === 'admin'; // Or 'role_name' if column differs
  if (!isAdmin) return { redirect: { destination: '/', permanent: false } };

  // Fetch instances (unchanged)
  const { data: instances } = await supabase
    .from('class_instances')
    .select('id, date, is_cancelled, classes(title, startTime)')
    .order('date');

  return { props: { instances: instances || [], isAdmin } };
};

export default function AdminClasses({ instances, isAdmin }: AdminProps) {
  if (!isAdmin) return <p>Access denied.</p>;

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('class_instances').update({ is_cancelled: true }).eq('id', id);
    if (!error) alert('Class cancelled!'); // Refresh or update list locally
  };

  const handleReactivate = async (id: string) => {
    const { error } = await supabase.from('class_instances').update({ is_cancelled: false }).eq('id', id);
    if (!error) alert('Class active!'); // Refresh or update list locally
  };

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <NavHeader />
      <main className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold">Admin: Manage Classes</h1>
        <table className="table-auto w-full mt-4 border-separate border-spacing-y-2">
          <thead><tr><th>Title</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {instances.map(inst => (
              <tr key={inst.id}>
                <td>{inst.classes.title}</td>
                <td>{inst.date} @ {(inst.classes as any)?.[0]?.startTime}</td>
                <td>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    inst.is_cancelled
                      ? 'bg-slate-200 text-slate-600'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {inst.is_cancelled ? 'Cancelled' : 'Active'}
                  </span>
                </td>
                <td>
                  <button 
                    className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
                      inst.is_cancelled
                        ? 'bg-green-700 text-white hover:bg-green-500' // Changed to red for Reactivate to imply action? Or keep green?
                        : 'bg-red-700 text-white hover:bg-red-500'
                    }`} 
                    onClick={() => inst.is_cancelled ? handleReactivate(inst.id) : handleCancel(inst.id)}
                  >
                    {inst.is_cancelled ? 'Reactivate' : 'Cancel'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
    </>
  );
}