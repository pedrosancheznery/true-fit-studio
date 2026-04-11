// components/ProfileForm.tsx
import { useState } from 'react';

// 1. Define what a Profile actually looks like
export type Profile = {
  id?: string | null;           // Add ? and | null
  full_name?: string | null;
  role_id?: string | null;
  membership_level?: string | null;
  created_at?: string | null;
};

type ProfileFormProps = {
  profile: Profile | null;
  onUpdate: (updated: Profile) => void;
};

const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onUpdate }) => {
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    membership_level: profile?.membership_level || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        alert('Profile updated!');
        onUpdate(data.profile); // Pass back updated profile
      } else {
        alert('Update failed: ' + data.error);
      } 
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        alert('Network error: ' + errorMessage);
    } finally {
    setSaving(false);
  }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-semibold">Full Name</label>
        <input
          type="text"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div>
        <label className="block font-semibold">Membership Level</label>
        <select
          name="membership_level"
          value={formData.membership_level}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        >
          <option value=""></option>
          <option value="Basic">Basic</option>
          <option value="Premium">Premium</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {saving ? 'Saving...' : 'Update Profile'}
      </button>
    </form>
  );
};

export default ProfileForm;

