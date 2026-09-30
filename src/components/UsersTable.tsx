import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    Checkbox,
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableFoot,
    DataTableHead,
    DataTableRow,
    InputField,
    Pagination,
    Tag,
} from '@dhis2/ui'
import {
    Column,
    RowSelectionState,
    SortingState,
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import { UserListItem } from '../types'
import { formatDate } from '../utils/dates'
import styles from './UsersTable.module.css'

const columnHelper = createColumnHelper<UserListItem>()

const getSortDirection = (column: Column<UserListItem>) =>
    column.getIsSorted() || 'default'

type UsersTableProps = {
    users: UserListItem[]
    rowSelection: RowSelectionState
    onRowSelectionChange: Dispatch<SetStateAction<RowSelectionState>>
    onShowInfo: (user: UserListItem) => void
    onDisable: (user: UserListItem) => void
}

export const UsersTable = ({
    users,
    rowSelection,
    onRowSelectionChange,
    onShowInfo,
    onDisable,
}: UsersTableProps) => {
    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState('')

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: 'select',
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllRowsSelected()}
                        indeterminate={table.getIsSomeRowsSelected()}
                        onChange={({ checked }) =>
                            table.toggleAllRowsSelected(checked)
                        }
                        dataTest="select-all-users"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        disabled={!row.getCanSelect()}
                        onChange={({ checked }) => row.toggleSelected(checked)}
                        dataTest={`select-user-${row.original.username}`}
                    />
                ),
            }),
            columnHelper.accessor('username', {
                header: i18n.t('Username'),
            }),
            columnHelper.accessor('firstName', {
                header: i18n.t('First name'),
            }),
            columnHelper.accessor('surname', {
                header: i18n.t('Surname'),
            }),
            columnHelper.accessor('disabled', {
                header: i18n.t('Status'),
                cell: (info) =>
                    info.getValue() ? (
                        <Tag negative>{i18n.t('Disabled')}</Tag>
                    ) : (
                        <Tag positive>{i18n.t('Active')}</Tag>
                    ),
            }),
            columnHelper.accessor('created', {
                header: i18n.t('Created'),
                cell: (info) => formatDate(info.getValue()),
            }),
            columnHelper.accessor((row) => row.lastLogin ?? '', {
                id: 'lastLogin',
                header: i18n.t('Last login'),
                cell: (info) => formatDate(info.getValue() || null),
            }),
            columnHelper.display({
                id: 'actions',
                header: i18n.t('Actions'),
                cell: ({ row }) => (
                    <ButtonStrip>
                        <Button
                            small
                            destructive
                            secondary
                            disabled={row.original.disabled}
                            onClick={() => onDisable(row.original)}
                        >
                            {i18n.t('Disable')}
                        </Button>
                        <Button small onClick={() => onShowInfo(row.original)}>
                            {i18n.t('Info')}
                        </Button>
                    </ButtonStrip>
                ),
            }),
        ],
        [onDisable, onShowInfo]
    )

    const table = useReactTable({
        data: users,
        columns,
        state: { sorting, globalFilter, rowSelection },
        getRowId: (row) => row.id,
        enableRowSelection: (row) => !row.original.disabled,
        onRowSelectionChange,
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: 'includesString',
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        autoResetPageIndex: true,
    })

    const rows = table.getRowModel().rows
    const totalRows = table.getFilteredRowModel().rows.length
    const { pageIndex, pageSize } = table.getState().pagination

    return (
        <div>
            <div className={styles.tableToolbar}>
                <InputField
                    placeholder={i18n.t('Search users')}
                    value={globalFilter}
                    onChange={({ value }) => setGlobalFilter(value ?? '')}
                    dense
                    className={styles.search}
                />
            </div>
            <DataTable>
                <DataTableHead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <DataTableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <DataTableColumnHeader
                                    key={header.id}
                                    fixed
                                    {...(header.column.getCanSort()
                                        ? {
                                              sortDirection: getSortDirection(
                                                  header.column
                                              ),
                                              sortIconTitle: i18n.t('Sort'),
                                              onSortIconClick: () =>
                                                  header.column.toggleSorting(),
                                          }
                                        : {})}
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                              header.column.columnDef.header,
                                              header.getContext()
                                          )}
                                </DataTableColumnHeader>
                            ))}
                        </DataTableRow>
                    ))}
                </DataTableHead>
                <DataTableBody>
                    {rows.length > 0 ? (
                        rows.map((row) => (
                            <DataTableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <DataTableCell key={cell.id}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </DataTableCell>
                                ))}
                            </DataTableRow>
                        ))
                    ) : (
                        <DataTableRow>
                            <DataTableCell colSpan="8" align="center">
                                {i18n.t('No users match the current filter')}
                            </DataTableCell>
                        </DataTableRow>
                    )}
                </DataTableBody>
                <DataTableFoot>
                    <DataTableRow>
                        <DataTableCell colSpan="8">
                            <Pagination
                                page={pageIndex + 1}
                                pageSize={pageSize}
                                pageCount={table.getPageCount()}
                                total={totalRows}
                                isLastPage={!table.getCanNextPage()}
                                onPageChange={(page: number) =>
                                    table.setPageIndex(page - 1)
                                }
                                onPageSizeChange={(size: number) =>
                                    table.setPageSize(size)
                                }
                            />
                        </DataTableCell>
                    </DataTableRow>
                </DataTableFoot>
            </DataTable>
        </div>
    )
}
