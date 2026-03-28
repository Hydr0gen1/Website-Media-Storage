import { useState, useRef, useCallback } from 'react';
import axios from 'axios';

const ALLOWED_EXTENSIONS = ['.mov', '.mp4', '.mp3', '.wav', '.ogg'];

export default function UploadZone({ apiBase, onUploadComplete, onError }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef(null);

  const uploadFile = useCallback(
    async (file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        onError(`"${file.name}" is not a supported file type.`);
        return;
      }

      const id = Date.now() + Math.random();
      setUploads((prev) => [
        ...prev,
        { id, name: file.name, progress: 0, status: 'uploading' },
      ]);

      const form = new FormData();
      form.append('file', file);

      try {
        const { data } = await axios.post(`${apiBase}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) =>
              prev.map((u) => (u.id === id ? { ...u, progress: pct } : u))
            );
          },
        });

        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, progress: 100, status: 'done' } : u))
        );

        onUploadComplete(data);

        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }, 2000);
      } catch (err) {
        const msg =
          err.response?.data?.error || `Failed to upload "${file.name}"`;
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: 'error' } : u))
        );
        onError(msg);
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.id !== id));
        }, 3000);
      }
    },
    [apiBase, onUploadComplete, onError]
  );

  const handleFiles = useCallback(
    (fileList) => {
      Array.from(fileList).forEach(uploadFile);
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="upload-zone">
      <div
        className={`drop-area ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label="Upload media files"
      >
        <span className="drop-icon">{dragOver ? '📂' : '⬆️'}</span>
        <p className="drop-text">
          {dragOver ? 'Drop to upload' : 'Click or drag files here'}
        </p>
        <p className="drop-subtext">Videos and audio up to 2 GB</p>
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
          onChange={handleChange}
        />
      </div>

      {uploads.length > 0 && (
        <div className="upload-progress">
          {uploads.map((u) => (
            <div key={u.id} className="progress-item">
              <div className="progress-info">
                <span className="progress-name" title={u.name}>{u.name}</span>
                <span className="progress-pct">
                  {u.status === 'error' ? '✗ Error' : u.status === 'done' ? '✓ Done' : `${u.progress}%`}
                </span>
              </div>
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
