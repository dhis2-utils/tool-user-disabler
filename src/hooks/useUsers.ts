import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { ResourceQuery } from '../interfaces/apiQueryTypes'
import { UserFilter, UserListItem } from '../types'
import { getInactiveSince } from '../utils/dates'

const USER_FIELDS = 'id,username,firstName,surname,disabled,created,lastLogin'

const buildCommonFilters = (filter: UserFilter): string[] => {
    const filters: string[] = []
    if (!filter.includeDisabled) {
        filters.push('disabled:eq:false')
    }
    if (filter.roleIds.length > 0) {
        filters.push(`userRoles.id:in:[${filter.roleIds.join(',')}]`)
    }
    if (filter.groupIds.length > 0) {
        filters.push(`userGroups.id:in:[${filter.groupIds.join(',')}]`)
    }
    return filters
}

const buildUsersQuery = (extraFilters: string[]): ResourceQuery => ({
    resource: 'users',
    params: {
        fields: USER_FIELDS,
        paging: false,
        filter: extraFilters,
    },
})

/**
 * Fetches all users matching the inactivity filter. Users who never logged
 * in can't be matched by a `lastLogin:lt:` filter (their lastLogin is null),
 * so they are fetched with a separate `lastLogin:null` query and the two
 * result sets are merged and de-duplicated.
 */
export const useUsers = (filter: UserFilter) => {
    const engine = useDataEngine()

    const { data, isLoading, isFetching, error } = useQuery<
        UserListItem[],
        Error
    >({
        queryKey: ['users', filter],
        queryFn: async () => {
            const inactiveSince = getInactiveSince(filter)
            const commonFilters = buildCommonFilters(filter)

            const queries: Record<string, ResourceQuery> = {
                inactive: buildUsersQuery([
                    ...commonFilters,
                    ...(inactiveSince ? [`lastLogin:lt:${inactiveSince}`] : []),
                ]),
            }
            if (filter.includeNeverLoggedIn) {
                queries.neverLoggedIn = buildUsersQuery([
                    ...commonFilters,
                    'lastLogin:null',
                ])
            }

            const response = (await engine.query(queries)) as unknown as {
                inactive: { users: UserListItem[] }
                neverLoggedIn?: { users: UserListItem[] }
            }

            const merged = [
                ...response.inactive.users,
                ...(response.neverLoggedIn?.users ?? []),
            ]
            const seen = new Set<string>()
            return merged.filter((user) => {
                if (seen.has(user.id)) {
                    return false
                }
                seen.add(user.id)
                return true
            })
        },
        staleTime: 60 * 1000,
        keepPreviousData: true,
    })

    return { users: data, isLoading, isFetching, error }
}
