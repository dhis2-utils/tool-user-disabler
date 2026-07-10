import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableHead,
    DataTableRow,
    LinearLoader,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    NoticeBox,
} from '@dhis2/ui'
import { useState } from 'react'
import { useDisableUsers } from '../hooks/useDisableUsers'
import { DisableResult, UserListItem } from '../types'
import styles from './DisableUsersModal.module.css'

type Phase = 'confirm' | 'running' | 'done'

type DisableUsersModalProps = {
    users: UserListItem[]
    onClose: () => void
    onCompleted: (results: DisableResult[]) => void
}

export const DisableUsersModal = ({
    users,
    onClose,
    onCompleted,
}: DisableUsersModalProps) => {
    const [phase, setPhase] = useState<Phase>('confirm')
    const [results, setResults] = useState<DisableResult[]>([])
    const { disableUsers, progress } = useDisableUsers()

    const start = async () => {
        setPhase('running')
        const disableResults = await disableUsers(users)
        setResults(disableResults)
        setPhase('done')
        onCompleted(disableResults)
    }

    const successCount = results.filter(
        (result) => result.status === 'success'
    ).length
    const failures = results.filter((result) => result.status === 'error')

    const confirmationText =
        users.length === 1
            ? i18n.t(
                  'User "{{username}}" will be disabled. Do you want to continue?',
                  { username: users[0].username }
              )
            : i18n.t(
                  '{{count}} users will be disabled. Do you want to continue?',
                  { count: users.length }
              )

    return (
        <Modal
            onClose={phase === 'running' ? undefined : onClose}
            dataTest="disable-users-modal"
        >
            <ModalTitle>{i18n.t('Disable users')}</ModalTitle>
            <ModalContent>
                {phase === 'confirm' && <p>{confirmationText}</p>}
                {phase === 'running' && progress && (
                    <div className={styles.progress}>
                        <p>
                            {i18n.t('{{done}} of {{total}} users updated…', {
                                done: progress.done,
                                total: progress.total,
                            })}
                        </p>
                        <LinearLoader
                            amount={(progress.done / progress.total) * 100}
                        />
                    </div>
                )}
                {phase === 'done' && (
                    <>
                        <NoticeBox
                            valid={failures.length === 0}
                            warning={failures.length > 0}
                            title={
                                successCount === 1
                                    ? i18n.t('1 user was successfully disabled')
                                    : i18n.t(
                                          '{{count}} users were successfully disabled',
                                          { count: successCount }
                                      )
                            }
                        >
                            {failures.length > 0 &&
                                (failures.length === 1
                                    ? i18n.t('1 user could not be disabled.')
                                    : i18n.t(
                                          '{{count}} users could not be disabled.',
                                          { count: failures.length }
                                      ))}
                        </NoticeBox>
                        {failures.length > 0 && (
                            <div className={styles.failures}>
                                <DataTable>
                                    <DataTableHead>
                                        <DataTableRow>
                                            <DataTableColumnHeader>
                                                {i18n.t('Username')}
                                            </DataTableColumnHeader>
                                            <DataTableColumnHeader>
                                                {i18n.t('Error')}
                                            </DataTableColumnHeader>
                                        </DataTableRow>
                                    </DataTableHead>
                                    <DataTableBody>
                                        {failures.map((failure) => (
                                            <DataTableRow key={failure.userId}>
                                                <DataTableCell>
                                                    {failure.username}
                                                </DataTableCell>
                                                <DataTableCell>
                                                    {failure.message}
                                                </DataTableCell>
                                            </DataTableRow>
                                        ))}
                                    </DataTableBody>
                                </DataTable>
                            </div>
                        )}
                    </>
                )}
            </ModalContent>
            <ModalActions>
                {/* ButtonStrip spaces its direct children — don't wrap
                    siblings in a fragment or the gap disappears */}
                {phase === 'confirm' && (
                    <ButtonStrip end>
                        <Button onClick={onClose} secondary>
                            {i18n.t('Cancel')}
                        </Button>
                        <Button
                            onClick={start}
                            destructive
                            dataTest="confirm-disable-users"
                        >
                            {i18n.t('Confirm')}
                        </Button>
                    </ButtonStrip>
                )}
                {phase === 'done' && (
                    <ButtonStrip end>
                        <Button onClick={onClose} primary>
                            {i18n.t('Close')}
                        </Button>
                    </ButtonStrip>
                )}
            </ModalActions>
        </Modal>
    )
}
