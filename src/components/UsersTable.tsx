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
import type {
    Column,
    Row,
    RowData,
    RowSelectionState,
    SortingState,
    Table,
} from '@tanstack/react-table'
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo, useState } from 'react'
import type { UserListItem } from '../types'
import { formatDate } from '../utils/dates'
import styles from './UsersTable.module.css'

const columnHelper = createColumnHelper<UserListItem>()

const getSortDirection = (column: Column<UserListItem>) =>
    column.getIsSorted() || 'default'

declare module '@tanstack/react-table' {
    // oxlint-disable-next-line no-unused-vars -- TData must match TanStack's declaration to merge with it
    interface TableMeta<TData extends RowData> {
        currentUserId: string
        onDisable: (user: UserListItem) => void
        onShowInfo: (user: UserListItem) => void
    }
}

type UserTable = Table<UserListItem>
type UserRow = Row<UserListItem>

// TanStack selects (and counts) only the rows that match the search.
const SelectAllHeader = ({ table }: { table: UserTable }) => (
    <Checkbox
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onChange={({ checked }) => table.toggleAllRowsSelected(checked)}
        dataTest="select-all-users"
    />
)

const SelectRowCell = ({ row }: { row: UserRow }) => (
    <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={({ checked }) => row.toggleSelected(checked)}
        dataTest={`select-user-${row.original.username}`}
    />
)

const StatusCell = ({ row, table }: { row: UserRow; table: UserTable }) => (
    <div className={styles.tags}>
        {row.original.disabled ? (
            <Tag negative>{i18n.t('Disabled')}</Tag>
        ) : (
            <Tag positive>{i18n.t('Active')}</Tag>
        )}
        {row.original.id === table.options.meta?.currentUserId && (
            <Tag neutral dataTest="current-user-tag">
                {i18n.t('You')}
            </Tag>
        )}
    </div>
)

const ActionsCell = ({ row, table }: { row: UserRow; table: UserTable }) => {
    const meta = table.options.meta
    return (
        <ButtonStrip>
            <Button
                small
                destructive
                secondary
                disabled={!row.getCanSelect()}
                onClick={() => meta?.onDisable(row.original)}
            >
                {i18n.t('Disable')}
            </Button>
            <Button small onClick={() => meta?.onShowInfo(row.original)}>
                {i18n.t('Info')}
            </Button>
        </ButtonStrip>
    )
}

// Built on first render rather than at module load, so the headers are
// translated with the user's locale.
const buildColumns = () => [
    columnHelper.display({
        id: 'select',
        header: SelectAllHeader,
        cell: SelectRowCell,
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
        cell: StatusCell,
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
        cell: ActionsCell,
    }),
]

interface UsersTableProps {
    users: UserListItem[]
    currentUserId: string
    rowSelection: RowSelectionState
    onRowSelectionChange: Dispatch<SetStateAction<RowSelectionState>>
    onShowInfo: (user: UserListItem) => void
    onDisable: (user: UserListItem) => void
}

export const UsersTable = ({
    users,
    currentUserId,
    rowSelection,
    onRowSelectionChange,
    onShowInfo,
    onDisable,
}: UsersTableProps) => {
    const [sorting, setSorting] = useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = useState('')
    const columns = useMemo(() => buildColumns(), [])

    // oxlint-disable-next-line react/incompatible-library -- the app is not compiled with React Compiler; useReactTable is TanStack's documented API
    const table = useReactTable({
        data: users,
        columns,
        meta: { currentUserId, onDisable, onShowInfo },
        state: { sorting, globalFilter, rowSelection },
        getRowId: (row) => row.id,
        // Admins cannot disable their own account here: one "select all"
        // with a broad filter would otherwise lock them out.
        enableRowSelection: (row) =>
            !row.original.disabled && row.original.id !== currentUserId,
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
                    dataTest="search-users"
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
