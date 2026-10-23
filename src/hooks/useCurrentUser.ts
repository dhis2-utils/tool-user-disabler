import { useApiDataQuery } from '../utils/useApiDataQuery'

export const useCurrentUserId = () => {
    const { data, isLoading, error } = useApiDataQuery<{ id: string }>({
        queryKey: ['me'],
        query: { resource: 'me', params: { fields: 'id' } },
        staleTime: Infinity,
        cacheTime: Infinity,
    })

    return { currentUserId: data?.id, isLoading, error }
}
