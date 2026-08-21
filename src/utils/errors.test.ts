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
