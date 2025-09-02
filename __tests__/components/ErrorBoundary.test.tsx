import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import ErrorBoundary from '../../src/components/ErrorBoundary';

// Mock component that throws an error
const ThrowError = ({shouldThrow}: {shouldThrow: boolean}) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    const {getByText} = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(getByText('No error')).toBeTruthy();
  });

  it('renders error UI when child throws an error', async () => {
    const {getByText, getByTestId} = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(getByText('Something went wrong')).toBeTruthy();
      expect(getByText('An error occurred in the application.')).toBeTruthy();
      expect(getByTestId('retry-button')).toBeTruthy();
      expect(getByTestId('report-button')).toBeTruthy();
    });
  });

  it('calls onRetry when retry button is pressed', async () => {
    const onRetry = jest.fn();
    const {getByTestId} = render(
      <ErrorBoundary onRetry={onRetry}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      const retryButton = getByTestId('retry-button');
      fireEvent.press(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onReportError when report button is pressed', async () => {
    const onReportError = jest.fn();
    const {getByTestId} = render(
      <ErrorBoundary onReportError={onReportError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      const reportButton = getByTestId('report-button');
      fireEvent.press(reportButton);
      expect(onReportError).toHaveBeenCalledTimes(1);
    });
  });

  it('logs error information when error occurs', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object),
      );
    });
  });
});
