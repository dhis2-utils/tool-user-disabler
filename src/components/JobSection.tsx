import i18n from '@dhis2/d2-i18n'
import { Button, CircularLoader, NoticeBox, Switch, Tag } from '@dhis2/ui'
import { useState } from 'react'
import {
    useInactiveUsersJobs,
    useToggleJob,
} from '../hooks/useInactiveUsersJob'
import { getErrorMessage } from '../utils/errors'
import { CreateJobModal } from './CreateJobModal'
import styles from './JobSection.module.css'

export const JobSection = () => {
    const { jobs, isLoading, error } = useInactiveUsersJobs()
    const { toggleJob, isToggling } = useToggleJob()
    const [createModalOpen, setCreateModalOpen] = useState(false)

    return (
        <section className={styles.section}>
            <h2 className={styles.title}>
                {i18n.t('Scheduled job to disable inactive users')}
            </h2>
            <p className={styles.description}>
                {i18n.t(
                    'A scheduled job can routinely disable users who have not logged in for a specified period.'
                )}
            </p>
            {isLoading && <CircularLoader small />}
            {error && (
                <NoticeBox error title={i18n.t('Error loading job status')}>
                    {getErrorMessage(error)}
                </NoticeBox>
            )}
            {!isLoading && !error && jobs.length === 0 && (
                <div className={styles.statusRow}>
                    <span>
                        {i18n.t('No job to disable inactive users exists.')}
                    </span>
                    <Button
                        small
                        onClick={() => setCreateModalOpen(true)}
                        dataTest="add-job-button"
                    >
                        {i18n.t('Add job')}
                    </Button>
                </div>
            )}
            {!isLoading && !error && jobs.length === 1 && (
                <div className={styles.statusRow}>
                    <span>
                        {i18n.t('Job name:')} <strong>{jobs[0].name}</strong>
                    </span>
                    {jobs[0].enabled ? (
                        <Tag positive>{i18n.t('Enabled')}</Tag>
                    ) : (
                        <Tag>{i18n.t('Disabled')}</Tag>
                    )}
                    <Switch
                        label={i18n.t('Enabled')}
                        checked={jobs[0].enabled}
                        disabled={isToggling}
                        onChange={() => toggleJob(jobs[0])}
                        dense
                    />
                </div>
            )}
            {!isLoading && !error && jobs.length > 1 && (
                <NoticeBox warning title={i18n.t('Several jobs configured')}>
                    {i18n.t(
                        'Several jobs to disable inactive users are configured, see more in the Scheduler app.'
                    )}
                </NoticeBox>
            )}
            {createModalOpen && (
                <CreateJobModal onClose={() => setCreateModalOpen(false)} />
            )}
        </section>
    )
}
