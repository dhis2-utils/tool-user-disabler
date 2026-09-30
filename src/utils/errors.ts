/**
 * Extracts a human-readable message from an app-runtime FetchError,
 * preferring the DHIS2 API's own message when present.
 */
export const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object') {
        const fetchError = error as {
            message?: string
            details?: { message?: string }
        }
        return (
            fetchError.details?.message ?? fetchError.message ?? String(error)
        )
    }
    return String(error)
}
