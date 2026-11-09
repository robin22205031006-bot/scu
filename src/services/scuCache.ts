import { supabase } from '../lib/supabase';

export const scuCache = {
  async getCharacters() {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase.from('characters').select('*');
        if (!error && data) {
          localStorage.setItem('scu_characters_cache', JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Network query failed, reading offline cache:', err);
      }
    }
    const cached = localStorage.getItem('scu_characters_cache');
    return cached ? JSON.parse(cached) : [];
  },

  async getOrganizations() {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase.from('organizations').select('*');
        if (!error && data) {
          localStorage.setItem('scu_organizations_cache', JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Network query failed, reading offline cache:', err);
      }
    }
    const cached = localStorage.getItem('scu_organizations_cache');
    return cached ? JSON.parse(cached) : [];
  },

  async getTimeline() {
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase.from('timeline_events').select('*');
        if (!error && data) {
          localStorage.setItem('scu_timeline_cache', JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Network query failed, reading offline cache:', err);
      }
    }
    const cached = localStorage.getItem('scu_timeline_cache');
    return cached ? JSON.parse(cached) : [];
  }
};