import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

describe('PRIVY Application UI Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Workspace by default and validates empty input', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /PRIVY/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Input Document/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Scan Input/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Input is empty/i);
  });

  it('renders editorial landing hero with working Start sanitizing and Try sample document CTAs', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /Share documents\. Not sensitive data\./i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Detect, protect and sanitize sensitive information before sharing your documents\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Product preview showing original and sanitized document side by side/i)
    ).toBeInTheDocument();

    // Primary CTA focuses the workspace input textarea
    await user.click(screen.getByRole('button', { name: /Start sanitizing/i }));
    expect(screen.getByLabelText(/Source text or CSV content/i)).toHaveFocus();

    // Secondary CTA loads built-in sample data into the real detection engine
    await user.click(screen.getByRole('button', { name: /Try sample document/i }));
    const sanitizedPanel = screen.getByLabelText(/Sanitized output panel/i);
    expect(sanitizedPanel).toHaveTextContent('[REDACTED]');
    expect(sanitizedPanel).not.toHaveTextContent('john@example.com');
    expect(sanitizedPanel).toHaveTextContent('4532015112830366');
  });

  it('loads sample data, updates stats live, and switches between all three redaction modes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: /Load Sample Data/i })
    );

    const sanitizedPanel = screen.getByLabelText(/Sanitized output panel/i);
    expect(sanitizedPanel).toHaveTextContent('[REDACTED]');
    expect(sanitizedPanel).not.toHaveTextContent('john@example.com');
    // False-positive Order ID stays intact
    expect(sanitizedPanel).toHaveTextContent('4532015112830366');

    // Switch to Partial Mask
    await user.click(screen.getByRole('radio', { name: /Partial Mask/i }));
    expect(sanitizedPanel).toHaveTextContent('j***@example.com');
    expect(sanitizedPanel).toHaveTextContent('XXXXXX3210');

    // Keyboard arrow navigation switches from Partial Mask to Consistent Pseudonym
    const partialRadio = screen.getByRole('radio', { name: /Partial Mask/i });
    partialRadio.focus();
    fireEvent.keyDown(partialRadio, { key: 'ArrowRight' });
    expect(sanitizedPanel).toHaveTextContent('USER_01');
    expect(sanitizedPanel).toHaveTextContent('PHONE_01');
    expect(sanitizedPanel).toHaveTextContent('PAN_01');
  });

  it('records privacy-safe Prompt Log entries without storing original sensitive values', async () => {
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByLabelText(/Source text or CSV content/i);
    await user.type(textarea, 'Secret contact john@example.com and PAN ABCDE1234F');
    await user.click(screen.getByRole('button', { name: /Scan Input/i }));

    await user.click(screen.getByRole('button', { name: /Prompt Log/i }));
    expect(
      screen.getByRole('heading', { name: /Prompt & Processing Log/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Scanned document input/i)).toBeInTheDocument();

    // Ensure sensitive values are NEVER stored in the Prompt Log table
    expect(screen.queryByText(/john@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ABCDE1234F/)).not.toBeInTheDocument();
  });

  it('handles TXT upload, CSV upload, unsupported file error, and safe Blob export', async () => {
    const user = userEvent.setup();
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      });
    }
    const createUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(<App />);

    const fileInput = screen.getByLabelText(/Upload TXT or CSV file/i);

    // Unsupported file
    const badFile = new File(['hello'], 'malware.exe', {
      type: 'application/octet-stream',
    });
    Object.defineProperty(badFile, 'text', {
      value: async () => 'hello',
    });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Unsupported file type/i
    );

    // Valid TXT file
    const txtContent = 'Email: john@example.com\nPhone: 9876543210';
    const txtFile = new File([txtContent], 'report.txt', {
      type: 'text/plain',
    });
    Object.defineProperty(txtFile, 'text', {
      value: async () => txtContent,
    });
    fireEvent.change(fileInput, { target: { files: [txtFile] } });

    expect(await screen.findByText('report.txt')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Sanitized output panel/i)
    ).toHaveTextContent('[REDACTED]');

    // Download TXT triggers Blob URL creation and revocation
    await user.click(screen.getByRole('button', { name: /Download TXT/i }));
    expect(createUrlSpy).toHaveBeenCalledTimes(1);

    // Valid CSV file
    const csvContent = 'name,email\n"Doe, Jane",john@example.com';
    const csvFile = new File([csvContent], 'leads.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(csvFile, 'text', {
      value: async () => csvContent,
    });
    fireEvent.change(fileInput, { target: { files: [csvFile] } });
    expect(await screen.findByText('leads.csv')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Download CSV/i }));
    expect(createUrlSpy).toHaveBeenCalledTimes(2);
    expect(anchorClickSpy).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r, 150));
    expect(revokeSpy).toHaveBeenCalled();
  });
});
