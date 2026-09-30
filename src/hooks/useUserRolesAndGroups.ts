import { useApiDataQuery } from '../utils/useApiDataQuery'

type NamedRef = { id: string; displayName: string }

export const useUserRoles = () => {
    const { data, isLoading, error } = useApiDataQuery<{
        userRoles: NamedRef[]
    }>({
        queryKey: ['userRoles'],
        query: {
            resource: 'userRoles',
            params: {
                fields: 'id,displayName',
                paging: false,
            },
        },
        staleTime: Infinity,
        cacheTime: Infinity,
    })

    return { userRoles: data?.userRoles ?? [], isLoading, error }
}

export const useUserGroups = () => {
    const { data, isLoading, error } = useApiDataQuery<{
        userGroups: NamedRef[]
    }>({
        queryKey: ['userGroups'],
        query: {
            resource: 'userGroups',
            params: {
                fields: 'id,displayName',
                paging: false,
            },
        },
        staleTime: Infinity,
        cacheTime: Infinity,
    })

    return { userGroups: data?.userGroups ?? [], isLoading, error }
}
