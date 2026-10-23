interface FetchErrorLike {
    message?: string
    details?: {
        message?: string
        response?: { errorReports?: { message?: string }[] }
    }
}

/**
 * Extracts a human-readable message from an app-runtime FetchError,
 * preferring the DHIS2 API's own message when present. A rejected import
 * says only "One or more errors occurred, please see full details in import
 * report", so the messages of its error reports come first.
 */
export const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object') {
        const { message, details } = error as FetchErrorLike
        const reports = (details?.response?.errorReports ?? [])
            .map((report) => report.message)
            .filter(Boolean)
        if (reports.length > 0) {
            return reports.join(' ')
        }
        return details?.message ?? message ?? String(error)
    }
    return String(error)
}
