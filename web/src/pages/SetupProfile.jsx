import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setupProfile } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { scanDocument } from '../utils/docScanner';
import styles from './SetupProfile.module.css';

// Doc number format rules
const DOC_PATTERNS = {
  passport: { regex: /^[A-Z0-9]{6,20}$/, hint: '6–20 alphanumeric characters (e.g. A12345678)' },
  id:       { regex: /^[A-Z0-9\-]{5,20}$/, hint: '5–20 alphanumeric characters or hyphens' },
};

const analyzeStages = [
  'Scanning document...',
  'Detecting face in selfie...',
  'Detecting face in document...',
  'Comparing facial features...',
  'Finalizing verification...',
];

export default function SetupProfile() {
  const { setUser } = useAuth();
  const navigate    = useNavigate();

  // step: 1=doc type, 2=doc images + scan, 3=face capture, 4=analyzing, 5=done
  const [step, setStep]                   = useState(1);
  const [docType, setDocType]             = useState('');
  const [docNumber, setDocNumber]         = useState('');
  const [docNumberError, setDocNumberError] = useState('');
  const [docNumberSource, setDocNumberSource] = useState(''); // 'scanned' | 'manual' | ''
  const [docFront, setDocFront]           = useState(null);
  const [docBack, setDocBack]             = useState(null);
  const [faceImage, setFaceImage]         = useState(null);
  const [cameraActive, setCameraActive]   = useState(false);
  const [scanning, setScanning]           = useState(false);
  const [scanProgress, setScanProgress]   = useState(0);
  const [analyzeStage, setAnalyzeStage]   = useState(0);
  const [error, setError]                 = useState('');

  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const frontRef  = useRef(null);
  const backRef   = useRef(null);

  const docLabel       = docType === 'passport' ? 'Passport' : 'National ID';
  const docPlaceholder = docType === 'passport' ? 'e.g. A12345678' : 'e.g. 123456789';

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateDocNumber = (value, type) => {
    if (!type || !value.trim()) return '';
    const { regex, hint } = DOC_PATTERNS[type];
    return regex.test(value.trim().toUpperCase()) ? '' : hint;
  };

  const handleDocNumberChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/\s+/g, '');
    setDocNumber(val);
    setDocNumberError(validateDocNumber(val, docType));
    setDocNumberSource('manual');
  };

  // ── Image upload + auto-scan ───────────────────────────────────────────────
  const readFile = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const handleFrontFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readFile(file);
    setDocFront(dataUrl);
    // Auto-scan the front image for the document number
    await runScan(dataUrl);
  };

  const runScan = async (dataUrl) => {
    setScanning(true);
    setScanProgress(0);
    setError('');
    try {
      const result = await scanDocument(dataUrl, docType, (p) => setScanProgress(p));
      if (result.docNumber) {
        setDocNumber(result.docNumber);
        setDocNumberError(validateDocNumber(result.docNumber, docType));
        setDocNumberSource('scanned');
      } else {
        // Scan ran but found nothing — let user type manually
        setDocNumberSource('manual');
      }
    } catch {
      // Silent fail — user can type manually
      setDocNumberSource('manual');
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const handleBackFile = async (e) => {
    const file = e.target.files[0];
    if (file) setDocBack(await readFile(file));
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
      setCameraActive(true);
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const captureFace = useCallback(() => {
    const video  = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setFaceImage(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  }, [stopCamera]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const runAnalysisAndSubmit = async () => {
    setStep(4);
    setAnalyzeStage(0);
    setError('');

    const apiPromise = setupProfile({
      doc_type:        docType,
      doc_number:      docNumber.trim().toUpperCase(),
      doc_image_front: docFront,
      doc_image_back:  docBack,
      face_image:      faceImage,
    });

    for (let i = 0; i < analyzeStages.length; i++) {
      await new Promise(r => setTimeout(r, 520));
      setAnalyzeStage(i + 1);
    }

    try {
      const res = await apiPromise;
      setUser(res.data);
      setStep(5);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      setStep(3);
    }
  };

  const canProceedFromStep2 = docFront && docBack && docNumber.trim() && !docNumberError && !scanning;

  const STEP_LABELS = ['Document', 'Photos', 'Face Scan'];

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <Link to="/" className={styles.backLink}>← Back to Dashboard</Link>

        <div className={styles.header}>
          <div className={styles.icon}>🛡️</div>
          <h1>Identity Verification</h1>
          <p>Required before creating groups, joining, or contributing</p>
        </div>

        {/* Step indicators */}
        {step < 4 && (
          <div className={styles.steps}>
            {STEP_LABELS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={styles.stepItem}>
                  <div className={`${styles.dot} ${step > i + 1 ? styles.dotDone : ''} ${step === i + 1 ? styles.dotActive : ''}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`${styles.stepLabel} ${step === i + 1 ? styles.stepLabelActive : ''}`}>{s}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`${styles.stepLine} ${step > i + 1 ? styles.stepLineDone : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {/* ── STEP 1: Choose doc type ── */}
        {step === 1 && (
          <div className={styles.card}>
            <h2>Choose Document Type</h2>
            <p className={styles.hint}>Select the government-issued document you want to use for verification.</p>

            <div className={styles.docChoice}>
              <button
                className={`${styles.docOption} ${docType === 'passport' ? styles.docOptionActive : ''}`}
                onClick={() => { setDocType('passport'); setDocNumber(''); setDocNumberError(''); setDocNumberSource(''); setDocFront(null); setDocBack(null); }}
              >
                <span>🛂</span>
                <strong>Passport</strong>
                <small>International travel document</small>
              </button>
              <button
                className={`${styles.docOption} ${docType === 'id' ? styles.docOptionActive : ''}`}
                onClick={() => { setDocType('id'); setDocNumber(''); setDocNumberError(''); setDocNumberSource(''); setDocFront(null); setDocBack(null); }}
              >
                <span>🪪</span>
                <strong>National ID</strong>
                <small>Government-issued ID card</small>
              </button>
            </div>

            {docType && (
              <button className={styles.btn} onClick={() => setStep(2)}>
                Continue →
              </button>
            )}
          </div>
        )}

        {/* ── STEP 2: Upload front + back, auto-scan doc number ── */}
        {step === 2 && (
          <div className={styles.card}>
            <h2>{docLabel} Photos</h2>
            <p className={styles.hint}>
              Upload both sides of your {docLabel.toLowerCase()}. We'll automatically scan the document number from the front image.
            </p>

            {/* Front image */}
            <div className={styles.field}>
              <label>
                Front Side
                {docFront && !scanning && docNumberSource === 'scanned' && (
                  <span className={styles.scannedBadge}>🔍 Scanned</span>
                )}
              </label>
              <p className={styles.fieldHint}>
                {docType === 'passport'
                  ? 'The photo/data page — must show your face and document number clearly'
                  : 'The front side showing your photo, name, and ID number'}
              </p>
              {docFront ? (
                <div className={styles.preview}>
                  <img src={docFront} alt="Front" />
                  {scanning && (
                    <div className={styles.scanOverlay}>
                      <div className={styles.scanBeam} />
                      <p className={styles.scanText}>Scanning document... {scanProgress}%</p>
                      <div className={styles.scanBar}>
                        <div className={styles.scanBarFill} style={{ width: `${scanProgress}%` }} />
                      </div>
                    </div>
                  )}
                  <button className={styles.retake} onClick={() => {
                    setDocFront(null);
                    setDocNumber('');
                    setDocNumberSource('');
                    setDocNumberError('');
                    if (frontRef.current) frontRef.current.value = '';
                  }}>
                    Change photo
                  </button>
                </div>
              ) : (
                <div className={styles.uploadBox} onClick={() => frontRef.current.click()}>
                  <span>📄</span>
                  <p>Click to upload front side</p>
                  <small>JPG or PNG — document number will be scanned automatically</small>
                </div>
              )}
              <input ref={frontRef} type="file" accept="image/*" onChange={handleFrontFile} style={{ display: 'none' }} />
            </div>

            {/* Scanned / manual doc number field */}
            {docFront && (
              <div className={styles.field}>
                <label>
                  {docLabel} Number
                  {docNumberSource === 'scanned' && !docNumberError && (
                    <span className={styles.scannedBadge}>✓ Auto-filled</span>
                  )}
                  {docNumberSource === 'manual' && (
                    <span className={styles.manualBadge}>✏ Manual</span>
                  )}
                </label>
                {scanning ? (
                  <div className={styles.scanningField}>
                    <span className={styles.spinner} /> Scanning document number...
                  </div>
                ) : (
                  <>
                    <p className={styles.fieldHint}>
                      {docNumberSource === 'scanned'
                        ? 'Scanned from your document — please verify this is correct.'
                        : `Could not auto-scan. Enter the number exactly as it appears on your ${docLabel.toLowerCase()}.`}
                    </p>
                    <input
                      value={docNumber}
                      onChange={handleDocNumberChange}
                      placeholder={docPlaceholder}
                      maxLength={20}
                      className={docNumberError ? styles.inputError : docNumber && !docNumberError ? styles.inputOk : ''}
                    />
                    {docNumberError && <p className={styles.fieldError}>⚠ {docNumberError}</p>}
                    {docNumber && !docNumberError && (
                      <p className={styles.fieldOk}>✓ {docNumberSource === 'scanned' ? 'Verified format' : 'Format looks good'}</p>
                    )}
                    {docNumberSource === 'scanned' && (
                      <button className={styles.rescanBtn} onClick={() => runScan(docFront)}>
                        🔄 Re-scan
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Back image */}
            <div className={styles.field}>
              <label>Back Side</label>
              <p className={styles.fieldHint}>
                {docType === 'passport'
                  ? 'The page with the machine-readable zone (two lines of text at the bottom)'
                  : 'The back side showing the barcode or additional details'}
              </p>
              {docBack ? (
                <div className={styles.preview}>
                  <img src={docBack} alt="Back" />
                  <button className={styles.retake} onClick={() => { setDocBack(null); if (backRef.current) backRef.current.value = ''; }}>
                    Change photo
                  </button>
                </div>
              ) : (
                <div className={styles.uploadBox} onClick={() => backRef.current.click()}>
                  <span>🔄</span>
                  <p>Click to upload back side</p>
                  <small>JPG or PNG</small>
                </div>
              )}
              <input ref={backRef} type="file" accept="image/*" onChange={handleBackFile} style={{ display: 'none' }} />
            </div>

            <div className={styles.btnRow}>
              <button className={styles.btnOutline} onClick={() => setStep(1)}>← Back</button>
              <button
                className={styles.btn}
                disabled={!canProceedFromStep2}
                onClick={() => { setStep(3); startCamera(); }}
              >
                Continue to Face Scan →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Face capture ── */}
        {step === 3 && (
          <div className={styles.card}>
            <h2>Face Verification</h2>
            <p className={styles.hint}>
              Take a selfie. We'll compare it against the photo on your {docLabel.toLowerCase()} to confirm your identity.
            </p>

            {faceImage ? (
              <div className={styles.facePreviewWrap}>
                <img src={faceImage} alt="Selfie" className={styles.facePreview} />
                <div className={styles.matchBadge}>📸 Captured</div>
                <button className={styles.retake} onClick={() => { setFaceImage(null); startCamera(); }}>Retake selfie</button>
              </div>
            ) : cameraActive ? (
              <div className={styles.cameraBox}>
                <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
                <div className={styles.faceGuide} />
                <p className={styles.cameraHint}>Position your face inside the oval</p>
                <button className={styles.captureBtn} onClick={captureFace}>📸 Capture Selfie</button>
              </div>
            ) : (
              <div className={styles.uploadBox} onClick={startCamera}>
                <span>📷</span>
                <p>Click to open camera</p>
                <small>Make sure your face is well-lit and clearly visible</small>
              </div>
            )}

            <div className={styles.btnRow}>
              <button className={styles.btnOutline} onClick={() => { stopCamera(); setFaceImage(null); setStep(2); }}>← Back</button>
              <button className={styles.btn} disabled={!faceImage} onClick={runAnalysisAndSubmit}>
                Verify Identity →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Analyzing ── */}
        {step === 4 && (
          <div className={styles.card}>
            <div className={styles.analyzeWrap}>
              <div className={styles.analyzeImages}>
                <div className={styles.analyzeImgBox}>
                  <img src={docFront} alt="Document front" className={styles.analyzeImg} />
                  <small>{docLabel}</small>
                </div>
                <div className={styles.analyzeScan}>
                  <div className={styles.scanLine} />
                  <span>🔍</span>
                </div>
                <div className={styles.analyzeImgBox}>
                  <img src={faceImage} alt="Selfie" className={styles.analyzeImgFace} />
                  <small>Selfie</small>
                </div>
              </div>

              <h2 className={styles.analyzeTitle}>Analyzing your identity...</h2>

              <div className={styles.stageList}>
                {analyzeStages.map((s, i) => (
                  <div key={s} className={`${styles.stage} ${analyzeStage > i ? styles.stageDone : ''} ${analyzeStage === i ? styles.stageActive : ''}`}>
                    <span className={styles.stageIcon}>
                      {analyzeStage > i ? '✓' : analyzeStage === i ? <span className={styles.spinner} /> : '○'}
                    </span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>

              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${(analyzeStage / analyzeStages.length) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: Done ── */}
        {step === 5 && (
          <div className={styles.card}>
            <div className={styles.doneWrap}>
              <div className={styles.doneIcon}>✅</div>
              <h2>Identity Verified!</h2>
              <p>Your {docLabel.toLowerCase()} has been verified successfully. You can now create groups, join, and contribute.</p>
              <div className={styles.doneDetail}>
                <span>{docType === 'passport' ? '🛂' : '🪪'} {docLabel}</span>
                <strong>{docNumber}</strong>
              </div>
              <button className={styles.btn} onClick={() => navigate('/')}>Go to Dashboard →</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
