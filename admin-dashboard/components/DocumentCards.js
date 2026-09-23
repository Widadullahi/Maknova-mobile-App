'use client';

import { useState } from 'react';
import { canPreviewDocument, verificationDocumentUrl } from '../lib/api';
import { formatCount, labelize } from '../lib/format';
import styles from './dashboard.module.css';

function Watermark({ text }) {
  if (!text) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        transform: 'rotate(-24deg) scale(1.3)',
      }}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <span
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.55)',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

function RestrictedPreview({ doc, url, watermarkText, onOpen, large = false }) {
  const isImage = String(doc.mimeType || '').startsWith('image/');
  return (
    <div
      className={large ? undefined : styles.previewFrame}
      onClick={!large ? onOpen : undefined}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: large ? 'default' : 'zoom-in',
        ...(large ? { width: '100%', height: '100%', background: '#0b0b0d' } : null),
      }}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={doc.fileName || 'Document preview'}
          src={url}
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
          style={{ userSelect: 'none', pointerEvents: 'none', width: '100%', height: '100%', objectFit: large ? 'contain' : 'cover' }}
        />
      ) : (
        <iframe src={url} title={doc.fileName || 'Document preview'} style={{ pointerEvents: 'none', width: '100%', height: '100%' }} />
      )}
      <Watermark text={watermarkText} />
    </div>
  );
}

export function DocumentCards({ documents = [], token, allowDownload = true, viewerLabel = '', emptyText = 'No uploaded documents are attached to this response.' }) {
  const [openDoc, setOpenDoc] = useState(null);
  const watermarkText = viewerLabel ? `${viewerLabel} · ${new Date().toLocaleString()}` : '';

  return (
    <div className={styles.documentList}>
      <strong>Uploaded documents</strong>
      {documents.length ? documents.map((doc) => {
        const url = verificationDocumentUrl(doc, token);
        const downloadUrl = verificationDocumentUrl(doc, token, true);
        return (
          <div key={doc.id || doc.category || doc.fileUrl || doc.fileName} className={styles.documentCard}>
            <div className={styles.documentInfo}>
              <span>{labelize(doc.category || doc.type, 'Document')}</span>
              <strong>{doc.fileName || 'Uploaded document'}</strong>
              <small>{doc.mimeType || 'Unknown file type'}{doc.fileSize ? ` / ${formatCount(doc.fileSize)} bytes` : ''}</small>
            </div>
            {url && canPreviewDocument(doc) ? (
              allowDownload ? (
                <a className={styles.previewFrame} href={url} target="_blank" rel="noreferrer">
                  {String(doc.mimeType || '').startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={doc.fileName || 'Document preview'} src={url} />
                  ) : (
                    <iframe src={url} title={doc.fileName || 'Document preview'} />
                  )}
                </a>
              ) : (
                <RestrictedPreview doc={doc} url={url} watermarkText={watermarkText} onOpen={() => setOpenDoc({ doc, url })} />
              )
            ) : null}
            <div className={styles.documentActions}>
              {url && allowDownload ? <a href={url} target="_blank" rel="noreferrer">Preview</a> : null}
              {url && !allowDownload ? (
                <button
                  type="button"
                  onClick={() => setOpenDoc({ doc, url })}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
                >
                  Open larger preview
                </button>
              ) : null}
              {!url ? <small>No file URL</small> : null}
              {url && allowDownload ? <a download={doc.fileName || true} href={downloadUrl}>Download</a> : null}
            </div>
          </div>
        );
      }) : <p>{emptyText}</p>}

      {openDoc ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenDoc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(900px, 100%)',
              height: 'min(85vh, 900px)',
              background: '#111',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <strong style={{ color: '#fff', fontSize: '14px' }}>{openDoc.doc.fileName || 'Document preview'}</strong>
              <button
                type="button"
                onClick={() => setOpenDoc(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <RestrictedPreview doc={openDoc.doc} url={openDoc.url} watermarkText={watermarkText} large />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
