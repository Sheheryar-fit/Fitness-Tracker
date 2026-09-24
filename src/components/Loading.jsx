/**
 * Loading Component - centered spinner while a page loads its data
 *
 * @param {boolean} inline - Small spinner inside a section instead of a full page
 */
export default function Loading({ inline = false }) {
  if (inline) {
    return (
      <div className="spinner spinner-inline" role="status">
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return (
    <div className="loading-container" role="status">
      <div className="spinner"></div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
