import i18n from '@dhis2/d2-i18n'
import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import { useQueryClient } from '@tanstack/react-query'
import { RowSelectionState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { DisableUsersModal } from '../components/DisableUsersModal'
import { JobSection } from '../components/JobSection'
import { UserFilterForm } from '../components/UserFilterForm'
import { UserInfoModal } from '../components/UserInfoModal'
import { UsersTable } from '../components/UsersTable'
import { useUsers } from '../hooks/useUsers'
import {
    DEFAULT_FILTER,
    DisableResult,
    UserFilter,
    UserListItem,
} from '../types'
import { getErrorMessage } from '../utils/errors'
import styles from './UsersPage.module.css'

export const UsersPage = () => {
    const [appliedFilter, setAppliedFilter] =
        useState<UserFilter>(DEFAULT_FILTER)
    const { users, isLoading, isFetching, error } = useUsers(appliedFilter)
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const [infoUser, setInfoUser] = useState<UserListItem | null>(null)
    const [usersToDisable, setUsersToDisable] = useState<UserListItem[] | null>(
        null
    )

    const selectedUsers = useMemo(
        () =>
            (users ?? []).filter(
                (user) => rowSelection[user.id] && !user.disabled
            ),
        [users, rowSelection]
    )

    const queryClient = useQueryClient()

    const applyFilter = (filter: UserFilter) => {
        setAppliedFilter(filter)
        setRowSelection({})
        // Always refetch on apply: the query key may be unchanged (same
        // filter values) but the inactivity cutoff is computed at fetch
        // time and the user list may have changed on the server.
        queryClient.invalidateQueries({ queryKey: ['users'] })
    }

    const handleDisableCompleted = (results: DisableResult[]) => {
        const disabledIds = new Set(
            results
                .filter((result) => result.status === 'success')
                .map((result) => result.userId)
        )
        setRowSelection((current) => {
            const next = { ...current }
            disabledIds.forEach((id) => delete next[id])
            return next
        })
    }

    return (
        <div className={styles.container}>
            <JobSection />
            <UserFilterForm
                initialFilter={DEFAULT_FILTER}
                onApply={applyFilter}
                loading={isFetching}
            />

            {isLoading && (
                <div className={styles.loadingContainer}>
                    <CircularLoader />
                </div>
            )}
            {error && (
                <NoticeBox error title={i18n.t('Error loading users')}>
                    {getErrorMessage(error)}
                </NoticeBox>
            )}
            {!isLoading && !error && users && (
                <>
                    <div className={styles.bulkBar}>
                        <Button
                            destructive
                            small
                            disabled={selectedUsers.length === 0}
                            onClick={() => setUsersToDisable(selectedUsers)}
                            dataTest="bulk-disable-button"
                        >
                            {i18n.t('Bulk disable')}
                        </Button>
                        <span className={styles.selectionCount}>
                            {selectedUsers.length === 1
                                ? i18n.t('1 user selected')
                                : i18n.t('{{count}} users selected', {
                                      count: selectedUsers.length,
                                  })}
                        </span>
                    </div>
                    <UsersTable
                        users={users}
                        rowSelection={rowSelection}
                        onRowSelectionChange={setRowSelection}
                        onShowInfo={(user) => setInfoUser(user)}
                        onDisable={(user) => setUsersToDisable([user])}
                    />
                </>
            )}

            {infoUser && (
                <UserInfoModal
                    userId={infoUser.id}
                    onClose={() => setInfoUser(null)}
                />
            )}
            {usersToDisable && (
                <DisableUsersModal
                    users={usersToDisable}
                    onClose={() => setUsersToDisable(null)}
                    onCompleted={handleDisableCompleted}
                />
            )}
        </div>
    )
}
