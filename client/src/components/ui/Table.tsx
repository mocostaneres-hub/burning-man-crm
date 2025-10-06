import React from 'react';

export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  className?: string;
  rowKey?: string | ((record: T) => string);
  onRowClick?: (record: T, index: number) => void;
  emptyText?: string;
}

export const Table = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  className = '',
  rowKey = 'id',
  onRowClick,
  emptyText = 'No data available',
}: TableProps<T>) => {
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return record[rowKey] || index.toString();
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={`table-container ${className}`}>
      <table className="table">
        <thead className="table-header">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`table-header-cell ${alignClasses[column.align || 'left']}`}
                style={{ width: column.width }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="table-body">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="table-cell text-center py-12">
                <div className="flex items-center justify-center">
                  <div className="spinner"></div>
                  <span className="ml-3 text-gray-500">Loading...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-cell text-center py-12">
                <div className="text-gray-500">{emptyText}</div>
              </td>
            </tr>
          ) : (
            data.map((record, index) => (
              <tr
                key={getRowKey(record, index)}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                onClick={() => onRowClick?.(record, index)}
              >
                {columns.map((column) => {
                  const value = column.dataIndex ? record[column.dataIndex] : record[column.key];
                  const renderedValue = column.render ? column.render(value, record, index) : value;
                  
                  return (
                    <td
                      key={column.key}
                      className={`table-cell ${alignClasses[column.align || 'left']}`}
                    >
                      {renderedValue}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
