import { UserDetails } from '../types'
import { useApiDataQuery } from '../utils/useApiDataQuery'

export const useUserDetails = (userId: string) => {
    const { data, isLoading, error } = useApiDataQuery<UserDetails>({
        queryKey: ['users', 'details', userId],
        query: {
            resource: 'users',
            id: userId,
            params: {
                fields: 'id,username,firstName,surname,disabled,created,lastLogin,userRoles[displayName],userGroups[displayName],organisationUnits[displayName]',
            },
        },
        staleTime: 60 * 1000,
    })

    return { user: data, isLoading, error }
}
