import { useState, useEffect, useCallback, useRef } from 'react';
import supabase, { TABLES } from '@/lib/supabase';
const searchStorage = {
  getItem: async (key: string) => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      const AS = require('@react-native-async-storage/async-storage').default;
      return AS.getItem(key);
    } catch {
      return null;
    }
  },
};
interface SearchUser {
  $id: string;
  user_id: string;
  full_name: string;
  interested_skills: string;
  location: string;
  bio: string;
  profile_image: string;
  skills: string[];
}
interface SearchCache {
  [query: string]: {
    results: SearchUser[];
    timestamp: number;
  };
}
const CACHE_DURATION = 5 * 60 * 1000;
const DEBOUNCE_DELAY = 500;
const PAGE_SIZE = 20;
export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const cacheRef = useRef<SearchCache>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserIdRef = useRef<string>('');
  useEffect(() => {
    searchStorage.getItem('userId').then(id => {
      if (id) currentUserIdRef.current = id;
    });
  }, []);
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (query.trim().length === 0) {
      setResults([]);
      setOffset(0);
      setHasMore(true);
      return;
    }
    if (query.trim().length < 2) {
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      performSearch(query, 0);
    }, DEBOUNCE_DELAY);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);
  const performSearch = async (searchQuery: string, pageOffset: number) => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (pageOffset === 0) {
      const cached = cacheRef.current[trimmedQuery];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setResults(cached.results);
        setHasMore(cached.results.length === PAGE_SIZE);
        return;
      }
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.users)
        .select('*')
        .or(`full_name.ilike.%${trimmedQuery}%,location.ilike.%${trimmedQuery}%`)
        .neq('userId', currentUserIdRef.current)
        .range(pageOffset, pageOffset + PAGE_SIZE - 1);
      if (error) throw error;
      const searchResults = (data ?? []) as unknown as SearchUser[];
      if (pageOffset === 0) {
        setResults(searchResults);
        cacheRef.current[trimmedQuery] = {
          results: searchResults,
          timestamp: Date.now(),
        };
      } else {
        setResults(prev => [...prev, ...searchResults]);
      }
      setOffset(pageOffset + PAGE_SIZE);
      setHasMore(searchResults.length === PAGE_SIZE);
    } catch (error) {
      console.warn('❌ Search error:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadMore = useCallback(() => {
    if (!loading && hasMore && query.trim().length >= 2) {
      performSearch(query, offset);
    }
  }, [loading, hasMore, query, offset]);
  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setOffset(0);
    setHasMore(true);
  }, []);
  return {
    query,
    setQuery,
    results,
    loading,
    hasMore,
    loadMore,
    clear,
  };
}