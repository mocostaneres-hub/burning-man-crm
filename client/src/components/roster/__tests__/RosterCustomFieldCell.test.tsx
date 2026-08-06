import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RosterCustomFieldCell, { RosterCustomFieldDefinition } from '../RosterCustomFieldCell';

const numberField: RosterCustomFieldDefinition = {
  key: 'eap_number',
  label: 'EAP #',
  type: 'number'
};

const NumberCellHarness = ({ onSave }: { onSave: jest.Mock }) => {
  const [value, setValue] = useState<number | null>(null);

  return (
    <RosterCustomFieldCell
      field={numberField}
      value={value}
      canEdit
      onSave={async (nextValue) => {
        onSave(nextValue);
        setValue(nextValue);
      }}
    />
  );
};

describe('RosterCustomFieldCell', () => {
  test('stays locked until clicked, then saves a number and relocks on blur', async () => {
    const onSave = jest.fn();
    render(<NumberCellHarness onSave={onSave} />);

    expect(screen.queryByRole('spinbutton', { name: 'EAP #' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit EAP #' }));
    const input = screen.getByRole('spinbutton', { name: 'EAP #' });
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(42));
    await waitFor(() => expect(screen.queryByRole('spinbutton', { name: 'EAP #' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Edit EAP #' })).toHaveTextContent('42');
  });

  test('requires another click before an existing number can be edited again', async () => {
    const onSave = jest.fn();
    const { rerender } = render(
      <RosterCustomFieldCell field={numberField} value={42} canEdit onSave={onSave} />
    );

    expect(screen.queryByRole('spinbutton', { name: 'EAP #' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit EAP #' }));
    expect(screen.getByRole('spinbutton', { name: 'EAP #' })).toHaveValue(42);

    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'EAP #' }), { key: 'Escape' });
    rerender(<RosterCustomFieldCell field={numberField} value={42} canEdit onSave={onSave} />);

    expect(screen.queryByRole('spinbutton', { name: 'EAP #' })).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('renders a non-interactive value for users without write permission', () => {
    render(
      <RosterCustomFieldCell field={numberField} value={42} canEdit={false} onSave={jest.fn()} />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit EAP #' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'EAP #' })).not.toBeInTheDocument();
  });
});
