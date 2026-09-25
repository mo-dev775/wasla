import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { user_id } = await req.json()

  // grab the first available number
  const { data: available, error: findErr } = await supabase
    .from('numbers')
    .select('number')
    .eq('status', 'available')
    .limit(1)
    .single()

  if (findErr || !available) {
    return new Response(JSON.stringify({ error: 'No numbers available' }), { status: 400 })
  }

  // assign it
  const { error: updateErr } = await supabase
    .from('numbers')
    .update({ status: 'assigned', assigned_user_id: user_id })
    .eq('number', available.number)

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })
  }

  // stamp it onto the user + approve them
  await supabase
    .from('users')
    .update({ phone_number: available.number, status: 'approved' })
    .eq('id', user_id)

  return new Response(JSON.stringify({ number: available.number }), { status: 200 })
})