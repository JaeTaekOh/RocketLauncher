import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://abc.supabase.co', 'public-anon-key');
export const routes = () => supabase.from('routes').select('*');
