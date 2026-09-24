import { useState, useEffect, useRef } from 'react'
import { Camera, Upload, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from './ConfirmDialog'
import Loading from './Loading'
import { formatDate, getLocalDateString } from '../utils/calculations'
import { resizePhoto } from '../utils/image'
import { removePhotoFiles, signedPhotoUrls } from '../lib/photoStorage'

export default function ProgressPhotos({ clientId }) {
  const { user } = useAuth()
  const [photos, setPhotos] = useState([])
  const [signedUrls, setSignedUrls] = useState({}) // photo_url -> temporary link
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null) // { url, date }
  const closeRef = useRef(null)

  useEffect(() => {
    fetchPhotos()
  }, [clientId])

  // Full-screen photo: Escape closes it, focus goes to the close button
  useEffect(() => {
    if (!fullscreenPhoto) return
    closeRef.current?.focus()
    function handleKey(e) {
      if (e.key === 'Escape') setFullscreenPhoto(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [fullscreenPhoto])

  async function fetchPhotos() {
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
      setSignedUrls(await signedPhotoUrls((data || []).map((p) => p.photo_url)))
    } catch (err) {
      console.error('Error fetching photos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      // 1. Shrink the photo, then upload to Supabase Storage
      const photo = await resizePhoto(file)
      const fileExt = photo.name.split('.').pop()
      // The folder is the client id - storage rules use it to decide who may access the file
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `${clientId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, photo)

      if (uploadError) throw uploadError

      // 2. Stored link (identifies the file; shown through a temporary signed link)
      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath)

      const photoUrl = publicUrlData.publicUrl

      // 3. Save to database
      const { data: photoData, error: dbError } = await supabase
        .from('progress_photos')
        .insert({
          client_id: clientId,
          uploader_id: user.id,
          photo_url: photoUrl,
          date: getLocalDateString()
        })
        .select()

      if (dbError) throw dbError

      if (photoData && photoData[0]) {
        const newLink = await signedPhotoUrls([photoUrl])
        setSignedUrls((prev) => ({ ...prev, ...newLink }))
        setPhotos((prev) => [photoData[0], ...prev])
      }
    } catch (err) {
      console.error('Error uploading photo:', err)
      alert('Failed to upload photo. Please try again.')
    } finally {
      setUploading(false)
      // Reset input
      e.target.value = null
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('progress_photos')
        .delete()
        .eq('id', deleteTarget)

      if (error) throw error

      // Also delete the image file, otherwise its public link keeps working
      const photo = photos.find((p) => p.id === deleteTarget)
      const fileError = await removePhotoFiles([photo?.photo_url])
      if (fileError) console.error('Error deleting photo file:', fileError)

      setPhotos((prev) => prev.filter((p) => p.id !== deleteTarget))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting photo:', err)
    }
  }

  if (loading) return <Loading inline />

  return (
    <div className="photos-block">
      <div className="section-header">
        <h3 className="card-title">
          <Camera size={20} aria-hidden="true" />
          Progress photos
          <span className="section-count">{photos.length}</span>
        </h3>

        <div>
          <input
            type="file"
            id={`photo-upload-${clientId}`}
            accept="image/*"
            className="sr-only"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <label
            htmlFor={`photo-upload-${clientId}`}
            className={`btn btn-secondary btn-sm ${uploading ? 'is-busy' : ''}`}
            aria-disabled={uploading}
          >
            {uploading ? <span className="btn-spinner" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </label>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state" style={{ padding: '1.5rem' }}>
          <p>No progress photos uploaded yet.</p>
        </div>
      ) : (
        <div className="photo-grid stagger">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-tile">
              {signedUrls[photo.photo_url] ? (
                <button
                  type="button"
                  className="photo-open"
                  onClick={() => setFullscreenPhoto({ url: signedUrls[photo.photo_url], date: photo.date })}
                  aria-label={`Open progress photo from ${formatDate(photo.date)}`}
                >
                  <img
                    src={signedUrls[photo.photo_url]}
                    alt={`Progress on ${formatDate(photo.date)}`}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ) : (
                <div className="photo-unavailable">Photo unavailable</div>
              )}
              <div className="photo-caption">
                <span>{formatDate(photo.date)}</span>
                {(user.role === 'admin' || user.id === photo.uploader_id) && (
                  <button
                    className="icon-btn"
                    onClick={() => setDeleteTarget(photo.id)}
                    aria-label={`Delete photo from ${formatDate(photo.date)}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Photo"
        message="Are you sure you want to delete this photo?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {fullscreenPhoto && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Progress photo from ${formatDate(fullscreenPhoto.date)}`}
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            type="button"
            className="icon-btn lightbox-close"
            onClick={() => setFullscreenPhoto(null)}
            aria-label="Close photo"
            ref={closeRef}
          >
            <X size={22} aria-hidden="true" />
          </button>
          <img
            src={fullscreenPhoto.url}
            alt={`Progress on ${formatDate(fullscreenPhoto.date)}`}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
