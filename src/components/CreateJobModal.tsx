import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    InputField,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useCreateJob } from '../hooks/useInactiveUsersJob'
import styles from './CreateJobModal.module.css'

const wholeNumber = (message: string) => z.string().regex(/^[0-9]+$/, message)

// Built lazily (not at module scope) so i18n.t picks up the user's locale
const buildSchema = () =>
    z.object({
        name: z.string().trim().min(1, i18n.t('Name is required')),
        inactiveMonths: wholeNumber(i18n.t('Enter a whole number')).refine(
            (value) => Number(value) >= 1,
            i18n.t('Must be at least 1')
        ),
        reminderDaysBefore: wholeNumber(i18n.t('Enter a whole number')),
        cronExpression: z
            .string()
            .trim()
            .min(1, i18n.t('Cron expression is required')),
    })

type FormValues = z.infer<ReturnType<typeof buildSchema>>

type CreateJobModalProps = {
    onClose: () => void
}

export const CreateJobModal = ({ onClose }: CreateJobModalProps) => {
    const [schema] = useState(buildSchema)
    const { control, handleSubmit } = useForm<FormValues>({
        resolver: standardSchemaResolver(schema),
        defaultValues: {
            name: i18n.t('Disable inactive users'),
            inactiveMonths: '6',
            reminderDaysBefore: '7',
            cronExpression: '0 0 20 ? * *',
        },
    })
    const { createJob, isCreating } = useCreateJob({ onSuccess: onClose })

    const onSubmit = (values: FormValues) =>
        createJob({
            name: values.name,
            inactiveMonths: Number(values.inactiveMonths),
            reminderDaysBefore: Number(values.reminderDaysBefore),
            cronExpression: values.cronExpression,
        })

    return (
        <Modal onClose={onClose} dataTest="create-job-modal">
            <ModalTitle>
                {i18n.t('Create job to disable inactive users')}
            </ModalTitle>
            <ModalContent>
                <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field, fieldState }) => (
                            <InputField
                                name={field.name}
                                value={field.value}
                                onBlur={() => field.onBlur()}
                                label={i18n.t('Name')}
                                onChange={({ value }) =>
                                    field.onChange(value ?? '')
                                }
                                error={!!fieldState.error}
                                validationText={fieldState.error?.message}
                            />
                        )}
                    />
                    <Controller
                        name="inactiveMonths"
                        control={control}
                        render={({ field, fieldState }) => (
                            <InputField
                                name={field.name}
                                value={field.value}
                                onBlur={() => field.onBlur()}
                                label={i18n.t('Inactive months')}
                                type="number"
                                min="1"
                                helpText={i18n.t(
                                    'Users who have not logged in for this many months are disabled'
                                )}
                                onChange={({ value }) =>
                                    field.onChange(value ?? '')
                                }
                                error={!!fieldState.error}
                                validationText={fieldState.error?.message}
                            />
                        )}
                    />
                    <Controller
                        name="reminderDaysBefore"
                        control={control}
                        render={({ field, fieldState }) => (
                            <InputField
                                name={field.name}
                                value={field.value}
                                onBlur={() => field.onBlur()}
                                label={i18n.t('Reminder days before')}
                                type="number"
                                min="0"
                                helpText={i18n.t(
                                    'Days before disabling that users receive a reminder email'
                                )}
                                onChange={({ value }) =>
                                    field.onChange(value ?? '')
                                }
                                error={!!fieldState.error}
                                validationText={fieldState.error?.message}
                            />
                        )}
                    />
                    <Controller
                        name="cronExpression"
                        control={control}
                        render={({ field, fieldState }) => (
                            <InputField
                                name={field.name}
                                value={field.value}
                                onBlur={() => field.onBlur()}
                                label={i18n.t('Cron expression')}
                                helpText={i18n.t(
                                    'When the job runs, e.g. "0 0 20 ? * *" is every day at 20:00'
                                )}
                                onChange={({ value }) =>
                                    field.onChange(value ?? '')
                                }
                                error={!!fieldState.error}
                                validationText={fieldState.error?.message}
                            />
                        )}
                    />
                </form>
            </ModalContent>
            <ModalActions>
                <ButtonStrip end>
                    <Button onClick={onClose} secondary disabled={isCreating}>
                        {i18n.t('Cancel')}
                    </Button>
                    <Button
                        onClick={() => handleSubmit(onSubmit)()}
                        primary
                        loading={isCreating}
                        disabled={isCreating}
                        dataTest="create-job-submit"
                    >
                        {i18n.t('Create job')}
                    </Button>
                </ButtonStrip>
            </ModalActions>
        </Modal>
    )
}
