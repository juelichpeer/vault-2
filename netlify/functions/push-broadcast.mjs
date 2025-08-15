import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function handler(event) {
  try{
    const body = JSON.parse(event.body || '{}');
    // Expected shape if called from a DB webhook on messages:
    // { record: { content, sender_id } }
    const rec = body.record || body;

    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
    const { data: subs } = await supa.from('push_subscriptions').select('endpoint, keys, user_id');

    const payload = JSON.stringify({
      title: 'VAULT',
      body: rec?.content ? String(rec.content).slice(0,120) : 'New message',
      url: process.env.PUBLIC_SITE_URL || '/'
    });

    const results = await Promise.allSettled(
      (subs||[])
        .filter(s => s.user_id !== rec?.sender_id)
        .map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload))
    );

    // Clean up dead endpoints
    const toDelete = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const code = r.reason?.statusCode || r.reason?.status;
        if (code === 404 || code === 410) toDelete.push(subs[i].endpoint);
      }
    });
    if (toDelete.length) await supa.from('push_subscriptions').delete().in('endpoint', toDelete);

    return { statusCode: 200, body: JSON.stringify({ ok:true }) };
  }catch(e){
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
