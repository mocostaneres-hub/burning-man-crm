import { fireEvent, render, screen } from '@testing-library/react';
import Modal from '../Modal';

describe('Modal', () => {
  test('closes when the overlay is clicked by default', () => {
    const onClose = jest.fn();

    render(
      <Modal isOpen onClose={onClose} title="Test Modal">
        <button type="button">Inside</button>
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-overlay'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not close when the overlay is clicked if disabled', () => {
    const onClose = jest.fn();

    render(
      <Modal isOpen onClose={onClose} title="Test Modal" closeOnOverlayClick={false}>
        <button type="button">Inside</button>
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-overlay'));

    expect(onClose).not.toHaveBeenCalled();
  });

  test('does not close when modal content is clicked', () => {
    const onClose = jest.fn();

    render(
      <Modal isOpen onClose={onClose} title="Test Modal">
        <button type="button">Inside</button>
      </Modal>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inside' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  test('closes on Escape by default', () => {
    const onClose = jest.fn();

    render(
      <Modal isOpen onClose={onClose} title="Test Modal">
        <button type="button">Inside</button>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not close on Escape if disabled', () => {
    const onClose = jest.fn();

    render(
      <Modal isOpen onClose={onClose} title="Test Modal" closeOnEscape={false}>
        <button type="button">Inside</button>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
