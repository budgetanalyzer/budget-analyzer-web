import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/Table';

describe('Table', () => {
  it('uses a horizontally scrollable container without hiding its native scrollbar', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Transaction</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const scrollContainer = screen.getByRole('table').parentElement;

    expect(scrollContainer).toHaveClass('overflow-x-auto');
    expect(scrollContainer).not.toHaveClass('scrollbar-hide');
  });
});
