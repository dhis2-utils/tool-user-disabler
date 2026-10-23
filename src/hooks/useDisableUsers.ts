import { useDataEngine } from '@dhis2/app-runtime'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { DisableResult, UserListItem } from '../types'
import { getErrorMessage } from '../utils/errors'

interface Progress {
    done: number
    total: number
}

/**
 * Disables users one by one via POST /api/users/{id}/disabled, reporting
 * progress and collecting per-user results.
 */
export const useDisableUsers = () => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()
    const [progress, setProgress] = useState<Progress | null>(null)
    const [isRunning, setIsRunning] = useState(false)

    const disableUsers = useCallback(
        async (users: UserListItem[]): Promise<DisableResult[]> => {
            setIsRunning(true)
            setProgress({ done: 0, total: users.length })
            const results: DisableResult[] = []

            for (const user of users) {
                try {
                    // oxlint-disable-next-line no-await-in-loop -- one request at a time keeps the progress count accurate and spares the server
                    await engine.mutate({
                        resource: `users/${user.id}/disabled`,
                        type: 'create',
                        data: {},
                    })
                    results.push({
                        userId: user.id,
                        username: user.username,
                        status: 'success',
                    })
                } catch (error) {
                    results.push({
                        userId: user.id,
                        username: user.username,
                        status: 'error',
                        message: getErrorMessage(error),
                    })
                }
                setProgress({ done: results.length, total: users.length })
            }

            setIsRunning(false)
            queryClient.invalidateQueries({ queryKey: ['users'] })
            return results
        },
        [engine, queryClient]
    )

    return { disableUsers, progress, isRunning }
}
