import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// This uses your .env.local variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TestDB() {
  const [status, setStatus] = useState('Testing connection...')

  const testInsert = async () => {
    const { data, error } = await supabase
      .from('classes')
      .insert([{ title: 'Connection Test Class', instructor: 'System' }])
      .select()

    if (error) setStatus(`Error: ${error.message}`)
    else setStatus(`Success! Inserted: ${data[0].title}`)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Supabase Connection Test</h1>
      <p>Status: {status}</p>
      <button onClick={testInsert}>Try Insert Record</button>
    </div>
  )
}
