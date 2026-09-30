import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    CircularLoader,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    NoticeBox,
} from '@dhis2/ui'
import { useUserDetails } from '../hooks/useUserDetails'
import { formatDate } from '../utils/dates'
import { getErrorMessage } from '../utils/errors'
import styles from './UserInfoModal.module.css'

type UserInfoModalProps = {
    userId: string
    onClose: () => void
}

export const UserInfoModal = ({ userId, onClose }: UserInfoModalProps) => {
    const { user, isLoading, error } = useUserDetails(userId)

    return (
        <Modal onClose={onClose}>
            <ModalTitle>{i18n.t('User details')}</ModalTitle>
            <ModalContent>
                {isLoading && (
                    <div className={styles.loadingContainer}>
                        <CircularLoader />
                    </div>
                )}
                {error && (
                    <NoticeBox error title={i18n.t('Error loading user')}>
                        {getErrorMessage(error)}
                    </NoticeBox>
                )}
                {user && (
                    <dl className={styles.detailsList}>
                        <dt>{i18n.t('Username')}</dt>
                        <dd>{user.username}</dd>
                        <dt>{i18n.t('First name')}</dt>
                        <dd>{user.firstName}</dd>
                        <dt>{i18n.t('Surname')}</dt>
                        <dd>{user.surname}</dd>
                        <dt>{i18n.t('Status')}</dt>
                        <dd>
                            {user.disabled
                                ? i18n.t('Disabled')
                                : i18n.t('Active')}
                        </dd>
                        <dt>{i18n.t('Created')}</dt>
                        <dd>{formatDate(user.created)}</dd>
                        <dt>{i18n.t('Last login')}</dt>
                        <dd>{formatDate(user.lastLogin)}</dd>
                        <dt>{i18n.t('User roles')}</dt>
                        <dd>
                            {user.userRoles
                                .map((role) => role.displayName)
                                .join(', ')}
                        </dd>
                        <dt>{i18n.t('User groups')}</dt>
                        <dd>
                            {user.userGroups
                                .map((group) => group.displayName)
                                .join(', ') || i18n.t('None')}
                        </dd>
                        <dt>{i18n.t('Organisation units')}</dt>
                        <dd>
                            {user.organisationUnits
                                .map((orgUnit) => orgUnit.displayName)
                                .join(', ') || i18n.t('None')}
                        </dd>
                    </dl>
                )}
            </ModalContent>
            <ModalActions>
                <ButtonStrip end>
                    <Button onClick={onClose} secondary>
                        {i18n.t('Close')}
                    </Button>
                </ButtonStrip>
            </ModalActions>
        </Modal>
    )
}
