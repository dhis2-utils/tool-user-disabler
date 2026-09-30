import i18n from '@dhis2/d2-i18n'
import {
    Button,
    Checkbox,
    InputField,
    MultiSelectField,
    MultiSelectOption,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import { useState } from 'react'
import { useUserGroups, useUserRoles } from '../hooks/useUserRolesAndGroups'
import { PeriodType, UserFilter } from '../types'
import styles from './UserFilterForm.module.css'

type UserFilterFormProps = {
    initialFilter: UserFilter
    onApply: (filter: UserFilter) => void
    loading: boolean
}

export const UserFilterForm = ({
    initialFilter,
    onApply,
    loading,
}: UserFilterFormProps) => {
    const [draft, setDraft] = useState<UserFilter>(initialFilter)
    const [numPeriodsInput, setNumPeriodsInput] = useState(
        String(initialFilter.numPeriods)
    )
    const { userRoles, isLoading: rolesLoading } = useUserRoles()
    const { userGroups, isLoading: groupsLoading } = useUserGroups()

    const update = (changes: Partial<UserFilter>) =>
        setDraft((current) => ({ ...current, ...changes }))

    const missingDate = draft.periodType === 'date' && !draft.specificDate
    const numPeriods = Number(numPeriodsInput)
    const invalidPeriods =
        draft.periodType !== 'date' &&
        (!numPeriodsInput || !Number.isInteger(numPeriods) || numPeriods < 1)

    return (
        <form
            className={styles.form}
            onSubmit={(event) => {
                event.preventDefault()
                if (missingDate || invalidPeriods) {
                    return
                }
                onApply({ ...draft, numPeriods: numPeriods || 1 })
            }}
        >
            <div className={styles.fields}>
                <SingleSelectField
                    label={i18n.t('Period inactive')}
                    selected={draft.periodType}
                    onChange={({ selected }) =>
                        update({ periodType: selected as PeriodType })
                    }
                    dense
                    className={styles.periodType}
                >
                    <SingleSelectOption
                        label={i18n.t('Months')}
                        value="months"
                    />
                    <SingleSelectOption label={i18n.t('Years')} value="years" />
                    <SingleSelectOption
                        label={i18n.t('Since date')}
                        value="date"
                    />
                </SingleSelectField>

                {draft.periodType === 'date' ? (
                    <InputField
                        label={i18n.t('Date')}
                        type="date"
                        value={draft.specificDate}
                        onChange={({ value }) =>
                            update({ specificDate: value ?? '' })
                        }
                        error={missingDate}
                        validationText={
                            missingDate ? i18n.t('Select a date') : undefined
                        }
                        dense
                        className={styles.numPeriods}
                    />
                ) : (
                    <InputField
                        label={
                            draft.periodType === 'months'
                                ? i18n.t('Number of months')
                                : i18n.t('Number of years')
                        }
                        type="number"
                        min="1"
                        value={numPeriodsInput}
                        onChange={({ value }) =>
                            setNumPeriodsInput(value ?? '')
                        }
                        error={invalidPeriods}
                        validationText={
                            invalidPeriods
                                ? i18n.t('Enter a whole number of at least 1')
                                : undefined
                        }
                        dense
                        className={styles.numPeriods}
                    />
                )}

                <MultiSelectField
                    label={i18n.t('User roles')}
                    selected={draft.roleIds}
                    onChange={({ selected }) => update({ roleIds: selected })}
                    loading={rolesLoading}
                    placeholder={i18n.t('All user roles')}
                    filterable
                    clearable
                    dense
                    className={styles.multiSelect}
                >
                    {userRoles.map((role) => (
                        <MultiSelectOption
                            key={role.id}
                            label={role.displayName}
                            value={role.id}
                        />
                    ))}
                </MultiSelectField>

                <MultiSelectField
                    label={i18n.t('User groups')}
                    selected={draft.groupIds}
                    onChange={({ selected }) => update({ groupIds: selected })}
                    loading={groupsLoading}
                    placeholder={i18n.t('All user groups')}
                    filterable
                    clearable
                    dense
                    className={styles.multiSelect}
                >
                    {userGroups.map((group) => (
                        <MultiSelectOption
                            key={group.id}
                            label={group.displayName}
                            value={group.id}
                        />
                    ))}
                </MultiSelectField>
            </div>

            <div className={styles.options}>
                <Checkbox
                    label={i18n.t('Include users who never logged in')}
                    checked={draft.includeNeverLoggedIn}
                    onChange={({ checked }) =>
                        update({ includeNeverLoggedIn: checked })
                    }
                    dense
                />
                <Checkbox
                    label={i18n.t('Include already disabled users')}
                    checked={draft.includeDisabled}
                    onChange={({ checked }) =>
                        update({ includeDisabled: checked })
                    }
                    dense
                />
                <Button
                    type="submit"
                    primary
                    small
                    loading={loading}
                    disabled={loading || missingDate || invalidPeriods}
                >
                    {i18n.t('Apply filter')}
                </Button>
            </div>
        </form>
    )
}
