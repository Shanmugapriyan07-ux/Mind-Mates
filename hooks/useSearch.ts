// hooks/useSearch.ts
// ✅ OPTIMIZED SEARCH HOOK - Instagram/LinkedIn Performance
// Features: Debouncing, Caching, Pagination, Offline support

import { useState, useEffect, useCallback, useRef } from 'react';
import supabase, { databases, config, Query, TABLES } from '@/lib/supabase';

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

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 500; // 500ms
const PAGE_SIZE = 20;

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Cache
  const cacheRef = useRef<SearchCache>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string>('');

  // ──────────────────────────────────────────────────────────────
  // INITIALIZE - Get current user
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    searchStorage.getItem('userId').then(id => {
      if (id) currentUserIdRef.current = id;
    });
  }, []);

  // ──────────────────────────────────────────────────────────────
  // DEBOUNCED SEARCH
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Empty query - clear results
    if (query.trim().length === 0) {
      setResults([]);
      setOffset(0);
      setHasMore(true);
      return;
    }

    // Too short - wait for more characters
    if (query.trim().length < 2) {
      return;
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      performSearch(query, 0);
    }, DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  // ──────────────────────────────────────────────────────────────
  // PERFORM SEARCH (with caching)
  // ──────────────────────────────────────────────────────────────

  const performSearch = async (searchQuery: string, pageOffset: number) => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    // ✅ CHECK CACHE FIRST
    if (pageOffset === 0) {
      const cached = cacheRef.current[trimmedQuery];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('✅ Using cached results for:', trimmedQuery);
        setResults(cached.results);
        setHasMore(cached.results.length === PAGE_SIZE);
        return;
      }
    }

    setLoading(true);

    try {
      console.log('🔍 Searching:', trimmedQuery, 'offset:', pageOffset);

      // ✅ SUPABASE SEARCH
      const { data, error } = await supabase
        .from(TABLES.users)
        .select('*')
        .or(`full_name.ilike.%${trimmedQuery}%,location.ilike.%${trimmedQuery}%`)
        .neq('userId', currentUserIdRef.current)
        .range(pageOffset, pageOffset + PAGE_SIZE - 1);

      if (error) throw error;

      const searchResults = (data ?? []) as unknown as SearchUser[];

      if (pageOffset === 0) {
        // First page - replace + cache
        setResults(searchResults);
        cacheRef.current[trimmedQuery] = {
          results: searchResults,
          timestamp: Date.now(),
        };
      } else {
        // Next page - append
        setResults(prev => [...prev, ...searchResults]);
      }

      setOffset(pageOffset + PAGE_SIZE);
      setHasMore(searchResults.length === PAGE_SIZE);

      console.log(`✅ Found ${searchResults.length} results`);

    } catch (error) {
      console.error('❌ Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // LOAD MORE (pagination)
  // ──────────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    if (!loading && hasMore && query.trim().length >= 2) {
      performSearch(query, offset);
    }
  }, [loading, hasMore, query, offset]);

  // ──────────────────────────────────────────────────────────────
  // CLEAR SEARCH
  // ──────────────────────────────────────────────────────────────

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