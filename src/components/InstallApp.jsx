import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Download, Share, SquarePlus, X, MonitorDown } from 'lucide-react'
import { subscribe, getInstallMode, promptInstall } from '../lib/installPrompt'

/**
 * InstallApp Component - "Install App" button, shown only where installing is possible
 * Chrome/Edge/Android: opens the browser's install dialog.
 * iPhone/iPad and Mac Safari: explains the Share / File menu steps.
 *
 * @param {string} variant - 'nav' (sidebar link style) or 'button'
 */
export default function InstallApp({ variant = 'button' }) {
  const mode = useSyncExternalStore(subscribe, getInstallMode)
  const [showSteps, setShowSteps] = useState(false)

  if (mode === 'installed' || mode === 'unsupported') return null

  async function handleClick() {
    if (mode === 'prompt') {
      await promptInstall()
    } else {
      setShowSteps(true)
    }
  }

  return (
    <>
      <button
        type="button"
        className={variant === 'nav' ? 'nav-link nav-button' : 'btn btn-secondary'}
        onClick={handleClick}
        id={variant === 'nav' ? 'install-app-nav' : 'install-app-btn'}
      >
        <Download size={variant === 'nav' ? 20 : 18} aria-hidden="true" />
        <span>Install App</span>
      </button>

      {showSteps && <InstallSteps mode={mode} onClose={() => setShowSteps(false)} />}
    </>
  )
}

// Step-by-step instructions for browsers without an install dialog
function InstallSteps({ mode, onClose }) {
  const closeRef = useRef(null)
  const isIOS = mode === 'ios'

  useEffect(() => {
    closeRef.current?.focus()
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const steps = isIOS
    ? [
        { icon: Share, text: <>Tap the <strong>Share</strong> button in the browser toolbar (bottom of the screen on iPhone, top on iPad).</> },
        { icon: SquarePlus, text: <>Scroll down and tap <strong>Add to Home Screen</strong>.</> },
        { icon: Download, text: <>Tap <strong>Add</strong>. FitTracker now opens full screen from your home screen.</> }
      ]
    : [
        { icon: MonitorDown, text: <>In the menu bar, choose <strong>File → Add to Dock</strong> (macOS Sonoma or newer).</> },
        { icon: Download, text: <>Click <strong>Add</strong>. FitTracker now opens in its own window from the Dock.</> }
      ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <span className="icon-chip">
            <Download size={22} aria-hidden="true" />
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" ref={closeRef}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <h3 className="modal-title" id="install-title">
          {isIOS ? 'Add to your Home Screen' : 'Add to your Dock'}
        </h3>
        <p className="modal-message">Use FitTracker like an app, without the browser bars.</p>

        <ol className="install-steps">
          {steps.map(({ icon: Icon, text }, index) => (
            <li key={index}>
              <span className="install-step-number">{index + 1}</span>
              <span className="install-step-text">{text}</span>
              <Icon size={20} className="install-step-icon" aria-hidden="true" />
            </li>
          ))}
        </ol>

        {isIOS && (
          <p className="form-hint" style={{ marginTop: '1rem' }}>
            On older iPhones, use Safari. Chrome also works on iOS 16.4 and newer.
          </p>
        )}
      </div>
    </div>
  )
}
