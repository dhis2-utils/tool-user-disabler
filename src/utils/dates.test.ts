import { DEFAULT_FILTER, UserFilter } from '../types'
import { getInactiveSince } from './dates'

const filter = (overrides: Partial<UserFilter>): UserFilter => ({
    ...DEFAULT_FILTER,
    ...overrides,
})

/** Local-time parts, so assertions don't depend on the runner's timezone. */
const parts = (iso: string | null): number[] => {
    const d = new Date(iso as string)
    return [d.getFullYear(), d.getMonth(), d.getDate()]
}

const freeze = (iso: string): void => {
    jest.useFakeTimers().setSystemTime(new Date(iso))
}

describe('getInactiveSince', () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    it('returns the specific date as an ISO string', () => {
        expect(
            getInactiveSince(
                filter({ periodType: 'date', specificDate: '2026-03-04' })
            )
        ).toBe(new Date('2026-03-04').toISOString())
    })

    it('returns null for a date period with no date chosen', () => {
        expect(
            getInactiveSince(filter({ periodType: 'date', specificDate: '' }))
        ).toBeNull()
    })

    it('subtracts whole calendar months', () => {
        freeze('2026-08-21T12:00:00Z')
        expect(parts(getInactiveSince(filter({ numPeriods: 6 })))).toEqual([
            2026, 1, 21,
        ])
    })

    it('clamps to the last day of the target month', () => {
        // May 31 minus 6 months is Nov 30, not Dec 1 (regression test for L2)
        freeze('2026-05-31T12:00:00Z')
        expect(parts(getInactiveSince(filter({ numPeriods: 6 })))).toEqual([
            2025, 10, 30,
        ])
    })

    it('clamps Feb 29 back to Feb 28 in a non-leap year', () => {
        freeze('2024-02-29T12:00:00Z')
        expect(
            parts(
                getInactiveSince(filter({ periodType: 'years', numPeriods: 1 }))
            )
        ).toEqual([2023, 1, 28])
    })

    it('treats years as twelve months', () => {
        freeze('2026-08-21T12:00:00Z')
        expect(
            parts(
                getInactiveSince(filter({ periodType: 'years', numPeriods: 2 }))
            )
        ).toEqual([2024, 7, 21])
    })
})
