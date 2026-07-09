import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, className = '', ...rest }) => (
  <table className={className} {...rest}>{children}</table>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = '', ...rest }) => (
  <thead className={className} {...rest}>{children}</thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = '', ...rest }) => (
  <tbody className={className} {...rest}>{children}</tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className = '', ...rest }) => (
  <tr className={className} {...rest}>{children}</tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...rest }) => (
  <th className={className} {...rest}>{children}</th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...rest }) => (
  <td className={className} {...rest}>{children}</td>
);

export default Table;
