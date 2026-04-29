import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setupProfile } from '../api/users';
import { useAuth } from '../context/AuthContext';
import styles from './SetupProfile.module.css';

const STEPS = ['Document', 'Face Scan', 'Analyzing', 'Done'];

export default function SetupProfile() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Step: 1=doc choice+details, 2=face capture, 3=analyzing (mock), 4=done
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState(''); // 'passport' | 'id'
  const [docNumber, setDocNumber] = useState('');
  const [docImage, setDocImage] = useState(null);
  const [faceImage, setFaceImage] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState(0); // progress through analysis steps
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const docInputRef = useRef(null);

  // ── Document image upload ──────────────────────────────────────────────────
  const handleDocFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocImage(reader.result);
    reader.readAsDataURL(file);
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      // slight delay so the video element is mounted
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
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setFaceImage(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  }, [stopCamera]);

  // ── Mock face analysis then submit ─────────────────────────────────────────
  const analyzeStages = [
    'Detecting face in selfie...',
    'Detecting face in document...',
    'Comparing facial features...',
    'Verifying document authenticity...',
    'Finalizing verification...',
  ];

  const runAnalysisAndSubmit = async () => {
    setStep(3);
    setAnalyzeStage(0);
    setError('');

    // Animate through stages
    for (let i = 0; i < analyzeStages.length; i++) {
      await new Promise(r => setTimeout(r, 520));
      setAnalyzeStage(i + 1);
    }

    // Now actually call the backend
    try {
      const res = await setupProfile({
        doc_type: docType,
        doc_number: docNumber,
        doc_image: docImage,
        face_image: faceImage,
      });
      setUser(res.data);
      setStep(4);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      setStep(2); // go back to face step so they can retry
    }
  };

  const docLabel = docType === 'passport' ? 'Passport' : 'National ID';
  const docPlaceholder = docType === 'passport' ? 'e.g. A12345678' : 'e.g. 123456789';

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        <Link to="/" className={styles.backLink}>← Back to Dashboard</Link>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.icon}>🛡️</div>
          <h1>Identity Verification</h1>
          <p>Required before creating groups, joining, or contributing</p>
        </div>

        {/* Step indicators — hide on analyzing/done */}
        {step < 3 && (
          <div className={styles.steps}>
            {STEPS.slice(0, 2).map((s, i) => (
              <React.Fragment key={s}>
                <div className={styles.stepItem}>
                  <div className={`${styles.dot} ${step > i + 1 ? styles.dotDone : ''} ${step === i + 1 ? styles.dotActive : ''}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`${styles.stepLabel} ${step === i + 1 ? styles.stepLabelActive : ''}`}>{s}</span>
                </div>
                {i < 1 && <div className={`${styles.stepLine} ${step > i + 1 ? styles.stepLineDone : ''}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {/* ── STEP 1: Document ── */}
        {step === 1 && (
          <div className={styles.card}>
            <h2>Choose Document Type</h2>
            <p className={styles.hint}>Select the government-issued document you want to use for verification.</p>

            <div className={styles.docChoice}>
              <button
                className={`${styles.docOption} ${docType === 'passport' ? styles.docOptionActive : ''}`}
                onClick={() => { setDocType('passport'); setDocNumber(''); setDocImage(null); }}
              >
                <span>🛂</span>
                <strong>Passport</strong>
                <small>International travel document</small>
              </button>
              <button
                className={`${styles.docOption} ${docType === 'id' ? styles.docOptionActive : ''}`}
                onClick={() => { setDocType('id'); setDocNumber(''); setDocImage(null); }}
              >
                <span>🪪</span>
                <strong>National ID</strong>
                <small>Government-issued ID card</small>
              </button>
            </div>

            {docType && (
              <>
                <div className={styles.field}>
                  <label>{docLabel} Number</label>
                  <input
                    value={docNumber}
                    onChange={e => setDocNumber(e.target.value.toUpperCase())}
                    placeholder={docPlaceholder}
                    maxLength={20}
                  />
                </div>

                <div className={styles.field}>
                  <label>{docLabel} Photo</label>
                  <p className={styles.fieldHint}>Upload a clear, well-lit photo of your {docLabel.toLowerCase()}. All details must be readable.</p>
                  {docImage ? (
                    <div className={styles.preview}>
                      <img src={docImage} alt={docLabel} />
                      <button className={styles.retake} onClick={() => { setDocImage(null); if (docInputRef.current) docInputRef.current.value = ''; }}>
                        Change photo
                      </button>
                    </div>
                  ) : (
                    <div className={styles.uploadBox} onClick={() => docInputRef.current.click()}>
                      <span>{docType === 'passport' ? '📄' : '🪪'}</span>
                      <p>Click to upload {docLabel.toLowerCase()} photo</p>
                      <small>JPG or PNG</small>
                    </div>
                  )}
                  <input ref={docInputRef} type="file" accept="image/*" onChange={handleDocFile} style={{ display: 'none' }} />
                </div>

                <button
                  className={styles.btn}
                  disabled={!docNumber.trim() || !docImage}
                  onClick={() => { setStep(2); startCamera(); }}
                >
                  Continue to Face Scan →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Face capture ── */}
        {step === 2 && (
          <div className={styles.card}>
            <h2>Face Verification</h2>
            <p className={styles.hint}>
              Take a selfie. We'll compare it against your {docLabel.toLowerCase()} photo to confirm your identity.
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
              <button className={styles.btnOutline} onClick={() => { stopCamera(); setFaceImage(null); setStep(1); }}>← Back</button>
              <button className={styles.btn} disabled={!faceImage} onClick={runAnalysisAndSubmit}>
                Verify Identity →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Analyzing (mock) ── */}
        {step === 3 && (
          <div className={styles.card}>
            <div className={styles.analyzeWrap}>
              <div className={styles.analyzeImages}>
                <div className={styles.analyzeImgBox}>
                  <img src={docImage} alt="Document" className={styles.analyzeImg} />
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

        {/* ── STEP 4: Done ── */}
        {step === 4 && (
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
