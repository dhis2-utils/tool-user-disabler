import i18n from '@dhis2/d2-i18n'
import { UserFilter } from '../types'

export const formatDate = (date?: string | null): string => {
    if (!date) {
        return i18n.t('Never')
    }
    return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

/**
 * Subtracts calendar months, clamping to the last day of the target month
 * (May 31 - 6 months -> Nov 30, not Dec 1).
 */
const subtractMonths = (date: Date, months: number): Date => {
    const result = new Date(date)
    const day = result.getDate()
    result.setDate(1)
    result.setMonth(result.getMonth() - months)
    const daysInMonth = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0
    ).getDate()
    result.setDate(Math.min(day, daysInMonth))
    return result
}

/**
 * Computes the "inactive since" cutoff date for the current filter.
 * Users whose last login is before this date are considered inactive.
 */
export const getInactiveSince = (filter: UserFilter): string | null => {
    if (filter.periodType === 'date') {
        return filter.specificDate
            ? new Date(filter.specificDate).toISOString()
            : null
    }
    const months =
        filter.periodType === 'months'
            ? filter.numPeriods
            : filter.numPeriods * 12
    return subtractMonths(new Date(), months).toISOString()
}
