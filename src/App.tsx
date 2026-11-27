import { useCallback, useMemo, useState } from 'react';
import { ComparisonView } from './components/ComparisonView';
import { Header, type ActiveTab } from './components/Header';
import { InputWorkspace } from './components/InputWorkspace';
import { LandingHero } from './components/LandingHero';
import { PrivacyAboutPanel } from './components/PrivacyAboutPanel';
import { PromptLogPanel } from './components/PromptLogPanel';
import { RedactionControls } from './components/RedactionControls';
import { SummaryStats } from './components/SummaryStats';
import {
  createPromptLogEntry,
  detectDocument,
  redactDocument,
} from './engine/processor';
import { SAMPLE_NOISY_DOCUMENT } from './engine/sampleData';
import type {
  PromptLogEntry,
  RedactionMode,
  UploadedFileMeta,
} from './types/pii';
import {
  buildSanitizedFileName,
  downloadSanitizedBlob,
  readAndValidateUploadedFile,
  redactCsvDocument,
} from './utils/fileHelpers';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [inputText, setInputText] = useState<string>('');
  const [fileMeta, setFileMeta] = useState<UploadedFileMeta | null>(null);
  const [redactionMode, setRedactionMode] = useState<RedactionMode>('FULL_MASK');
  const [reviewOverrides, setReviewOverrides] = useState<
    Record<string, 'approved' | 'dismissed'>
  >({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [promptLog, setPromptLog] = useState<PromptLogEntry[]>([]);

  const isCsvMode = fileMeta?.type === 'csv';

  const detections = useMemo(
    () => detectDocument(inputText, isCsvMode),
    [inputText, isCsvMode]
  );

  const processed = useMemo(
    () => redactDocument(inputText, detections, redactionMode, reviewOverrides),
    [inputText, detections, redactionMode, reviewOverrides]
  );

  const appendLog = useCallback((entry: PromptLogEntry) => {
    setPromptLog((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const handleTextChange = (nextText: string) => {
    setInputText(nextText);
    setReviewOverrides({});
    if (errorMessage && nextText.trim()) {
      setErrorMessage(null);
    }
  };

  const handleLoadSample = () => {
    setErrorMessage(null);
    setFileMeta(null);
    setReviewOverrides({});
    setInputText(SAMPLE_NOISY_DOCUMENT);
    const sampleDetections = detectDocument(SAMPLE_NOISY_DOCUMENT, false);
    const result = redactDocument(
      SAMPLE_NOISY_DOCUMENT,
      sampleDetections,
      redactionMode,
      {}
    );
    appendLog(
      createPromptLogEntry({
        action: 'Loaded built-in sample dataset',
        redactionMode,
        entitiesDetected: result.stats.totalDetected,
        replacementsMade: result.stats.totalReplacements,
        status: 'success',
        details: 'All 6 PII categories, repeated entities, invalid patterns, and false-positive traps.',
      })
    );
  };

  const handleClear = () => {
    setInputText('');
    setFileMeta(null);
    setReviewOverrides({});
    setErrorMessage(null);
    setCopied(false);
  };

  const handleValidateInput = () => {
    if (!inputText.trim()) {
      const msg =
        'Input is empty. Paste text, upload a .txt or .csv file, or load sample data.';
      setErrorMessage(msg);
      appendLog(
        createPromptLogEntry({
          action: 'Scan rejected (empty input)',
          redactionMode,
          entitiesDetected: 0,
          replacementsMade: 0,
          status: 'error',
          details: 'Empty input validation triggered.',
        })
      );
      return;
    }

    setErrorMessage(null);
    appendLog(
      createPromptLogEntry({
        action: 'Scanned document input',
        redactionMode,
        entitiesDetected: processed.stats.totalDetected,
        replacementsMade: processed.stats.totalReplacements,
        status: processed.stats.reviewRequiredCount > 0 ? 'warning' : 'success',
        details:
          processed.stats.reviewRequiredCount > 0
            ? `${processed.stats.reviewRequiredCount} candidate(s) flagged for review.`
            : 'All detected entities classified deterministically.',
      })
    );
  };

  const handleFileSelected = async (file: File) => {
    const result = await readAndValidateUploadedFile(file);
    if (!result.ok) {
      setErrorMessage(result.error);
      appendLog(
        createPromptLogEntry({
          action: 'File upload validation failed',
          redactionMode,
          entitiesDetected: 0,
          replacementsMade: 0,
          status: 'error',
          details: result.error,
        })
      );
      return;
    }

    setErrorMessage(null);
    setFileMeta(result.meta);
    setReviewOverrides({});
    setInputText(result.content);

    const fileDetections = detectDocument(
      result.content,
      result.meta.type === 'csv'
    );
    const scanResult = redactDocument(
      result.content,
      fileDetections,
      redactionMode,
      {}
    );
    appendLog(
      createPromptLogEntry({
        action: `Uploaded .${result.meta.type.toUpperCase()} file`,
        redactionMode,
        entitiesDetected: scanResult.stats.totalDetected,
        replacementsMade: scanResult.stats.totalReplacements,
        status: scanResult.stats.reviewRequiredCount > 0 ? 'warning' : 'success',
        details: `Processed ${result.meta.type.toUpperCase()} input in browser memory.`,
      })
    );
  };

  const handleModeChange = (nextMode: RedactionMode) => {
    setRedactionMode(nextMode);
    if (inputText.trim()) {
      const nextResult = redactDocument(
        inputText,
        detections,
        nextMode,
        reviewOverrides
      );
      appendLog(
        createPromptLogEntry({
          action: 'Changed redaction mode',
          redactionMode: nextMode,
          entitiesDetected: nextResult.stats.totalDetected,
          replacementsMade: nextResult.stats.totalReplacements,
          status: 'success',
        })
      );
    }
  };

  const handleReviewDecision = (
    id: string,
    decision: 'approved' | 'dismissed'
  ) => {
    const nextOverrides = { ...reviewOverrides, [id]: decision };
    setReviewOverrides(nextOverrides);
    const nextResult = redactDocument(
      inputText,
      detections,
      redactionMode,
      nextOverrides
    );
    appendLog(
      createPromptLogEntry({
        action:
          decision === 'approved'
            ? 'Approved uncertain candidate for redaction'
            : 'Dismissed uncertain candidate (kept original)',
        redactionMode,
        entitiesDetected: nextResult.stats.totalDetected,
        replacementsMade: nextResult.stats.totalReplacements,
        status: 'success',
      })
    );
  };

  const handleCopySanitized = async () => {
    if (!inputText.trim()) {
      setErrorMessage('Nothing to copy. Provide input text first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(processed.sanitizedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      appendLog(
        createPromptLogEntry({
          action: 'Copied sanitized output to clipboard',
          redactionMode,
          entitiesDetected: processed.stats.totalDetected,
          replacementsMade: processed.stats.totalReplacements,
          status: 'success',
        })
      );
    } catch {
      setErrorMessage('Clipboard access was denied by the browser.');
    }
  };

  const handleDownloadTxt = () => {
    if (!inputText.trim()) {
      setErrorMessage('Nothing to download. Provide input text first.');
      return;
    }
    const fileName = buildSanitizedFileName(fileMeta?.name, 'txt');
    downloadSanitizedBlob(
      processed.sanitizedText,
      fileName,
      'text/plain;charset=utf-8'
    );
    appendLog(
      createPromptLogEntry({
        action: 'Exported sanitized TXT file',
        redactionMode,
        entitiesDetected: processed.stats.totalDetected,
        replacementsMade: processed.stats.totalReplacements,
        status: 'success',
      })
    );
  };

  const handleDownloadCsv = () => {
    if (!inputText.trim()) {
      setErrorMessage('Nothing to download. Provide input text or CSV first.');
      return;
    }
    const csvResult = redactCsvDocument(
      inputText,
      redactionMode,
      reviewOverrides,
      processed.detections
    );
    if (!csvResult.ok) {
      setErrorMessage(csvResult.error);
      appendLog(
        createPromptLogEntry({
          action: 'CSV export failed validation',
          redactionMode,
          entitiesDetected: processed.stats.totalDetected,
          replacementsMade: 0,
          status: 'error',
          details: csvResult.error,
        })
      );
      return;
    }

    const fileName = buildSanitizedFileName(fileMeta?.name, 'csv');
    downloadSanitizedBlob(csvResult.csv, fileName, 'text/csv;charset=utf-8');
    appendLog(
      createPromptLogEntry({
        action: 'Exported sanitized CSV file',
        redactionMode,
        entitiesDetected: processed.stats.totalDetected,
        replacementsMade: processed.stats.totalReplacements,
        status: 'success',
      })
    );
  };

  const reviewDetections = useMemo(
    () => processed.detections.filter((d) => d.reviewStatus === 'needs_review'),
    [processed.detections]
  );

  const hasInput = inputText.trim().length > 0;

  const scrollToWorkspace = (focusTextarea: boolean) => {
    const el = document.getElementById('sanitization-workspace');
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (focusTextarea) {
      const textarea = document.getElementById(
        'pii-input-textarea'
      ) as HTMLTextAreaElement | null;
      textarea?.focus();
    }
  };

  const handleStartSanitizing = () => {
    scrollToWorkspace(true);
  };

  const handleTrySampleFromHero = () => {
    handleLoadSample();
    scrollToWorkspace(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-slate-900">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        logCount={promptLog.length}
      />

      {activeTab === 'workspace' && (
        <LandingHero
          onStartSanitizing={handleStartSanitizing}
          onTrySample={handleTrySampleFromHero}
        />
      )}

      <main
        id="sanitization-workspace"
        className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6"
      >
        {activeTab === 'workspace' && (
          <>
            <InputWorkspace
              inputText={inputText}
              fileMeta={fileMeta}
              errorMessage={errorMessage}
              onTextChange={handleTextChange}
              onFileSelected={handleFileSelected}
              onLoadSample={handleLoadSample}
              onClear={handleClear}
              onValidateInput={handleValidateInput}
            />

            <SummaryStats stats={processed.stats} />

            <RedactionControls
              mode={redactionMode}
              onModeChange={handleModeChange}
              onDownloadTxt={handleDownloadTxt}
              onDownloadCsv={handleDownloadCsv}
              onCopySanitized={handleCopySanitized}
              copied={copied}
              hasOutput={hasInput}
              reviewDetections={reviewDetections}
              onReviewDecision={handleReviewDecision}
            />

            <ComparisonView
              originalSegments={processed.originalSegments}
              sanitizedSegments={processed.sanitizedSegments}
              hasInput={hasInput}
            />
          </>
        )}

        {activeTab === 'prompt-log' && (
          <PromptLogPanel
            entries={promptLog}
            onClearLog={() => setPromptLog([])}
          />
        )}

        {activeTab === 'privacy' && <PrivacyAboutPanel />}
      </main>
    </div>
  );
}

export default App;
