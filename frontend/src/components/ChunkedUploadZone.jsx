import { useState, useRef, useCallback } from 'react';
import axios from 'axios';

const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = [
  // Video
  '.mov', '.mp4', '.webm', '.avi', '.mkv',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  // Image
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.heic', '.heif',
];

function getFileType(mimeType, filename) {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  const ext = '.' + filename.split('.').pop().toLowerCase();
  if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) return 'audio';
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.heic', '.heif'].includes(ext)) return 'image';
  return 'unknown';
}

export default function ChunkedUploadZone({ apiBase, authToken, onUploadComplete, onError }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef(null);

  const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  const uploadFileInChunks = useCallback(
    async (file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        onError(`"${file.name}" is not a supported file type.`);
        return;
      }

      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      setUploads((prev) => [
        ...prev,
        { id: uploadId, name: file.name, progress: 0, status: 'uploading', uploadedChunks: 0, totalChunks },
      ]);

      try {
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', chunkIndex);
          formData.append('totalChunks', totalChunks);
          formData.append('originalFilename', file.name);

          await axios.post(`${apiBase}/upload-chunk`, formData, {
            headers: { 'Content-Type': 'multipart/form-data', ...authHeaders },
          });

          const uploadedChunks = chunkIndex + 1;
          const progress = Math.round((uploadedChunks / totalChunks) * 100);
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, progress, uploadedChunks } : u))
          );
        }

        // Finalize: merge chunks into final file
        const { data } = await axios.post(
          `${apiBase}/upload-finalize`,
          {
            uploadId,
            originalFilename: file.name,
            fileType: getFileType(file.type, file.name),
            mimeType: file.type || 'application/octet-stream',
          },
          { headers: { ...authHeaders } }
        );

        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, progress: 100, status: 'done' } : u))
        );

        onUploadComplete(data);

        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        }, 2000);
      } catch (err) {
        const msg = err.response?.data?.error || `Failed to upload "${file.name}"`;
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, status: 'error' } : u))
        );
        onError(msg);
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        }, 3000);
      }
    },
    [apiBase, authHeaders, onUploadComplete, onError]
  );

  const handleFiles = useCallback(
    (fileList) => {
      Array.from(fileList).forEach(uploadFileInChunks);
    },
    [uploadFileInChunks]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleClick = () => inputRef.current?.click();

  return (
    <div className="upload-zone">
      <div
        className={`drop-area ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label="Upload media files"
      >
        <span className="drop-icon">{dragOver ? '📂' : '⬆️'}</span>
        <p className="drop-text">{dragOver ? 'Drop to upload' : 'Click or drag files here'}</p>
        <p className="drop-subtext">Videos, audio, and images up to 2 GB</p>
        <div className="file-types">
          {ALLOWED_EXTENSIONS.map((ext) => (
            <span key={ext} className="file-type-badge">{ext}</span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          className="file-input"
          accept={ALLOWED_EXTENSIONS.join(',')}
          multiple
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {uploads.length > 0 && (
        <div className="upload-progress">
          {uploads.map((u) => (
            <div key={u.id} className="progress-item">
              <div className="progress-info">
                <span className="progress-name" title={u.name}>{u.name}</span>
                <span className="progress-pct">
                  {u.status === 'error'
                    ? '✗ Error'
                    : u.status === 'done'
                    ? '✓ Done'
                    : `${u.progress}%`}
                </span>
              </div>
              {u.status === 'uploading' && u.totalChunks > 1 && (
                <div className="progress-details">
                  <span className="chunk-info">
                    Chunk {u.uploadedChunks} of {u.totalChunks}
                  </span>
                </div>
              )}
              <div className="progress-bar">
                <div
                  className={`progress-fill ${u.status}`}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
