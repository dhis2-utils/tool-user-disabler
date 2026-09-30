import { useAlert, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { JobConfiguration } from '../types'
import { getErrorMessage } from '../utils/errors'
import { useApiDataQuery } from '../utils/useApiDataQuery'

export const JOB_TYPE = 'DISABLE_INACTIVE_USERS'

export type NewJobValues = {
    name: string
    inactiveMonths: number
    reminderDaysBefore: number
    cronExpression: string
}

export const useInactiveUsersJobs = () => {
    const { data, isLoading, error } = useApiDataQuery<{
        jobConfigurations: JobConfiguration[]
    }>({
        queryKey: ['jobConfigurations'],
        query: {
            resource: 'jobConfigurations',
            params: {
                fields: 'id,name,enabled',
                filter: `jobType:eq:${JOB_TYPE}`,
                paging: false,
            },
        },
    })

    return { jobs: data?.jobConfigurations ?? [], isLoading, error }
}

export const useToggleJob = () => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()
    const { show: showError } = useAlert(
        ({ message }: { message: string }) =>
            i18n.t('Failed to update job: {{message}}', {
                message,
                nsSeparator: '###',
            }),
        { critical: true }
    )

    const { mutate: toggleJob, isLoading: isToggling } = useMutation<
        unknown,
        Error,
        JobConfiguration
    >({
        mutationFn: (job) =>
            engine.mutate({
                resource: `jobConfigurations/${job.id}/${
                    job.enabled ? 'disable' : 'enable'
                }`,
                type: 'create',
                data: {},
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobConfigurations'] })
        },
        onError: (error) => {
            showError({ message: getErrorMessage(error) })
        },
    })

    return { toggleJob, isToggling }
}

export const useCreateJob = ({ onSuccess }: { onSuccess?: () => void }) => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()
    const { show: showSuccess } = useAlert(i18n.t('Job created'), {
        success: true,
    })
    const { show: showError } = useAlert(
        ({ message }: { message: string }) =>
            i18n.t('Failed to create job: {{message}}', {
                message,
                nsSeparator: '###',
            }),
        { critical: true }
    )

    const { mutate: createJob, isLoading: isCreating } = useMutation<
        unknown,
        Error,
        NewJobValues
    >({
        mutationFn: (values) =>
            engine.mutate({
                resource: 'jobConfigurations',
                type: 'create',
                data: {
                    name: values.name,
                    jobType: JOB_TYPE,
                    schedulingType: 'CRON',
                    cronExpression: values.cronExpression,
                    jobParameters: {
                        inactiveMonths: values.inactiveMonths,
                        reminderDaysBefore: values.reminderDaysBefore,
                    },
                    enabled: true,
                },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobConfigurations'] })
            showSuccess()
            onSuccess?.()
        },
        onError: (error) => {
            showError({ message: getErrorMessage(error) })
        },
    })

    return { createJob, isCreating }
}
