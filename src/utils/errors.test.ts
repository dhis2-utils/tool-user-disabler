import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
    it("prefers the DHIS2 API's own message", () => {
        expect(
            getErrorMessage({
                message: 'An unknown error occurred',
                details: { message: 'User must have at least one role' },
            })
        ).toBe('User must have at least one role')
    })

    it('prefers the error reports of a rejected import', () => {
        expect(
            getErrorMessage({
                message: 'One or more errors occurred',
                details: {
                    message:
                        'One or more errors occurred, please see full details in import report.',
                    response: {
                        errorReports: [
                            {
                                message:
                                    'Allowed range for numeric property `inactiveMonths` is [1 to 24], but number given was 30',
                            },
                        ],
                    },
                },
            })
        ).toBe(
            'Allowed range for numeric property `inactiveMonths` is [1 to 24], but number given was 30'
        )
    })

    it('falls back to the error message when there are no details', () => {
        expect(getErrorMessage(new Error('Network request failed'))).toBe(
            'Network request failed'
        )
    })

    it('stringifies non-object errors', () => {
        expect(getErrorMessage('plain string')).toBe('plain string')
        expect(getErrorMessage(null)).toBe('null')
    })
})
