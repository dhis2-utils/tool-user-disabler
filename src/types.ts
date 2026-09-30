export type UserListItem = {
    id: string
    username: string
    firstName: string
    surname: string
    disabled: boolean
    created: string
    lastLogin?: string | null
}

export type UserDetails = UserListItem & {
    userRoles: { displayName: string }[]
    userGroups: { displayName: string }[]
    organisationUnits: { displayName: string }[]
}

export type PeriodType = 'months' | 'years' | 'date'

export type UserFilter = {
    periodType: PeriodType
    numPeriods: number
    specificDate: string
    roleIds: string[]
    groupIds: string[]
    includeNeverLoggedIn: boolean
    includeDisabled: boolean
}

export const DEFAULT_FILTER: UserFilter = {
    periodType: 'months',
    numPeriods: 6,
    specificDate: '',
    roleIds: [],
    groupIds: [],
    includeNeverLoggedIn: false,
    includeDisabled: false,
}

export type JobConfiguration = {
    id: string
    name: string
    enabled: boolean
}

export type DisableResult = {
    userId: string
    username: string
    status: 'success' | 'error'
    message?: string
}
