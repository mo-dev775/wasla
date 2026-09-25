import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { user_id, minutes } = await req.json()

  // credits are 1:1 with minutes (1 credit = 1 minute)
  const cost = minutes

  const { data: user, error: findErr } = await supabase
    .from('users')
    .select('credits')
    .eq('id', user_id)
    .single()

  if (findErr || !user) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })
  }

  if (user.credits < cost) {
    return new Response(JSON.stringify({ error: 'Insufficient credits' }), { status: 402 })
  }

  const newBalance = user.credits - cost

  const { error: updateErr } = await supabase
    .from('users')
    .update({ credits: newBalance })
    .eq('id', user_id)

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })
  }

  await supabase.from('credit_transactions').insert({
    user_id,
    amount: -cost,
    type: 'deduction'
  })

  return new Response(JSON.stringify({ new_balance: newBalance }), { status: 200 })
})