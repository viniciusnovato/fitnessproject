/**
 * AI Cache Helper
 * Gerencia cache de respostas da OpenAI no Supabase
 */

import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { supabase } from './supabase';

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    userId: string;
}

export interface CachedResponse<T = any> {
    data: T;
    cached: boolean;
    cacheAge?: number; // Age in seconds
}

/**
 * Gera uma chave de cache consistente baseada no tipo e parâmetros
 */
export async function generateCacheKey(
    type: string, // 'recipe' | 'insight' | 'meal_image' | 'meal_plan' | 'diet_plan'
    params: any
): Promise<string> {
    // Normaliza os parâmetros para garantir consistência
    const normalized = JSON.stringify(params, Object.keys(params).sort());
    const input = `${type}:${normalized}`;

    // Gera hash SHA256
    const hash = await digestStringAsync(
        CryptoDigestAlgorithm.SHA256,
        input
    );

    return hash;
}

/**
 * Busca uma resposta no cache
 */
export async function getCachedResponse<T = any>(
    cacheKey: string,
    userId: string
): Promise<CachedResponse<T> | null> {
    try {
        const { data, error } = await supabase
            .from('ai_cache')
            .select('*')
            .eq('cache_key', cacheKey)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            return null;
        }

        // Verifica se expirou
        if (data.expires_at) {
            const expiresAt = new Date(data.expires_at);
            if (expiresAt < new Date()) {
                // Expirado - deleta e retorna null
                await supabase
                    .from('ai_cache')
                    .delete()
                    .eq('id', data.id);
                return null;
            }
        }

        // Atualiza hit count e last_hit_at
        await supabase
            .from('ai_cache')
            .update({
                hit_count: (data.hit_count || 0) + 1,
                last_hit_at: new Date().toISOString(),
            })
            .eq('id', data.id);

        const cacheAge = Math.floor(
            (new Date().getTime() - new Date(data.created_at).getTime()) / 1000
        );

        return {
            data: data.response_data as T,
            cached: true,
            cacheAge,
        };
    } catch (error) {
        console.error('Error getting cached response:', error);
        return null;
    }
}

/**
 * Armazena uma resposta no cache
 */
export async function setCachedResponse(
    cacheKey: string,
    userId: string,
    requestType: string,
    requestParams: any,
    responseData: any,
    ttl?: number | null // TTL em segundos
): Promise<void> {
    try {
        const expiresAt = ttl
            ? new Date(Date.now() + ttl * 1000).toISOString()
            : null;

        const { error } = await supabase.from('ai_cache').upsert(
            {
                cache_key: cacheKey,
                user_id: userId,
                request_type: requestType,
                request_params: requestParams,
                response_data: responseData,
                expires_at: expiresAt,
                hit_count: 0,
            },
            {
                onConflict: 'cache_key,user_id',
            }
        );

        if (error) {
            console.error('Error setting cached response:', error);
        }
    } catch (error) {
        console.error('Error setting cached response:', error);
    }
}

/**
 * Invalida cache por tipo ou todo o cache do usuário
 */
export async function invalidateCache(
    userId: string,
    requestType?: string
): Promise<void> {
    try {
        let query = supabase.from('ai_cache').delete().eq('user_id', userId);

        if (requestType) {
            query = query.eq('request_type', requestType);
        }

        const { error } = await query;

        if (error) {
            console.error('Error invalidating cache:', error);
        }
    } catch (error) {
        console.error('Error invalidating cache:', error);
    }
}

/**
 * Limpa entradas expiradas do cache
 */
export async function cleanExpiredCache(): Promise<void> {
    try {
        const { error } = await supabase.rpc('clean_expired_cache');

        if (error) {
            console.error('Error cleaning expired cache:', error);
        }
    } catch (error) {
        console.error('Error cleaning expired cache:', error);
    }
}

/**
 * Wrapper genérico para funções com cache
 */
export async function withCache<T>(
    cacheKey: string,
    userId: string,
    requestType: string,
    requestParams: any,
    fetchFn: () => Promise<T>,
    ttl?: number | null,
    forceRefresh: boolean = false
): Promise<CachedResponse<T>> {
    // Tenta buscar do cache se não for forçado
    if (!forceRefresh) {
        const cached = await getCachedResponse<T>(cacheKey, userId);
        if (cached) {
            return cached;
        }
    }

    // Cache miss ou force refresh - executa a função
    const data = await fetchFn();

    // Armazena no cache
    await setCachedResponse(
        cacheKey,
        userId,
        requestType,
        requestParams,
        data,
        ttl
    );

    return {
        data,
        cached: false,
    };
}
