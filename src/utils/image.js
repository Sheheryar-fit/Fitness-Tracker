// Longest side of uploaded progress photos, in pixels
const MAX_PHOTO_SIZE = 1280
const PHOTO_QUALITY = 0.8

/**
 * Shrink a photo in the browser before upload (JPEG, longest side 1280px).
 * Keeps the original if the browser can't decode it or shrinking doesn't help.
 * @param {File} file - Image picked by the user
 * @returns {Promise<File>} Resized JPEG, or the original file
 */
export async function resizePhoto(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()

    const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff' // JPEG has no transparency
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch (err) {
    console.warn('Could not resize photo, uploading original:', err)
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}
