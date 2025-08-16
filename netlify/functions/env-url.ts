import { Handler } from '@netlify/functions'
export const handler: Handler = async () => ({ statusCode: 200, body: process.env.SUPABASE_URL || '' })
